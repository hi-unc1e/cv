---
title: "NexusPHP代码审计小结"
slug: rf4gzd
translationKey: rf4gzd
date: 2020-01-10T17:28:56+08:00
source: yuque/penetration
---

NexusPHP是用于P2P下载的资源分享类CMS，源码下载链接是[https://github.com/ZJUT/NexusPHP](https://github.com/ZJUT/NexusPHP)



# 前置分析
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637211384737-4c4a1237-f26a-4e34-8a50-c9abb5bc40c1.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637211540426-e9b7b402-a5ad-4e1b-b2ca-3d6a1ff29c83.png)

[  
  
  
  
](https://github.com/ZJUT/NexusPHP)

这套cms，存在全局过滤sql注入的函数`sqlesc()`

`nexusphp/include/globalfunctions.php #75`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578665090979-a178b3e4-c646-472a-bb10-fd5e69a0fc12.png)



1. **全局过滤之防止SQL注入1。**用mysql防注入函数转义，并且用单引号包裹住语句，导致无法注入引号，也无法引入变量（单引号中的$不会被识别成变量）



2. **全局过滤之防止SQL注入2。**常有整型转换，利用加法强转为数字

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578664936920-1a5f4e5e-16d5-4b7e-a645-bc08cc176ec2.png)



3. **getip() 函数校验不当导致可伪造ip。**首先，获取ip的函数写成了下面这样:

```php
<?php
function getip() {
	if (isset($_SERVER)) {
		if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && validip($_SERVER['HTTP_X_FORWARDED_FOR'])) {
			$ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
		} elseif (isset($_SERVER['HTTP_CLIENT_IP']) && validip(......
                                                           ...
?>
```

+ 取`X_FORWARDED_FOR`请求头作为ip地址，这个请求头是可以伪造滴！
+ 其次，在校验函数`validip()`中的逻辑也以偏概全，认为只要是让`ip2long()`函数出错内容就是IPV6地址。。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606367130214-8f0a220d-53ba-4da8-a56c-35f9654785e8.png)

+ 实际上：任何不是IP的字符串都可以让它输出`False`，即该点完全可控，美滋滋。



废话不多说，开始审计。

# 0x01 前台找回密码处存在邮件内容可控问题，可导致储存XSS
接着刚刚说的`getip()`函数的IP伪造问题，我们找找它的引用

找到`recover.php`，存在一段找回密码的功能

> **heredoc**
>
> PHP EOF(heredoc) 使用说明 PHP EOF(heredoc)是一种在命令行shell（如sh、csh、ksh、bash、PowerShell和zsh）和程序语言（像Perl、PHP、Python和Ruby）里定义一个字符串的方法。 
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606370132607-2a6ba4b9-4bf9-4883-9cdc-346b1f64b413.png)

加入一段打印body的代码，抓包改一下XFF请求头，加入XSS的payload

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606370053410-18ed58f4-e3d2-4697-b679-4ad1344f5897.png)

模拟在email中收信的场景，是熟悉的XSS

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606370028366-6eb82ab1-9936-4a08-b449-65116fd510f2.png)

# 0x02 nowarn.php 存在SQL注入
> 需要登录且不为普通用户
>



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578664268612-5386c2e7-7661-4dbe-8d8b-6aecd5064ef1.png)

`nowarn.php`的第36行开始，直接拼接进sql语句了

```markdown
# payload仅供参考
(select*from(select sleep(10))x)# 
```

只不过这个注入点需要认证

# 0x03 linksmanage.php存在SQL注入
如图，关键逻辑就是直接传入了用户的变量，连都sqlesc这个过滤函数都没使用。。。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606371692717-fbed2a08-ad6f-46b9-83e6-4e8dae9531e0.png)

还有其它好几个SQL注入点，用正则表达式都可以发现，可以参考它的[CVE网站](https://www.cvedetails.com/vulnerability-list/vendor_id-16849/year-2017/opsqli-1/Nexusphp.html)，不再赘述。

# 0x04 恶意SQL查询风险
`moforums.php`中，存在如下的查询语句

```sql
sql_query("UPDATE overforums SET sort = " . sqlesc($_POST['sort']) . ", name = " . sqlesc($_POST['name']). ", description = " . sqlesc($_POST['desc']). ", minclassview = " . sqlesc($_POST['viewclass']) . " WHERE id = ".sqlesc($_POST['id'])) or sqlerr(__FILE__, __LINE__);
```

那么可以考虑利用`/* */`来注释掉中间的部分，达成执行恶意语句的效果。。。不过也只是风险罢了。。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606373041288-120681b6-7eb4-4134-a3f3-804f2914cf15.png)

# 其余风险点
## iconv的截断
低版本，（默认）乱杀

高版本，（有条件）乱杀



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578665878342-7e973113-92e5-4271-9233-65e3c209d036.png)



我们看下php官方的文档，关于iconv这个函数，官方是怎么说的



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578666013310-5df9fe05-e9c6-40d4-ab71-035c75c8d1f7.png)



在PHP < 5.4.0，字符非法时会被截断，只返回非法字符串之前能正常解码的内容

在PHP >= 5.4.0时，字符非法时会报错返回False，除非输出字符串里拼接了//IGNORE，本套cms就是这种情况



也就是说，我们可以控制输出，利用特性bypass文件后缀之类的检测



# 总结
1. 这套cms审下来，有好很多地方都是形如**0x02的注入**一样的拼接，但都需要高权限才能访问到漏洞代码处，进而注入，价值不大。
2. 参数绝大部分都来强制类型转换，没有常见的命令执行函数
3. 可以参考这几个老哥的[cve](https://www.cvedetails.com/product/39021/?q=nexusphp)和[cnnvd](http://www.cnnvd.org.cn/web/vulnerability/querylist.tag?relLdKey=2017100498)，17年的时候刷了一波大规模的洞，主要是xss和sql注入，重复性工作，索然无味
4. 这次审计在前人的基础上，发现了SQL多参数时利用注释来绕过减少查询字段数的骚姿势，还是学习了不少姿势的。



