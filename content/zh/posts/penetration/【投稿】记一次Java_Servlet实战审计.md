---
title: "【投稿】记一次Java Servlet实战审计"
slug: hq8g81
translationKey: hq8g81
date: 2021-01-24T11:10:37+08:00
source: yuque/penetration
---

本文首发于阿里云先知社区[记一次Java Servlet实战审计 - 先知社区](https://xz.aliyun.com/t/9153)，转载请注明出处。

感谢观看！

# 0x00    背景
某次渗透中，遇到个jsp的站，弱密码进到后台以后，却发现功能很少，并不好搞，简单排查后并无突破，然而老大给的要求是尽快搞到shell。。。

一番梳理后，我的想法是：要么通过漏洞拿下后台，要么搞到源码直接白盒开冲。白盒的话很香，对审计能力提升也大，所以可以按下面几步来试试：

+ **目录扫描。**使用`dirbuster`的字典`directory-list-2.3-medium.txt`指定后缀`jsp`来扫，工具就随便用个顺手的，`dirseach`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611458801512-d7a73935-934e-4c92-8428-951345b1e893.png)

+ **网盘泄露。**这套系统并不开源，估计厂家发版的时候放了不少在网盘，简单一搜就有结果了。在网盘搜索引擎上，搜到了厂家安装包，但似乎是PE文件，还得安装，且不清楚是否有混淆/加密，暂搁置。

内心OS：这年头——可不敢乱点。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611459974562-f750b863-11fb-4fb6-82b1-d4350797559b.png)



+ **Github、gitlab泄露。**尝试了多个关键词，均无果

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611459787783-51cf6d20-c845-41f3-ac09-0f43beacaa7f.png)





+ **Fofa找同类型的站。**这个无需多说，不管是发版的时候没有把备份文件删除，还是运维的疏忽大意，都是很容易被发现的。同时，在fofa上，用`favicon.ico`，或是用title来搜，准确率都相当惊人

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611460138521-29925b95-c474-4157-98e2-65bc1c567405.png)

那工具方面，首先是选用了`broken5`师傅的[https://github.com/broken5/WebAliveScan](https://github.com/broken5/WebAliveScan)，1024个线程猛冲之后，却并无发现。。。

考虑是不是字典不够牛，接着使用`dirsearch`自带的字典（约17,000条），

```basic
# 只要字典大，没有拿不下
python3 dirsearch3.py -e "jsp" -l ip_port.txt -t 50 --plain-text-report=ip_port_DirScan.txt  -q
```

跑目标列表花了一个上午，终于有了收获——`web.rar`，香！

天黑了，打开IDEA！天亮了，关闭IDEA。



我发现`jsp`的代码虽然不难懂，可基础知识不牢，代码审起来简直让人打脑壳，于是有了下面这第一章。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611758970677-03e4802b-2f7e-4a63-89b9-d23cc1770873.png)



