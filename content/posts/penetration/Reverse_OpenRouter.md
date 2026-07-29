---
title: "Reverse OpenRouter"
slug: iy7k17ehlduoblsm
date: 2026-04-26T12:10:14+08:00
source: yuque/penetration
---

通过境外服务器反向代理 OpenRouter AI API，解决区域访问限制问题。



## 背景（SCQA）
**S - 情境**

海外 AI 服务（如生图、对话等）通常通过 OpenRouter 等聚合平台提供统一 API 接入，使用方式与 OpenAI SDK 兼容。

**C - 冲突**

这些服务对中国大陆地区实施了访问限制——请求来源 IP 若被识别为中国境内，将直接拒绝服务。

**Q - 问题**

如何从中国境内正常访问 OpenRouter API，且不暴露代理服务的存在？

**A - 方案**

在美国服务器上部署 Nginx 反向代理，使所有请求以境外 IP 发出。通过自定义域名 `openrouter.ai.XXX` 访问，根路径返回伪装页面，仅 `/api/v1` 路径提供代理服务。



## 部署
[https://github.com/hi-unc1e/reverse_openrouter](https://github.com/hi-unc1e/reverse_openrouter)





```bash
docker build -t openrouter-proxy .
docker run -d -p 80:80 --restart unless-stopped openrouter-proxy

```



## 使用
将 API 地址改为代理域名即可，API Key 不变：

+ **iOS**：[Kelivo](https://apps.apple.com/cn/app/kelivo/id6752122930) — 设置中填入自定义 API 地址 `https://openrouter.ai.XXX/api/v1` 及 OpenRouter API Key
+ **Android**：[Rikka Hub](https://docs.rikka-ai.com/)（暂未配置）

代码调用同理：

```python
client = OpenAI(
    base_url="https://openrouter.ai.XXX/api/v1",
    api_key="<YOUR_OPENROUTER_KEY>",
)
```



最终效果，🐶

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1777176723980-1d180b2e-b08f-48bf-a857-9089c9d5f437.png)



