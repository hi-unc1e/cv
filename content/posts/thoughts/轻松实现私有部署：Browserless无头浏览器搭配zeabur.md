---
title: "轻松实现私有部署：Browserless无头浏览器搭配zeabur"
slug: il43gl7515qd1dap
date: 2024-10-01T10:10:44+08:00
source: yuque/thoughts
---

# 项目介绍
**<font style="color:rgb(60, 60, 67);">引言</font>**

在现代Web开发和测试领域，无头浏览器已经成为不可或缺的工具。它们能够在没有图形用户界面的情况下加载并渲染网页内容，广泛应用于自动化脚本、网页测试、网页截屏及爬虫等场景。然而，传统的无头浏览器部署和管理方式往往复杂且耗时。为了解决这一问题，Browserless项目应运而生。



本文展示了Browserless的技术细节，同时给出了实际操作的指南，希望对这个项目感兴趣的人带来帮助。



**<font style="color:rgb(60, 60, 67);">项目特点</font>**

+ **<font style="color:rgb(60, 60, 67);">支持多种无头浏览器</font>**<font style="color:rgb(60, 60, 67);">：如Chrome和Firefox，确保了广泛的兼容性和适用性。</font>
+ **<font style="color:rgb(60, 60, 67);">简单的API调用</font>**<font style="color:rgb(60, 60, 67);">：用户可以通过API远程控制浏览器执行页面访问、操作DOM、执行JavaScript代码等操作，非常适合构建自动化测试套件、网页数据抓取服务或是任何需要与Web交互的后端服务。</font>



