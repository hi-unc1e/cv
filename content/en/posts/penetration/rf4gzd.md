---
title: "NexusPHP Code Audit Notes"
slug: rf4gzd
translationKey: rf4gzd
date: 2020-01-10T17:28:56+08:00
source: yuque/penetration
---

NexusPHP is a resource-sharing CMS used for P2P downloading; the source code download link is [https://github.com/ZJUT/NexusPHP](https://github.com/ZJUT/NexusPHP)



# Preliminary Analysis
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637211384737-4c4a1237-f26a-4e34-8a50-c9abb5bc40c1.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637211540426-e9b7b402-a5ad-4e1b-b2ca-3d6a1ff29c83.png)

[  
  
  
](https://github.com/ZJUT/NexusPHP)

This CMS has a global SQL-injection filtering function, `sqlesc()`

`nexusphp/include/globalfunctions.php #75`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578665090979-a178b3e4-c646-472a-bb10-fd5e69a0fc12.png)



1. **Global filtering: SQL injection prevention #1.** It escapes input with the MySQL anti-injection function and wraps the statement in single quotes, which makes it impossible to inject quotes or introduce variables ($ inside single quotes is not interpreted as a variable)



2. **Global filtering: SQL injection prevention #2.** Integer casts are used frequently, forcibly converting values to numbers via addition

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578664936920-1a5f4e5e-16d5-4b7e-a645-bc08cc176ec2.png)



3. **Improper validation in the getip() function allows IP spoofing.** First, the IP-retrieval function is written like this:

```php
<?php
function getip() {
	if (isset($_SERVER)) {
		if (isset($_SERVER['HTTP_X_FORWARDED_FOR']) && validip($_SERVER['HTTP_X_FORWARDED_FOR'])) {
			$ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
		} elseif (isset($_SERVER['HTTP_CLIENT_IP']) && validip(......
                                                           ...
?>
```

+ It takes the `X_FORWARDED_FOR` request header as the IP address — and this header is spoofable!
+ Second, the logic in the validation function `validip()` overgeneralizes: it assumes that anything making `ip2long()` fail must be an IPv6 address...

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606367130214-8f0a220d-53ba-4da8-a56c-35f9654785e8.png)

+ In reality: any string that is not an IP makes it return `False`, meaning this point is fully controllable — lovely.



Enough said, let's start the audit.

# 0x01 Controllable email content in the front-end password recovery flow, leading to stored XSS
Following up on the IP-spoofing issue in the `getip()` function, let's look for places that reference it

We find `recover.php`, which contains a password recovery feature

> **heredoc**
>
> PHP EOF (heredoc) usage notes: PHP EOF (heredoc) is a way of defining a string in command-line shells (such as sh, csh, ksh, bash, PowerShell, and zsh) and programming languages (like Perl, PHP, Python, and Ruby). 
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606370132607-2a6ba4b9-4bf9-4883-9cdc-346b1f64b413.png)

Add a snippet that prints the body, capture the request, modify the XFF header, and add an XSS payload

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606370053410-18ed58f4-e3d2-4697-b679-4ad1344f5897.png)

Simulating the scenario of receiving the message in an email client — it's the familiar XSS

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606370028366-6eb82ab1-9936-4a08-b449-65116fd510f2.png)

# 0x02 SQL injection in nowarn.php
> Requires being logged in and not being a regular user
>



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578664268612-5386c2e7-7661-4dbe-8d8b-6aecd5064ef1.png)

Starting at line 36 of `nowarn.php`, user input is concatenated directly into the SQL statement

```markdown
# payload for reference only
(select*from(select sleep(10))x)# 
```

The only catch is that this injection point requires authentication

# 0x03 SQL injection in linksmanage.php
As shown in the figure, the key logic passes user variables straight in — it doesn't even use the sqlesc filtering function...

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606371692717-fbed2a08-ad6f-46b9-83e6-4e8dae9531e0.png)

There are several other SQL injection points as well, all discoverable with regular expressions; you can refer to its [CVE site](https://www.cvedetails.com/vulnerability-list/vendor_id-16849/year-2017/opsqli-1/Nexusphp.html) — no need to repeat them here.

# 0x04 Malicious SQL query risk
In `moforums.php`, there is a query like the following

```sql
sql_query("UPDATE overforums SET sort = " . sqlesc($_POST['sort']) . ", name = " . sqlesc($_POST['name']). ", description = " . sqlesc($_POST['desc']). ", minclassview = " . sqlesc($_POST['viewclass']) . " WHERE id = ".sqlesc($_POST['id'])) or sqlerr(__FILE__, __LINE__);
```

One could consider using `/* */` to comment out the middle portion, achieving the effect of executing a malicious statement... though it's only a risk, nothing more...

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1606373041288-120681b6-7eb4-4134-a3f3-804f2914cf15.png)

# Other risk points
## iconv truncation
Low versions: (by default) totally exploitable

High versions: (conditionally) totally exploitable



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578665878342-7e973113-92e5-4271-9233-65e3c209d036.png)



Let's look at the official PHP documentation to see what it says about the iconv function



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578666013310-5df9fe05-e9c6-40d4-ab71-035c75c8d1f7.png)



In PHP < 5.4.0, illegal characters cause truncation, returning only the content that could be decoded normally before the illegal string

In PHP >= 5.4.0, illegal characters cause an error and a return value of False, unless //IGNORE is appended to the output string — which is exactly the case in this CMS



In other words, we can control the output and use this behavior to bypass checks such as file-extension validation



# Summary
1. Auditing this CMS, many spots turned out to be concatenations like the **0x02 injection**, but they all require high privileges to reach the vulnerable code and inject, so they are of little value.
2. The vast majority of parameters undergo forced type casting, and there are no common command-execution functions
3. You can refer to these folks' [CVEs](https://www.cvedetails.com/product/39021/?q=nexusphp) and [CNNVD](http://www.cnnvd.org.cn/web/vulnerability/querylist.tag?relLdKey=2017100498) — in 2017 a wave of mass-harvested bugs was reported, mainly XSS and SQL injection; repetitive work, rather dull
4. Building on predecessors' work, this audit discovered the neat trick of using comments to reduce the number of queried columns in multi-parameter SQL cases — quite a few new techniques learned.

