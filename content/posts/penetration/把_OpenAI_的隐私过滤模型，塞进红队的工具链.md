---
title: "把 OpenAI 的隐私过滤模型，塞进红队的工具链"
slug: openai-privacyfilter-into-redteam
date: 2026-04-25T11:11:28+08:00
source: yuque/penetration
tags:
  - Agent
  - 红队
---

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1777302701535-625c20f6-3b1b-4d69-8060-c6cfaca61d29.png)



> 红队安全工具 — 将 OpenAI Privacy Filter 改造为 PII 结构化
>
> 提取 HTTP 网关
>



OpenAI 开源了一个叫 Privacy Filter 的小模型，能从非结构化文本里识别姓名、邮箱、电话、地址这些 PII。



![](https://cdn.nlark.com/yuque/0/2026/png/166008/1777301197503-5cec4ca4-265a-4705-82b4-c2ca7e2d84e0.png)



我花了一晚上，把它改造成了一个 HTTP 网关服务，跑在 NVIDIA L20 上，双进程推理峰值 81 RPS，GPU 利用率干到了 98%。



![随手截的图，当时还没有跑满 GPU](https://cdn.nlark.com/yuque/0/2026/png/166008/1777301249017-2eb439a1-6e7b-477c-ad75-97661e5b9d62.png)



这篇文章记录整个调研过程：从原始项目到生产级网关，中间踩了什么坑，最终性能天花板在哪里。



虽然X 上[已经有人跑了一版](https://x.com/chiefofautism/status/2047582480140562542)，不过我相信我们这个版本是更好的，不但是因为把 Codex 窗口跑满了，还是因为[参考项目做了优化](https://github.com/hi-unc1e/pii-span-extractor/blob/codex/extract-demo-benchmark/lesson-from-privacy-parser.md)。

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1777302076718-d7137aba-d7a5-4742-8a32-e73e2341d258.png)



## 为什么需要一个 PII 网关
红队在做 LLM 安全评估时，经常碰到一个问题：测试用例里带了大量真实 PII。要么是业务数据不小心混进了 prompt，要么是模型输出里泄露了训练数据中的隐私信息。OpenAI 的 [privacy-filter](https://github.com/openai/privacy-filter) 本身就能做 PII 脱敏——输入一段文本，输出把姓名、邮箱、电话替换成 `<PRIVATE_PERSON>` 之类的占位符。如果你只是要在网关层拦一道，把敏感信息洗掉再放行，官方项目直接用就行。



但红队场景需要的不是"帮我遮住"，而是**告诉我****<font style="color:#DF2A3F;"> </font>****PII 在哪个位置 **——具体来说，我们需要一个**标注**能力：

把非结构化文本里的敏感信息转成结构化 span——每个 span 带上类别标签（label）、原文片段（text）、起止位置（start / end offset）。有了这些结构化数据，才能做后续的安全分析、分类分级、合规审计。脱敏只是最后一步，标注才是上游。



![](https://cdn.nlark.com/yuque/0/2026/webp/166008/1777303023289-57b33888-2e18-4da7-a43b-71e029ac94da.webp)



原始项目没有这个能力。它是个 Python 库，只暴露了 `/redact` 接口，没有 HTTP 服务，没有并发处理。



所以我的目标是：**在脱敏的基础上，新增一个面向标注和提取的推理服务，测出真实的性能上限，判断能不能上生产。**



## 从 Python 库到 HTTP 服务
原始项目的核心是一个基于 transformer 的序列标注模型。输入一段文本，输出每个 token 的隐私标签。模型本身不大，参数量级在几十 MB。



我的改造思路很简单：保留上游的运行时和模型权重，只替换 HTTP 层。具体做了几件事：

+ **提取优先 API**：原始项目只有 `/redact`（脱敏），我加了 `/extract`（提取），<font style="color:#DF2A3F;">直接返回结构化 span——label + text + start offset + end offset。红队需要的不是"帮我脱敏"，而是"告诉我哪些位置有 PII"。</font>
+ **混合后处理**：加了 label-aware 合并（处理姓名、地址的边界问题）、regex 回补（兜底 URL、secret、账号）、标点修剪。组合起来叫 hybrid 模式，exact F1 从 baseline 的 0.923 提到了 **1.0000**。
+ **Docker 化**：基于上游镜像构建，不重新打包模型层。`docker pull` 拉下来就能跑，首次启动不需要额外下载。
+ 

部署命令：

```bash
# GPU 模式
docker run -d \
  -p 8000:8000 \
  --gpus all \
  -e OPF_DEVICE=cuda \
  -e OPF_OUTPUT_MODE=typed \
  --name pii-span-extractor \
  ghcr.io/hi-unc1e/pii-span-extractor:latest
```

```bash
# CPU 模式（验证用）
docker run -d \
  -p 8000:8000 \
  -e OPF_DEVICE=cpu \
  -e OPF_OUTPUT_MODE=typed \
  --name pii-span-extractor \
  ghcr.io/hi-unc1e/pii-span-extractor:latest
```

提取示例：

```bash
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "My name is Alice Smith and my email is alice@example.com. Call me at 555-123-4567.",
    "include_text": true,
    "merge_adjacent": true,
    "merge_strategy": "label_aware",
    "enable_regex_backstop": true,
    "trim_punctuation": true
  }'
```

返回：

```json
{
  "schema_version": 1,
  "extracted_spans": [
    {
      "label": "private_person",
      "start": 11,
      "end": 22,
      "text": "Alice Smith"
    },
    {
      "label": "private_email",
      "start": 39,
      "end": 56,
      "text": "alice@example.com"
    }
  ]
}
```

到这里，服务能跑了。但"能跑"和"能用"之间还差一个关键问题：**并发性能到底行不行？**

****

## 并发压测：单进程不够，双进程刚好
测试环境是阿里云上的一台 NVIDIA L20（46 GB 显存）。这台卡一天一百多块钱，属于生产级 GPU 里性价比不错的。

我写了一个阶梯并发压测脚本，从并发 1 到 12 逐档加压，每档跑 20 秒，同时用 `nvidia-smi` 采样 GPU 利用率和显存。

### 单 worker 基线
默认 uvicorn 只启动一个 worker 进程。结果：

| 并发 | RPS | 平均延迟 | P50 | GPU 利用率 | 显存 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 62.9 | 15.9 ms | 16.0 ms | 39 % | 3.5 GB |
| 2 | 71.9 | 27.8 ms | 27.4 ms | 44 % | 3.7 GB |
| 4 | 60.4 | 66.2 ms | 66.1 ms | 40 % | 3.7 GB |
| 6 | 43.2 | 138.8 ms | 139.2 ms | 27 % | 3.7 GB |
| 12 | 38.2 | 313.6 ms | 313.6 ms | 29 % | 3.7 GB |


峰值在并发 2，~72 RPS。但 GPU 利用率最高才 44%，显存只用了 3.7 GB / 46 GB。

**GPU 根本没跑满。** 瓶颈不在算力，在于单进程的推理调度——GPU 大部分时间在等 CPU 喂数据。



### 双 worker：GPU 利用率拉到 98%
解决思路很直接：既然一个进程喂不饱 GPU，那就跑两个。uvicorn 加 `--workers 2`，两个进程各加载一份模型（显存翻倍到 ~7.3 GB，L20 46 GB 完全扛得住），共享同一块 GPU，内核级并行调度。

| 并发 | RPS | 平均延迟 | P50 | GPU 利用率峰值 | 显存 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 75.4 | 26.5 ms | 26.5 ms | 82 % | 7.1 GB |
| **4** | **80.6** | **49.6 ms** | **51.4 ms** | **91 %** | **7.2 GB** |
| 6 | 66.8 | 89.7 ms | 99.0 ms | 98 % | 7.2 GB |
| 8 | 61.6 | 129.6 ms | 157.0 ms | 95 % | 7.2 GB |
| 12 | 54.9 | 217.9 ms | 293.4 ms | 97 % | 7.3 GB |


对比单 worker：

+ 吞吐从 72 RPS 提升到 **81 RPS**（+12%）
+ GPU 利用率峰值从 44% 拉到 **98%**
+ 显存从 3.7 GB 增加到 7.3 GB，完全在 L20 承受范围内

**最优工作点在并发 4**：81 RPS，延迟 ~50 ms，GPU 利用率 91%。对于 PII 检测这种场景，50 ms 的额外延迟完全可以接受。





### 踩过一个坑：Triton 编译
启 GPU 模式时碰到过一个坑。OPF 模型用了 Triton 加速 CUDA 内核，而 Triton 首次运行时需要用 GCC 编译。原始 Dockerfile 用了 `--no-install-recommends`，只装了 gcc 没装 `libc6-dev`，导致 `stdlib.h` 找不到，编译失败。

修复方法：Dockerfile 里 `gcc libc6-dev` 一起装。这个问题在 CPU 模式下不会出现，只有 GPU 模式才会触发，容易被忽略。



## 硬件选型：L20 有点浪费
跑完压测有一个明显的感受：**这个模型太轻了，L20 跑它有点浪费。**

满载时 GPU 利用率也就 50-65%（平均），显存只用了 16%。模型推理的计算量很小，瓶颈更多在调度和数据搬运。对 PII 网关这个场景：

+ **L4 / A10G** 这类入门级 GPU 就够用了，成本更低
+ **L20** 适合需要同时跑多个模型实例、或者吞吐要求更高的场景
+ **纯 CPU** 能跑，适合低频离线任务，但吞吐会差一个量级

如果只是给红队的测试流量过一道 PII 检测，一台 L4 完全够了。L20 的 46 GB 显存，跑这个模型只用了零头。

## 支持 8 种 PII 类别
最后列一下模型支持检测的标签：

+ `private_person`——姓名
+ `private_email`——邮箱
+ `private_phone`——电话
+ `private_address`——地址
+ `private_url`——URL
+ `private_date`——日期
+ `account_number`——账号
+ `secret`——密钥、token、密码

对于红队场景，`secret` 和 `account_number` 的检测价值最高——这两个类别覆盖了 API key、access token、银行卡号等常见敏感信息，也是合规审计中最容易被忽略的。



## So What
如果你在做 LLM 安全评估或者 AI 网关，三件事值得做：

1. **出向加一道 PII 检测**。模型输出里有 PII 不是小概率事件，特别是在 RAG 场景下。延迟成本 ~50 ms，收益是避免一次数据泄露事件。
2. **不要高估硬件需求**。这个模型在 L4 上就能跑满，不需要 A100。先把服务跑起来，再根据实际吞吐决定是否升配。
3. **提取比脱敏更有用**。红队需要知道"哪里有问题"，而不是"帮我遮住问题"。结构化 span 输出比替换成 `<PRIVATE_PERSON>` 更适合做后续分析。



项目在这里：[github.com/hi-unc1e/pii-span-extractor](https://github.com/hi-unc1e/pii-span-extractor)



Docker 镜像一行拉起：`docker pull ghcr.io/hi-unc1e/pii-span-extractor:latest`



有兴趣的可以自己跑一遍压测。



亲手试过，才知道 81 RPS 是什么概念。







