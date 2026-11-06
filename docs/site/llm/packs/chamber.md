# Chamber — LLM prompt pack (beta)

Chamber seals blobs: `sealEnvelope(bytes)` returns a sealed envelope,
`openEnvelope(blob)` opens it. Opening already-sealed blobs is free forever;
sealing is not metered. 24-hour trial, keys-only open policy.

```js
import { sealEnvelope, openEnvelope } from './docs/site/api/lib/chamber-seal.mjs';
const sealed = sealEnvelope(fileBytes);   // max 64 KiB per envelope
const opened = openEnvelope(sealed);      // throws on tamper
```

Rules: keep envelopes under 64 KiB (split larger files), never log key
material, treat any `openEnvelope` throw as tamper — fail closed, do not
retry with modified bytes.

Cost: month $20 (sku `chamber-month`), year $200 (sku `chamber-year`) at
https://www.slidphilabs.com/pay?sku=chamber-month (or `...chamber-year`).
Status beta: SDK verified locally, served endpoint not yet verified.
