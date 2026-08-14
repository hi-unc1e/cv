---
title: "Reverse OpenRouter"
slug: iy7k17ehlduoblsm
translationKey: iy7k17ehlduoblsm
date: 2026-04-26T12:10:14+08:00
source: yuque/penetration
tags:
  - Agent
  - Red Team
---

Reverse-proxy the OpenRouter AI API through an overseas server to work around regional access restrictions.




## Background (SCQA)
**S - Situation**

Overseas AI services (image generation, chat, etc.) are typically accessed through aggregator platforms like OpenRouter that offer a unified API, compatible with the OpenAI SDK.

**C - Complication**

These services impose access restrictions on mainland China — if the requesting source IP is identified as originating from within China, service is refused outright.

**Q - Question**

How can you access the OpenRouter API normally from within China, without exposing the existence of the proxy service?

**A - Answer**

Deploy an Nginx reverse proxy on a US server so that all requests are made from an overseas IP. Access it via the custom domain `openrouter.ai.XXX`: the root path returns a decoy page, and only the `/api/v1` path provides the proxy service.





## Deployment
[https://github.com/hi-unc1e/reverse_openrouter](https://github.com/hi-unc1e/reverse_openrouter)






```bash
docker build -t openrouter-proxy .
docker run -d -p 80:80 --restart unless-stopped openrouter-proxy

```




## Usage
Just change the API address to the proxy domain; the API key stays the same:

+ **iOS**: [Kelivo](https://apps.apple.com/cn/app/kelivo/id6752122930) — in settings, enter the custom API address `https://openrouter.ai.XXX/api/v1` and your OpenRouter API key
+ **Android**: [Rikka Hub](https://docs.rikka-ai.com/) (not configured yet)

Code calls work the same way:

```python
client = OpenAI(
    base_url="https://openrouter.ai.XXX/api/v1",
    api_key="<YOUR_OPENROUTER_KEY>",
)
```



Final result, 🐶

![](https://cdn.nlark.com/yuque/0/2026/png/166008/1777176723980-1d180b2e-b08f-48bf-a857-9089c9d5f437.png)

