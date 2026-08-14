---
title: "Red Team Essential! Frp Anti-Traceability Enhanced Build"
slug: np5v8tglxw95ztmk
translationKey: np5v8tglxw95ztmk
date: 2025-04-14T21:03:41+08:00
source: yuque/penetration
tags:
  - Red Team
---

frp is a great tool — high performance, stable, and worth using.

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1744648570174-90104017-d254-443e-82bf-fbcaec371323.png)



However, its configuration file has gone through two format generations (`.ini` ->`.toml`), and the options can be somewhat complicated for newcomers.



When project timelines are tight and workloads heavy, you may not have time to figure out what all these options mean in a short period.



Hence this article — written on April 14, 2025; the currently applicable frp version is: [https://github.com/fatedier/frp/releases/tag/v0.61.2](https://github.com/fatedier/frp/releases/tag/v0.61.2)



This article mainly covers:

1. Basics: what frp is and how to use it
2. Practical: how to build a reasonably secure intranet tunnel with frp
3. Advanced: how to hide the parameter configuration on the frpc side



# FRP Basics
Visit the frp releases page and download the matching distribution: [https://github.com/fatedier/frp/releases/tag/v0.61.2](https://github.com/fatedier/frp/releases/tag/v0.61.2)

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1744637271058-2a49012a-67b9-42fc-80f3-93bcaba1c6af.png)



![](https://cdn.nlark.com/yuque/0/2025/png/166008/1744637310545-744056c7-0670-4a5d-a484-bc2a527e0a17.png)



I won't write much more here. If other fundamentals are still unclear, please refer directly to the original article: [https://www.catcolia.com/blog/202411071542/](https://www.catcolia.com/blog/202411071542/)





# Quickly Setting Up an Intranet Tunnel: a socks5 Proxy
## Server Side
The server needs to open a listening port for the target machine to connect back to.



Assume the server's public IP address is `<font style="color:#DF2A3F;">vps_ip</font>`

```toml
bindPort = 7000
auth.method = "token"
auth.token = "TOKEN_IS_HARD_To_Guess"
transport.maxPoolCount = 5

```

Startup command:

```bash
frps -c ./frps.toml
```



+ For the full syntax, refer to: [frps_full_example.toml#L7](https://github.com/fatedier/frp/blob/dev/conf/frps_full_example.toml#L7)




## Client Side


Client configuration

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

+ For the full configuration syntax, refer to [frpc_full_example.toml](https://github.com/fatedier/frp/blob/dev/conf/frpc_full_example.toml)




Command to run on the client

```bash
frpc -c frpc.toml
```


Explanation:

+ The `auth.token` in `frp**s.**toml` and `frp**c**.toml` must be exactly identical — this is the authentication password
+ `loginFailExit = false` is very important. It means: # `If the first login attempt fails, exit the program; otherwise keep reconnecting to frps continuously` — this is critical for intranet work, so make sure it is set to `false`.
+ `remotePort = 60101` means the server listens on a port that serves as the socks5 proxy port
+ A username and password are set for the socks5 proxy.





Usage

Here we use curl as an example; configuration elsewhere works the same way.

```toml
curl -x socks5://USER:PASS@vps_ip:60101  http://172.16.1.1:80
```



```toml
curl -x socks5://USER:PASS@vps_ip:60101  http://4.ipw.cn
```




Tip:

You can also add

```bash
# If true, traffic of this proxy will be encrypted, default is false
transport.useEncryption = false
# If true, traffic will be compressed
transport.useCompression = false
```

For example

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






# <font style="background-color:rgba(255, 255, 255, 0);">Secondary Development: FRP Stealth Enhancement</font>
## Background
::::color2
Why hide frpc.toml?

::::

+ In real-world penetration or red team scenarios, exposing frpc.toml directly can leak critical information (such as the server IP, ports, Token, etc.).
+ If the target machine undergoes forensic analysis, plaintext configuration files are easy to discover, creating traceability risk.



Normal usage will expose `frpc.toml`, and the IP and token inside can easily be traced back to you. Therefore, our goals:

+ Configuration stealth: avoid storing frpc.toml in plaintext on disk.
+ Anti-reverse-engineering hardening: increase the difficulty of reverse analysis.



## Approach
1. **Option 1: binary + configuration merge**. Merge the frpc executable and frpc.toml into a single file, dynamically release it to memory or a temp directory at runtime, and delete it immediately after execution.
2. **Option 2: Go source-code integration**. Directly modify the frpc source, hardcoding the configuration into the binary to completely eliminate dependence on external files.
3. **Option 3: dynamic injection via environment variables (lightweight)**. Pass sensitive parameters via environment variables to avoid writing them into a configuration file (requires frp to support environment variable placeholders).



In the end, Option 2 was chosen: directly modify the frpc source and hardcode the configuration into the binary, which produced the secondary development project below.



Project address: [https://github.com/hi-unc1e/frp/blob/dev/README.md](https://github.com/hi-unc1e/frp/blob/dev/README.md)



<font style="background-color:rgba(255, 255, 255, 0);">🚀</font><font style="background-color:rgba(255, 255, 255, 0);"> New features:</font>

![Hides the frpc configuration file at runtime](https://github.com/hi-unc1e/frp/raw/dev/doc/pic/embeded.png)
## <font style="background-color:rgba(255, 255, 255, 0);">🛠️</font><font style="background-color:rgba(255, 255, 255, 0);"> Features</font>
**<font style="background-color:rgba(255, 255, 255, 0);">Configuration-file stealth technique</font>**<font style="background-color:rgba(255, 255, 255, 0);"> </font><font style="background-color:rgba(255, 255, 255, 0);">(2025.04.14)</font>

<font style="background-color:rgba(255, 255, 255, 0);">Zero on-disk footprint for sensitive configuration via binary embedding, suited to sensitive scenarios such as red team operations and H-operations.</font>

| **<font style="background-color:rgba(255, 255, 255, 0);">Mode</font>** | **<font style="background-color:rgba(255, 255, 255, 0);">Startup command</font>** | **<font style="background-color:rgba(255, 255, 255, 0);">Use case</font>** | **<font style="background-color:rgba(255, 255, 255, 0);">Security level</font>** |
| --- | --- | --- | --- |
| <font style="background-color:rgba(255, 255, 255, 0);">Stealth mode (uses embedded configuration)</font> | `<font style="background-color:rgba(255, 255, 255, 0);">./frpc_embeded</font>` | <font style="background-color:rgba(255, 255, 255, 0);">Red team ops / APT defense</font> | <font style="background-color:rgba(255, 255, 255, 0);">★★★★★</font> |
| <font style="background-color:rgba(255, 255, 255, 0);">Fallback mode</font> | `<font style="background-color:rgba(255, 255, 255, 0);">./frpc_embeded -c frpc.toml</font>` | <font style="background-color:rgba(255, 255, 255, 0);">Routine testing / debugging</font> | <font style="background-color:rgba(255, 255, 255, 0);">★★☆</font> |


## <font style="background-color:rgba(255, 255, 255, 0);">📦</font><font style="background-color:rgba(255, 255, 255, 0);"> Build Script</font>
```plain
# Basic usage
./build_stealth.sh <config path> <target OS> <target architecture>
./build_stealth.sh  ./conf/frpc.toml linux amd64"  # darwin/windows/linux

# Build the Linux version
./build_stealth.sh ./01.toml linux amd64

# Build the Windows version
./build_stealth.sh ./02.toml windows amd64
```

### <font style="background-color:rgba(255, 255, 255, 0);">Output description</font>
```plain
release/
├── frpc_embeded_linux_amd64       # Linux executable
├── frpc_embeded_linux_amd64.toml.backup       # Configuration file backup (for checking which target it belongs to)
├── frpc_embeded_windows_arm64.exe # Windows executable
├── frpc_embeded_windows_arm64.exe.toml.backup # Configuration file backup (for checking which target it belongs to)
```

## <font style="background-color:rgba(255, 255, 255, 0);">⚙️</font><font style="background-color:rgba(255, 255, 255, 0);"> How It Works</font>
+ <font style="background-color:rgba(255, 255, 255, 0);">Configuration embedding: uses the Go 1.16+</font><font style="background-color:rgba(255, 255, 255, 0);"> </font>`<font style="background-color:rgba(255, 255, 255, 0);">//go:embed</font>`<font style="background-color:rgba(255, 255, 255, 0);"> </font><font style="background-color:rgba(255, 255, 255, 0);">directive to embed the TOML file into the binary —</font><font style="background-color:rgba(255, 255, 255, 0);"> </font>[<font style="background-color:rgba(255, 255, 255, 0);">pkg/config/load.go#L41</font>](https://github.com/hi-unc1e/frp/blob/495c589a07c36e78a434014a682885f9313ea36c/pkg/config/load.go#L41)
+ <font style="background-color:rgba(255, 255, 255, 0);">Dynamic loading: at runtime, the embedded configuration is checked first</font>

### <font style="background-color:rgba(255, 255, 255, 0);">File structure diagram</font>
```plain
frp-src/
├── pkg/
│   └── config/
│       └── embedder/     
│           └── frpc.toml # where the embedded configuration file lives
└── build_stealth.sh      # build script
└── release/              # build output directory
```








# Easter egg: frpc actually also supports command-line startup...
```bash
./frpc tcp  --uc --ue --proxy-name test --token TOKEN  --server-addr 127.0.0.1 --server-port 7001 --protocol tcp --metadatas loginFailExit=false
```