访问GitHub仓库（[https://github.com/browserless/browserless](https://github.com/browserless/browserless) ），可以获取更多技术细节、文档和支持信息。



# 部署
我这里直接采用 zeabur 平台来部署 browserless，地址：[https://zeabur.com/zh-CN](https://zeabur.com/zh-CN)。

当然，直接用 docker 部署也是可行的，[点击查看](https://docs.browserless.io/docker/quickstart#tag/Management-REST-APIs/paths/~1/get)

```python
$ docker run \
  --rm \
  -p 3000:3000 \
  -e "CONCURRENT=10" \
  -e "TOKEN=6R0W53R135510" \
  ghcr.io/browserless/chromium
```



操作方法：

「新建项目」，选择核实的地区，搜索「Browserless」，启动服务，生成一个免费域名

1. 我这里选的 Frankfurt（德国比美国更快一点；如果选上海的实例，需要域名备案才能对外暴露访问；）
2. Browserless 的域名：<font style="background-color:#81BBF8;">happy-holiday-bro.zeabur.app</font>
3. 在环境变量中，记录 API 调用凭据（`PASSWORD` 变量）





![选地区](https://cdn.nlark.com/yuque/0/2024/png/166008/1727749298501-54ea9a5f-39cc-4d1c-84c3-0067edafeee9.png)

![搜一下](https://cdn.nlark.com/yuque/0/2024/png/166008/1727749421486-b425801e-ec2f-43e1-9712-59c04b475c87.png)

![自定义一个域名](https://cdn.nlark.com/yuque/0/2024/png/166008/1727749567371-e5544604-5dc6-47c1-802e-390a99cff774.png)

![查看 Token](https://cdn.nlark.com/yuque/0/2024/png/166008/1727751206982-7cc44ace-bcd1-4b99-b1e4-d59f64b3c205.png)



---

# 使用
我们试试访问这个网站：`happy-holiday-bro.zeabur.app`，你会发现打不开，显示的是404错误。这是咋回事呢？

```java
happy-holiday-bro.zeabur.app
```

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1727750113432-65fa7740-8a9f-42e1-9503-c56360fedafe.png)



其实啊，Browserless这个服务，它不像普通网站那样可以直接在浏览器里使用。要想用它，你得通过特定的方法“调用”它。Browserless有两种方式可以和它沟通：

1. 第一种方法，是使用已经设置好的**REST API **[ [点击查看](https://docs.browserless.io/http-apis/apis) ]，这些API能帮你做很多事情，比如生成PDF文件啊，网页截图之类的。  
所以，要是你想访问那个网址成功，就得用这些特别的方法去“敲门”，直接输网址是进不去的。
2. 第二种方法，是通过**SDK**进行集成 [ [点击查看](https://docs.browserless.io/libraries/playwright) ]，例如 Python 下面的Playwright、Pyppeteer、Scrapy、Beautiful Soup

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1727751552007-2dc05a2a-c1f3-4aac-b943-40b47eb5adab.png)

  
因此，若要成功使用Browserless，关键在于调用，且为了安全，默认需要带上 `Token` （=环境变量`PASSWORD`）。

## 使用示例
本节将介绍两种不同的方法来驱动 Browserless【SDK、Http API】，满足以下几个具体的应用需求：

1. **获取浏览器渲染后的动态 HTML源码**：这个场景旨在捕获网页在浏览器完全渲染后的最终HTML结构，包括动态加载的内容和JavaScript执行结果，为<font style="background-color:#E8F7CF;">后续的数据解析与爬取</font>提供准确的基础。
2. **提取页面纯文本内容**：此场景中，我们希望从网页中提取所有可见文本信息，剔除HTML标签及样式信息，<font style="background-color:#E8F7CF;">仅保留用户可直接阅读的内容</font>，适用于文本分析、信息汇总等场景。
3. **获取网页截图**：捕获网页的截图，适用于页面内容变化监控等用途



## Http API
> <font style="color:rgb(28, 30, 33);">浏览器API 可通过 Http REST API，执行特定任务。</font>
>

+ <font style="color:rgb(28, 30, 33);">接口记得添加 </font>`<font style="color:rgb(28, 30, 33);">/chrome</font>`<font style="color:rgb(28, 30, 33);"> 前缀 —— 如</font>`<font style="color:rgb(28, 30, 33);">/content</font>`<font style="color:rgb(28, 30, 33);">接口的完整路径是</font>`<font style="color:rgb(28, 30, 33);">/chrome/</font>content`
+ 完整接口文档请参考：[https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1screenshot%20~1chromium~1screenshot/post](https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1screenshot%20~1chromium~1screenshot/post)

| 接口路径 | 说明 | Description |
| --- | --- | --- |
| `/content` | 返回动态内容的HTML | Returns HTML of dynamic content |
| `/unblock` | 返回受保护网站的HTML、屏幕截图或cookies | Returns HTML, screenshots, or cookies for protected sites |
| `/download` | 返回Chrome下载的文件 | Returns files Chrome has downloaded |
| `/function` | 在不安装库的情况下运行HTTP请求 | Runs HTTP requests without installing a library |
| `/pdf` | 将页面导出为PDF | Exports a page as a PDF |
| `/screenshot` | 返回.png/.jpg 格式的截图 | Captures a .png or .jpg screenshot |
| `/scrape` | 返回结构化JSON数据 | Returns structured JSON data |
| `/performance` | 运行并行的Google Lighthouse测试以进行性能分析 | Runs parallel Google Lighthouse tests for performance analysis |




:::info
**a 获取动态 HTML 源码**

:::

```python
host = "happy-holiday-bro.zeabur.app"
token = "2****************3"

browserless_uri = f'https://{host}/chrome/content?token={token}'
def get_html(url):
    post_data = {
        "url": url,
        "gotoOptions": {"waitUntil": "networkidle2" },
    }
    print(post_data)
    response = requests.post(browserless_uri, json=post_data, headers=header)
    return response.text
    
url = "https://www.baidu.com"
html = get_html(url)
print(html)
```

+ "`networkidle2`" 表示在 500ms 内没有超过 2 个网络连接。

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728198587719-55ef0b60-71fb-49fc-9fb8-04fe473be69e.png)



:::info
**b 提取页面纯文本内容**

:::

完整的文档，请看：

+ [https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1chrome~1scrape/post](https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1chrome~1scrape/post) 

和

+  [https://docs.browserless.io/http-apis/scrape](https://docs.browserless.io/http-apis/scrape)

```python

def get_text(url):
    # 构建请求数据
    post_data = {
        "url": url,
        "gotoOptions": {"waitUntil": "networkidle2"},  # 等待网络空闲
        "elements": [
            {"selector": "body", "timeout": 60000},  # 选择整个body元素，超时时间为60秒
        ],
        "viewport": {"width": 1920, "height": 1080},  # 设置视口大小
        "waitForSelector": {
            "hidden": True,
            "selector": "body",
            "timeout": 60000,
            "visible": True
        }  # 等待body元素可见
    }
    print(post_data)

    # 发送POST请求到Browserless API
    response = requests.post(f'https://{host}/chrome/scrape?token={token}', json=post_data, headers=header)
    _rdata = response.json()

    # 提取响应中的数据
    data = _rdata['data']
    return data



if __name__ == "__main__":
    # 示例：抓取Hacker News首页内容
    data = get_text("https://news.ycombinator.com/")

    # 处理返回的数据
    results = data[0]['results']  # 获取第一个结果（通常只有一个，因为我们只选择了body元素）
    for r in results:
        html = r.get('html')  # 获取HTML内容
        text = r.get('text')  # 获取纯文本内容
        print(text)  # 打印纯文本内容
        print("Html=", len(html), "Text=", len(text))
```

执行效果

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728200574903-15347ca5-e4d4-492d-950b-19e31ab54c43.png)





:::info
**c 获取网页截图**

:::

完整文档请查看：[https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1screenshot%20~1chromium~1screenshot/post](https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1screenshot%20~1chromium~1screenshot/post)

```python
def get_screen_shot(url):
    post_data = {
        "url": url,
        "gotoOptions": {"waitUntil": "networkidle2" },
        "options": {
            "fullPage": True,
            "omitBackground": True,
        }
    }
    print(post_data)
    response = requests.post(f'https://{host}/chrome/screenshot?token={token}', json=post_data, headers=header)
    return response.content


if __name__ == "__main__":
    url = "https://cn.bing.com/search?pglt=163&q=browserless"

    r = get_screen_shot(url)
    # save file to local
    print(r)
    with open("img/sdk_screen.png", "wb") as fs:
        fs.write(r)
```



 执行效果

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728199312653-c0f99eee-aa59-4e94-90f9-996a1b1753a1.png)



****

****

## SDK
> 大多数库都允许您指定要与之交互的 Chrome 远程实例。他们要么在寻找 websocket 接口地址、主机和端口，要么在寻找某个 URL 地址。Browserless 默认支持这些。
>

这里以 Python 为例，使用方法可参考这篇文档

+ python-playwright 文档： [https://docs.browserless.io/libraries/playwright#python-playwright](https://docs.browserless.io/libraries/playwright#python-playwright)



:::info
**a 获取动态 HTML 源码**

:::



```python
host = "happy-holiday-bro.zeabur.app"
token = "2****************3"
args = {
    "--window-size=1920,1080",
    "--lang=en-US",
}
browserless_uri = f'wss://{host}/chrome/playwright?token={token}&--lang=zh-CN&--window-size=1920,1080'


def get_html_source(url) -> str:
    # 打印将要获取的URL
    print(f"Will GET {url}")

    # 使用Playwright创建一个同步上下文
    with sync_playwright() as p:
        # 打印browserless的URI
        print(browserless_uri)

        # 连接到远程浏览器
        browser = p.chromium.connect(browserless_uri)

        # 创建一个新的浏览器上下文
        context = browser.new_context()

        # 在上下文中创建一个新页面
        page = context.new_page()

        # 导航到指定的URL，等待直到DOM内容加载完成
        page.goto(url, wait_until='domcontentloaded')

        # 获取页面的HTML源代码
        html_source = page.content()

        # 关闭浏览器上下文
        context.close() 

        return html_source
# demo
html = get_html_source('https://shop35928747.taobao.com/?spm=pc_detail.29232929/evo365560b447259.shop_block.dshopinfo.744f7dd6PK7NQa')
print(html)
self.assertIn("GOGOSOON禾子先生", html)
```



:::info
**b 提取页面纯文本内容**

:::

关键代码：`text_content = page.locator('body').inner_text()` 

原理：这行代码是用来获取页面上所有可见的文本，包括标题、段落、列表等。让我们逐步分解它：

1. `page.locator('body')`：
    - `page` 是 Playwright 中表示一个网页的对象。
    - `locator()` 方法用于在页面中定位元素。
    - `'body'` 是一个 CSS 选择器，指向 HTML 文档的 `<body>` 标签。
    - 所以 `page.locator('body')` 返回一个定位器对象，指向页面的 body 元素。
2. `.inner_text()`：
    - 这是 Playwright 中的一个方法，用于获取元素的内部文本内容。
    - 它类似于 JavaScript 中的 `innerText` 属性。
    - `inner_text()` 返回元素及其所有子元素的可见文本内容，不包括隐藏元素的文本。
    - 它会保留文本的格式，如换行和空格。
3. 原理：
    - 这行代码首先定位到页面的 `<body>` 元素。
    - 然后获取 `<body>` 元素及其所有可见子元素的文本内容。
    - 这样做可以获取页面上所有可见的文本，包括标题、段落、列表等。



:::info
**c 获取网页截图**

:::



下面，我们在一份代码中，同时实现「获取页面纯文本」和「网页截图」

```python
def get_text(url):
    # 打印将要获取的URL
    print(f"Will GET {url}")
    
    with sync_playwright() as p:
        # 打印browserless的URI
        print(browserless_uri)
        
        # 连接到远程浏览器
        browser = p.chromium.connect(browserless_uri)
        
        # 创建一个新的浏览器上下文
        context = browser.new_context()
        
        # 在上下文中创建一个新页面
        page = context.new_page()
        
        # 导航到指定的URL，等待直到网络空闲
        page.goto(url, wait_until='networkidle')
        
        # 获取页面body元素的文本内容
        text_content = page.locator('body').inner_text()
        
        # 截图并保存
        page.screenshot(path=f'img/1.png')
        # 全屏截图
        # page.screenshot(path=f'img/1-full.png', full_page=True)
        
        # 关闭浏览器上下文
        context.close() 

        return text_content


text = get_text('https://cn.bing.com/search?q=ajax+demo++vulpweb&qs=n&form=QBRE&sp=-1&lq=0&pq=ajax+demo++vulpweb&sc=0-18&sk=&cvid=801DE93231A94BDEAAA48CC50A688E31&ghsh=0&ghacc=0&ghpl=')
print(text)
```



获取页面文字

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728197292252-48900603-0d26-4d0c-a86c-8f33d66829f7.png)

截图（只截 1 屏）-默认参数

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728197154363-358e8d6c-32cb-4888-911b-13c4b4da3fb8.png)

全屏截图-指定`full_page=True`

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728197602007-3f9c6dd7-74c6-4ba8-ae8c-384d97ddc5bd.png)





# 小结
```python
page.goto(url, wait_until='domcontentloaded')
```

+ `wait_until` 有几种可选的状态，使用场景如下
    - `"commit", `含义：在收到页面的第一个字节时完成。使用场景：当您只需要确认服务器已经<font style="background-color:#FBDE28;">开始响应，而不需要等待页面完全加载时</font>使用。这是最快的选项，但页面内容可能还没有完全加载。
    - `"domcontentloaded", `在 DOMContentLoaded 事件触发时被认为完成。使用场景：当您需要 DOM 结构已经构建完成，但<font style="background-color:#FBDE28;">不需要等待所有资源（如图片、样式表）加载完成</font>时使用。这对于需要快速访问 DOM 结构但不关心外部资源的情况很有用。
    - `"load", `在 load 事件触发时被认为完成，当您<font style="background-color:#FBDE28;">需要页面的所有资源（包括图片、样式表等）都加载完成时使用</font>。这是最全面的选项，
    - `"networkidle"，`在网络连接至少 500 毫秒没有活动时被认为完成。当页面可能有延迟加载的内容或 AJAX 请求时使用。这对于确保所有动态内容都已加载完成很有用，但可能是最慢的。

爬虫最常用的是：`load`、`networkidle`



+ SDK 的完整接口文档在这里：[https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1screenshot%20~1chromium~1screenshot/post](https://docs.browserless.io/open-api#tag/Browser-REST-APIs/paths/~1screenshot%20~1chromium~1screenshot/post)

![](https://cdn.nlark.com/yuque/0/2024/png/166008/1728198684492-77289148-cbe1-4933-8779-117f595c6e31.png)



+ REST Api 的 query 参数，还可以指定「是否拦截广告」（blockAds 参数）——是否为本次会话加载广告拦截扩展。目前使用的是uBlock Origin，可能会导致某些网站无法正常加载。

例如

```python
response = requests.post(f'https://{host}/chrome/scrape?token={token}&blockAds=true'
```



这个Browserless项目，它确实是个很有创意的玩意儿。Browserless能够结合Docker和无头浏览器的优势，为开发者和测试工程师提供这么一个灵活的工具，部署简单，使用方便，确实挺吸引人的。

# 支持
如果你感觉有一些收获，想给予我一些鼓励和支持，可以试试通过下面的推荐链接来注册哦。

将来，如果你决定尝试它们的付费服务，我的账户将会得到五美金（或三十五人民币）的现金抵扣。

![](https://cdn.nlark.com/yuque/0/2024/svg/166008/1727751731264-e9eab492-fe4b-4e60-982d-d7e309a7d1a3.svg)

