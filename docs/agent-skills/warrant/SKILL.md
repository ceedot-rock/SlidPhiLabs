---
name: warrant
description: Use Warrant — signed mandate and receipts bound to an Agent-Rider. Caps hosts, actions, spend, and calls. Verify detects tamper. Use when an agent needs permission to act and a receipt that it did.
version: 1.0.0
---

# Warrant

A signed mandate plus a receipt trail, bound to a Rider. Who is Rider; what they may do and proof they did it is Warrant.

Product: https://www.slidphilabs.com/warrant  
Issue: POST https://www.slidphilabs.com/api/warrant/issue  header `X-Agent-Rider`  
Verify: POST `/api/warrant/verify`  
MCP: `spl_warrant_issue` / `spl_warrant_verify` / `spl_warrant_receipt`

Caps live on the mandate: `allow_hosts`, actions, `max_usd`, `max_calls`, `exp`. Receipts decrement remaining budget. Tamper fails verify.

Needs a Rider for non-demo issue. 3 issues + 10 receipts/day free; verify free.

## Pay

$29/mo · $290/yr. Dual license AGPL-3.0-or-later or commercial grant.
