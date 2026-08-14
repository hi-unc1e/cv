---
title: "从字节招聘页没有「岗位发布时间」说起（含完整脚本与SOP）"
slug: dh59ixdgdcrbhfil
date: 2025-05-18T20:04:41+08:00
source: yuque/penetration
---

# 起因
按惯例，最近了解一下行业的机会。打开字节跳动的 [招聘官网](https://jobs.bytedance.com/referral/pc/position/)，准备看看相关岗位的要求。



点进去某个职位后，发现了一个头疼的事情：



页面上**没有显示岗位的发布时间**。



这事很怪。你不标时间，我怎么知道这个岗位是刚挂上去的，还是去年就一直在的老古董？<font style="color:#74B602;">总不能每个都投吧</font>。

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747568499814-86616f6f-d36c-4441-81cf-d6889321edea.png)



打开 F12，翻翻接口呢——果然，在 AJAX 接口里找到了发布时间字段：

```javascript
"publish_time": 1746539100047
```

![AJAX 接口中的岗位发布时间](https://cdn.nlark.com/yuque/0/2025/png/166008/1747569619571-869d6e0c-9bdb-4d26-a854-d835352f6eaa.png)

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747570435677-5a676df1-2fc6-4a91-8cf9-2cc5768fad3a.png)



也就是说，**岗位发布时间是有的**（时间戳格式）**，只是页面没展示出来。**

****



# 想法
> 怎么复用这种能力？——“每个岗位都开 F12 看时间戳……”🤡
>

你说这时候怎么办？



作为一个资深的安全研究员，我第一反应不是找客服，而是动手搞个浏览器插件——



写了一个油猴（Tampermonkey）脚本来增强页面功能，干的事很简单也很粗暴，从用户的浏览器层面实现了：

+ “劫持”岗位详情页加载时的接口
+ 从接口响应中提取 `publish_time` 
+ 将其格式化为“发布日期”，插入到页面上的对应位置，像是本来就属于那里的似的



现在每次打开岗位详情页，就能直接看到这条信息，非常丝滑。



# ✅ 效果预览
**效果一图胜千言**



👇 页面增强前：

+ 岗位信息中没有发布日期，用户无法判断是否为旧岗。

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747570543264-bb82988b-6791-44d5-8166-595d6614d917.png)





👇 页面增强后：

+ `发布日期：2025/05/02 08:46:16`
+ （信息被插入到 `.job-info` 模块的最后一项）

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747570564951-6ecd76c1-13cb-4465-91bd-ce6212b9fb6c.png)



---

# 🧩 核心代码原理
写都写到这里了，简单介绍下脚本的参数：

+ 使用 `XMLHttpRequest.prototype.open/send` 劫持特定 AJAX 请求；
+ 利用 `MutationObserver` 等待 DOM 完整加载——确保在页面异步加载时也能正常插入。
+ 加入 `DEBUG` 模式，方便快速调试与复用。



而且，我还把它封装成了一个可复用的模板脚本，抽象出「请求路径通配规则」、「字段提取函数」、「DOM 注入函数」三个变量，简单易上手。



以后不管是看电商商品、查新闻发布、看 JD 页面，只要你想“自动提取某个字段 + 插入页面展示”，都能直接拿去套用，改改参数就行。



👉 GitHub Gist 地址： [ajax-inject-template.user.js](https://gist.github.com/hi-unc1e/f120fa570ab557d8e658f699dd18684e)



写这个小东西，其实不是为了“炫技”。



就是那种事，你看到一个 bug、一个缺口、一个可以优化的点，然后心里一痒，不搞点什么就不舒服。



This is why we are here～



如果你也有类似的需求，不妨试试看。

---



# 有趣的发现
今天是 2025 年 5 月 18 日，然而我点进去一个职位，咱脚本显示的发布日期是——

![](https://cdn.nlark.com/yuque/0/2025/png/166008/1747568914179-29c0de22-4bf8-44d9-af5d-20c8829e2e61.png)

🧓 <font style="color:#8CCF17;">2023 年 12 月</font>



所以，它还在招吗？还是……



这就值得深思了……



# 📌附录： SOP（代码如何使用）
1. 安装浏览器插件：Tampermonkey；
2. 新建脚本，将我提供的模板粘贴进去；
3. 修改：
    - `@match` ，为你想增强的页面；
    - `AJAX_URL_GLOB` 为接口通配地址（如 `<font style="color:rgb(150, 208, 255);background-color:rgb(33, 40, 48);">/api/v1/job/posts/*</font>`）；
    - `EXTRACT()` 指定要提取的字段；
    - `INJECT()` 定义页面插入位置；
4. 刷新页面，即可看到自动增强效果！



```javascript
// ==UserScript==
// @name         通用 AJAX 劫持 & 页面增强模板
// @namespace    https://unc1e.cn/
// @version      1.0
// @description  劫持指定 AJAX 接口，提取字段并插入页面，可调试 +复用
// @grant        none
// @run-at       document-start
// @match        https://jobs.bytedance.com/referral/pc/position/*
// ==/UserScript==

(function () {
  'use strict';

  // ===== 🔧 配置区 =====
  const CONFIG = {
    DEBUG: true, // 是否启用调试日志
    AJAX_URL_GLOB: '/api/v1/job/posts/*', // 👈 要劫持的 AJAX_URL（更友好的通配写法，无需转义）
    EXTRACT: (json) => json?.data?.job_post_detail?.publish_time, // 👈 自定义AJAX 响应的提取逻辑
    INJECT: (value) => {
      const container = document.querySelector('.job-info'); // 👈 要注入的目标位置
      if (!container || document.querySelector('#inject-custom')) return;

      const divider = document.createElement('div');
      divider.className = 'lineDevider__3u51h';

      const span = document.createElement('span');
      span.id = 'inject-custom';
      span.innerText = `👈 发布日期：${formatDate(value)}`;

      container.appendChild(divider); // 👈 注入位置
      container.appendChild(span);
    }
  };

  // ===== 🧠 工具函数 =====
  const log = (...args) => CONFIG.DEBUG && console.log('[🌐AjaxInjectTemplate]', ...args);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const globToRegex = (pattern) => {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 转义正则保留符号
      .replace(/\*/g, '.*');                 // * -> .*
    return new RegExp(escaped);
  };

  const AJAX_URL_REGEX = globToRegex(CONFIG.AJAX_URL_GLOB);

  let cachedValue = null;
  const tryInject = () => {
    if (!cachedValue) return;
    CONFIG.INJECT(cachedValue);
  };

  // ===== 🔍 劫持 XHR =====
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    const xhr = this;
    if (AJAX_URL_REGEX.test(xhr._url)) {
      log('🎯 拦截到目标请求：', xhr._url);
      const origOnReady = xhr.onreadystatechange;

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            const json = JSON.parse(xhr.responseText);
            const value = CONFIG.EXTRACT(json);
            if (value !== undefined) {
              cachedValue = value;
              log('📦 提取到值：', value);
              tryInject();
                        } else {
                            log('⚠️ 提取字段失败，返回 undefined');
                        }
                    } catch (e) {
                        log('❌ JSON 解析失败：', e);
                    }
                }

                if (origOnReady) origOnReady.apply(this, arguments);
            };
        }
        return origSend.apply(this, arguments);
    };

    // ===== 👀 DOM 监听器 =====
    const observer = new MutationObserver(tryInject);
    observer.observe(document, { childList: true, subtree: true });
})();

```

