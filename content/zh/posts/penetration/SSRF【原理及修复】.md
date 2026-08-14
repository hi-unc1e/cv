---
title: "SSRF【原理及修复】"
slug: uwuqgl
translationKey: uwuqgl
date: 2020-11-16T00:03:42+08:00
source: yuque/penetration
---

本文站在安全工程师的角度，分析了PHP中SSRF的成因及修复方案。通过在vps上作实验，介绍不同成因导致的SSRF漏洞的危害和限制，并在最后给出安全编码的示例。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1581432420756-90e01855-46d9-4621-ba1d-e196bdfa3bc8.png#align=left&display=inline&height=513&margin=%5Bobject%20Object%5D&originHeight=513&originWidth=847&size=0&status=done&style=none&width=847)

## cURL的配置项
此处记录了cURL的各项配置和SSRF漏洞类型之间的关系.



+ **CURLOPT_HEADER** 绝大多数情况下都是0，否则会连同`HTTP`响应头一起返回(如图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604657225750-6b4683ef-0c36-45d5-8b31-82f2279247db.png)



+ **CURLOPT_NOBODY** 启用时将不对HTML中的BODY部分进行输出，若**关闭则有回显**。**决定是否为无回显布尔型SSRF的因素**

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1581431095607-517bf45d-205c-45ea-879d-d7e940685b11.png#align=left&display=inline&height=123&margin=%5Bobject%20Object%5D&name=image.png&originHeight=246&originWidth=841&size=35477&status=done&style=none&width=421)



+ **CURLOPT_PORT** 用来指定默认连接端口。**决定SSRF是否被限制端口的因素。**多个端口：用`-`表示端口范围，用逗号`,`指定多个端口

```markdown
# 指定多个端口
curl_setopt($curl, CURLOPT_PORT, 8000,9000,8081,1,2,3,4,5)

# 指定端口范围
curl_setopt($curl, CURLOPT_PORT, 8000-9000);
```

