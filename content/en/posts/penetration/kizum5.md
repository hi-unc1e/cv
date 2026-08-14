---
title: "SSRF Bypass Techniques"
slug: kizum5
translationKey: kizum5
date: 2020-12-29T18:23:11+08:00
source: yuque/penetration
---

This post covers common bypass techniques for SSRF vulnerabilities under various restrictions.



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606801745441-a00a3bdb-b610-457c-9bfd-40e66863a1c3.png)

<font style="color:#8C8C8C;">(Image from</font> [SSRF Bypass Tricks](https://zhuanlan.zhihu.com/p/73736127)<font style="color:#8C8C8C;">)</font>

## 0x00    URL scheme


![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606786970656-7724da11-d2ac-4e8e-9c6e-df3c473241c0.png)

```plain
Part 1: the scheme name (ends with a single colon)
Part 2: user information, i.e. username and password (commonly used when logging into FTP)
Part 3: the host name (i.e. the domain)
Part 4: the port
Part 5: the query content, containing [path+param] — there is a bug here: only the content after the ? should count as the query!
Part 6: Fragment ID (never sent to the server!)
```

**1. Extracting the scheme name:**

It looks for where the first `:` is; if found, everything to the left of the `:` is the scheme name!

If the extracted scheme name contains characters that shouldn't be there, it is assumed that this is probably a relative `url` and what was extracted is not a scheme name!

**2. Stripping the hierarchical URL marker:**

The string `//` should be considered as following the scheme name; if this string is found, it is skipped; if not found, it is simply ignored! That is why http:baidu.com is also reachable! In browsers you can also replace the forward slashes with backslashes, `\\` instead of `//` — except in Firefox!



## 0x01    Browser parsing quirks
### 1. @
Simply put, this is how a normal web application processes the request:

First it parses the user-supplied URL with `parse_url` to obtain the host, then passes the host into `check_inner_ip` to check whether it is an intranet IP.

If the check passes, the URL is handed to the HTTP library to send the request.

So the core principle of the bypass is: the host obtained during `parse_url` is A, while the host actually used when the HTTP library (such as curl) sends the packet is B — exploiting this discrepancy to bypass `check_inner_ip`.

This discrepancy usually arises because the two use different URL parsing logic. For example, PHP sends requests via CURL, and CURL is at its core a third-party library. So PHP's own `parse_url` and CURL's internal "`parse_url`" can differ.

```plain
http://xss1.com&action=test@www.baidu.com

@External_Domain@12.0.0.1
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606787636361-893af878-6823-4797-aee9-34aa2bc33b4f.png)Chrome does not allow this!



### 2. Period
```basic
127。0。0。1 >>> 127.0.0.1
```

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606801502518-d6354dcb-6dd4-4fcb-ab9f-43fd990f6ee7.gif)

### 3. # ?
```basic
#.jpg
?.jpg
```

Truncation! See "a real-world code audit" for details

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606802208291-e92123fa-abaa-4ec1-8b9c-ede946a5661f.png)

****

## 0x02    PunnyCode
> Because operating system kernels are written in English and [DNS server](https://baike.baidu.com/item/DNS%E6%9C%8D%E5%8A%A1%E5%99%A8) resolution also exchanges English code, DNS servers do not support direct resolution of Chinese domain names. All Chinese domain names must be converted into punycode first, and then the [DNS resolution](https://baike.baidu.com/item/DNS%E8%A7%A3%E6%9E%90) resolves the punycode. The claim that all kinds of browsers perfectly support Chinese domain names just means the browser software actively performs the Chinese-domain-name auto-conversion internally, so there is no need to install a separate Chinese domain name conversion plugin to complete the process.
>
> 
>
> For example: 企鹅 (Penguin)[.com](https://baike.baidu.com/item/.com), after Punycode conversion, becomes: xn--hoq754q. com
>
> 中国.cn, after Punycode conversion, becomes: xn--fiqs8s. cn<sup></sup>
>

```plain
ⅅʳºℙˢ  -->  drops 
ʷººʸⓊⁿ       —>  wooyun
Ⓞʳℊ         —>  org

ⅅʳºℙˢ.ʷººʸⓊⁿ.ºʳℊ --> drops.wooyun.org
```



## 0x03    Numeric base conversion
`http://664552783`  =>  `http://baidu.com`

```bash
$ ping baidu.com
Pinging baidu.com [39.156.69.79] with 32 bytes of data:
```



### Decimal
39.156.69.79 => 664552783 (decimal)

### Octal
39.156.69.79 => <font style="color:#BFBFBF;">0</font>4747042517 (octal)

> **Octal** is a numeral system that uses the eight digits 0, 1, 2, 3, 4, 5, 6, 7, carries at eight, and must always begin with the digit 0.
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606801176470-ece0052a-e323-4138-8a53-7b23a526cb6a.png)

There is also an IPv6 form:

```plain
[0:0:0:0:0:ffff:127.0.0.1]
::ffff:7f00:1
0:0::1
0:0:0:0:0:0:0:0
```

As well as the special form `http://0/`

## **0x04    URL shorteners**
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606805795686-d876836d-030a-46df-a013-11e1f48457a0.png)

