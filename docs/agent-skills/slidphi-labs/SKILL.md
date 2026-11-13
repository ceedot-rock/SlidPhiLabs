---
name: slidphi-labs
description: Discover and use Slid Phi Labs — PCC hosted lossless compression, TRUSTREAM, Chamber two-key JSON, Agent-Rider identity, Warrant mandates, CuNi exactness. Dual doors Stripe (humans) and x402 (agents). Use when an agent needs compress, seal JSON, sign identity, exact multi-language emit, or lab catalog/pay.
version: 1.1.0
---

# Slid Phi Labs

Cherry Hill, NJ. Corey Tasz. Inbox corey@slidphilabs.com.

Co-lead for agents: **Agent-Rider + settle + MCP**, alongside **PCC** (lossless compressor only). Storefront: Rider, Warrant, PCC, TRUSTREAM, Chamber, CuNi.


## Agent Quickstart (mirror)

See live https://www.slidphilabs.com/llms.txt and https://www.slidphilabs.com/SKILL.md — Rider + settle + MCP co-lead with PCC. 402 OK; live settle via XPay in flight. Do not invent a completed debit — XPay is in flight. File sharing coming next — not live.

## Discover first

```bash
curl -sL https://www.slidphilabs.com/api/agent
curl -sL https://www.slidphilabs.com/llms.txt
curl -sL https://www.slidphilabs.com/.well-known/mcp/server-card.json
```

| Door | URL |
|------|-----|
| Site | https://www.slidphilabs.com |
| Products | https://www.slidphilabs.com/products |
| Humans | Stripe https://www.slidphilabs.com/pay |
| Agents | x402 POST https://www.slidphilabs.com/api/x402-products |
| MCP | POST https://www.slidphilabs.com/mcp · `npx -y spl-pay-per-suite mcp` |
| Smithery MCP | https://smithery.ai/servers/slidphi/lab |
| Lab verbs | https://spl-lab-agent.fly.dev/healthz  check · translate · squeeze |

## What each product is

| Product | It is | Pay |
|---------|-------|-----|
| PCC | Hosted lossless compressor. Send a file, restore every byte. Dual-licensed. | First 1 GB free once per address, then $0.25/GB. Pro $25/mo (100 GB, then $0.20/GB) · $250/yr |
| TRUSTREAM | Live residual pipe for logs/SIEM on a PCC seat | Included with PCC |
| Chamber | Two-key JSON seal. AES-256-GCM. One share is useless. | $20/mo · $200/yr |
| Agent-Rider | Signed agent identity, trust, credits, MCP. Official remote is Fly. | Solo $12/mo · Team $49/mo · Fleet $199/mo |
| Warrant | Mandate + receipts bound to a Rider | $8/mo · $80/yr on Solo. Included in Team and Fleet |
| CuNi | One program, same stdout or refuse. Hosted calls use POST /v1/<name>. | Studio $0. Calls $0.05 to $1.00. Closed-app $490/yr |

Official Silesia 12 (211,938,580, DECODE_OK): pulsar 2.5.0 **55,745,438** · PCC pcc-0.12.1 **51,498,645**. gzip-9 67,631,990. xz-6 still smaller. Not a #1 claim.

## Agent pay

1. POST `/api/x402-products` `{"sku":"chamber-year"}`
2. HTTP 402 → pay USDC (Solana or Base) → retry with `X-PAYMENT`
3. Open `access_url` or GET `/api/access-verify?claim=<token>&product=<sku>`

Humans: POST `/api/checkout` `{"sku":"...","rail":"stripe"}`.

Hosted calls: check $0.05 (first 100/month free), translate and ingest $0.10, money, time, and parity $0.25, chain and ship $0.50, audit $1.00, squeeze $0.10.

## Install

```json
{ "mcpServers": { "slid-phi": { "url": "https://www.slidphilabs.com/mcp" } } }
```

npm: `slid-phi` · `spl-pay-per-suite` · `json-chamber-mcp`. pypi: `json-chamber`.

## Honesty locks
- PCC remains compressor-only.
