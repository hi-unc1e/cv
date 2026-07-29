---
title: "Minimax2.7 发布，我被 API_Key 设置坑了2小时（🤡山羊背锅）"
slug: yak-shaving-on-minimax-api
date: 2026-03-18T23:39:59+08:00
source: yuque/penetration
---

今天花36$， 开通了 minimax 国际版的 Token Plan套餐——决策理由是： minimax2.7 发布了，据说是高中生的 idea，因此 minimax 提供了加速套餐---可以跑到每秒 100Tok，比起别家，可以说相当快了。



开通之后，用来干活效果也蛮好的。

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773848306471-2624d17b-4cab-4d31-8b65-0cede8ff0d3a.png)



不过，因为「API 识别错误」的问题，频繁提示`"insufficient balance (1008)"`，耽误了好几个小时才解决…………



时间是最宝贵的。



因此，在这篇文章中，我会对我配置的过程，做个简要的回顾。

# OpenClaw
openClaw 的配置是下面这样，要点是：

+   "api": "`<font style="color:#DF2A3F;">anthropic-messages</font>`",
+ 端点是：  ` "base_url": "https://api.minimax.io/<font style="color:#DF2A3F;">anthropic</font>",`



```json
{
  "provider": "minimax",
  "base_url": "https://api.minimax.io/anthropic",
  "api": "anthropic-messages",
  "api_key": "sk-cp-xxxx-xxxx-WpQ",
  "model": { "id": "MiniMax-M2.7-highspeed", "name": "MiniMax-M2.7-highspeed" }
}
```







# claude code配置
```json
 {
    "ANTHROPIC_BASE_URL": "https://api.minimax.io/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "sk-cp-x-xxxxx",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1,
    "ANTHROPIC_MODEL": "MiniMax-M2.7",
    "ANTHROPIC_SMALL_FAST_MODEL": "MiniMax-M2.7-highspeed",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "MiniMax-M2.7-highspeed",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "MiniMax-M2.7-highspeed",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "MiniMax-M2.7"
  }
```

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773848355701-72b7be13-c63a-4a86-8f46-57e0a5b35260.png)



# OpenAI端点配置
```json
https://api.minimax.io/v1
apikey 相同
```



![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773848196997-c5892e04-436c-40ad-b8a8-24150b3b9cd4.png)



# 结论
应该用下面的 Token Plan Key，否则会提示余额不足（🤡）





至于我为什么要一直跑通 OpenClaw，那只是因为下班后没事做……非要搞点正反馈，于是“<font style="color:#74B602;">给山羊剃了一晚上的毛…………</font>”（解释见评论区）



不接受平静，也是一种病态吧。

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1773847538145-b2f772d7-1ac4-4b3b-890b-d26ede58ebba.png)