+ **CURLOPT_PROTOCOLS** 限定在传输过程中可使用的协议。这将允许你在编译libcurl时支持众多协议，默认将会使用全部它支持的协议。**决定SSRF是否被限制协议的因素. **示例代码为`curl_setopt($curl, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS | CURLPROTO_FTP);`, 多个协议用竖线`|`分隔. 下面是一些常用的协议, 如需完整的协议列表, 可访问[https://curl.haxx.se/libcurl/c/CURLOPT_PROTOCOLS.html ](https://curl.haxx.se/libcurl/c/CURLOPT_PROTOCOLS.html)



```shell
可用的协议选项为：
    CURLPROTO_HTTP
    CURLPROTO_HTTPS
    CURLPROTO_FTP
    CURLPROTO_FTPS
    CURLPROTO_SCP
    CURLPROTO_SFTP
    CURLPROTO_TELNET
    CURLPROTO_LDAP
    CURLPROTO_LDAPS
    CURLPROTO_DICT
    CURLPROTO_FILE
    CURLPROTO_TFTP
    CURLPROTO_ALL
```

需要注意的是, 如果`CURLOPT_PROTOCOLS `配置只允许HTTP协议的话, 那么是无法通过302跳转来bypass的! 

也就是说302跳转只适用于**关键词过滤**时的绕过. 参考本文例3中的<u>重定向型SSRF</u>

+ **CURLOPT_RETURNTRANSFER** 将`curl_exec`获取的信息以文件流的形式返回，而不是直接输出。ps: 有网友说这项配置会导致ssrf无回显，经测试并非如此——置0置1对有无输出**均无影响**，有无输出由_CURLOPT_NOBODY_决定** ；**实际上，这个配置项主要跟_CURLOPT_BINARYTRANSFER_一起使用）
+ **CURLOPT_FOLLOWLOCATION** 启用时会将服务器服务器返回的"Location: "放在header中递归的返回给服务器，使用_CURLOPT_MAXREDIRS_可以限定递归返回的数量。**是否允许SSRF跳转的决定因素. 默认为False即**不支持跳转
+ **CURLOPT_TIMEOUT** 设置cURL允许执行的最长秒数。
+ **CURLOPT_TIMEOUT_MS**	设置cURL允许执行的最长毫秒数。
+ **CURLOPT_CONNECTTIMEOUT** 在发起连接前等待的时间，如果设置为0，则无限等待。
+ **CURLOPT_CONNECTTIMEOUT_MS** 尝试连接等待的时间，以毫秒为单位。如果设置为0，则无限等待
+ **CURLOPT_CUSTOMREQUEST** 使用一个自定义的请求信息来代替"GET"或"HEAD"作为HTTP请求。常用值如"GET"，"POST"，"CONNECT"等等。

## 成因1—cURL
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1581428652667-64818de2-f34a-4f92-a361-285c354dbf04.png#align=left&display=inline&height=393&margin=%5Bobject%20Object%5D&name=image.png&originHeight=785&originWidth=1613&size=275893&status=done&style=none&width=806.5)



> 某天审一套野生cms的时候看到如上的PHP代码，curl的配置项比较多，怀疑是否存在ssrf漏洞，也正好想研究ssrf，所以对**什么样的curl配置会导致ssrf**这一点很感兴趣，于是展开了本次研究
>



+ PHP中curl可能的配置项可参考[https://www.php.net/manual/zh/curl.constants.php](https://www.php.net/manual/zh/curl.constants.php)及[https://www.runoob.com/php/func-curl_setopt.html](https://www.runoob.com/php/func-curl_setopt.html)
+ curl_version：7.42.1 【在`phpinfo`或`var_dump(curl_version()）`中可查看】



### 0x01    回显型SSRF
实例代码

```php
<?php
    //curl_base.php
    highlight_file(__FILE__);
    
	$url = $_GET['url'];
	$curl = curl_init($url);
	
	/*进行curl配置*/
	curl_setopt($curl, CURLOPT_TIMEOUT, 10); 	// 设置超时时间
	curl_setopt($curl, CURLOPT_HEADER, 0); // 不输出HTTP头
	//curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1); //跟随跳转
	//curl_setopt($curl, CURLOPT_NOBODY, 1) //不输出响应内容
	$responseText = curl_exec($curl);
	
	/*打印curl结果*/
	var_dump(curl_error($curl) );//如果执行curl过程中出现异常，可打开此开关，以便查看异常内容
	echo $responseText;
	
	/*关闭curl*/
	curl_close($curl);
?>
```

### ****
### 0x02    布尔型SSRF
示例代码

```php
<?php
    //curl_blind.php
    highlight_file(__FILE__);
    
	$url = $_GET['url'];
	$curl = curl_init($url);
	
	/*进行curl配置*/
	curl_setopt($curl, CURLOPT_TIMEOUT, 10); 	// 设置超时时间
	curl_setopt($curl, CURLOPT_HEADER, 0); // 不输出HTTP头
	//curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1); //跟随跳转
	curl_setopt($curl, CURLOPT_NOBODY, 1) ;//不输出响应内容
	$responseText = curl_exec($curl);
	
	/*打印curl结果*/
	//var_dump(curl_error($curl) );//如果执行curl过程中出现异常，可打开此开关，以便查看异常内容
	echo $responseText;
	
	/*关闭curl*/
	curl_close($curl);
?>
```

这就是`bool`型SSRF, 返回值永远只有`True ` or `False`.

`True `, 即有响应内容时: 返回`1`

`False`, 即无响应内容时：返回空

不妨试试, 在上面实例代码的情况下, 使用`file`协议仍然可以读取文件。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604653625329-5978778e-ffe7-4992-841a-58239d3f66f0.png)

这是由于`CURLOPT_NOBODY`选项真正的作用是: **采用**`**HEAD**`**方法来请求网络资源. **就像下面[cURL文档](https://curl.haxx.se/libcurl/c/CURLOPT_NOBODY.html)里说的一样

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604653827591-90c4e93f-bf98-4dd5-a691-c53fe5153242.png)

### 0x03    支持重定向的SSRF
为了演示302跳转脚本的作用, 我将cURL限制为只能请求以`http://`开始的地址, 实例代码如下

```php
<?php
    //curl_location.php
    highlight_file(__FILE__);
    
	$url = $_GET['url'];
	if (preg_match("#^http:\/\/#", $url)){
	$curl = curl_init($url);
	
	/*进行curl配置*/
	curl_setopt($curl, CURLOPT_TIMEOUT, 10); 	// 设置超时时间
	curl_setopt($curl, CURLOPT_HEADER, 0); // 不输出HTTP头
	curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1); //跟随跳转
    // curl_setopt($curl, CURLOPT_PROTOCOLS, CURLPROTO_HTTP|CURLPROTO_HTTPS|CURLPROTO_FILE); //限制cURL允许的协议
    $responseText = curl_exec($curl);
	
	/*打印curl结果*/
	//var_dump(curl_error($curl) );//如果执行curl过程中出现异常，可打开此开关，以便查看异常内容
	echo $responseText;
	
	/*关闭curl*/
	curl_close($curl);
	} else {
	    die("Only allow http://");
	}
?>
```

此时: 可以通过302.php脚本来实现协议的"转换", 示例脚本如下。

> 
>

```php
<?php
//302.php
error_reporting(0);
$p = $_GET["p"];
$url = $_GET["url"];
$path = $_GET["path"] ? $_GET['path'] : '';

if(isset($url)){
    header("Location: $p://$url/$path");
}
else{
    highlight_file(__FILE__);
}
?>

```

注意：使用`header()`函数时，在`<?php`标签前不能有内容，否则会提示报错`Warning: Cannot modify header information - headers already sent by ...`, 响应头也不能正常发送。



最后，经测试，302跳转可实现`HTTP`=>`DICT`, `HTTP`=>`GOPHER`，但不支持转成FILE协议。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604987803048-f292d8a3-1133-4311-bb82-6b5aebc4f57f.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604987919081-6e7ee57e-8032-4429-b1b9-fab2cc57b420.png)

