---
title: "[SOC]使用Suricata防御Apereo CAS反序列化攻击"
slug: bisq5a5zs2oarfkk
translationKey: bisq5a5zs2oarfkk
date: 2023-08-08T19:33:47+08:00
source: yuque/penetration
tags:
  - 运行时安全
---

# 一、漏洞的攻击特征
漏洞的成因，是因为反序列化了用户的不可信输入，其中涉及到硬编码的key

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691496731902-020166e5-8872-4178-adfe-0251f20e8534.png)

攻击者，可以利用目标机器上已有的反序列化gadgets，执行恶意的操作。



下面分别介绍一下正常、攻击的流量特征

1. 普通的登录请求。

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691496391175-15f1bdf0-393e-4c5f-af63-cd0d79a90550.png)



请求

execution长度：1121

响应

响应码：200

响应长度：7287





2. **恶意利用-无回显利用**

请求

execution长度：2203

响应

响应码：500

响应长度：1399



![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691497489389-1e367da5-44f2-425c-a898-985c35dab83b.png)

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691497576329-0942fde6-d42f-4581-aa40-7cf5fb8b7762.png)





3. **恶意利用-有回显利用**

请求

execution长度：3029

响应

响应码：200

响应长度：~，跟执行的命令有关

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691496451301-97af7dd0-f53b-4d6c-91d0-d73dfe243969.png)



|  | **正常登录请求** | **攻击请求** | |
| --- | --- | --- | --- |
| **指标** | **** | **无回显利用** | **有回显利用** |
| HTTP请求-execution长度 | 1121 | <font style="background-color:#FBDE28;">2203</font> | <font style="background-color:#FBDE28;">3029</font> |
| HTTP响应状态码 | 200 | <font style="background-color:#FBDE28;">500</font> | 200（根据实际情况） |
| HTTP响应长度（Content-Length） | 7286<br/>不同语言不一样（中文英文） | 1399 | ~（根据实际情况） |






# 二、NTA的检测思路（Suricata）
NTA流量识别，通过HTTP请求、响应来判断是否为攻击特征，主要有下面2种思路。

## 思路一：异常会话特征
从「第一节」的漏洞攻击特征来看，攻击流量、正常请求流量的确有一些不同。

检测逻辑

1. 筛选【特定uri，如`/cas/login`】 +【POST execution关键字】
2. 若Http流量满足“异常会话”特征，则认为是疑似攻击流量。



异常会话特征总结：

+ **HTTP请求参数中的execution长度不同**。攻击请求execution长度，比正常请求大，约为2倍+。
+ **HTTP响应的状态码不同。**攻击请求的响应状态码，跟普通的响应状态码不同，漏洞利用的状态码是500。
+ **HTTP响应的内容不同**。
    - 在无回显的利用场景下，无论利用成功与否，响应正文中均会出现”error“等关键字。

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691502470049-95a052d5-c2f4-410f-9bcd-b605465c7858.png)



    - 此外，在有回显的利用场景下，响应正文甚至会缺少必要的title、css等信息。左边为攻击的HTTP响应

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691502441907-e1b480a0-c096-408b-a393-da47c0aa55b3.png)





## 思路二：解密检测
从流量上看，该漏洞的利用，没有明显的关键字特征，这是因为漏洞利用的字节流被AES加密。

不过，如果有条件解密execution的值，可以通过ysoserial默认的特征，检测攻击请求。

这里梳理下大概的思路

1. 筛选出CAS的请求，条件：【特定uri，如`/cas/login`】 +【POST execution关键字】
2. 尝试解密execution的值。这里依次经过`URLDecode`->`Base64_Decode`->`AES_Decode`，此时在攻击场景下，我们可得到Java字节流
3. 检测该字节流是否为恶意，例如通过刚刚提到的ysoserial关键字；当然，黑名单关键字的列表可以扩充。

![一般的攻击请求，解出来的字节码](https://cdn.nlark.com/yuque/0/2023/png/166008/1691501306095-349deeba-1d5c-4ebc-846a-fc32676f0a0c.png)



之所以能够这样，是因为

+ 目前的攻击手法大多基于ysoserial工具进行魔改，其默认类名包含`ysoserial`关键字。
+ 因此，在**解密**得到的二进制流中，若包含`ysoserial`关键字，可作为检测指标之一。
+ 检测解码的代码参考：https://github.com/MrMeizhi/ysoserial-mangguogan#saveDecode函数

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691499271528-c7bf106b-fddf-46d8-b9b4-22f3c31bdb72.png)





此外，除了黑名单，正常请求的特征我们也可以作为判断依据。正常请求的数据也可以被解密，解密结果如下图所示，包含username、password等关键字，可作为白名单的判断依据，凡是不包含这个的，都认为是恶意的。

![正常登录请求，解出来的字节码](https://cdn.nlark.com/yuque/0/2023/png/166008/1691501181625-54aa5ec8-46e8-4143-8842-3a33f0bf860b.png)



下一个问题又来了，Suricata如何解密流量？通过查阅Suricata的手册，发现Suricata支持用lua脚本自定义检测逻辑。

> Suricata支持Lua脚本，Suricata 提供了在特定类型上获得更详细输出的可能性，通过可插拔 Lua 脚本的网络流量。您可以自己编写这些脚本，只需要定义四个挂钩函数。
>

代码实现，可参考下面这些材料

+ 案例#1：[https://www.freebuf.com/sectool/218951.html](https://www.freebuf.com/sectool/218951.html)
+ 案例#2：[https://www.trustwave.com/en-us/resources/blogs/spiderlabs-blog/decoding-hancitor-malware-with-suricata-and-lua/](https://www.trustwave.com/en-us/resources/blogs/spiderlabs-blog/decoding-hancitor-malware-with-suricata-and-lua/)
+ 案例#3：[https://suricon.net/wp-content/uploads/2016/11/SuriCon2016_ChrisWakelin.pdf](https://suricon.net/wp-content/uploads/2016/11/SuriCon2016_ChrisWakelin.pdf)
+ 官方手册：[https://docs.suricata.io/en/latest/rules/lua-detection.html#lua-detection](https://docs.suricata.io/en/latest/rules/lua-detection.html#lua-detection)
+ 可能有用的编码、解码函数：
    - [https://github.com/Lyafei/lua-aes](https://github.com/Lyafei/lua-aes)
    - [https://blog.csdn.net/MakerCloud/article/details/85206565](https://blog.csdn.net/MakerCloud/article/details/85206565)



---

# 其他建议
1. 就这个漏洞而言，本身属于组件类漏洞，及时升级就可以避免安全风险。
2. 本漏洞属于反序列化漏洞，从Web侧，难以获取完整的上下文信息，更适合使用RASP等主机类安全方案

Apereo CAS（Central Authentication Service）是一个非常重要的认证中心，其安全性也至关重要，而且由于其资产数量少，部署难度相对更低，更适合上RASP等方案。





某RASP的检测截图

![](https://cdn.nlark.com/yuque/0/2023/png/166008/1691505116457-4a5ff547-49d5-4b98-bc96-d921041dab3b.png)



