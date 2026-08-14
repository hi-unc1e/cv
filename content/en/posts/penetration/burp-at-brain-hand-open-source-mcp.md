---
title: "You Bought the Hands, Not the Brain: After Analyzing Burp AT, I Built an Open-Source Burp MCP"
slug: burp-at-brain-hand-open-source-mcp
translationKey: burp-at-mcp
date: 2026-08-12T00:20:00+08:00
lastmod: 2026-08-12T00:20:00+08:00
description: "Burp AT proves that penetration testing can be handed to AI, but it locks the model in the cloud and suffers from approval fatigue in production. I analyzed its protocol, followed the official front door, and built an open-source burp-mcp-server — filling the gaps that make or break a red-team automation loop."
tags:
  - Burp Suite
  - Agent
  - MCP
  - Analysis
  - Red Team
categories:
  - Security Research
draft: false
---

<style>
.burp .callout{ border-left:3px solid var(--uncle-blue,#2457d6); background:var(--uncle-soft-blue,#e9efff); padding:10px 14px; margin:16px 0; border-radius:0 4px 4px 0; font-size:.96em; }
.burp svg{ max-width:100%; height:auto; border-radius:6px; margin:14px 0; }
.burp img{ max-width:100%; height:auto; border-radius:6px; margin:14px 0; }
.burp .cap{ font-size:.86em; color:var(--secondary,#657086); margin:-6px 0 18px; }
</style>

<div class="burp">

I opened up Burp AT's jar looking for one thing: where does it hide the GPT client?

After a thorough search, the answer was — nowhere, because it doesn't exist.

A Burp that can chat and autonomously run scans, yet it has no complete chat client running locally. That alone tells you something. After going through the entire jar, it clicked: the thing running locally is just a pair of hands. The brain calling the shots lives on PortSwigger's cloud.

This post is about those hands — and how to give them a different brain. The conclusion first: Burp AT proves that "penetration testing can be handed to AI" is the right direction, but it locks the model in the cloud, doesn't fit production environments, and creates approval fatigue. I analyzed its protocol, followed the official front door, and built an open-source [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) — putting Burp's hands back in your Agent's control. No more waiting for approval on your next move.

## First, What Exactly Is Burp AT?

<img src="/img/burp-at/burp-at-overview.jpg" alt="Burp AT official product page (PortSwigger)">
<p class="cap">Figure · Burp AT official product page (PortSwigger)</p>

If you haven't used Burp AT, here's the one-sentence version: it's PortSwigger's official AI-powered automation capability for Burp Suite Pro ([website](https://portswigger.net/burp/burp-at)) — you give it a target, and it crawls, sends requests, runs audits, and files findings on its own. It's like having an intern who never sleeps, clicking through Burp for you.

Under the hood, it does three things:

- Wraps Burp's core capabilities (sending requests, reading history, scanning, Collaborator, Intruder...) into dozens of atomic tools that AI can call like functions;
- Adds a task engine to manage those jobs: scans are asynchronous, with queuing, status polling, deduplication, and timeout convergence — not just blocking on a single return;
- Layers a conversation interface on top, so you describe what you want in plain language, and it orchestrates the tools behind the scenes.

The results can be genuinely impressive — drop in a target and it finds injection points on its own, faster than clicking through manually. That's exactly why I say "handing penetration testing to AI" is the right direction.

But "sometimes impressive" and "production-ready" are two different things. That's what we're about to unpack.

## Hands Are Local, the Brain Is in the Cloud

Let's establish a shared vocabulary first — everything that follows hangs on this:

- **Hands (capability)**: Burp's local tool runtime — sending requests, reading history, scanning, feeding Intruder, Collaborator.
- **Brain (orchestrator)**: The component that decides which tool to call next, how to interpret results, when to escalate — i.e., the model plus the Agent loop.
- **Protocol**: How the two sides talk (standard MCP, or AT's own BurpAI envelope).

So in the default configuration, Burp AT is a **private Agent in the cloud, using its model to drive Burp's local capabilities (the hands)**. When evaluating any "AI × security tool" product, start by drawing this picture: who is the Client, who is the Server, where does the model run — that matters far more than which base model they're using.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 240" font-family="-apple-system,Segoe UI,Roboto,sans-serif" role="img" aria-label="Hands and Brain, Separated: External Agent drives Burp's local capabilities via MCP protocol">
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
<p class="cap">Figure 1 · Hands are local, the brain is swappable.</p>

The hands haven't moved — that's the premise of this entire thing. The desktop tool runtime is still local; you can drive it with a different Client. The only problem is that the default Client is in the cloud, with its policies in the cloud, and you don't control the model.

So why bother swapping the model?

Because the landscape has shifted. General-purpose models get better every year, and open-source models are thriving — the barrier to self-hosting and self-scheduling is now very low. In this environment, a security tool clinging to the "private model + cloud lock-in" model is essentially handing your data, your strategy, and your autonomy to a single vendor. Any security practitioner with ambition will want to connect their capabilities to the model of their choice: controlled model, data stays in-domain, scheduling on your own terms.

That's exactly what this post sets out to solve.

## Three Paths: Front Door, Back Channel, Custom Framework

PortSwigger actually ships two things, and I initially conflated them — which cost me some time:

- The official [burp-mcp](https://github.com/PortSwigger/mcp-server): this is the MCP line. Burp **listens** locally (default `127.0.0.1:9876`), your Agent acts as the Client, using **standard MCP**. This is the front door.
- Burp AT: a closed-loop commercial Agent product. **From your perspective, it has nothing to do with MCP** — you use its built-in chat interface, the model runs on PortSwigger's cloud, and the desktop connects back through a private, authenticated envelope protocol. You wouldn't point an MCP client at AT.

The topologies are also inverted: in one, Burp is a Server waiting for connections; in the other, Burp is a Client making outbound connections. Don't conflate them just because both involve Burp — one is an open protocol, the other is a closed product.

Three ways to put Burp under your own Agent's control:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 280" font-family="-apple-system,Segoe UI,Roboto,sans-serif" role="img" aria-label="Three ways to swap models: pick a topology, not an API-key box">
  <rect width="740" height="280" fill="#0f1419"/>
  <text x="370" y="30" fill="#e7ecf3" text-anchor="middle" font-size="14" font-weight="600">Driving Burp with your own model?</text>
  <rect x="270" y="48" width="200" height="34" rx="8" fill="#1a2332" stroke="#8b9bb4"/>
  <text x="370" y="70" fill="#e7ecf3" text-anchor="middle" font-size="12">Pick a topology, not an API-key box</text>
  <path d="M370 82 V108" stroke="#8b9bb4"/>
  <path d="M120 108 H620" stroke="#8b9bb4"/>
  <path d="M120 108 V123" stroke="#8b9bb4"/><path d="M370 108 V123" stroke="#8b9bb4"/><path d="M620 108 V123" stroke="#8b9bb4"/>
  <rect x="30" y="123" width="180" height="120" rx="10" fill="#162033" stroke="#3dd68c"/>
  <text x="120" y="153" fill="#3dd68c" text-anchor="middle" font-size="13" font-weight="600">A · Front Door (Rec.)</text>
  <text x="120" y="180" fill="#e7ecf3" text-anchor="middle" font-size="11">burp-mcp + Claude Code</text>
  <text x="120" y="200" fill="#8b9bb4" text-anchor="middle" font-size="11">Standard MCP, your model</text>
  <text x="120" y="222" fill="#8b9bb4" text-anchor="middle" font-size="11">Ready to go</text>
  <rect x="280" y="123" width="180" height="120" rx="10" fill="#1a2332" stroke="#3d8bfd"/>
  <text x="370" y="153" fill="#3d8bfd" text-anchor="middle" font-size="13" font-weight="600">B · Back Channel (R&amp;D)</text>
  <text x="370" y="180" fill="#e7ecf3" text-anchor="middle" font-size="11">BurpAI Compatible Gateway</text>
  <text x="370" y="200" fill="#8b9bb4" text-anchor="middle" font-size="11">Replace the cloud Client</text>
  <text x="370" y="222" fill="#8b9bb4" text-anchor="middle" font-size="11">Protocol pitfalls ahead</text>
  <rect x="530" y="123" width="180" height="120" rx="10" fill="#1a2332" stroke="#ff6633"/>
  <text x="620" y="153" fill="#ff6633" text-anchor="middle" font-size="13" font-weight="600">C · Custom (Long-term)</text>
  <text x="620" y="180" fill="#e7ecf3" text-anchor="middle" font-size="11">Custom Agent</text>
  <text x="620" y="200" fill="#8b9bb4" text-anchor="middle" font-size="11">+ Tool adaptation</text>
  <text x="620" y="222" fill="#8b9bb4" text-anchor="middle" font-size="11">Can still use burp-mcp</text>
</svg>
<p class="cap">Figure 2 · Three ways to swap models: pick a topology, not an API-key box.</p>

**A · Front Door** is my recommended default for most people: install the official mcp-server, enable the MCP tab, configure Claude Code / Desktop with SSE or a stdio proxy. The protocol is standard, the model is entirely yours, and `Tools.kt` is extensible. Verification is simple — `tools/list` from the client returns non-empty, and a single end-to-end request or proxy history read confirms it works.

**B · Back Channel** is an architecture-level research project: implement a BurpAI-compatible gateway locally, point the desktop AT's reverse MCP to you instead of `ai.portswigger.net`, and connect your own OpenAI-compatible endpoint or custom Agent loop behind the gateway. I've been down this road and it deserves a specific callout:

> Pointing to localhost ≠ connected.

I had `ZL()` reporting `session already started` — it looked like it worked. But `Zy()` never actually ran `hub.connect()` because of a gating condition — the session marker and the underlying transport were out of sync. So when debugging, only trust one thing: **does your gateway log show an active `GET /api/v1/mcp` SSE, and has the state machine actually entered the connected state?** Don't let the UI popup fool you.

The minimum protocol contract for this back channel (architecture-level, no exploitation details): `GET {base}/api/v1/mcp` opens SSE → receive `connection.accepted` with `mcp_connection_id` → `POST …/sessions/{burpai_session_id}/claim` to claim → bidirectional `type: mcp.message` envelopes (inner payload is JSON-RPC) → handle the ~90s idle reconnect, POST 409 re-claim state machine. Common headers: `Portswigger-Burp-Ai-Token`, optional Bearer, `Burpai-Engagement-Id`, `X-MCP-Connection-Id`. Note: this is not bare MCP — pointing a generic MCP Client library directly at the cloud won't work; you need to implement this authenticated envelope yourself.

A practical reminder: the base URL's three-tier resolution (`-Dburpai.mcp.url` → `BURPAI_MCP_URL` → regional fallback; production defaults to `https://ai.portswigger.net`) may have the sysprop/env read path "compiled away" in certain production builds. Whether it works depends on the jar in your hands — additional measures may be necessary.

**C · Custom Framework** is the long-term form once you shed the AT shell: your own Agent + burp-mcp (or a custom Montoya adapter). The tool I'm about to introduce falls squarely on this path.

## What I Open-Sourced, and Where It Differs

This is the section I most want to write — and the one most lacking in available materials.

I built an open-source [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) following the official front door — it's a fork of [PortSwigger/mcp-server](https://github.com/PortSwigger/mcp-server), preserving the official stable tool surface while adding the spine that makes a red-team automation loop actually close. Current version `1.3.0-AT`, JDK 21 build, `./gradlew embedProxyJar` produces a fat JAR; pre-built packages are in Releases.

Why extend it? The official burp-mcp has about twenty useful tools covering the main red-team path (HTTP/1.1, HTTP/2 requests, Repeater/Intruder delivery, Proxy history, Scanner issues, Collaborator, encoding/decoding, config import/export). But AT has roughly 54 atomic tools across 12 groups — the extra ones fill two critical gaps: **low-attended automated assessment and large-scale fuzzing**. No scope navigation, no scan orchestration, no queryable fuzz result surface.

My initial plan was to match all 54 tools. After listing them out, I got realistic. No need to compete on quantity — **a maintainable narrow tool surface often outperforms an unmanageable wide one**. So I filled gaps by closing the loop, not by chasing numbers.

The extension path is straightforward: modify `Tools.kt` + Montoya API, treat AT's enumeration as a gap list reference, not a runtime dependency. Unit tests `ToolsKtTest` pass under JDK 21 with BUILD SUCCESSFUL.

Here's what got added, broken down by category — which Burp capability each reuses, what the API enables, and why the original MCP couldn't do it:

| Category | Tools & Details | What It Means |
|---|---|---|
| **P0 · Scope** | `include_in_scope` / `exclude_from_scope` / `is_in_scope` (suite-wide) | Reuses Burp's **Target Scope**. The Agent can "fence off" its territory: add targets to scope, exclude noise, check if a URL is in scope. The original MCP had none of this — the Agent couldn't enforce boundaries, leading to either over-scanning or missing targets. |
| **P0 · Site Map** | `list_sitemap` (optional urlPrefix) | Reuses Burp's **Site Map**, reading the discovered site structure (which paths, which requests). The original MCP had none of this — the Agent couldn't see where it had crawled, effectively operating blind. |
| **P0 · Scan Orchestration** | `start_crawl` / `start_audit` (returns taskId), `get_scanner_issues_for_url`, `list_scan_tasks` / `get_scan_task_status` / `delete_scan_task` | Reuses Burp's **Crawl / Active Scan**. The Agent can "dispatch work": initiate crawling and auditing, poll task progress, retrieve issues by URL. The original MCP could at most read existing issues — it **could not initiate scans** — the automation loop broke at the first step. |
| **P1 · History Inspection** | `inspect_proxy_http_history_item` (by index + optional regex) | Reuses Burp's **Proxy History**, precisely fetching a single request by index for inspection without dumping the entire history into context. The original MCP could only batch-read; zeroing in on one item meant fishing through everything. |
| **P1 · Batch Requests** | `bulk_send_http1_requests` (sequential batch) | Reuses Burp's request-sending capability, issuing a batch of requests sequentially in one call. Probing, validation, and bulk parameter testing without round-trips per request. The original MCP could only send single requests — slow and token-expensive. |
| **P1 · History Diff** | `compare_proxy_history_items` | Compare two history items side by side (response differences, parameter changes). Pre-auth vs. post-auth, vulnerable vs. not — conclusions at a glance. The original MCP had no comparison; the Agent had to pull full text and compare manually, eating context. |
| **P1 · Intruder (Delivery)** | `send_to_intruder` | Pushes a request into **Intruder**, but can't read results back — not because I didn't try, but because Montoya API has no complete result interface. Honestly labeled as-is. |
| **P2 · Site Map Write** | `add_to_sitemap` | Write manually discovered or externally scanned results back into the Site Map, keeping Burp's view and the Agent's awareness in sync. The original MCP was read-only. |
| **P2 · Custom Checks** | `import_b_check` | Reuses Burp's **BCheck** custom scan rules, feeding project-specific checks into the Scanner. The original MCP had no interface for this — custom logic couldn't get in. |

I borrowed a few of AT's design principles — universally applicable to anyone building pentest Agents. Borrow the structure, not the trademark:

- Permission gates for dangerous operations (sending requests, scanning, deleting issues) are enforced at runtime, not through prompt-based verbal constraints;
- Long-running tasks like scans return handles and are pollable, rather than assuming sub-second tool results — an Agent that only waits for instant returns can't do real penetration testing;
- HTTP literals from model output undergo `\r\n` normalization — never assume the model produces byte-level-valid HTTP;
- History and issues are paginated and truncated to protect context windows.

## Try It, Give Me Feedback

Different people have different default actions:

- **Red Team / Security Engineering**: Burp + [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) + your own Agent (Claude Code or custom). If the tools aren't enough, extend `Tools.kt` following the P0/P1 priority — don't start by chewing on obfuscated AT.
- **Building a custom pentest framework**: Prioritize standard MCP; tools carry permission and async semantics; the workbench is swappable, the model is swappable — Burp is just one workbench candidate.
- **Still want to tinker with the AT shell**: Back Channel B has architectural room, but verification only counts SSE, and production build details vary by version. This post doesn't provide a bypass cookbook.

When evaluating any AI security product, draw that "hands / brain" diagram first, then talk about model names.

---

You bought the hands, not the brain. What matters isn't which model name is written inside Burp — it's who has the authority to issue `tools/call`.

[burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) has opened the door. Install it, connect your own model, and let me know how it goes.

</div>

## Appendix · Evidence & References

<details>
<summary>Click to expand: analysis evidence, protocol details, and open-source index (does not affect readability of the main text)</summary>

**Why "the model is in the cloud"**

- The desktop jar contains no complete `chat/completions` client — the model was never in the desktop process.
- The desktop is an MCP Server + reverse SSE, not a local chat client; tools are exposed via MCP / BurpAI envelopes, and the connection between hands and brain is a protocol, not a hard link.
- The base URL uses three-tier container resolution; path rules: SSE/POST use `{base}/api/v1/mcp`, claim uses `{sse}/sessions/{burpai_session_id}/claim`, the Hub `AccountScopedMcpSseHub` handles connect / claim / reconnect / 409 re-claim / ~90s idle recycle.
- The official open-source standard MCP Server effectively acknowledges that "any MCP Client" can drive the same set of hands — this is the foundation that makes "external brain" viable.

**burp-mcp vs. Burp AT tool surface gap (by operational mode)**

| Mode | Gap Weight |
|------|-------------|
| Human-in-the-loop + Agent-assisted | Low–Medium (main path covered; swapping your own model is often stronger) |
| Low-attended automated assessment | High (missing crawl/audit/task status/scope) |
| Large-scale fuzzing / batch validation | High ("push to Intruder" ≠ queryable result surface) |
| Model-swapping goal | Protocol & control > tool count |

**Open-source & documentation index**

- [hi-unc1e/burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) — the subject of this post, AT fork of the official mcp-server with P0–P2 extensions
- [PortSwigger/mcp-server](https://github.com/PortSwigger/mcp-server) — the official front door for external Agents
- [modelcontextprotocol.io](https://modelcontextprotocol.io/) — the MCP protocol specification

</details>