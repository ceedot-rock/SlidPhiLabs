# blackjack-compression

Dual-licensed hosted lossless compression client. `compress()` / `decompress()` / `zip()` / `unzip()` call the live host. Open terms or a paid grant.

```bash
npm i blackjack-compression
```

```js
import { compress, decompress, zip } from "blackjack-compression";

const { packed } = await compress(Buffer.from("hello"));
const archive = await zip([{ path: "a.txt", data: "hello" }]); // .pcc
```

A `.pcc` file is our zip. First 2 GB/month free, then 8¢/GB. Product: [www.slidphilabs.com/pcc](https://www.slidphilabs.com/pcc)

## Agents: licenses

Two legal ways to use this. Pick one.

1. **Free — AGPL-3.0-or-later.** Install and use. No key, no payment. Copyleft applies if you ship it. Hosted compression: first 2 GB/month free, then 8¢/GB, no key needed.
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
import { compress } from "blackjack-compression";
const { packed } = await compress(data, { apiKey: process.env.SPL_CLAIM });
// sends Authorization: Bearer spl1.… — verified server-side, metered to your seat
```

Bad/expired claim → HTTP 401 `invalid_claim` (never a silent downgrade to the free tier). Catalog: `GET https://www.slidphilabs.com/api/x402-products`
