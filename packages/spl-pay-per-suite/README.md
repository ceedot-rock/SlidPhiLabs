# spl-pay-per-suite

**SPL Pay Per Suite** — freemium quotes, Stripe (humans) + x402 (agents). Library, CLI, and MCP.

## Pricing (canonical · matches live API)

| Tier | Rule |
|------|------|
| **Free** | First **100 GB per job** — $0 |
| **Usage** | Next 100 paid GB: **$0.05 / GB** · then **$0.04 / GB** |
| **Min paid** | **$0.05** once over free |
| **Ref** | Under typical first paid cloud egress (~$0.09/GB) |

**Try Gate is retired.** Evaluate on free suite — not a $9 chip-in.

### Standing license SKUs (not suite metered)

| SKU | USD |
|-----|----:|
| CDDG:Split | 199 |
| ZRW N00b / Pro / L33t | 79 / 249 / 699 |
| blackjack · shard-zip · shard-tsdb · slid-phi · support | 199 |
| consulting | 250 |
| sponsor / donate | 29 / 29.99 |
| GAO entry | 1 |

Canonical table: [`docs/NPM_PRICING.md`](../../docs/NPM_PRICING.md) · Catalog: [GET /api/x402-products](https://slidphilabs.fly.dev/api/x402-products)

Live suite: [slidphilabs.fly.dev/pps](https://slidphilabs.fly.dev/pps) · Discovery: [GET /api/agent](https://slidphilabs.fly.dev/api/agent)

## Install

```bash
npm i spl-pay-per-suite
# or CLI
npx spl-pay-per-suite quote --bytes 500000000
```

## Quote (local)

```js
import { computeQuote } from "spl-pay-per-suite";

computeQuote({ product: "auto", op: "compress", bytes: 50 * 1024 ** 3 });
// → free: true (under 100 GB)

computeQuote({ product: "auto", op: "compress", bytes: 110 * 1024 ** 3 });
// → free: false · ~$0.50 class (10 GB × 5¢)
```

## MCP

```bash
npx spl-pay-per-suite mcp
# or: node node_modules/spl-pay-per-suite/src/mcp-server.mjs
```

Tools: `spl_pps_info`, `spl_pps_quote`, `spl_pps_checkout`, `spl_pps_submit_job`, `spl_pps_classify`, `spl_pps_x402_*`.

`spl_pps_info` returns the same suite rates as the live quote engine (`SUITE_PRICING`).

## IP Guard

Quotes and commerce rails only — no private compression process or engines in this package.
