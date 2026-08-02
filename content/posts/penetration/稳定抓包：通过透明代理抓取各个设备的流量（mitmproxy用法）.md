---
title: "稳定抓包：通过透明代理抓取各个设备的流量（mitmproxy用法）"
slug: lsqvp3qo4b2z8ro6
date: 2023-11-24T23:20:13+08:00
source: yuque/penetration
tags:
  - 红队
---

教程参考

+ [https://blog.csdn.net/zhuxian1277/article/details/111875951](https://blog.csdn.net/zhuxian1277/article/details/111875951)



# 使用场景
**<font style="color:rgb(44, 44, 54);">mitmproxy</font>**<font style="color:rgb(44, 44, 54);"> 是一个功能强大的中间人代理工具，它允许你拦截、查看和修改客户端和服务器之间的流量。其透明代理模式使得 mitmproxy 在特定场景中非常有用，尤其是在需要对网络流量进行分析或测试时，而无需更改目标设备上的任何设置。</font>

+ **<font style="color:rgb(44, 44, 54);">无需配置代理</font>**<font style="color:rgb(44, 44, 54);">：与 Burp Suite 不同的是，mitmproxy 在透明模式下工作时不需要在目标机器上手动设置 HTTP 或 HTTPS 代理。这意味着最终用户或测试对象不会察觉到代理的存在，减少了人为干预的可能性。</font>
+ **<font style="color:rgb(44, 44, 54);">安装证书</font>**<font style="color:rgb(44, 44, 54);">：尽管在透明模式下不需要配置代理，但为了拦截和解密 HTTPS 流量，仍然需要在目标机器上安装 mitmproxy 的根证书。这一点与 Burp Suite 类似，因为两者都需要处理 SSL/TLS 握手来查看加密流量。</font>
+ <font style="color:rgb(44, 44, 54);">通过 MitmWeb，可以在本机查看抓取的包，使用方式上跟 Burp 没有多大差异。</font>



![mitmweb](https://cdn.nlark.com/yuque/0/2024/png/166008/1734491587977-7e5e72eb-8876-42f3-9d76-c20ff914b72d.png)  


# 常用命令
替换资源

```bash
 mitmproxy --mode reverse:http://xxxx:8888/ -p 8888 -k --map-remote "|https://xxxx:9201|- http://10.100.15.44:8888
```



替换正文body

```bash
mitmproxy --mode reverse:http://xxxx:2881/ -p 2881 -k \
 --modify-body '/13883797080/13866667080' \
 --modify-body '/17784081010/17766661010' \
  --modify-body '/13983240380/13966660380'
```



![](https://cdn.nlark.com/yuque/0/2024/png/166008/1722564229449-d1bdddbf-81a4-417a-bde4-c71cf26263cf.png)

# 网关机器
kali

192.168.1.12



![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700839815951-8665732b-b6b6-4f8a-925c-fa468b049b33.png)



## 网络配置
### 内核转发
```bash
# 开启内核路由转发
sysctl -w net.ipv4.ip_forward=1
```

使用上述任何一种方法都不会使更改持久。为了确保新设置在重新启动后仍然有效，您需要编辑 /etc/sysctl.conf 文件。

vim /etc/sysctl.conf

将以下行之一添加到文件底部，具体取决于您想要关闭还是打开 Linux IP 转发。然后，保存对此文件的更改。该设置在重新启动后将是永久的。   


```bash
net.ipv4.ip_forward = 0
OR
net.ipv4.ip_forward = 1
```

编辑文件后，您可以运行以下命令以使更改立即生效。

```bash
sysctl -p
```



### iptables转发
只转发80/443的流量

```bash
# 重定向所有到达 80 和 443 端口的 TCP 流量到 mitmproxy 的端口（假设 mitmproxy 在 8080 端口运行）
sudo iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 80 -j REDIRECT --to-port 8080
sudo iptables -t nat -A PREROUTING -i eth1 -p tcp --dport 443 -j REDIRECT --to-port 8080

```





转发特定IP的流量

```bash
 iptables -t nat -A PREROUTING -i eth1 -p tcp -s 192.168.1.112 -j REDIRECT --to-port 8080

```





check iptables rules确认下规则

```bash
iptables -t nat -L -n -v=
```

## mitm录制
```bash
mitmweb -p 8080 --listen-host 0.0.0.0  --web-port 88 --web-host 0.0.0.0 --mode transparent --showhost

```

+ 在web端左上角file，可以保存为flows文件以便下次使用



## mitm<font style="color:rgb(54, 54, 54);">服务器端</font>重放
模拟一个Server端，重放刚刚的请求

mitmproxy的另一个强大功能是重放以前的流量。支持服务器端重播：mitmproxy重播与较早记录的请求匹配的请求的服务器响应。

`<font style="color:rgb(74, 74, 74);">--server-replay</font>`<font style="color:rgb(74, 74, 74);">选项使我们可以从保存的HTTP对话中重播服务器响应。</font>

+ <font style="color:rgb(74, 74, 74);">为此，我们使用一组启发式方法将传入请求与保存的响应进行匹配。</font>
+ <font style="color:rgb(74, 74, 74);">默认情况下，当将传入请求与重放文件中的响应进行匹配时，我们将排除请求头，并且仅使用</font><font style="color:rgb(74, 74, 74);background-color:#FBDE28;">URL和请求方法</font><font style="color:rgb(74, 74, 74);">进行匹配，这在大多数情况下都有效，并且可以在请求头自然会变化的情况下重放服务器响应，例如使用不同的用户代理。</font>

```bash
itmweb -p 8080 --listen-host 0.0.0.0  --web-port 88 --web-host 0.0.0.0 --mode transparent --showhost \
--server-replay-refresh \
--server-replay-nopop \
--server-replay-kill-extra \
--set server_replay_ignore_content=true \
--server-replay ./PrivateServer-Mock-2.flows 
```

选项解释

Server Replay:

| -server-replay PATH, -S PATH<br/>                        <br/> <br/> <br/>  | 从保存的文件重播服务器响应。可多次通过。 |
| --- | --- |
| ** --server-replay-kill-extra**<br/>** --no-server-replay-kill-extra**                        | 在重放期间，如果没有找到可重放的响应，那么杀死额外的请求 |
| **  --server-replay-nopop**<br/> --no-server-replay-nopop<br/>**<u></u>**<br/>                        | 在重放某个响应后，不从服务器删除这个流，如果你需要多次重放相同的响应需要打开。<br/>这对选项的含义有点绕，双重否定。 |
| **  --server-replay-refresh**<br/> --no-server-replay-refresh<br/>**<u></u>**<br/>                         | 在重放期间，自动调整响应中的日期， expires和last-modified标头，以及调整cookie到期时间 |
| --set server_replay_ignore_content=true | 设置`server_replay_ignore_content`，不把body作为重放的依据——只看Http方法+URL<br/>后记：我是怎么知道有这个选项的呢？<br/>+ `mitmweb  --options  |grep server_replay`<br/>+ mitmweb控制台-options选项可看到<br/>![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700883349591-7924e6b1-d589-4a00-a783-12851d21abee.png)<br/>                                    |


 

# 目标设备
### 安装证书
在需要抓包的设备上配置网关，访问 `http://mitm.it/` 安装证书文件并信任

1. 更改默认网关：

打开“网络和共享中心”。

点击“更改适配器设置”。

右键点击您正在使用的网络适配器，选择“属性”。

双击“Internet 协议版本 4 (TCP/IPv4)”。

选择“使用下面的 IP 地址”并填写相应的 IP 信息。在“默认网关”字段中，输入您的 Kali Linux 机器的 IP 地址。

2. 安装 mitmproxy 证书：

从 mitmproxy 获取根证书。通常，您可以从 http://mitm.it 访问并下载证书。

在 Windows 上安装证书：双击证书文件，选择“安装证书”，然后按照提示进行安装。

完成以上步骤后，您的 Windows 机器上的所有 HTTP 和 HTTPS 流量将通过 Kali Linux 上的 mitmproxy 进行转发和分析。记得在完成抓包分析后，将 Windows 的网络设置恢复到原始状态。

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700842025259-a03d8298-8385-4be7-890d-e223700a581e.png)





![](https://cdn.nlark.com/yuque/0/2023/png/166008/1700842106491-d32b3f22-3d0b-4a31-9558-55fd26f6604c.png)

