---
title: "如何在WordPress里完美支持语雀导出的Markdown(支持图片)"
slug: yongnb
date: 2020-11-05T19:38:57+08:00
source: yuque/penetration
---

# 语雀导出设置
![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604577012099-8d710be3-f190-4954-a919-21eeca26598b.png)

# WordPress设置
## 使用markdown插件
插件的名字叫:Editor.md

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604576798592-9afa6ec3-92dd-4c7f-96bb-655833de5f4c.png)

插件的高亮效果如下图所示

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604576848118-4d86e8a8-7b37-44d3-8902-5c6042ea6b25.png)

## 改header.php
在这里需要注意: 否则会出现在`html`中通过`img`标签引入的图片会报`403`。但是这个图片地址直接复制出来在地址栏打开，却是看得到的。这就是`referer`来源地址的问题

将`<meta name="referrer" content="no-referrer" />`加到`header.php`中, 即可

![](https://cdn.nlark.com/yuque/0/2020/png/166008/1604576718339-51ad4a15-184c-4745-b017-5f5250e76348.png)



最终, 就实现了语雀作为图床，跨平台书写`Markdown`的效果, 不可谓不舒服。