# 0x01    Servlet简介
![](https://cdn.nlark.com/yuque/0/2021/jpeg/166008/1611461827709-d59442e2-aa87-4b15-bd70-ae64acc92b92.jpeg)

正常情况下的目录结构，长下面这样

```basic
exampleApp
└─images
└─WEB-INF                             
│   ├─classes     # 包含了所有的 Servlet 类和其他类文件【重要】
│   │    └─com	
│   │				└─example
│		│
│   └─lib					# 项目依赖包的储存位置（.jar文件）
└─web.xml					# Servlet的配置文件【重要】
```

**定义路由**

路由的定义，可以在这两个地方进行：`Servlet注解`、`web.xml`, 配置的时候二选一即可。

## Ⅰ    Servlet中的注解
```java
@WebServlet("/Hello")
public class HelloServlet extends HttpServlet{
　　//处理 GET 方法请求的方法
　　public void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		response.setContentType("text/html;charset=UTF-8");
		//实现的代码
  }

　　//处理POST方法请求的方法
　　protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		response.setContentType("text/html;charset=UTF-8");
		//实现的代码
  }
}
```

Servlet3.0之前，需要在web.xml中配置，才能够使用Servlet，这一块由于路由跟逻辑并不在一块儿实现，比较陌生，因此我们重点看下它。

## Ⅱ    配置文件`web.xml`
Java项目中的`web.xml`，可以配置web的路由，里面的属性很多，咱们主要关心两条：

1. **<servlet-class>**对应类的名字
2. **<url-pattern>，**路由。为servlet提供一个缺省的URL：`http://host/webAppPre   fix/servlet/ServletName`

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE web-app
    PUBLIC "-//Sun Microsystems, Inc.//DTD Web Application 2.3//EN"
    "http://java.sun.com/dtd/web-app_2_3.dtd">
<web-app>
  <servlet>
    <servlet-name>HelloServlet</servlet-name>
    <servlet-class>com.example.HelloServlet</servlet-class>
  </servlet>
  
  <servlet-mapping>
    <servlet-name>HelloServlet</servlet-name>
    <url-pattern>/Hello</url-pattern>
  </servlet-mapping>
</web-app>
```

## Ⅲ    jsp:useBean标签
同时，在`jsp`代码的开头，看到大量使用`<jsp:useBean...`的代码，见图片中的第2~4行。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611753548902-098650de-5127-4c9c-ab5e-7e342ba916b9.png)

这东西，叫`**<jsp:useBean>**`**标签，**它的定义，整理出来是这样的：

> `<jsp:useBean>`标签可以在JSP中声明一个`JavaBean`，然后使用。
>
> + 声明后，`JavaBean`对象就成了脚本变量，可以通过脚本元素或其他自定义标签来访问。
> + `<jsp:useBean>`标签的语法格式如下：
>     - **id值**，可随意定义，只要跟上下文不重复；在习惯上，跟`class`的最后一级相同（`HttpSession`）；
>     - **scope值**，可以是`page`，`request`，`session`或`application`，分别对应不同的作用范围，注意不要将【需要经常变动的 `bean`】 的 `scope `设为 `application` 或 `session`
>     - **class值**，指定对应的`java`类；一般是`WEB-INF/classes/`为起点的一个相对路径（用**点**作路径分隔符）
>

```basic
<jsp:useBean id="HttpSession" scope="session" class="example.HttpSession"/>
```

而`JavaBean`，个人认为就是Java的一种对象，遵循一些规范，有一些特征。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611754026153-6ec6f706-538f-4449-b876-1d495cc47ec7.png)

因此，在审计时，只需先在jsp文件中找敏感函数，根据当前文件中的标签定义，找到定义函数的`.class`，完成漏洞的确认就好了。用IDEA可以很方便地进行查看。



## Ⅳ    取HTTP参数
JSP中取request参数的写法，虽然非常好理解，但对小白来说，也是有一些需要注意的点。

```java
<%@ page contentType="text/html; charset=gb2312" language="java" errorPage="" %>
    ...
<% 
String id;  
id = request.getParameter("id");

// 处理中文
String name =new String(request.getParameter("name").getBytes("ISO-8859-1"),"UTF-8");
...
```

上面这段代码中，使用`request.getParameter`来接受client发送的HTTP参数。但对于id参数，无论你以`GET`、还是`POST`方法来提交的，都能被server接收。

也就是说：`request.getParameter`是兼容`POST/GET`参数滴！有点像PHP中的`$_REQUEST`方法。

同时，对于中文数据，需要对其转码，才能正常显示。

当然，JSP中还有其它取参数的写法，由于并未在本次渗透中出现，也就不再赘述。感兴趣的师傅可以自行了解。

## Ⅴ    文件的包含
此外，在项目中还出现了文件包含的写法

```java
<%@ include file="check.jsp"%>
```

经过一番学习，这个跟PHP中的文件包含有点像

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611756203005-889a3925-0a35-46fc-9019-93fddc13a3db.png)

那看看`check.jsp`的内容吧，

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611756312134-33b2f18a-2c96-4691-a199-4a0acf17777a.png)

很明显，下面这段代码一出现，就意味着本页面的功能属于后台功能了。

```java
<%@ include file="check.jsp"%>
```

不过呢，我还有一点没搞懂，又没看到有`exit`函数，为啥include以后的代码，走到`out.print`以后就不再执行了呢？估计跟`servlet`的生命周期有关。有了解的师傅麻烦在评论区抬一手。

OK，基础知识补充得差不多了，下面开冲，尝试完成前台RCE的挖掘。

# 0x02    后台SQLi
轻松找到一处注入，无任何过滤。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611757617173-a9f14611-c72e-42e0-886d-f090a85f6bc3.png)

不过，考虑到可能需要SQLMAP作自动化利用——删除型的注入点，还是算了。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611757895270-262d246b-fe35-40b5-a441-cac849331997.png)

那么，又重新找到一处拼接表名的注入点。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611758052914-0b9d23d2-4c76-4088-ba12-0f06f67072a3.png)

但问题又来了，这个测试环境的数据库文件，我之前作目录扫描的时候是搞了一份的，找半天咋找不到`task_`开头的数据表呢？？？

没办法，只能FUZZ了，采用`SecLists`里面的`raft-large-words.txt`来进行FUZZ。哈哈，果然没用！

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611758319233-a60c0444-37e9-4b4b-8a3e-baaae267e968.png)

最后，审计呗，找到一处完美注入点，既不伤害数据库，又不需要花里胡哨地FUZZ。SQLMAP跑的结果如下：

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611757247235-1fbcf2ea-5f09-404a-b29d-2cbec32d1bd0.png)

注意到是DBA权限，且通过大小写判断目标是Windows环境。

对我来说，一是想到可以用UNC地址进行带外注入（可以，但在联合注入面前，没必要）；

二是写webshell。一般而言，windows通过注入写webshell比linux更难一些，因为路径相对更难猜。不过，由于我手上有系统的部分源码，很快翻找到了web路径，是`C:\example`，尝试使用`--os-shell`写shell，并不成功；一开始还猜测是当前环境更换了盘符，结果26个字母捋了一遍，都不成功。。。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611758995611-cee0f074-1bcb-4db8-b813-1e508db34c8a.png)



# 0x03    路径泄露 => 后台getshell
天无绝人之路啊。我回想起目标环境的Tomcat似乎很拉跨，并未对报错进行屏蔽，经常露源码出来，嘿嘿！

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611759215946-8b6080f0-102e-4796-90cf-e35815ea9162.png)

通过让后台备份功能产生报错，成功获得路径`d:\exam\bak\`

接着通过`SQLMAP --os-shell`参数，也是不费工夫就拿到了SQLMAP的shell，允许上传任意文件了。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611759580818-b28e4a01-5923-4b41-9525-b74a4d40049f.png)

# 0x04    前台getshell
话又说回来，目前这个目标是拿下来了，可毕竟是弱密码，难免被诟病“不讲武德”。

于是，全局搜索没有包含`check.jsp`的代码，发现一处前台SQL注入。。。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611760349654-9eb3efe0-438c-43c3-afad-d108f66879bb.png)

好的，前台getshell的方式有了，不过要知道目标环境的web路径才行，但考虑到该产品差不多采用的都是销售OEM服务器的形式，基本不会出太大岔子。



感谢观看，本文主要是简单的代码审计，有很多思路不到位的地方，请各位师傅不吝指点！

# Refs
+ [https://www.runoob.com/servlet/servlet-writing-filters.html](https://www.runoob.com/servlet/servlet-writing-filters.html)
+ [https://www.w3cschool.cn/jsp/jsp-javabean.html](https://www.w3cschool.cn/jsp/jsp-javabean.html)
+ [https://www.cnblogs.com/sharpest/p/6117629.html](https://www.cnblogs.com/sharpest/p/6117629.html)

# 0x05    复盘
TODO思维导图。

## 1、为什么不去搞401认证？
主要还是TCL，又嫌Burp跑401认证有些小麻烦，主要还是成功率太低。那么优化的Action，总结为两条

### Action
+ ~~总结了相关经验：~~[~~渗透中401认证的那点事儿~~](http://yuque.com)



+ 开发了脚本[**BAP-Suite**](https://github.com/hi-unc1e/BAP-Suite)**，**很粗糙.....而且懒得去改

****

## 2、为什么一开始没有深入审计？
一开始进去是通过弱密码呀，说不定是千万人搞过的站了，找漏洞：扫描器不敢开，手工测成本又高，必须另辟蹊径，先搞源码，有道理吧。但后续发现，找源码的工作量也不小，所以优化的Action可以从下面着手

### Action
+ ~~开发一键查源码系统，整合github API、百度网盘搜索引起、Fofa/Zoomeye/Shodan 上的gitlab、Gogs、HTTPServer等内容~~

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1611460564751-aa684ba0-f5f6-4352-aee8-2163a3f17d9a.png)

（刚写好README）🤭



