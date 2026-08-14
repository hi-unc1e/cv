# LinkedIn Post Draft: Burp AT / burp-mcp-server

---

## Version A: Practitioner's Review (Recommended — Safest, most LinkedIn-appropriate)

I've been using Burp AT for automated penetration testing workflows, and the experience is genuinely good — it proves that AI can effectively drive security testing. But I wanted more control: my own model, my own data boundaries, my own scheduling.

So I built [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) — an open-source MCP server that connects Burp Suite to any AI agent via the standard MCP protocol.

The key insight: Burp AT's architecture separates "hands" (the local tool runtime — crawling, scanning, HTTP manipulation) from the "brain" (the AI orchestrator making decisions). Once you understand this separation, you realize you can swap the brain without touching the hands.

What I built extends PortSwigger's official MCP server with red-team workflow essentials:
- Scope management so the agent knows its boundaries
- Crawl & audit orchestration for automated assessment
- Batch HTTP requests for efficient validation
- History comparison for differential analysis
- BCheck import for custom scan rules

The philosophy: you bought the hands, not the brain. What matters isn't which model name is written inside Burp — it's who has the authority to issue `tools/call`.

Full writeup: https://www.unc.la/posts/penetration/burp-at-brain-hand-open-source-mcp/

If you're building AI-powered security tooling or doing automated pentesting, I'd love to hear your approach.

#security #automation #opensource #burpsuite #ai #mcp

---

## Version B: Architecture Insight (More technical, for security-focused audience)

After working extensively with Burp AT and studying its architecture, I realized something fundamental: the "hands" (Burp's tool runtime) are local, but the "brain" (the AI agent) can be anywhere. The MCP protocol is the connective tissue.

This insight led me to build [burp-mcp-server](https://github.com/hi-unc1e/burp-mcp-server) — a standard MCP server for Burp Suite that adds the missing pieces for red-team automation: scope management, crawl/audit orchestration, batch requests, history diffing, and custom check imports.

Key design decisions:
- Permission gates at runtime, not in prompts
- Async task handles for long-running scans (not assuming sub-second results)
- HTTP literal normalization for model output
- Context-aware pagination for history and issues

It's a fork of PortSwigger's official MCP server, preserving the stable tool surface while adding the spine that makes a red-team loop actually close. Current release: v1.3.0-AT.

Writeup with full architecture analysis: https://www.unc.la/posts/penetration/burp-at-brain-hand-open-source-mcp/

If you're building AI-augmented security tooling, what's your approach to the "hands vs. brain" problem?

#securityengineering #penetrationtesting #aiagents #opensource #mcp #burpsuite

---

## Usage Notes

- **Pick Version A** if you want a broader LinkedIn audience (recruiters, managers, general tech)
- **Pick Version B** if you want to reach practitioners (pentesters, security engineers, tool builders)
- **Don't tag PortSwigger** — they may not appreciate a post about an alternative to their commercial product
- **Post during US/EU business hours** for maximum reach on security content
- **Attach a screenshot** of the burp-mcp-server in action (or the architecture diagram from the blog) as the post image for higher engagement
- **Reply to every comment** in the first 2 hours to boost the algorithm