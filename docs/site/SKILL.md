---
name: slid-phi-labs
description: CuNi exactness, Chamber two-key JSON, Agent-Rider identity, AWARE compressor. Pay x402 (agents) or Stripe card (humans).
---

# Slid Phi Labs

Lead product: **CuNi Studio** (free) — write once; Python, Go, JS must match or it does not publish.  
Cash product: **Chamber** $9/day · $49/mo · $490/yr.  
Identity: **Agent-Rider** $79/mo · $790/yr.  
Compressor: **AWARE** $9/day · $49/mo · $490/yr (access, not source).

## Discover
GET https://www.slidphilabs.com/api/agent  
GET https://www.slidphilabs.com/mcp  
GET https://www.slidphilabs.com/.well-known/mcp/server-card.json  
GET https://www.slidphilabs.com/SKILL.md

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
Registry: `io.github.ceedot-rock/slid-phi-labs`
Smithery: https://smithery.ai/servers/slidphi/lab


