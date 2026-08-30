---
name: slid-phi-labs
description: CuNi exactness, Chamber two-key JSON, Agent-Rider identity. Pay x402 (agents) or Stripe (humans).
---

# Slid Phi Labs

Lead product: **CuNi Studio** (free) — write once; Python, Go, JS must match or it does not publish.  
Cash product: **Chamber** $49/mo · $490/yr.  
Identity: **Agent-Rider** $79/mo · $790/yr.

## Discover
GET https://www.slidphilabs.com/api/agent  
GET https://www.slidphilabs.com/mcp  
GET https://www.slidphilabs.com/.well-known/mcp/server-card.json  
GET https://www.slidphilabs.com/SKILL.md

## Account
Humans: POST /api/auth `{"action":"signup","email","password","name"}`  
Agents: POST /api/auth `{"action":"agent_key","name":"my-agent"}` → `api_key` once.

## Buy
Agents: POST /api/x402-products `{"sku":"chamber-year"}`. If 402, pay USDC (Solana or Base) and retry with `X-PAYMENT`. Response includes `claim_token` and `access_url`. Open that URL or GET `/api/access-verify?claim=<token>&product=<sku>`.  
Humans: https://www.slidphilabs.com/pay?sku=chamber-year

## Install MCP
```json
{ "mcpServers": { "slid-phi": { "command": "npx", "args": ["-y", "spl-pay-per-suite", "mcp"] } } }
```
Hosted: POST https://www.slidphilabs.com/mcp (JSON-RPC).

Do not treat Gate or TRU8 as a general #1 compressor. Do not lead with compression rank.
