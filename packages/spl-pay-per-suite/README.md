# spl-pay-per-suite

**SPL Pay Per Suite** — freemium quotes, Stripe (humans) + x402 (agents). Library, CLI, and MCP.

## Pricing (v2 freemium)

| Tier | Rule |
|------|------|
| **Free** | First **1 GiB per job** — $0 (showcase) |
| **Usage** | Bytes over free: **~$0.015/GB** (0.8¢/GB after 50 GB over free) |
| **Min paid** | $0.15 once over free |

**Try Gate is retired.** Evaluate on free suite — not a $9 chip-in.

License packages (CDDG:Split, ZRW tiers, etc.) remain separate fixed SKUs via catalog/x402.

Live: [www.slidphilabs.com/pps](https://www.slidphilabs.com/pps) · Discovery: [GET /api/agent](https://www.slidphilabs.com/api/agent)

## Install

```bash
npm i spl-pay-per-suite
# or CLI
npx spl-pay-per-suite quote --bytes 500000000
```

## Quote (local)

```js
import { computeQuote } from "spl-pay-per-suite";

computeQuote({ product: "auto", op: "compress", bytes: 100e6 });
// → free: true, amount_cents: 0

computeQuote({ product: "auto", op: "compress", bytes: 9e9 });
// → free: false, ~$0.15 class
```

## MCP

```bash
npx spl-pay-per-suite mcp
# or: node node_modules/spl-pay-per-suite/src/mcp-server.mjs
```

Tools: `spl_pps_info`, `spl_pps_quote`, `spl_pps_checkout`, `spl_pps_submit_job`, `spl_pps_classify`, `spl_pps_x402_*`.

## IP Guard

Quotes and commerce rails only — no private compression process or engines in this package.
