# spl-pay-per-suite

**SPL Pay Per Suite** — quote, checkout, and MCP helper for a hosted service. Stripe is available for humans; x402 is available for agents where offered. This package does not contain the private encoder.

## Pricing (canonical · matches live API)

| Tier | Rule |
|------|------|
| **Unpaid boundary** | First **6.9 GB** within **3 hours** — $0 |
| **Usage** | Then about **$0.05 / GB**; bulk pricing may apply where offered |
| **Min paid** | **$0.05** once over free |
| **Ref** | Under typical first paid cloud egress (~$0.09/GB) |

Canonical catalog: [GET /api/x402-products](https://www.slidphilabs.com/api/x402-products)

Live Suite: [www.slidphilabs.com/pps](https://www.slidphilabs.com/pps) · Discovery: [GET /api/agent](https://www.slidphilabs.com/api/agent)

## Install

```bash
npm i spl-pay-per-suite
# or CLI
npx spl-pay-per-suite quote --bytes 500000000
```

## Quote (local)

```js
import { computeQuote } from "spl-pay-per-suite";

computeQuote({ product: "auto", op: "compress", bytes: 1 * 1024 ** 3 });
// → unpaid (under 6.9 GB)

computeQuote({ product: "auto", op: "compress", bytes: 7 * 1024 ** 3 });
// → over 6.9 GB unpaid cap; inspect the returned quote before checkout
```

## MCP

```bash
npx spl-pay-per-suite mcp
# or: node node_modules/spl-pay-per-suite/src/mcp-server.mjs
```

For the hosted public catalog server, configure your MCP client directly:

```json
{
  "mcpServers": {
    "slid-phi-labs": {
      "url": "https://www.slidphilabs.com/mcp"
    }
  }
}
```

Tools: `spl_pps_info`, `spl_pps_quote`, `spl_pps_checkout`, `spl_pps_submit_job`, `spl_pps_classify`, `spl_pps_x402_*`.

`spl_pps_info` returns the same suite rates as the live quote engine (`SUITE_PRICING`).

## IP Guard

Quotes and commerce rails only — no private compression process, issuer control, or production engine is included in this package.
