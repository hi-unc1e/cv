---
title: "你买的是手，不是脑：拆开 Burp AT 之后，我分析协议开源了一个自己的 Burp MCP"
slug: burp-at-brain-hand-open-source-mcp
date: 2026-08-12T00:20:00+08:00
lastmod: 2026-08-12T00:20:00+08:00
description: "Burp AT 证明渗透能力可以交给 AI，但它把模型锁在云端、生产场景审批疲劳。我分析了它的协议，照官方正门做了一套开源 burp-mcp-server，还补齐了红队闭环缺的脊椎——把手交还给你的 Agent。"
tags:
  - Burp Suite
  - Agent
  - MCP
  - 分析
  - 红队
categories:
  - 安全研究
draft: false
---

<style>
.burp .callout{ border-left:3px solid var(--uncle-blue,#2457d6); background:var(--uncle-soft-blue,#e9efff); padding:10px 14px; margin:16px 0; border-radius:0 4px 4px 0; font-size:.96em; }
.burp svg{ max-width:100%; height:auto; border-radius:6px; margin:14px 0; }
.burp .cap{ font-size:.86em; color:var(--secondary,#657086); margin:-6px 0 18px; }
</style>

<div class="burp">

我拆开 Burp AT 的 jar，本来想找一样东西：它把 GPT 的客户端藏哪了。

找了半天，答案是——没藏，因为压根不存在。

一个会聊天、能自己开扫描的 Burp，本地居然没有一个完整的 chat 客户端。这本身就挺说明问题。翻完整个 jar 我才反应过来：这东西在本地其实只有一双手。拍板的那个模型，住在 PortSwigger 的云上。

这篇要讲的就是这双手——以及，怎么给它换个模型。结论先放在这：Burp AT 证明「渗透能力可以交给 AI」这条路是对的，但它把模型锁在云端、生产场景水土不服还审批疲劳；我分析了它的协议，照官方正门做了一套开源的 [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server)，把 Burp 这双手交还给你的 Agent。别等它审批你的下一步。

## 先说清楚：Burp AT 是什么

<!-- 截图占位：在此处插入 Burp AT 界面截图。建议放到 static/img/burp-at/ 下，正文用 <img src="/img/burp-at/xxx.png" alt="Burp AT 界面"> 引用。 -->

没碰过 Burp AT 的师傅，我用一句话给你说明白：它是 PortSwigger 官方给 Burp Suite Pro 加的 AI 自动化测试能力——你给个目标，它自己爬站、发包、跑审计、归档问题，相当于多了一个不睡觉的实习生在帮你点 Burp。

拆开看，它干了三件事：

- 把 Burp 的核心能力（发包、读历史、扫描、Collaborator、Intruder……）封装成几十个原子工具，让 AI 像调函数一样去调；
- 配一个任务引擎管这些活儿：扫描是异步的，能排队、查状态、去重、超时收敛，而不是傻等一个返回；
- 上面再套一层对话，你用人话提需求，它在背后编排这些工具。

效果有时确实惊艳——丢个目标进去，它自己摸出几个注入点，比手动点半天快。这也是我为什么说「渗透能力交给 AI」这条路是对的。

但「有时惊艳」和「生产好用」是两码事。这正是后面要拆的问题。

## 手在本地，模型在云端

先用一句话建立共同语言，后面整篇都挂在上面：

- 手（capability）：Burp 本地这套工具运行时——发包、读历史、扫描、丢 Intruder、Collaborator。
- 模型（orchestrator）：决定下一步调哪个工具、怎么解释结果、何时升级权限——也就是 model 加 Agent 循环。
- 协议：两边说话的方式（标准 MCP，或 AT 自己那套 BurpAI 信封）。

所以默认情况下的 Burp AT，是**私有 Agent 在云端，用它的模型驾驶 Burp 本地的能力（手）**。评估任何「AI × 安全工具」产品，先画这张图：谁是 Client、谁是 Server、model 跑在哪——比纠结它用哪个底座模型实在得多。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 240" font-family="-apple-system,Segoe UI,Roboto,sans-serif" role="img" aria-label="手与模型分离：外置 Agent 通过 MCP 协议驱动 Burp 本地能力">
  <rect width="760" height="240" fill="#0f1419"/>
  <rect x="24" y="40" width="210" height="160" rx="12" fill="#1a2332" stroke="#3d8bfd"/>
  <text x="129" y="80" fill="#58a6ff" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="1.5">SWAPPABLE</text>
  <text x="129" y="112" fill="#e7ecf3" text-anchor="middle" font-size="16" font-weight="600">External Agent / Model</text>
  <text x="129" y="140" fill="#8b9bb4" text-anchor="middle" font-size="12">orchestration · reasoning · strategy</text>
  <text x="129" y="164" fill="#8b9bb4" text-anchor="middle" font-size="12">Claude Code · custom framework · cloud</text>
  <path d="M244 120 H320" stroke="#3dd68c" stroke-width="2" marker-end="url(#ba)"/>
  <text x="282" y="110" fill="#3dd68c" text-anchor="middle" font-size="11">tools/call</text>
  <rect x="330" y="62" width="170" height="116" rx="12" fill="#162033" stroke="#3dd68c"/>
  <text x="415" y="100" fill="#3dd68c" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1.5">PROTOCOL</text>
  <text x="415" y="128" fill="#e7ecf3" text-anchor="middle" font-size="14" font-weight="600">MCP Server</text>
  <text x="415" y="152" fill="#8b9bb4" text-anchor="middle" font-size="11">standard MCP</text>
  <text x="415" y="170" fill="#8b9bb4" text-anchor="middle" font-size="11">or BurpAI envelope</text>
  <path d="M510 120 H580" stroke="#3dd68c" stroke-width="2" marker-end="url(#ba)"/>
  <rect x="584" y="40" width="152" height="160" rx="12" fill="#1a2332" stroke="#ff6633"/>
  <text x="660" y="80" fill="#ff6633" text-anchor="middle" font-size="12" font-weight="700" letter-spacing="1.5">CAPABILITY</text>
  <text x="660" y="116" fill="#e7ecf3" text-anchor="middle" font-size="16" font-weight="600">Burp Workbench</text>
  <text x="660" y="146" fill="#8b9bb4" text-anchor="middle" font-size="12">tool runtime</text>
  <text x="660" y="168" fill="#8b9bb4" text-anchor="middle" font-size="12">local, addressable</text>
  <defs><marker id="ba" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3dd68c"/></marker></defs>
</svg>
<p class="cap">图 1 · 手在本地，模型可替换。</p>

手没动——这是整件事的前提。桌面那一整套工具运行时还在本地，可以换个 Client 来用。问题只是默认那个 Client 在云端、策略也在云端，模型不由你做主。

那为什么非得换成自己的模型？

因为大环境变了。通用模型一年比一年能打，开源模型也如日中天——自己部署、自己调度的门槛已经很低。这种背景下，一个安全工具要是还死守「私有模型 + 云端闭环」的老路子，等于把数据、策略、命脉全交给一家厂商，多少有点开倒车。但凡有点追求的安全从业者，都会想把手里的能力接到自己选的模型上：模型可控、数据不出域、调度自己说了算。

这也是这篇要解决的事。

## 三条路：正门、走廊、自研

PortSwigger 其实有两样东西，我一开始当成一回事，绕了点路：

- 官方 [burp-mcp](https://github.com/PortSwigger/mcp-server)：这才是 MCP 那条线。Burp 在本地**监听**（默认 `127.0.0.1:9876`），你的 Agent 当 Client，走**标准 MCP**。这是正门。
- Burp AT：一个闭环的商业 Agent 产品，**从你的角度跟 MCP 没关系**——你用的是它内置的对话，模型跑在 PortSwigger 云端，桌面通过一条私有的、带账号的信封协议连回去。你不会拿个 MCP 客户端去连 AT。

两者拓扑也正好相反：一个 Burp 当 Server 等人来连，一个 Burp 当 Client 主动出站。但别因为都沾 Burp 就当成一回事——一个是开放协议，一个是闭源产品。

把 Burp 交给自己的 Agent 驾驶，三条路：

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 280" font-family="-apple-system,Segoe UI,Roboto,sans-serif" role="img" aria-label="换模型三档：正门 burp-mcp、走廊 BurpAI 兼容网关、自研框架">
  <rect width="740" height="280" fill="#0f1419"/>
  <text x="370" y="30" fill="#e7ecf3" text-anchor="middle" font-size="14" font-weight="600">Driving Burp with your own model?</text>
  <rect x="270" y="48" width="200" height="34" rx="8" fill="#1a2332" stroke="#8b9bb4"/>
  <text x="370" y="70" fill="#e7ecf3" text-anchor="middle" font-size="12">Pick a topology, not an API-key box</text>
  <path d="M370 82 V108" stroke="#8b9bb4"/>
  <path d="M120 108 H620" stroke="#8b9bb4"/>
  <path d="M120 108 V123" stroke="#8b9bb4"/><path d="M370 108 V123" stroke="#8b9bb4"/><path d="M620 108 V123" stroke="#8b9bb4"/>
  <rect x="30" y="123" width="180" height="120" rx="10" fill="#162033" stroke="#3dd68c"/>
  <text x="120" y="153" fill="#3dd68c" text-anchor="middle" font-size="13" font-weight="600">A · 正门（推荐）</text>
  <text x="120" y="180" fill="#e7ecf3" text-anchor="middle" font-size="11">burp-mcp + Claude Code</text>
  <text x="120" y="200" fill="#8b9bb4" text-anchor="middle" font-size="11">标准 MCP，模型是你的</text>
  <text x="120" y="222" fill="#8b9bb4" text-anchor="middle" font-size="11">上手即用</text>
  <rect x="280" y="123" width="180" height="120" rx="10" fill="#1a2332" stroke="#3d8bfd"/>
  <text x="370" y="153" fill="#3d8bfd" text-anchor="middle" font-size="13" font-weight="600">B · 走廊（研究向）</text>
  <text x="370" y="180" fill="#e7ecf3" text-anchor="middle" font-size="11">BurpAI 兼容网关</text>
  <text x="370" y="200" fill="#8b9bb4" text-anchor="middle" font-size="11">顶替云端 Client</text>
  <text x="370" y="222" fill="#8b9bb4" text-anchor="middle" font-size="11">协议坑多</text>
  <rect x="530" y="123" width="180" height="120" rx="10" fill="#1a2332" stroke="#ff6633"/>
  <text x="620" y="153" fill="#ff6633" text-anchor="middle" font-size="13" font-weight="600">C · 自研（长期）</text>
  <text x="620" y="180" fill="#e7ecf3" text-anchor="middle" font-size="11">自定义 Agent</text>
  <text x="620" y="200" fill="#8b9bb4" text-anchor="middle" font-size="11">+ 工具适配</text>
  <text x="620" y="222" fill="#8b9bb4" text-anchor="middle" font-size="11">可继续挂 burp-mcp</text>
</svg>
<p class="cap">图 2 · 换模型三档：选拓扑，不是选一个填 API key 的框。</p>

**A 正门**是我推荐绝大多数人的默认答案：装官方 mcp-server，启用 MCP 页，Claude Code / Desktop 配 SSE 或 stdio proxy。协议标准、模型完全是你的、`Tools.kt` 可扩。验收也简单——客户端 `tools/list` 非空，一次发包或读 proxy history 端到端跑通就行。

**B 走廊**是架构级的研究题：本地实现一个 BurpAI 兼容网关，让桌面 AT 的反向 MCP 指向你而不是 `ai.portswigger.net`，网关后面再接 OpenAI 兼容或自研 Agent loop。这条路我踩过坑，值得单独说一句——

> 能指到本地 ≠ 已连上。

我当时 `ZL()` 报 `session already started`，看起来成了；但 `Zy()` 因为一道门控没真正跑 `hub.connect()`——会话标记和底层传输脱节了。所以排障只认一件事：**网关日志里有没有活跃的 `GET /api/v1/mcp` SSE，状态机有没有真的进入已连接**。别被 UI 弹窗骗了。

这条走廊协议的最小契约（架构级，不展开利用细节）：`GET {base}/api/v1/mcp` 开 SSE → 先收 `connection.accepted` 带 `mcp_connection_id` → `POST …/sessions/{burpai_session_id}/claim` 认领 → 双向 `type: mcp.message` 信封（内层才是 JSON-RPC）→ 处理约 90s idle 重连、POST 409 再 claim 这套状态机。常见头有 `Portswigger-Burp-Ai-Token`、可选 Bearer、`Burpai-Engagement-Id`、`X-MCP-Connection-Id`。注意这不是裸 MCP——拿个通用 MCP Client 库直接怼云端连不上，得自己实现这层带账号的信封。

一个现实提醒：base URL 的三级解析（`-Dburpai.mcp.url` → `BURPAI_MCP_URL` → 区域回退，生产默认 `https://ai.portswigger.net`）在某些生产构建里，sysprop/env 读取路径有「编译期关闭」的迹象。能不能生效，**以你手头 jar 为准**，必要时得额外手段。

**C 自研框架**是丢掉 AT 壳的长期形态：自己的 Agent + burp-mcp（或自研 Montoya 适配）。本文要推的东西，正落在这条线上。

## 我开源了什么，差在哪

这是全文我最想讲、也是现成材料里最缺的一节。

我照官方正门做了一套开源的 [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server)——是 [PortSwigger/mcp-server](https://github.com/PortSwigger/mcp-server) 的 fork，保留了官方那条稳定工具面，再往上补了红队闭环缺的脊椎。当前版本 `1.3.0-AT`，JDK 21 构建，`./gradlew embedProxyJar` 出 fat JAR， Releases 里有预编译包。

为什么要补？因为官方 burp-mcp 二十来个实用工具，覆盖了红队主路径（HTTP/1.1、HTTP/2 发包、Repeater/Intruder 投递、Proxy 历史、Scanner issues、Collaborator、编解码、配置导入导出）；但 AT 内置大约 54 个原子工具、分 12 组——多出来的那部分，**少人值守自动评估和大规模 fuzz 这两个形态是致命空洞**：缺 scope 导航、缺扫描编排、缺可查询的 fuzz 结果面。

我一开始的想法是追平那 54 个工具，列完清单冷静了。没必要数量攀平——**可维护的窄工具面，往往比不可控的宽工具面更能干活**。于是按闭环补脊椎，而不是按数量填坑。

补齐路径就一条：改 `Tools.kt` + Montoya API，把 AT 枚举当 gap list 参考，不当运行时依赖。单测 `ToolsKtTest` 在 jdk21 下 BUILD SUCCESSFUL。

下面这张表把补的能力掊开看——每类复用 Burp 的哪项能力、能通过 API 干什么、原来 MCP 为什么使不上劲：

| 大类 | 工具及明细 | 大白话 |
|---|---|---|
| **P0 · 边界（Scope）** | `include_in_scope` / `exclude_from_scope` / `is_in_scope`（suite-wide） | 复用 Burp 的 **Target Scope**。Agent 自己「圈地」：把目标加进范围、把杂项踢出去、查某个 URL 在不在范围内。原来 MCP 没有，Agent 守不住边界，要么乱扫要么漏扫。 |
| **P0 · 站点地图** | `list_sitemap`（可选 urlPrefix） | 复用 Burp 的 **Site Map**，读出已爬到的站点结构（哪些路径、哪些请求）。原来 MCP 没有，Agent 看不到自己爬到哪了，等于摸黑走。 |
| **P0 · 扫描编排** | `start_crawl` / `start_audit`（返回 taskId）、`get_scanner_issues_for_url`、`list_scan_tasks` / `get_scan_task_status` / `delete_scan_task` | 复用 Burp 的 **Crawl / Active Scan**。Agent 能「派活」：发起爬取和审计、按任务查进度、按 URL 取 issue。原来 MCP 顶多读已有 issue，**不能主动开扫描**——自动化闭环第一步就断了。 |
| **P1 · 历史检索** | `inspect_proxy_http_history_item`（按 index + 可选 regex） | 复用 Burp 的 **Proxy History**，按序号精准取某一条请求来看，不必把整段历史塞进上下文。原来 MCP 只能批量翻，想盯某一条得自己捞半天。 |
| **P1 · 批量发包** | `bulk_send_http1_requests`（顺序批量） | 复用 Burp 发包能力，一次顺序发一批请求。探活、验证、批量测参数不用一条条 round-trip。原来 MCP 只能单发，又慢又费 token。 |
| **P1 · 历史对比** | `compare_proxy_history_items` | 把历史里两条请求摆一起比差异（响应、参数变化）。认证前后、有无漏洞直接出结论。原来 MCP 没有，Agent 得自己拉文本比，吃 context。 |
| **P1 · Intruder（投递）** | `send_to_intruder` | 能把请求丢进 **Intruder**，但读不回结果——这不是我没做，是 Montoya API 没有完整结果接口。诚实标在这。 |
| **P2 · 地图写入** | `add_to_sitemap` | 把手工发现或外部工具扫到的结果写回 Site Map，让 Burp 视图和 Agent 认知同步。原来 MCP 只读不写。 |
| **P2 · 自定义检查** | `import_b_check` | 复用 Burp 的 **BCheck** 自定义扫描规则，把项目专属检查喂给 Scanner。原来 MCP 没接口，自定义逻辑进不去。 |

设计上抄了几条 AT 的智慧，这几条对任何做 pentest Agent 的人都通用——抄结构，不抄商标：

- 危险操作（发包、扫描、删 issue）的权限门放在运行时，不靠 prompt 口头约束；
- 扫描这种长任务返回句柄、可轮询，而不是假设秒级 tool result——只等秒级返回的 Agent 做不了真渗透；
- 对 model 输出的 HTTP 字面量做 `\r\n` 规范化，别假设 model 输出字节级合法；
- 历史和 issue 分页截断，保护 context。

## 来用，给我反馈

不同的人默认动作不一样：

- 红队 / 安全工程：Burp + [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) + 你自己的 Agent（Claude Code 或自研）。工具不够，按 P0/P1 接着扩 `Tools.kt`，别先啃混淆 AT。
- 自研 pentest 框架：协议优先标准 MCP；工具带权限与异步语义；工作台可替换、模型可替换——Burp 只是工作台候选之一。
- 还想碰 AT 壳的人：走廊 B 有架构空间，但验收只认 SSE，生产构建细节因版本而异，本文不提供绕过菜谱。

评估任何 AI 安全产品，先画那张「手 / 模型」图，再谈 model 名字。

---

你买的是手，不是脑。要紧的不是 Burp 里那个 model 叫什么——而是谁有权对它下 `tools/call`。

[burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) 已经把门打开了。装上，接你自己的模型，用了跟我说。

</div>

## 附录 · 证据与参考

<details>
<summary>点开看分析证据、协议细节与开源索引（不影响正文阅读）</summary>

**为什么说「模型在云端」**

- 桌面 jar 里没有完整的 `chat/completions` 客户端——模型本就不在桌面进程里。
- 桌面是 MCP Server + reverse SSE，不是本地 chat 客户端；工具经 MCP / BurpAI 信封暴露，手与模型之间是协议不是硬链接。
- base URL 容器三级解析，路径规则：SSE/POST 走 `{base}/api/v1/mcp`，claim 走 `{sse}/sessions/{burpai_session_id}/claim`，Hub `AccountScopedMcpSseHub` 负责连接 / claim / 重连 / 409 再 claim / 约 90s idle recycle。
- 官方开源标准 MCP Server，等于官方承认「任意 MCP Client」可驾驶同一类手——这是「外置」能成立的根本。

**burp-mcp vs Burp AT 工具面差异（按作战形态）**

| 形态 | 差异权重 |
|------|----------|
| 人在环 + Agent 辅助 | 低～中（主路径已覆盖，换自己的模型往往更强） |
| 少人值守自动评估 | 高（缺 crawl/audit/任务状态/scope） |
| 大规模 Fuzz / 批量验证 | 高（「丢进 Intruder」≠ 可查询结果面） |
| 换模型目标 | 协议与可控性 > 工具数量 |

**开源与文档索引**

- [hi-unc1e/burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) — 本文主角，官方 mcp-server 的 AT fork，含 P0–P2 补齐
- [PortSwigger/mcp-server](https://github.com/PortSwigger/mcp-server) — 外置 Agent 的官方正门
- [modelcontextprotocol.io](https://modelcontextprotocol.io/) — MCP 协议

</details>
