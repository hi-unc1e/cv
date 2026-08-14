---
title: "利用PCRE回溯绕过PHP中的正则表达式"
slug: es4kkx
translationKey: es4kkx
date: 2021-01-15T15:16:34+08:00
source: yuque/penetration
---

# 正则表达式简介


PHP 正则表达式特殊字符 `[:alnum:]`  `[:alpha:]` 等

> <font style="color:rgb(0, 0, 0);">For example, '</font>`<font style="color:rgb(0, 0, 0);">[[:alnum:]]</font>`<font style="color:rgb(0, 0, 0);">' means '</font>`<font style="color:rgb(0, 0, 0);">[0-9A-Za-z]</font>`<font style="color:rgb(0, 0, 0);">', </font>
>

```markdown
正则表达式中有两个很重要的特殊字符就是"[ ]"。他们可以匹配"[]"之中出现过的字符，比如"/[az]/"可以匹配单个字符"a"或者"z"；如果把上面的表达式改成这样"/[a-z]/"，就可以匹配任何单个小写字母，比如"a"、"b"等等。
如果在"[]"中出现了"^"，代表本表达式不匹配"[]"内出现的字符，比如"/[^a-z]/"不匹配任何小写字母！并且正则表达式给出了几种"[]"的默认值，如下：

# '[:alnum:]' 匹配任何字母
Alphanumeric characters: '[:alpha:]' and '[:digit:]'.

# '[:alpha:]' 匹配任何字母和数字
Alphabetic characters: '[:lower:]' and '[:upper:]'.

# '[:blank:]'
Blank characters: space and tab.

# '[:cntrl:]'
Control characters. In ASCII, these characters have octal codes 000 through 037, and 177 ('DEL'). In other character sets, these are the equivalent characters, if any.

# '[:digit:]' 匹配任何数字
Digits: '0 1 2 3 4 5 6 7 8 9'.

# '[:graph:]'
Graphical characters: '[:alnum:]' and '[:punct:]'.

# '[:lower:]' 匹配任何小写字母
Lower-case letters: 'a b c d e f g h i j k l m n o p q r s t u v w
x y z'.

# '[:print:]'
Printable characters: '[:alnum:]', '[:punct:]', and space.

# '[:punct:]' 匹配任何标点符号
Punctuation characters: '! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ \ ] ^ _ ' { | } ~'.

# '[:space:]' 匹配空格符
Space characters: tab, newline, vertical tab, form feed, carriage
return, and space.

# '[:upper:]' 匹配任何大写字母
Upper-case letters: 'A B C D E F G H I J K L M N O P Q R S T U V W
X Y Z'.

# '[:xdigit:]' 匹配任何16进制数字
Hexadecimal digits: '0 1 2 3 4 5 6 7 8 9 A B C D E F a b c d e f'.
```



## 背景介绍


首先，来看一段在waf上很常见的正则，



```basic
...
if(preg_match('/SELECT.+?FROM.+/is', $_POST['sql'])){
		die("SQL injection") //WAF
}else{
  	echo($_POST['sql']);
		//mysql_query($db,  $_POST['sql']); //查询
}
```



如何绕过?——相信师傅们肯定是方法多多。但今天主要详细说说其中的一种另类的绕过方式，利用正则回溯绕过正则判断

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610695186939-191eb725-b5a7-4fc3-9bdd-1dbb86d0321f.png)



## 原理分析
> (PHP 4, PHP 5, PHP 7)
>
> preg_match_all — 执行一个全局正则表达式匹配
>
> **<font style="color:#737373;">reg_match_all</font>**<font style="color:#737373;"> ( </font><font style="color:#669933;">string</font><font style="color:#737373;"> </font>`<font style="color:#737373;">$pattern</font>`<font style="color:#737373;"> , </font><font style="color:#669933;">string</font><font style="color:#737373;"> </font>`<font style="color:#737373;">$subject</font>`<font style="color:#737373;"> , </font><font style="color:#669933;">array</font><font style="color:#737373;"> </font>`<font style="color:#737373;">&$matches</font>`<font style="color:#737373;"> = ?</font><font style="color:#737373;"> , </font><font style="color:#669933;">int</font><font style="color:#737373;"> </font>`<font style="color:#737373;">$flags</font>`<font style="color:#993366;"> = </font>`**<font style="color:#993366;">PREG_PATTERN_ORDER</font>**`<font style="color:#737373;"> , </font><font style="color:#669933;">int</font><font style="color:#737373;"> </font>`<font style="color:#737373;">$offset</font>`<font style="color:#993366;"> = 0</font><font style="color:#737373;"> ) : </font><font style="color:#669933;">int</font>
>
> **返回值**
>
> 返回完整匹配次数（可能是0），或者如果发生错误返回`false`。
>

