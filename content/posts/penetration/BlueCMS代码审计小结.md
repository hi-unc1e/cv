---
title: "BlueCMS代码审计小结"
slug: rvdfk6
date: 2020-01-12T10:02:24+08:00
source: yuque/penetration
---

# 0x00 基础快捷键
Sublime

+ 下一个词组：Ctrl+D
+ 书签：Ctrl+F2、F2
+ 展示函数：Ctrl+E
+ 选中本行：Ctrl+L
+ 匹配的括号：Ctrl+M

# 0x01 可重复安装
正常安装完成后，存在可重复安装的问题，因为install.lock未能生成.

freebuf有篇文章说，问题出在insall/index.php的158行，错误地使用了is_writable函数。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795057671-7c251453-b762-4cc1-90e1-3db6d081431c.png)

可是经过验证，发现并不是由这个函数导致的可重复安装问题



首先，找一下php官方手册

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795842491-0701f3a2-2657-4afd-9729-c9f683e09062.png)



在代码里试着把布尔值dump出来看，是true！看来并不是158行的判断出错了

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795365792-fd05ba46-70ae-4322-ab07-9239b1b5661d.png)



之所以没有生成install.lock, 不是因为include了两次, 也不是相同的变量define了两次

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578799654577-bc165bb0-f57a-4964-9f3a-da68c4dbd15f.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578799338686-5f3cbbb3-5043-4372-84ee-bc0e762c95f1.png)

本地测试include两次,可正常运行

![](https://cdn.nlark.com/yuque/0/2021/png/166008/1637211091017-aa53068b-f760-45da-aee1-28453b087ec5.png)

而是因为**发生了错误**, 在156行便停止运行, 所以就没有走到160行以后的写install.lock的逻辑

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578802013716-ffd7a1af-e171-481b-a71c-cc52e580dca9.png)

除此之外, 由于编码被设置成了gbk, 导致全局都存在gbk宽字节注入的问题

# 0x02 全局存在gbk宽字节注入
  
`admin\include\common.inc.php:26处,`对用户入参进行了统一的addslash处理.![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578796696140-34e5062e-2567-4259-9c21-3ce12ddc939d.png)



![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578796867724-299c55bd-9535-4aad-bd1c-7032cc31bcd9.png)

在install/index.php，缺少过滤，直接使转义符号\被吞掉, 导致注入

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578795788870-eda47cfd-0596-45a2-9305-78ac892d36ac.png)



# 0x03 安装处拿shell
利用`**%df + "/" => "運"**` ，吃掉'转义用的'\', 直接注入了恶意内容, 需要注意的是`%df`里面的百分号会被url编码成`%25`，需要在burp里改回为% . 否则不能注入恶意代码，如图

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578801721901-bac41452-c13b-43c1-a536-0fab0c5f2918.png)



# 0x04 多处xss
个人资料中<font style="background-color:rgba(0, 0, 0, 0.06);">MSN：QQ：办公电话：家庭电话：手机：地址</font>的参数都是经过html实体转义的, 不存在xss问题

可是, 在"用户管理>>我的个人资料"处, 存在将用户输入直接写进页面的操作,导致首页等能看到用户头像的地方都存在xss

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1580783981422-7f0fa2e9-faf5-4fed-b04b-8d391fcedf4a.png)

# 0x05 uccode.class.php命令执行


首先介绍一下php正则匹配中的后向引用，一般用`${1}, ${2}`或者`\\1, \\2`来表示，如下面图中的两种使用方式



> 后向引用是在preg_replace($pattern, $replacement, $subject)中，将$pattern中的原子参数（`Capturing Group`）重新组合的一种实现。
>

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1580787139061-9230eef6-4ed6-482f-9a22-5f954c129554.png)

例如上面35行那里，`\\1`代表`(=((https?|ftp|gopher|news|telnet|rtsp|mms|callto|bctp|ed2k|thunder|synacast){1}:\/\/|www\.)([^\[\"']+?))?`， `\\5`



而这里的问题在于使用了`preg_replace /e`的模式, 稍加搜索就能发现, 这种模式可能导致命令执行, 即php会把$replacement当成php代码执行 , 所以这里就是我们的代码注入点.



```php
function complie($message) {
  $message = htmlspecialchars($message);
  if(strpos($message, '[/code]') !== FALSE) {
  $message = preg_replace("/\s*\[code\](.+?)\[\/code\]\s*/ies", "\$this->codedisp('\\1')", $message);
		}
    
  if(strpos($message, '[/url]') !== FALSE) {
  $message = preg_replace("/\[url(=((https?|ftp|gopher|news|telnet|rtsp|mms|callto|bctp|ed2k|thunder|synacast){1}:\/\/|www\.)([^\[\"']+?))?\](.+?)\[\/url\]/ies", "\$this->parseurl('\\1', '\\5')", $message);
		}
    
  if(strpos($message, '[/email]') !== FALSE) {
  $message = preg_replace("/\[email(=([a-z0-9\-_.+]+)@([a-z0-9\-_]+[.][a-z0-9\-_.]+))?\](.+?)\[\/email\]/ies", "\$this->parseemail('\\1', '\\4')", $message);
		}
```

# 后记
还有几个地方比较有趣，但是不足以串联起来利用，此处汇总起来，供各位参考

# PHP弱类型
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578805270942-f55720c5-a3bc-453a-88d1-f2003e8b2aec.png)



除去不符合代码规范的部分（双目运算符左右要有1个空格的嘛），这里还错误地使用了不严格比较的`==`运算符，在两边取值都特殊的情况下，也能通过判断。

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1578841430009-118fda11-0697-4b0b-8b66-6b08d32065b3.png)