These actually rely on 302 redirects

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606805875854-05fab5ca-c3fe-4805-a669-a72860050d44.png)



**URL shortener services I commonly use**

```plain
suo.im
tinyurl.com
goo.gl 
...
```





## **0x05    xip.io / xip.name**
**xip.name**

It works like a kind of "forwarding" and is very handy for bypassing keyword whitelists, e.g. `if "baidu" in URL: {visit(URL);}`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606804475039-351818dd-24d8-408a-9dec-ea832a3da230.png)

****

**xip.io******

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606805558592-61d5c22b-85b7-4c54-9eeb-b1dd2b933834.png)

```plain
127.0.0.1.xip.io 								 	>>>  127.0.0.1
www.baidu.com.127.0.0.1.xip.io		>>>  127.0.0.1
...
```

Similar services include:

```basic
lvh.me
*.localtest.me	(see: readme.localtest.me )

ping 1.2.3.4.sslip.io
ping 1.1.2.3.nip.io 
```

## **0x06    Enclosed alphanumerics**
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606803924802-1df6ca23-db8c-45cf-b2cb-87913fe4af97.png)



> ![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606803841753-9b365011-127a-4d82-aed3-6810746a3c34.png)
>
> + Concept: [https://en.wiktionary.org/wiki/Appendix:Unicode/Enclosed_Alphanumerics](https://en.wiktionary.org/wiki/Appendix:Unicode/Enclosed_Alphanumerics)
> + Usage: [https://www.qqxiuzi.cn/zh/shijiewenzi/?character=Enclosed%20Alphanumerics](https://www.qqxiuzi.cn/zh/shijiewenzi/?character=Enclosed%20Alphanumerics)
>

```basic
ⓔⓧⓐⓜⓟⓛⓔ.ⓒⓞⓜ >>> http://example.com
ⓑⒶⒾⒹⓤ。Cⓞm >>> http://baidu.com
```

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606803777842-beba1386-ce89-4358-832c-ea7853b6a771.gif)



```plain
①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑⒒⒓⒔⒕⒖⒗⒘⒙⒚⒛⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ⓪⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴⓵⓶⓷⓸⓹⓺⓻⓼⓽⓾⓿
```

## 0x07    Intranet addresses
Usually the following three ranges are designated as intranet IP ranges, and all machines inside the intranet are assigned IPs from these ranges:



> For the complete list refer to [https://datatracker.ietf.org/doc/html/rfc5735](https://datatracker.ietf.org/doc/html/rfc5735)
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

So usually, we only need to check that the target IP is not in these three ranges, plus `127.0.0.0/8` and `0.0.0.0/8 `

> 1. The local address can be written not only as the familiar `127.0.0.1` but also as `127.6.6.6`
> 2. On Linux, both `127.0.0.1` and `0.0.0.0` point to the local machine; see [http://blog.orange.tw/2017/07/how-i-chained-4-vulnerabilities-on.html](http://blog.orange.tw/2017/07/how-i-chained-4-vulnerabilities-on.html)
>

# Some Practices
A few small exercises

### Round 1: Hiding in plain sight
```plain
①②⑦。⓪。⓪。①
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606803282628-c0f1e728-32e2-4cf3-8e7b-b1cb169a9c28.png)

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606803250425-51c07e25-5a9b-4235-9dc3-820ea77f8f27.gif)

### Round 2: Bait and switch
```plain
http://qq.com？action=submit&ID=@04747042517
```

![](https://cdn.nlark.com/yuque/0/2020/gif/166008/1606802423050-3bb39349-5e0b-403a-849b-062fe49c9119.gif)

Adding some highlighting makes it clearer

```basic
http://qq.com？action=submit&ID=@04747042517
Notes
- The ？ is a full-width (Chinese) question mark
- The @ is the key part: the string starting with 0 after it is the IP address in octal, and everything before it is userinfo
```



# DNS rebinding
## 1. The DNS resolution process
1. Query the local DNS server (/etc/resolv.conf)
2. If a cached result exists, return it and go no further
3. If there is no cache, query the remote DNS server and return the result



On the Mac and Windows machines we use daily, the system performs DNS caching to speed up HTTP access. On Linux, however, DNS caching is not performed by default ([https://stackoverflow.com/questions/11020027/dns-caching-in-linux](https://link.zhihu.com/?target=https%3A//stackoverflow.com/questions/11020027/dns-caching-in-linux)), unless software such as nscd is running.

It is enough to know that Linux does not cache DNS by default. This also explains why, with the same configuration, my setup failed on Mac but worked on Linux.

Note that a DNS server with the IP 8.8.8.8 will not be cached locally.

1. Java by default is not vulnerable to DNS rebinding bypasses (TTL defaults to 10)



2. PHP by default can be bypassed via DNS rebinding



3. Linux by default performs no DNS caching

> **DNS resolution process**
>
> 1. Query the local DNS server (/etc/resolv.conf)
> 2. If a cached result exists, return it and go no further
> 3. If there is no cache, query the remote DNS server and return the result
>

## 2. How rebinding works
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606807255024-0c8717ad-5a9a-44e9-a587-f48e0b0131ac.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606831393974-9f7a1a12-74b7-4455-858a-b4ae255b1402.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606831432939-70708306-f9f9-4c78-90e0-2bd7c06b7a22.png)

In fact, the `ceye.io` platform from Knownsec also offers a DNS rebinding service

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1609232371555-3b2919f2-d0b4-47b9-b197-0395af6ece7f.png)![](https://cdn.nlark.com/yuque/0/2020/jpeg/166008/1609232399706-fd04d768-c47f-4f37-bf2e-17324baa4a37.jpeg)

In practice, just use `r.xxxxx.ceye.io`

The first request returns `127.0.0.1`

```bash
$ nslookup r.abcdef.ceye.io
Server:        8.8.8.8
Address:    8.8.8.8#53
Non-authoritative answer:
Name:    r.abcdef.ceye.io
Address: 127.0.0.1
```

The second request returns `192.168.0.1`

```bash
$ nslookup r.abcdef.ceye.io
Server:        8.8.8.8
Address:    8.8.8.8#53
Non-authoritative answer:
Name:    r.abcdef.ceye.io
Address: 192.168.0.1
```

## 3. A prerequisite that cannot be ignored
<font style="color:#282828;">The</font>**<font style="color:#282828;">DNS server </font>**<font style="color:#282828;">used by the target affects how well a DNS rebinding attack works. Therefore, for a DNS rebinding attack to succeed, the target must be using a DNS server that respects TTL rules.</font>

<font style="color:#282828;">Commonly used public DNS:</font>

```bash
- Respects DNS TTL rules: 8.8.8.8
- Does not respect the rules: 1.1.1.1, 223.5.5.5, 119.29.29.29
- Caches DNS records rather unpredictably: 114.114.114.114
```

As you can see, most DNS servers cache DNS records to save on the number of requests; only 8.8.8.8 implements TTL fairly faithfully.

## 4. Tooling
You can use `[https://github.com/taviso/rbndr](https://github.com/taviso/rbndr)` to perform DNS rebinding

```php
# Alternate between 255.255.255.255 and an external IP
ffffffff.2FF02E9A.rbndr.us
  
# Alternate between 127.0.0.1 and an external IP
7F000001.2FF02E9A.rbndr.us
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622190289433-29afae9e-deea-4465-8727-59b1512d1191.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622190281044-81b6f3d8-28df-4e74-bc4b-1b13712944fa.png)

---

# Some CTF-style challenges
## WMCTF2020-SimpleAuth
> [https://github.com/wm-team/WMCTF2020-WriteUp/blob/master/WMCTF%202020%E5%AE%98%E6%96%B9WriteUp.md#SimpleAuth](https://github.com/wm-team/WMCTF2020-WriteUp/blob/master/WMCTF%202020%E5%AE%98%E6%96%B9WriteUp.md#SimpleAuth)
>

After entering the url parameter, it says only the http protocol is supported.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1609232682815-39e5d871-8617-4198-a148-28082f4e8073.png)

Crafting a url that requests the http port on my own VPS, the http request is successfully received.

![](https://camo.githubusercontent.com/d1f779a07b96f893225aa6c73a30d0dcb550db7e4d1dd9747419e0ab75e35434/68747470733a2f2f75706c6f616465722e7368696d6f2e696d2f662f6c587a534d385169696e746a365a64622e706e67217468756d626e61696c)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1609232716846-b72a2174-5ad9-4eb0-9d5b-8fd6438840fe.png)

When a normal http response comes back, the page displays "nothing". **Next you can [try modifying the http response packet]** for testing, for example returning a 401 authentication challenge.

```http
<?php
    header('WWW-Authenticate: Basic realm="test"'); 
    header('HTTP/1.0 401 Unauthorized'); 
?>
```

![](https://camo.githubusercontent.com/66b018c580414f5f7f1801a9506541f2238c5fb9aa646462b90a793b4849157f/68747470733a2f2f75706c6f616465722e7368696d6f2e696d2f662f3169734b396437516d563073553670422e706e67217468756d626e61696c)

When the 401 authentication page's content changed, it said this authentication type is not supported. By **[looking up the documentation]** we learn that HTTP supports authentication types such as Basic, Digest, and NTLM, and from the site's information we learn that the server is running Windows. Try responding with a 401 NTLM authentication challenge.

```http
<?php
    header('WWW-Authenticate: NTLM'); 
    header('HTTP/1.0 401 Unauthorized'); 
?>
```

Requesting again, the response content had changed<font style="color:#24292E;">. </font>

A tcpdump packet capture shows that when the http response header requests NTLM authentication, the challenge re-requests the url with http NTLM authentication.

![](https://camo.githubusercontent.com/3f2603300fd218983b154b855853405443f3e57e466df5b4163a3eed7a0b401c/68747470733a2f2f75706c6f616465722e7368696d6f2e696d2f662f564a747950335579676c7a714b3667692e706e67217468756d626e61696c)



---

# Postscript: SSRF in practice and in theory


## An SSRF on the Zhihu main site that can probe the intranet
**Source**

> 【Vulnerability study — SSRF】An SSRF on the Zhihu main site that can probe the intranet [https://blog.csdn.net/Fly_hps/article/details/84400273](https://blog.csdn.net/Fly_hps/article/details/84400273)
>

**Vulnerability description**

When answering a question on Zhihu, entering a URL automatically converts it into the page title. For example, entering [http://wooyun.org/](http://wooyun.org/) turns it into:

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606722728534-70c4519a-1cee-47e6-ac05-3d82390d9d0d.png)

Clearly the backend makes a request for this.

Capturing the traffic, the request goes to [http://www.zhihu.com/scraper](http://www.zhihu.com/scraper):



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606722720922-5a283882-3381-4052-ac7e-236b0469d9c0.png)



## Low-severity SSRF escalating into the intranet
**Source**

> R3start, Low-severity SSRF escalating into the intranet
>
> [https://mp.weixin.qq.com/s/HjvviHp1EdAmWEUE4fbajQ](https://mp.weixin.qq.com/s/HjvviHp1EdAmWEUE4fbajQ)
>

**Vulnerability description**

Starting from an SSRF point, getting into the intranet, and finally running rampant in Redis



## WordPress SSRF (DNS Rebinding)
See:[http://redteam.today/2019/11/01/wordpress%20xmlrpc.php%20have%20ssrf%20vuln(use%20dns%20rebinding%20bypass%20limit)/](http://redteam.today/2019/11/01/wordpress%20xmlrpc.php%20have%20ssrf%20vuln(use%20dns%20rebinding%20bypass%20limit)/)

# References
+ Expanding the attack surface with the Gopher protocol [https://blog.chaitin.cn/gopher-attack-surfaces/](https://blog.chaitin.cn/gopher-attack-surfaces/)
+ Exploiting SSRF vulnerabilities and attacking intranet applications in practice [https://xz.aliyun.com/t/7405#toc-0](https://xz.aliyun.com/t/7405#toc-0)
+ URL Hacking - sneaky frontend tricks[ https://wooyun.js.org/drops/URL%20Hacking%20-%20%E5%89%8D%E7%AB%AF%E7%8C%A5%E7%90%90%E6%B5%81.html](https://wooyun.js.org/drops/URL%20Hacking%20-%20%E5%89%8D%E7%AB%AF%E7%8C%A5%E7%90%90%E6%B5%81.html)
