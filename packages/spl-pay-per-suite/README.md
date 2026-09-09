# spl-pay-per-suite

Quote, checkout, and MCP helper for **AWARE** metered jobs. Stripe for humans; x402 for agents. This package does not contain the compressor.

## Pricing

| Tier | Rule |
|------|------|
| **Free** | First **2 GB** each calendar month — $0 |
| **Then** | **8¢ / GB** ($1 card minimum) |
| **Month plan** | AWARE $49 includes 200 GB |

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