## **成因2—** file_get_contents
来看看[官网](https://www.php.net/manual/zh/function.file-get-contents.php)对这个函数的说明，支持读取以下形式的内容

> + /path/to/file.ext
> + relative/path/to/file.ext
> + fileInCwd.ext
> + C:/path/to/winfile.ext
> + C:\path\to\winfile.ext
> + \\smbserver\share\path\to\winfile.ext
> + file:///path/to/file.ext
>

且在开启`allow_url_fopen`的情况下（**默认开启**），支持`ftp`和`http`协议

这里也是给出示例代码:

```php
<?php
//file_get_contents.php
highlight_file(__FILE__);
$url = $_GET['url'];;
echo file_get_contents($url);
?>
```

当请求内网的`redis`服务时，报错开启的话会显示banner

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605016193300-1a8e5e55-da7e-4adf-b65c-f89e8573118a.png)

当请求内网的`SSH`服务时也是

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605017001889-d82cdfe0-d694-46fd-89d6-f6316d514624.png)

不知为啥，请求内网的MySQL就不行。。

相较于`curl`，感觉`file_get_contents`要收敛很多，不支持`dict` / `gopher`协议，更不支持302跳转

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605018638249-b351de69-b5d3-47f9-9b10-61c6ab1b45a6.png)

主要功能点在于内网的`http`服务扫描、本地文件的读取以及有限制的内网服务扫描（开启报错情况下的banner回显），总体来说更偏向于读取文件一些，例如下面读读PHP代码之类的。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605017933603-8c428254-3a6e-4020-9b60-889be5b5723a.png)

说到读取`PHP`源代码，不得不提到一个东西叫做php伪协议：简单来说就是用php过滤器来将输出的内容编码，常用的编码方式之一是base64

```php
php://filter/read=convert.base64-encode/resource=index.php
```

下面这张图，就是采用base64编码之后的结果。在过滤了回显关键字的时候有奇效

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605018096267-b9636035-70d1-400f-b51f-ecddf5eb57fd.png)

## **成因3—** fopen/fsockopen
### fopen
示例代码

```php
<?php 
//fopen.php
highlight_file(__FILE__);
$file = fopen($_GET['url'], 'r');
echo fread($file, 4096);//限制读取大小 4096
fclose($file);
?>
```

支持`file://`协议，默认支持通外网，因此用来内网web服务探测也是妥妥的。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605177322762-e1e7c02f-eb3a-4262-878b-2ef2c9d0ede9.png)

可惜的是：不支持`POST`请求、不支持`DICT`或`GOPHER`协议。当然配合上传点，`phar`反序列化还是很香的。

### fsockopen
```php
<?php //fsockopen.php
highlight_file(__FILE__);
$host = $_GET[host];
$port = $_GET[port];
$fp = fsockopen($host, $port, $errno, $errstr, $timeout = 10); 
echo fgets($fp, 4096); 
  fclose($fp); 

?>
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1605456155573-93c98636-1916-4f2f-a4ad-224bc5344ce3.png)

乏善可陈...



## 成因4—LDAP连接
通过注入CRLF来SSRF，See：[https://www.silentrobots.com/blog/2019/02/06/ssrf-protocol-smuggling-in-plaintext-credential-handlers-ldap/](https://www.silentrobots.com/blog/2019/02/06/ssrf-protocol-smuggling-in-plaintext-credential-handlers-ldap/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622024588898-80a3c661-4469-499a-ae36-c6e06c2b648f.png)

```basic
# nc -lvp 9000
listening on [::]:9000 ...
connect to [::ffff:127.0.0.1]:9000 from localhost:39250 ([::ffff:127.0.0.1]:39250)
0`1
2
3
4
5
6---
```

