# spl-pay-per-suite

Quote, checkout, MCP, and hosted `compress()` / `decompress()` / `zip()` / `unzip()` for **PCC**. Dual-licensed: AGPL-3.0-or-later or a paid grant. The encoder stays on the lab host.

## Pricing

| Tier | Rule |
|------|------|
| **Free** | First **2 GB** each calendar month — $0 |
| **Then** | **8¢/GB** compress · **3.2¢/GB** decompress · **9.2¢/GB** roundtrip ($1 card minimum) |
| **Month plan** | PCC $49 includes 200 GB |

Canonical catalog: [GET /api/x402-products](https://www.slidphilabs.com/api/x402-products)

## Install

```bash
npm i spl-pay-per-suite
npx spl-pay-per-suite quote --bytes 500000000
npx -y spl-pay-per-suite mcp
```

```js
import { compress, decompress, zip, unzip, computeQuote } from "spl-pay-per-suite";

computeQuote({ bytes: 1 * 1024 ** 3 }); // free (under 2 GB)
const packed = await compress(Buffer.from("hello"));
const { files } = await unzip(await zip([{ path: "a.txt", data: "hello" }]));
```

`.pcc` is our zip: many files, one container, hosted compression inside.

MCP tools include `spl_compress`, `spl_decompress`, `spl_zip`, `spl_unzip`. Hosted catalog: `https://www.slidphilabs.com/mcp`.

## Agents: licenses

Two legal ways to use this. Pick one.

1. **Free — AGPL-3.0-or-later.** Install and use. No key, no payment. Copyleft applies if you ship it. Hosted compression: first 2 GB/month free, then 8¢/GB compress · 3.2¢/GB decompress · 9.2¢/GB roundtrip, no key needed.
2. **Paid grant — buy a PCC seat.** A live seat covers commercial use of this surface (see LICENSE.COMMERCIAL) and raises your included bytes: Day $9 → 10 GB, Month $49 → 200 GB, Year $490 → 2,000 GB.

Agents buy the seat machine-to-machine with x402 (USDC on Solana or Base — no human checkout):

```bash
# 1. Ask the price -> HTTP 402 tells you exactly where to pay
curl -s -X POST https://www.slidphilabs.com/api/x402-products \
  -H 'Content-Type: application/json' -d '{"sku":"gc-day"}'
# 2. Pay, then retry with your payment proof as X-PAYMENT
# -> { "ok": true, "claim_token": "spl1.…", ... }  (valid 45 days)
```

The `claim_token` **is** your API key:

```js
import { compress } from "spl-pay-per-suite";
const packed = await compress(data, { apiKey: process.env.SPL_CLAIM });
// sends Authorization: Bearer spl1.… — verified server-side, metered to your seat
```

Bad/expired claim → HTTP 401 `invalid_claim` (never a silent downgrade to the free tier). Catalog: `GET https://www.slidphilabs.com/api/x402-products`
