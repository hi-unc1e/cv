---
title: "BlueCMS Code Audit Notes"
slug: rvdfk6
translationKey: rvdfk6
date: 2020-01-12T10:02:24+08:00
source: yuque/penetration
---

# 0x00 Basic Shortcuts
Sublime

+ Next word: Ctrl+D
+ Bookmarks: Ctrl+F2, F2
+ Show function: Ctrl+E
+ Select current line: Ctrl+L
+ Matching bracket: Ctrl+M

# 0x01 Repeated Installation Possible
After a normal installation completes, the system can be installed again, because install.lock is never generated.

An article on freebuf claims the problem lies at line 158 of install/index.php, where the is_writable function is used incorrectly.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795057671-7c251453-b762-4cc1-90e1-3db6d081431c.png)

However, after verification, I found this function is not what causes the repeated-installation issue.



First, let's check the official PHP manual:

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795842491-0701f3a2-2657-4afd-9729-c9f683e09062.png)



Trying to dump the boolean value in the code, it's true! So the check at line 158 is not the failure point.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795365792-fd05ba46-70ae-4322-ab07-9239b1b5661d.png)



The reason install.lock isn't generated is not because of a double include, nor because the same variable is defined twice.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578799654577-bc165bb0-f57a-4964-9f3a-da68c4dbd15f.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578802013716-ffd7a1af-e171-481b-a71c-cc52e580dca9.png)

A local test including the file twice runs normally:

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1637211091017-aa53068b-f760-45da-aee1-28453b087ec5.png)

The real reason is that **an error occurred**: execution stops at line 156, so the logic after line 160 that writes install.lock is never reached.

![](https://cdn.nlark.com/yuque/0/2020/png/1578802013716-ffd7a1af-e171-481b-a71c-cc52e580dca9.png)

Besides this, because the encoding is set to gbk, the whole application is vulnerable to gbk wide-byte injection.

# 0x02 Global gbk Wide-Byte Injection

At `admin\include\common.inc.php:26`, user input is uniformly processed with addslashes.![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578796696140-34e5062e-2567-4259-9c21-3ce12ddc939d.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578796867724-299c55bd-9535-4aad-bd1c-7032cc31bcd9.png)

In install/index.php, filtering is missing, so the escaping backslash \ gets swallowed, leading to injection.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795788870-eda47cfd-0596-45a2-9305-78ac892d36ac.png)



# 0x03 Getting a Shell at the Installation Step
Using `**%df + "/" => "運"**`, the escaping '\' is consumed and malicious content is injected directly. Note that the percent sign in `%df` will be URL-encoded as `%25`, so you need to change it back to % in burp. Otherwise the malicious code cannot be injected, as shown:

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578801721901-bac41452-c13b-43c1-a536-0fab0c5f2918.png)



# 0x04 XSS in Multiple Places
The parameters in the user profile for MSN, QQ, office phone, home phone, mobile, and address are all HTML-entity escaped, so there is no XSS there.

However, under "User Management >> My Profile", user input is written directly into the page, so XSS exists everywhere the user's avatar can be seen, such as the homepage.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1580783981422-7f0fa2e9-faf5-4fed-b04b-8d391fcedf4a.png)

# 0x05 Command Execution in uccode.class.php


First, a quick introduction to backreferences in PHP regex matching, usually written as `${1}, ${2}` or `\\1, \\2`. The two usage styles are shown in the image below.



> A backreference is a mechanism in preg_replace($pattern, $replacement, $subject) that recombines the capturing groups (atomic units) captured in $pattern.
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1580787139061-9230eef6-4ed6-482f-9a22-5f954c129554.png)

For example, at line 35 above, `\\1` stands for `(=((https?|ftp|gopher|news|telnet|rtsp|mms|callto|bctp|ed2k|thunder|synacast){1}:\/\/|www\.)([^\[\"']+?))?`, and `\\5`



The problem here is the use of the `preg_replace /e` modifier. A quick search shows this mode can lead to command execution — PHP evaluates $replacement as PHP code — so this is our code injection point.



```php
function complie($message) {
  $message = htmlspecialchars($message);
  if(strpos($message, '[/code]') !== FALSE) {
  $message = preg_replace("/\s*\[code\](.+?)\[\/code\]\s*/ies", "\$this->codedisp('\\1')", $message);
		}
    
  if(strpos($message, '[/url]') !== FALSE) {
  $message = preg_replace("/\[url(=((https?|ftp|gopher|news|telnet|rtsp|mms|callto|bctp|ed2k|thunder|synacast){1}:\/\/|www\.)([^\[\"']+?))?\](.+?)\[\/url\]/ies", "\$this->parseurl('\\1', '\\5')", $message);
		}
    
  if(strpos($message, '[/email]') !== FALSE) {
  $message = preg_replace("/\[email(=([a-z0-9\-_.+]+)@([a-z0-9\-_]+[.][a-z0-9\-_.]+))?\](.+?)\[\/email\]/ies", "\$this->parseemail('\\1', '\\4')", $message);
		}
```

# Postscript
There are a few other interesting spots, but they can't be chained together for exploitation. I've collected them here for reference.

# PHP Weak Typing
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578805270942-f55720c5-a3bc-453a-88d1-f2003e8b2aec.png)



Setting aside the parts that violate coding standards (binary operators should have one space on each side, after all), this code also incorrectly uses the loose comparison `==` operator: when both sides take special values, the check can still pass.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578841430009-118fda11-0697-4b0b-8b66-6b08d32065b3.png)
