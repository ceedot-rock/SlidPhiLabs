# spl-pay-per-suite

Quote, checkout, MCP, and hosted `compress()` / `decompress()` / `zip()` / `unzip()` for **AWARE**. Dual-licensed: AGPL-3.0-or-later or a paid grant. The encoder stays on the lab host.

## Pricing

| Tier | Rule |
|------|------|
| **Free** | First **2 GB** each calendar month — $0 |
| **Then** | **8¢ / GB** ($1 card minimum) |
| **Month plan** | AWARE $49 includes 200 GB |

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
