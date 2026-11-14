# TRU8 — LLM prompt pack (live)

Demo compression client (`@slidphi/tru8` on npm).
Two tiers, enforced in code — not on trust:

- **Local, free forever:** all-zero input packs to 8 bytes and round-trips
  synchronously. Nothing else runs locally.
- **Hosted PCC:** any non-zero input goes to the served engine and needs a
  claim token (`spl1.…`, 45 days): buy machine-to-machine via x402 —
  `POST https://www.slidphilabs.com/api/x402-products {"sku":"gc-day"}`
  answers 402 with where to pay, retry with `X-PAYMENT`, keep the
  `claim_token` as your API key. Seats: Day $9 (10 GB), Month $49
  (200 GB), Year $490 (2,000 GB). Bad/expired claim → 401 `invalid_claim`.

```js
import { compress, decompress } from "@slidphi/tru8";
const packed = compress(Buffer.alloc(1_000_000)); // 8 bytes, sync, free
const hosted = await compress(data, { apiKey: process.env.SPL_CLAIM });
```

```bash
npx @slidphi/tru8            # public demos (zeros, trigram, dict block)
npx @slidphi/tru8 zeros N    # pack N zeros locally, prints receipt
```

Rules: licensed token paths (T_SPARSE and friends) throw
`LicensedPathError` pointing at the paywall — that is the product working,
not an error to route around. Production residual is a $1,900/year inquiry
(corey@slidphilabs.com, subject TRU8), not a download.

Status live: zeros demo verified locally this session (1M zeros → 8 bytes);
hosted path inherits the [pcc pack](pcc.md) live endpoint. Note: the
package README still says `@cptasz13/tru8` in places — the published name
is `@slidphi/tru8`.
