---
title: "从\"邀请码有误\"到二进制 Patch：一次 Tauri 逆向实践"
slug: re-on-wukong
translationKey: re-on-wukong
date: 2026-03-18T22:57:34+08:00
source: yuque/penetration
---

拿到一款内测应用- Wukong，打开一看——弹出一个邀请码输入框。





邀请码？

<font style="color:#74B602;">我今天没搞到邀请码……</font>

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773846111194-bc1d7f39-3c08-42c1-8842-c66f7f098e2d.png)

大多数人到这儿就放弃了。

我的第一反应是：**这玩意是怎么实现的？**

****

没想到这一研究，就花光了整个Coding Plan Pro套餐的额度。

---

## 一、初步探索
拿到一个要破解的目标，第一步是搞清楚它的架构。

```bash
file Wukong.app
# Mach-O ARM64 executable, 117MB
```

`strings` 一跑，满屏的 Rust 符号——`DingTalkReal::dingtalk_core::login`、`LoginModule`、`LoginPhase`……

这不是普通应用，是一个 **Tauri 2.x 应用**：Rust 后端 + Web 前端（WKWebView）。

邀请码验证可能在两个地方：

1. 前端——纯 JS 检查
2. 后端——Rust 状态机

试了试改 localStorage，没用。前端资源根本不在 Resources 里，是通过 IPC 动态加载的。

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773846101654-e3f5bb27-d002-4dd9-ba88-756fdfcca286.png)

答案在后端。

---

## 二、定位目标
用 `nm` 列出符号表，锁定了一个函数：

```bash
on_invite_code_validated
```

这就是"邀请码验证"的 Tauri 命令。地址是 `0x1020376b4`。

光找到函数不够，还得理解它的逻辑。

ARM64 汇编我之前也不熟——但没关系，只需要找到关键的几行：

```bash
1020376d0: ldr  x8, [x0, #0x180]    ; 加载内部对象指针
1020376d4: mov  w9, #0x1              ; w9 = 1 (true)
1020376d8: stlurb w9, [x8, #0x10]   ; 原子存储到标志位
```

这就是设置「邀请码已验证」标志的代码。

---

## 三、Patch 思路
找到了设置标志的代码，思路就清晰了：

**简化这个函数，让它直接设置标志并返回，跳过所有验证逻辑。**

Patch 字节：

```bash
08 c0 40 f9 29 00 80 52 09 01 01 19 c0 03 5f d6
```

对应汇编：

```bash
ldr x8, [x0, #0x180]
mov w9, #1
stlurb w9, [x8, #0x10]
ret
```

但这只是其中一个函数。后来发现，还需要 patch 其他几个函数才能完整绕过——这是一个**多层验证体系**：

| 函数 | 作用 |
| --- | --- |
| `on_invite_code_validated` | Tauri 命令入口 |
| `LoginManager::on_invite_code_validated` | 实际设置标志 |
| `is_agentbay_environment` | AgentBay 环境检测 |
| `get_launch_mode` | 启动模式 |


---

## 四、实战：命令行一条路走到底
不想用 Hopper，不想开 GUI。命令行走到底。

```bash
#!/bin/bash
BINARY="/Applications/Wukong.app/Contents/MacOS/DingTalkReal"

# 备份
cp "$BINARY" "DingTalkReal.backup"

# Patch 1: Tauri 命令直接返回成功
printf '\x00\x00\x80\x52\xc0\x03\x5f\xd6' | \
dd of="$BINARY" bs=1 seek=$((0x12eaa04)) conv=notrunc

# Patch 2: 简化验证逻辑
printf '\x08\xc0\x40\xf9\x29\x00\x80\x52\x09\x01\x01\x19\xc0\x03\x5f\xd6\x1f\x20\x03\xd5\x1f\x20\x03\xd5\x1f\x20\x03\xd5\x1f\x20\x03\xd5' | \
dd of="$BINARY" bs=1 seek=$((0x20376b4)) conv=notrunc

# 签名——macOS 必须
codesign --sign - --force "$BINARY"
```

核心思想就一句：**用 **`printf`** 写字节，用 **`dd`** 定位偏移，用 **`codesign`** 重新签名。**

---

## 五、踩坑记录
### 坑1：偏移量计算
拿到虚拟地址 `0x1020376b4`，怎么换算成文件偏移？

Macho-O 的 __TEXT 段从 `0x100000000` 开始，文件偏移是 0。所以：

```bash
文件偏移 = 虚拟地址 - 0x100000000
```

但这是针对 __TEXT 段的。不同段有不同的基址，得用 `otool -l` 查看段表。



### 坑2：版本升级后地址全变了
应用更新后，函数地址全部改变：

| 函数 | 旧版偏移 | 新版偏移 |
| --- | --- | --- |
| on_invite_code_validated | 0x12eaa04 | 0x2b16c |
| LoginManager | 0x20376b4 | 0xfca10 |


解决方案：用 `nm` 重新定位函数，重新计算偏移。





### 坑3：macOS 代码签名
Patch 后应用打不开——代码签名被破坏了。

```bash
codesign --remove-signature "$BINARY"
codesign --sign - --force "$BINARY"
```

---

## 六、结果与反思
最终成功绕过邀请码验证。

但有意思的是：**绕过前端只是第一步**。应用虽然能进主界面了，后端服务（模型列表获取）依然不可用——这说明真正的验证逻辑在服务器端，邀请码是用来绑定账户的。

这次经历教会我几件事：

一、Tauri 应用的安全边界——核心逻辑在后端，别迷信「绕过前端就等于破解」

二、ARM64 逆向没有想象中那么难——多查手册，多动手

三、命令行工具的力量——`nm` + `xxd` + `strings` 组合起来，不比 IDA 差多少

---

## 技术附录
**关键工具**：`nm`、`xxd`、`strings`、`otool`、`codesign`

**ARM64 常用指令**：

| 指令 | 机器码 |
| --- | --- |
| `mov w0, #0` | `00 00 80 52` |
| `mov w0, #1` | `20 00 80 52` |
| `ret` | `c0 03 5f d6` |


**核心发现**：邀请码验证在 Rust 状态机中实现，前端只是展示层。



最终效果：能进去， 但操作不了～～

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773846091081-dfecc4ca-e2c4-49df-bbb5-7ae51f07145b.png)



![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773846398868-41d9e6c0-c8d3-4ffb-beaa-e2c95a73479b.png)

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773846403803-cb316f54-9fad-4f1f-be7f-b723e80630a8.png)









