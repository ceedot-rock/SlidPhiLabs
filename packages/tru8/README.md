# @cptasz13/tru8

Dual-licensed compression client from Slid Phi Labs. Primary product face is **PCC**; this package is a demo client, not the current lead. AWARE is a retired alias for PCC.

- All-zero input packs locally to **8 bytes** and round-trips (sync).
- Everything else uses hosted PCC (`compress()` returns a Promise).
- `zip()` / `unzip()` build a `.pcc` archive (our zip).

```bash
npm i @cptasz13/tru8
npx @cptasz13/tru8
```

```js
import { compress, decompress } from "@cptasz13/tru8";

const packed = compress(Buffer.alloc(1_000_000)); // 8 bytes, sync
const raw = decompress(packed);                   // 1_000_000 zeros
```

PCC: https://www.slidphilabs.com/pcc · `.pcc` archive format: https://www.slidphilabs.com/archive

## Agents: licenses

Two legal ways to use this. Pick one.

1. **Free — AGPL-3.0-or-later.** Install and use. No key, no payment. The all-zeros demo (`compress(zeros)` → 8 bytes) runs locally and is free forever.
2. **Paid grant — buy a PCC seat.** Non-zero data uses hosted PCC: first 2 GB/month free, then 8¢/GB. A live seat covers commercial use of this surface (see LICENSE.COMMERCIAL): Day $9 → 10 GB, Month $49 → 200 GB, Year $490 → 2,000 GB included.

Agents buy the seat machine-to-machine with x402 (USDC on Solana or Base — no human checkout): `POST https://www.slidphilabs.com/api/x402-products {"sku":"gc-day"}` → HTTP 402 tells you where to pay → retry with `X-PAYMENT` → `claim_token` (`spl1.…`, valid 45 days).

The `claim_token` **is** your API key: `compress(data, { apiKey: process.env.SPL_CLAIM })`. Bad/expired claim → HTTP 401 `invalid_claim`.