要知道`preg_match`的返回值除了0和1，还可能因为出错而返回**false**



而出错的原因，大致有两个，1. 正则回溯次数超过限制 ； 2. 入参的类型不是字符串（如数组类型）

我们主要关注第一种：利用正则回溯次数超过限制。回到一开始举的例子：



```basic
<?php
function is_php($data){
    return preg_match('/<\?.*[(`;?>].*/is', $data);
}

if(empty($_FILES)) {
    die(show_source(__FILE__));
}

$user_dir = 'data/' . md5($_SERVER['REMOTE_ADDR']);
$data = file_get_contents($_FILES['file']['tmp_name']);
if (is_php($data)) { //必须绕过此处判断；使其返回false
    echo "bad request";
} else {
    @mkdir($user_dir, 0755);
    $path = $user_dir . '/' . random_int(0, 10) . '.php';
    move_uploaded_file($_FILES['file']['tmp_name'], $path);

    header("Location: $path", true, 303);
} 1
```



只看前几行判断入参是否为php代码的`is_php()`函数：



当输入的字符串中含有`SELECT`、`FROM`，且两个词后分别跟有任意字符串，即视为满足匹配，`preg_match`就会返回1。其中的参数介绍如下



+ `.+`，“点 加号”，`.`表示匹配除了换行符\n之外的任意单个字符串，+ 匹配前面的子表达式1次或多次，两者合在一起，其实就表示匹配任意的字符串。



这段正则是有问题的——但问题在哪里呢？这就要从PHP中正则的匹配原理说起。



PHP 为了防止正则表达式的拒绝服务攻击（reDOS），给 pcre 设定了一个回溯次数上限  `pcre.backtrack_limit`，我们可以在phpinfo里查看当前环境下的上限，默认为1000,000



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610695481069-a7df1ece-7922-4b13-8b8c-3ad521e42af3.png)



常见的正则引擎，可被细分为 DFA（确定性有限状态自动机）与 NFA（非确定性有限状态自动机）。大多数程序语言都使用了 NFA 作为正则引擎，其中也包括 PHP 使用的 PCRE 库。



> NFA：从起始状态开始，一个字符一个字符地读取输入串，并与正则表达式进行匹配，如果匹配不上，则进行往回查找（回溯），尝试其他状态
>



那 NFA 自动机到底是怎么进行回溯的呢？我们以下面的字符和表达式来举例说明。



```plain
regex=/SELECT.+FROM.+/
param=select id from /*0123456789*/ test
```



+ 首先，拿到正则表达式的第一个匹配符S，于是去和字符串的字符进行比较，字符串的第一个字符是s，匹配(忽略大小写)，换下一个，第二个是 E，和字符串的第二个字符e匹配，再换下一个，一直到SELECT与select匹配完毕
+ 读取到正则表达式匹配符的第二部分`.+`：任意字符串匹配1次以上，那么可以一次性匹配掉剩下的所有字符串，即正则拿到`select id from /*0123456789*/ test`，但此时正则表达式中的`F`是无法匹配上的，且拿到的字符串已到了末尾，于是开始回溯，从末尾开始往回匹配，首先尝试匹配末尾的`t`，当然无法匹配上`F`，于是匹配倒数第二个字符`s`，也不行，于是一步步回溯到字符串中的`f`，回溯次数一次又一次地增加着。。直到回溯次数超过预设值`1000,000`而发生错误，函数返回false



因此，我们可以通过**发送超长字符串**的方式，使正则执行失败，返回**false**，从而绕过目标对 PHP 语言的限制。



![](https://cdn.nlark.com/yuque/0/2021/gif/166008/1610695866351-3141d5aa-c29f-4b54-989b-a6ac0f464274.gif)

<font style="color:#8C8C8C;">（动画中是正则调试器，来自：</font>[https://regex101.com/r/pf5Pa0/1/debugger](https://regex101.com/r/pf5Pa0/1/debugger)<font style="color:#8C8C8C;">）</font>



开头的那种方法，便是这样绕过的，但其实有个前提，payload必须在**POST**的参数里，不能是GET的参数，因为RFC 2616里限制了GET的参数最长不能超过8K(8*1024)，本地实测8178个字符，一旦超过，状态码即变成414



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610695913777-d3489f30-07c9-4077-a918-2710d0dd822f.png)

这可能也是很多时候构造POST超长字符串，能绕过waf的原因之一（waf需要考虑性能）



## 利用方式


在某些情况下（POST参数+特殊的正则）：可以利用正则回溯，使得preg_match函数返回false，进而绕过正则表达式的判断。代码审计时可以额外关注全局过滤处的正则表达式是否可用这种方法绕过。



之前maccms出过一个前台RCE，就是利用的这种方法来绕过全局过滤函数的，详情可参考[maccmsV8前台RCE(preg_match绕过)](https://mochazz.github.io/2020/01/08/maccmsV8%E5%89%8D%E5%8F%B0RCE(preg_match%E7%BB%95%E8%BF%87)/)



**利用方式：**发送超长字符串，可以用burp的intruder，payload类型选`Character blocks`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610695959204-006e28d3-9afe-485a-a308-9c7b84a5c652.png)

也可以改编下面这个python脚本进行利用



```python
#!/usr/bin/env python3
#encoding: utf-8
import requests