| **<u><font style="color:rgb(56, 56, 56);">Library</font></u>** | **<u><font style="color:rgb(56, 56, 56);">Tested In</font></u>** |
| :--- | :--- |
| <font style="color:rgb(56, 56, 56);">python-ldap</font> | <font style="color:rgb(56, 56, 56);">Python 2.7</font> |
| <font style="color:rgb(56, 56, 56);">com.sun.jndi.ldap</font> | <font style="color:rgb(56, 56, 56);">JDK 11</font> |
| <font style="color:rgb(56, 56, 56);">php-ldap</font> | <font style="color:rgb(56, 56, 56);">PHP 7</font> |
| <font style="color:rgb(56, 56, 56);">net-ldap</font> | <font style="color:rgb(56, 56, 56);">Ruby 2.5.2</font> |
| <font style="color:rgb(56, 56, 56);">——-</font> | <font style="color:rgb(56, 56, 56);">——–</font> |


+ 如果您是攻击者，并且找到`LDAP`配置页，请检查用户名或密码字段是否允许CRLF字符。通常，初始测试将涉及将请求发送到您控制的侦听器，以验证未过滤这些字符。
+ 如果您是防御者，请确保您的应用程序正在过滤`CRLF`字符（即`％0D％0A`）

---

## 常见服务支持的协议
| **服务类型** | **支持的协议** | **实例命令** | **响应内容** |
| --- | --- | --- | --- |
| Redis | dict | `dict://redis:6379/` | `-ERR Syntax error, try CLIENT (LIST | KILL | GETNAME | SETNAME | PAUSE | REPLY) +OK string(0) "" 1` |
| | http | `http://redis:6379/` | `-ERR wrong number of arguments for 'get' command string(0) "" 1` |
| | gopher | `gopher://redis:6379/_info` | 返回`redis`执行`info`命令后的内容 |
| SSH | dict<br/>http<br/>gopher | `http://172.17.0.1:22`<br/>... | `SSH-2.0-OpenSSH_7.4 Protocol mismatch.` |
| MySQL | dict<br/>http<br/>gopher<br/>telnet | `<font style="color:#262626;">dict://mysql:3306</font>`<br/><font style="color:#262626;">...</font> | `J ``**5.7.32**``q@Y60l����W{_lfD.5``**mysql_native_password!��#08S01Got packets out of order**``1` |
| HTTP | dict<br/>http | 略 | 略 |


**注意:**

1. 使用`dict`协议, 可以直接在`redis`上执行命令, 如`dict://redis:6379/info`, 就是执行了`info`命令

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604649122298-3bb2538f-b06f-4e3a-a4a9-694f8daa36c2.png)



## 修复建议
> 对于不同的需求，有不同的配置建议，但总的还是采用【白名单】的思路。
>

如果是为了防止SSRF进内网的话，可以通过**限制协议+端口+白名单地址范围**来彻底杜绝SSRF，例如下面的实例代码就是较为安全的（**限制白名单地址+不输出http头+限制http(s)协议**）.



```php
<?php

  $url = $_GET['url'];
  /**对url进行白名单判断,不满足就die，
  * 此处需要注意PHP中双等于'==' 以及
  * 默认配置时in_array()存在类型转换（弱类型）导致不严谨比较的问题
  * tip：PHP中，如果一个数值和字符串进行比较的时候，会将字符串转换成数值
  **/

  $whilelists = array("http://weather.com.cn", "http://baidu.com");//白名单
  $flag = in_array($url, $whilelists, TRUE)  //第三个参数为严格比较，比较时将先考察格式
  if($flag){//若url在白名单内，进行下一步配置
      $curl = curl_init($url);  
      curl_setopt($curl, CURLOPT_HEADER, 0); // 不输出HTTP响应头
      curl_setopt($curl, CURLOPT_PROTOCOLS, CURLPROTO_HTTP|CURLPROTO_HTTPS); 
      /*	限定传输协议
       *ps:允许多种协议的配置，用|隔开即可
       */
      curl_setopt($curl, CURLOPT_PORT, 80); //限定访问端口
      curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 0);
      $responseText = curl_exec($curl);
      echo $responseText;
      curl_close($curl);
} else{
 die("url不在白名单内！");
 }

?>
```





## Fuzz: cURL 7.61.1支持的协议
可用于fuzz，参考[http://www.codersec.net/2020/05/SSRF%E6%94%BB%E5%87%BB%E5%A7%BF%E5%8A%BF%E6%B1%87%E6%80%BB/](http://www.codersec.net/2020/05/SSRF%E6%94%BB%E5%87%BB%E5%A7%BF%E5%8A%BF%E6%B1%87%E6%80%BB/)

```php
dict
file
ftp
ftps
gopher
http
https
imap
imaps
ldap
ldaps
pop3
pop3s
rtsp
smb
smbs
smtp
smtps
telnet
tftp
```

