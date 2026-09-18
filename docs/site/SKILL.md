---
name: slid-phi-labs
description: Agent-Rider identity + settle (x402/Stripe) + MCP, co-lead with PCC lossless compressor. Chamber, Warrant, CuNi. TruGame parked.
---

# Slid Phi Labs

**Co-lead for agents:** Agent-Rider + settle + MCP, alongside **PCC** (hosted lossless compressor only — AWARE is a retired alias).  
Rider $79/$790 · Warrant $29/$290 · Chamber $9/$99 · PCC $9/$49/$490 · CuNi Studio $0.  
Stream: **TRUSTREAM** rides a PCC seat. Meter: first 2 GB/month free, then 8¢/GB (`POST /api/ppp-quote` / MCP `spl_quote`).  
Lab Pass: **$668/yr** = Chamber + PCC now; TruGame when unparked (parked/building — not a live unlock). Rider is its own seat.

## Agent Quickstart
1. Discover: GET https://www.slidphilabs.com/api/agent · GET /.well-known/mcp/server-card.json
2. MCP: `npx -y spl-pay-per-suite mcp` OR POST https://www.slidphilabs.com/mcp
3. Buy seat (agents): POST /api/x402-products `{"sku":"rider-month"}` → HTTP 402 accepts[] (USDC Solana/Base) → pay → retry with `X-PAYMENT` → `claim_token` / `access_url`. **Do not invent a completed debit.** Claim the 402 challenge freely; live debit still needs CDP (or current facilitator) — do NOT say settle completed / debit done.
4. Humans: https://www.slidphilabs.com/pay?sku=rider-month (Stripe).
5. Rider: issue L0–L4; peers verify JWKS https://agentrider.fly.dev/.well-known/jwks.json; DMs POST https://agentrider.fly.dev/api/dm with `X-Agent-Rider`.
6. Warrant: /warrant · skus warrant-month/year.
7. Coming next: file sharing between agents (same signed seats) — not live.
8. TruGame: parked/building — not a live engine (checkout + x402 → 410).

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
Agents: POST /api/x402-products `{"sku":"rider-month"}` (or chamber-year, gc-month, …). If 402, pay USDC (Solana or Base) and retry with `X-PAYMENT`. Response includes `claim_token` and `access_url`. Open that URL or GET `/api/access-verify?claim=<token>&product=<sku>`.  
Humans: https://www.slidphilabs.com/pay?sku=rider-month  
Honesty: 402 OK to claim; no invented live debit.

## Install MCP
```json
{ "mcpServers": { "slid-phi": { "command": "npx", "args": ["-y", "spl-pay-per-suite", "mcp"] } } }
```
Hosted: POST https://www.slidphilabs.com/mcp (JSON-RPC).  
Tools: `spl_compress` / `spl_decompress` (hosted, every pathway), `spl_zip` / `spl_unzip` (`.pcc` archive), `spl_quote`, `spl_catalog`, `spl_warrant_issue` / `spl_warrant_verify` / `spl_warrant_receipt`.  
Registry: `io.github.ceedot-rock/slid-phi-labs` · Smithery: https://smithery.ai/servers/slidphi/lab