NUM = 1000000;# 你想填充的字符串数
URL = "http://php.test/select.php" # 地址

param = "union select 1,2,3,4,5 /*{}*/ ".format("A"*NUM) 
post_data = {"p":param}
resp = requests.post(url=URL, data=post_data)

print(resp.text)
```



## 结论（修复方案）


1. 如果用`preg_match`对字符串进行匹配，一定要使用`===`全等号来判断返回值，如：



```php
<?php
function is_php($data){  
    return preg_match('/<\?.*[(`;?>].*/is', $data);  
}

if(is_php($input) === 0) {
    // fwrite($f, $input); ...
}
```



这样，即使正则执行失败返回false，也不会进入if语句。



2. 推荐一个网站[https://regex101.com/](https://regex101.com/)，这个网站可以检查你写的正则表达式和对应的字符串匹配时是否有问题。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1610695981124-66a6ec74-ddb4-41dc-9bc4-8190dfb74033.png)

## reference


+ PHP利用PCRE回溯次数限制绕过某些安全限制 [https://www.freebuf.com/articles/web/190794.html](https://www.freebuf.com/articles/web/190794.html)
+ 正则表达式回溯漏洞[https://blog.csdn.net/dl71181/article/details/101281495](https://blog.csdn.net/dl71181/article/details/101281495)
+ 正则表达式 — 回溯陷阱 - 五维思考 - 博客园[https://www.cnblogs.com/zhaoshujie/p/10278919.html](https://www.cnblogs.com/zhaoshujie/p/10278919.html)
+ HTTP/1.1: Protocol Parameters [https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.2.1](https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.2.1)
+ PHP手册-PCRE正则语法 [https://www.php.net/manual/zh/regexp.reference.meta.php](https://www.php.net/manual/zh/regexp.reference.meta.php)
+ regex debugger [https://regex101.com/](https://regex101.com/)
+ maccmsV8前台RCE(preg_match绕过)[https://mochazz.github.io/2020/01/08/maccmsV8前台RCE(preg_match绕过)/](https://mochazz.github.io/2020/01/08/maccmsV8%E5%89%8D%E5%8F%B0RCE(preg_match%E7%BB%95%E8%BF%87)/)

