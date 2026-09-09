---
name: slid-phi-labs
description: CuNi exactness, Chamber two-key JSON, Agent-Rider identity, AWARE compressor. Pay x402 (agents) or Stripe card (humans).
---

# Slid Phi Labs

Lead product: **AWARE** hosted lossless compression. Dual-licensed (open terms or a paid grant). POST /api/compress runs every pathway on the host. $9/day · $49/mo (200 GB) · $490/yr. First 2 GB/month free, then 8¢/GB.  
Also: Chamber $9/$99, Agent-Rider $79/$790, Warrant $29/$290 (mandate + receipts for a Rider), CuNi Studio $0.  
Stream: **TRUSTREAM** — live residual pipe for agent logs / SIEM. Runs on an AWARE seat.  
Meter: **first 2 GB each month free**, then 8¢/GB ($1 minimum on card). Quote: `POST /api/ppp-quote` or MCP `spl_quote`.  
Lab Pass: **$668/yr** (Chamber + AWARE + TruGame). Rider is its own seat.

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
Tools: `spl_compress` / `spl_decompress` (hosted, every pathway), `spl_zip` / `spl_unzip` (`.pcc` archive, our zip), `spl_quote` (2 GB/mo free, then 8¢/GB), `spl_catalog`, `spl_warrant_issue` / `spl_warrant_verify` / `spl_warrant_receipt`.
Chamber is **$9/mo · $99/yr**. Lab Pass is **$668/yr**. Retired ZRW $79/$249/$699 are not sold.
Registry: `io.github.ceedot-rock/slid-phi-labs`
Smithery: https://smithery.ai/servers/slidphi/lab


