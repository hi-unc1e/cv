---
title: "红队必备！Frp反溯源增强版"
slug: np5v8tglxw95ztmk
translationKey: np5v8tglxw95ztmk
date: 2025-04-14T21:03:41+08:00
source: yuque/penetration
tags:
  - 红队
---

frp 是个很棒的工具，高性能、稳定，值得使用。

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1744648570174-90104017-d254-443e-82bf-fbcaec371323.png)



但是，其配置文件经过2个版本的更迭（`.ini` ->`.toml`），其中的选项，对于新人来说稍显复杂。



很多时候，项目时间紧、任务重，短时间内不一定能搞清楚这些选项的含义。



因此便有了此文——本文写于 2025 年 4 月 14 日，目前适用的 frp 版本为：[https://github.com/fatedier/frp/releases/tag/v0.61.2](https://github.com/fatedier/frp/releases/tag/v0.61.2)



本文会主要介绍：

1. 基础篇：frp 是啥，咋使用
2. 实战篇：如何用 frp 搭建一个比较安全的内网隧道
3. 进阶篇：如何在 frpc 端隐藏参数配置



# FRP基础
访问 frp 页面，下载对应发行版[https://github.com/fatedier/frp/releases/tag/v0.61.2](https://github.com/fatedier/frp/releases/tag/v0.61.2)

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1744637271058-2a49012a-67b9-42fc-80f3-93bcaba1c6af.png)



![](https://cdn.nlark.com/yuque/0/2025/png/166008/1744637310545-744056c7-0670-4a5d-a484-bc2a527e0a17.png)



不多写了。其它的基础知识如果还不清楚，请直接查看原文：[https://www.catcolia.com/blog/202411071542/](https://www.catcolia.com/blog/202411071542/)





# 简单起个内网隧道：socks5 代理
## 服务端
服务端需要建立一个监听端口，让目标机器反连访问。



假设服务端的公网IP地址是 `<font style="color:#DF2A3F;">vps_ip</font>`

```toml
bindPort = 7000
auth.method = "token"
auth.token = "TOKEN_IS_HARD_To_Guess"
transport.maxPoolCount = 5

```

启动命令：

```bash
frps -c ./frps.toml
```



+ 完整语法请参考：[frps_full_example.toml#L7](https://github.com/fatedier/frp/blob/dev/conf/frps_full_example.toml#L7)





## 客户端


客户端配置

```toml
serverAddr = "vps_ip"
serverPort = 7000

auth.method = "token"
auth.token = "TOKEN_IS_HARD_To_Guess" 
loginFailExit = false

[[proxies]]
name = "plugin_socks5_01"
type = "tcp"
remotePort = 60101

[proxies.plugin]
type = "socks5"
username = "USER"
password = "PASS"
```

+ 完整配置语法请参考[frpc_full_example.toml](https://github.com/fatedier/frp/blob/dev/conf/frpc_full_example.toml)





客户端执行命令

```bash
frpc -c frpc.toml
```



解释：

+ `frp**s.**toml`、`frp**c**.toml`的`auth.token`应该完全一致，这是认证的密码
+ `loginFailExit = false`很重要，它的含义是：# `如果第一次登录时失败，就退出程序，否则连续重新连接frps`——对于打内网是非常关键的，务必确保设置为`false`。
+ `remotePort = 60101`，表示在服务器端监听一个端口，作为 socks5 的代理端口
+ 为socks5 代理设置了账号、密码。





用法

这里以 curl 为例，其它地方配置同理。

```toml
curl -x socks5://USER:PASS@vps_ip:60101  http://172.16.1.1:80
```



```toml
curl -x socks5://USER:PASS@vps_ip:60101  http://4.ipw.cn
```





提示：

还可以增加

```bash
# If true, traffic of this proxy will be encrypted, default is false
transport.useEncryption = false
# If true, traffic will be compressed
transport.useCompression = false
```

例如

```bash
[common]
server_addr = ip
server_port = 27000
token = TOKEN

pool_count = 50
protocol = tcp
health_check_type = tcp
health_check_interval_s = 100

[plugin_socks]
remote_port = 27010
type = tcp

plugin = socks5
plugin_user = USER
plugin_passwd = PASS
use_encryption = true
use_compression = true
```

```bash
[common]
bind_addr = 0.0.0.0
bind_port = 27000
token = TOKEN

heartbeat_timeout = 90
max_pool_count = 100
use_encryption = true
use_compression = true
```







# <font style="background-color:rgba(255, 255, 255, 0);">二次开发：FRP 隐蔽化增强</font>
## 问题背景
:::color2
为什么要隐藏 frpc.toml ？

:::

+ 实际渗透或红队场景中，直接暴露 frpc.toml 可能泄露关键信息（如服务端 IP、端口、Token 等）。
+ 目标机器若被取证分析，明文配置文件易被发现，导致溯源风险。



正常使用会露出`frpc.toml`，里头的 ip 和 token容易被溯源。因此，我们的目标：

+ 配置隐身：避免 frpc.toml 明文存储在磁盘。
+ 防逆向加固：增加逆向分析难度。



## 解决思路
1. **方案一：二进制+配置合并**。将 frpc 可执行文件与 frpc.toml 合并为单一文件，运行时动态释放到内存或临时目录，执行后立即删除。
2. **方案二：Go 源码编译集成**。直接修改 frpc 源码，将配置硬编码到二进制中，彻底摆脱外部文件依赖。
3. **方案三：环境变量动态注入（轻量级）**。利用环境变量传递敏感参数，避免写入配置文件（需 frp 支持环境变量占位符）。



最终选择了方案二：直接修改 frpc 源码，将配置硬编码到二进制中，形成了下面的二次开发项目。



项目地址：[https://github.com/hi-unc1e/frp/blob/dev/README.md](https://github.com/hi-unc1e/frp/blob/dev/README.md)



<font style="background-color:rgba(255, 255, 255, 0);">🚀</font><font style="background-color:rgba(255, 255, 255, 0);"> 新特性：</font>

![执行时，可隐藏frpc配置文件](https://github.com/hi-unc1e/frp/raw/dev/doc/pic/embeded.png)

## <font style="background-color:rgba(255, 255, 255, 0);">🛠️</font><font style="background-color:rgba(255, 255, 255, 0);"> 功能特性</font>
**<font style="background-color:rgba(255, 255, 255, 0);">配置文件隐身技术</font>**<font style="background-color:rgba(255, 255, 255, 0);"> </font><font style="background-color:rgba(255, 255, 255, 0);">(2025.04.14)</font>

<font style="background-color:rgba(255, 255, 255, 0);">通过二进制固化（Embed）技术实现敏感配置零落地，适用于红队渗透、H行动等敏感场景。</font>

| **<font style="background-color:rgba(255, 255, 255, 0);">模式</font>** | **<font style="background-color:rgba(255, 255, 255, 0);">启动命令</font>** | **<font style="background-color:rgba(255, 255, 255, 0);">适用场景</font>** | **<font style="background-color:rgba(255, 255, 255, 0);">安全等级</font>** |
| --- | --- | --- | --- |
| <font style="background-color:rgba(255, 255, 255, 0);">隐身模式（使用内嵌配置）</font> | `<font style="background-color:rgba(255, 255, 255, 0);">./frpc_embeded</font>` | <font style="background-color:rgba(255, 255, 255, 0);">红队渗透/APT防护</font> | <font style="background-color:rgba(255, 255, 255, 0);">★★★★★</font> |
| <font style="background-color:rgba(255, 255, 255, 0);">降级模式</font> | `<font style="background-color:rgba(255, 255, 255, 0);">./frpc_embeded -c frpc.toml</font>` | <font style="background-color:rgba(255, 255, 255, 0);">常规测试/调试</font> | <font style="background-color:rgba(255, 255, 255, 0);">★★☆</font> |


## <font style="background-color:rgba(255, 255, 255, 0);">📦</font><font style="background-color:rgba(255, 255, 255, 0);"> 编译脚本</font>
```plain
# 基本用法
./build_stealth.sh <配置路径> <目标OS> <目标架构>
./build_stealth.sh  ./conf/frpc.toml linux amd64"  # darwin/windows/linux

# 编译 Linux 版
./build_stealth.sh ./01.toml linux amd64

# 编译 Windows 版
./build_stealth.sh ./02.toml windows amd64
```

### <font style="background-color:rgba(255, 255, 255, 0);">输出说明</font>
```plain
release/
├── frpc_embeded_linux_amd64       # Linux可执行文件
├── frpc_embeded_linux_amd64.toml.backup       # 配置文件备份（供查阅是哪个目标）
├── frpc_embeded_windows_arm64.exe # Windows可执行文件
├── frpc_embeded_windows_arm64.exe.toml.backup # 配置文件备份（供查阅是哪个目标）
```

## <font style="background-color:rgba(255, 255, 255, 0);">⚙️</font><font style="background-color:rgba(255, 255, 255, 0);">原理</font>
+ <font style="background-color:rgba(255, 255, 255, 0);">配置固化： 使用 Go 1.16+ 的</font><font style="background-color:rgba(255, 255, 255, 0);"> </font>`<font style="background-color:rgba(255, 255, 255, 0);">//go:embed</font>`<font style="background-color:rgba(255, 255, 255, 0);"> </font><font style="background-color:rgba(255, 255, 255, 0);">指令将 TOML 文件嵌入二进制——</font><font style="background-color:rgba(255, 255, 255, 0);"> </font>[<font style="background-color:rgba(255, 255, 255, 0);">pkg/config/load.go#L41</font>](https://github.com/hi-unc1e/frp/blob/495c589a07c36e78a434014a682885f9313ea36c/pkg/config/load.go#L41)
+ <font style="background-color:rgba(255, 255, 255, 0);">动态加载： 运行时优先检测嵌入式配置</font>

### <font style="background-color:rgba(255, 255, 255, 0);">文件结构示意图</font>
```plain
frp-src/
├── pkg/
│   └── config/
│       └── embedder/     
│           └── frpc.toml # 嵌入配置文件存放处
└── build_stealth.sh      # 编译脚本
└── release/              # 成品输出目录
```









# 彩蛋：其实 frpc 还支持命令行启动……
```bash
./frpc tcp  --uc --ue --proxy-name test --token TOKEN  --server-addr 127.0.0.1 --server-port 7001 --protocol tcp --metadatas loginFailExit=false
```





