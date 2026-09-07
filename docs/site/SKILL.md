---
name: slid-phi-labs
description: CuNi exactness, Chamber two-key JSON, Agent-Rider identity, AWARE compressor. Pay x402 (agents) or Stripe card (humans).
---

# Slid Phi Labs

Lead product: **CuNi Studio** (free) — write once; Python, Go, JS must match or it does not publish.  
Cash product: **Chamber** cloak license $9/mo · $99/yr (open existing seals with both keys).  
Identity: **Agent-Rider** $79/mo · $790/yr.  
Compressor: **AWARE** $9/day · $49/mo · $490/yr (access, not source).  
Stream: **TRUSTREAM** — live residual pipe for agent logs / SIEM. Not a zstd replacement. Runs on an AWARE seat.  
Suite: **6.9 GB / 3 h unpaid**, then ~5¢/GB. Quote: `POST /api/ppp-quote` or MCP `spl_quote`.  
Lab Pass: **$668/yr** (Chamber + AWARE + TruGame). Not Rider.

## Discover
GET https://www.slidphilabs.com/api/agent  
GET https://www.slidphilabs.com/mcp  
GET https://www.slidphilabs.com/.well-known/mcp/server-card.json  
GET https://www.slidphilabs.com/SKILL.md  
GET https://www.slidphilabs.com/npm

## Account
Humans: POST /api/auth `{"action":"signup","email","password","name"}` then passkey on /account.  
Agents: POST /api/auth `{"action":"agent_key","name":"my-agent"}` → `api_key` once.

## Buy
Agents: POST /api/x402-products `{"sku":"chamber-year"}`. If 402, pay USDC (Solana or Base) and retry with `X-PAYMENT`. Response includes `claim_token` and `access_url`. Open that URL or GET `/api/access-verify?claim=<token>&product=<sku>`.  
Humans: https://www.slidphilabs.com/pay?sku=chamber-year

## Install MCP
```json
{ "mcpServers": { "slid-phi": { "command": "npx", "args": ["-y", "spl-pay-per-suite", "mcp"] } } }
```
Hosted: POST https://www.slidphilabs.com/mcp (JSON-RPC).
Tools: `spl_quote` (Suite 6.9 GB / 3 h), `spl_catalog`, `sku_search` / `sku_get`, `npm_search` / `npm_get`.
Chamber is **$9/mo · $99/yr**. Lab Pass is **$668/yr**. Retired ZRW $79/$249/$699 are not sold.
Registry: `io.github.ceedot-rock/slid-phi-labs`
Smithery: https://smithery.ai/servers/slidphi/lab


