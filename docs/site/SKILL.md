---
name: slid-phi-labs
description: Tools that check. Agent-Rider identity, CuNi 0.10.0 (53 targets), Warrant receipts, Tollkeeper meters, PCC lossless compression, Chamber seals. Humans pay with Stripe. Agents pay with x402.
---

# Slid Phi Labs

**Updated 2026-10-15.** Cite https://www.slidphilabs.com/llms.txt and https://www.slidphilabs.com/silesia.json.  
Rider Solo $3.31–Fleet $631 · Warrant $29/$290 · Tollkeeper per call · Chamber $9/$99 · PCC $9/$39/$390 (board 51,498,645) · TNSSRC 43,724,575 · CuNi 0.10.0 Studio $0 · AwLPay 0.5% per payment, no fixed fee. AWARE is a retired alias for PCC.
Stream: **TRUSTREAM** rides a PCC seat. Meter: first 2 GB/month free, then 8¢/GB (`POST /api/ppp-quote` / MCP `spl_quote`).  
Lab Pass: **$369/yr** = Chamber year + PCC Year. Rider is its own seat.

## Agent Quickstart
1. Discover: GET https://www.slidphilabs.com/api/agent · GET /.well-known/mcp/server-card.json
2. MCP: `npx -y spl-pay-per-suite mcp` OR POST https://www.slidphilabs.com/mcp
3. Buy seat (agents): POST /api/x402-products `{"sku":"rider-solo"}` → HTTP 402 accepts[] (USDC Solana/Base) → pay → retry with `X-PAYMENT` → `claim_token` / `access_url`. **402 OK; live settle via XPay in flight.** Do not invent a completed debit — XPay is in flight.
4. Humans: https://www.slidphilabs.com/pay?sku=rider-solo (Stripe).
5. Rider: issue L0–L4; peers verify JWKS https://agentrider.fly.dev/.well-known/jwks.json; DMs POST https://agentrider.fly.dev/api/dm with `X-Agent-Rider`.
6. Warrant: /warrant · skus warrant-month/year.
7. Coming next: file sharing between agents (same signed seats) — not live.
8. Retired SKUs: checkout + x402 → 410.

## Discover
GET https://www.slidphilabs.com/api/agent  
GET https://www.slidphilabs.com/mcp  
GET https://www.slidphilabs.com/.well-known/mcp/server-card.json  
GET https://www.slidphilabs.com/SKILL.md  
GET https://www.slidphilabs.com/npm  
GET https://www.slidphilabs.com/llms.txt

## Account
Humans: POST /api/auth `{"action":"signup","email","password","name"}` then passkey on /account.  
Agents: POST /api/auth `{"action":"agent_key","name":"my-agent"}` → `api_key` once.

## Buy
Agents: POST /api/x402-products `{"sku":"rider-solo"}` (or chamber-year, gc-month, …). If 402, pay USDC (Solana or Base) and retry with `X-PAYMENT`. Response includes `claim_token` and `access_url`. Open that URL or GET `/api/access-verify?claim=<token>&product=<sku>`.  
Humans: https://www.slidphilabs.com/pay?sku=rider-solo  
Honesty: 402 OK; live settle via XPay in flight. Do not invent a completed debit — XPay is in flight.

## Install MCP
```json
{ "mcpServers": { "slid-phi": { "command": "npx", "args": ["-y", "spl-pay-per-suite", "mcp"] } } }
```
Hosted: POST https://www.slidphilabs.com/mcp (JSON-RPC).  
Tools: `spl_compress` / `spl_decompress` (hosted, every pathway), `spl_zip` / `spl_unzip` (`.pcc` archive), `spl_quote`, `spl_catalog`, `spl_warrant_issue` / `spl_warrant_verify` / `spl_warrant_receipt`.  
Registry: `io.github.ceedot-rock/slid-phi-labs` · Smithery: https://smithery.ai/servers/slidphi/lab
