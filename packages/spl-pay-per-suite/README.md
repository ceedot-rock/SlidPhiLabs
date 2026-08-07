# SPL Pay Per Suite

**On-spot project quotes · dual payment rails · lab job intake** for Slid Phi Labs.

| Who | Rail |
|-----|------|
| **Humans** | Stripe · [slidphilabs.com/pps](https://www.slidphilabs.com/pps) |
| **Agents** | **x402** · `POST /api/x402-suite` (402 → pay → retry) |

- **npm:** `spl-pay-per-suite`
- **CLI:** `spl-pps` · `pay-per-suite`
- **MCP:** stdio tools including `spl_pps_x402_*`
- **Discovery:** `GET https://www.slidphilabs.com/api/agent`

Private engines stay in the lab. This package quotes, routes payment, and submits jobs — it does **not** ship proprietary codecs.

## Install

```bash
npm i spl-pay-per-suite
# or one-shot
npx spl-pay-per-suite quote --bytes 1048576 --class zeros --product zrw
```

## CLI

```bash
spl-pps quote --bytes 5242880 --class mixed_ints --product auto --op compress
spl-pps quote ./payload.bin
spl-pps pay ./payload.bin --email you@company.com
spl-pps job --email you@company.com --paid --file ./payload.bin
spl-pps products
```

## Library

```js
import { computeQuote, createCheckout, submitJob, quoteFile } from "spl-pay-per-suite";

const q = computeQuote({ product: "zrw", dataClass: "zeros", op: "compress", bytes: 1_000_000 });
console.log(q.amount_display); // e.g. "37.00"

const pay = await createCheckout({ ...q.breakdown, email: "you@company.com" });
// open pay.url

await submitJob({
  email: "you@company.com",
  paidConfirm: true,
  amount_display: q.amount_display,
  product: "zrw",
  dataClass: "zeros",
  op: "compress",
  bytes: 1_000_000,
});
```

## Agentic commerce (x402)

**All standing products** + **metered suite jobs**.

```bash
# Discovery + catalog
curl -s https://www.slidphilabs.com/api/agent | jq .
curl -s https://www.slidphilabs.com/api/x402-products | jq .
spl-pps x402
spl-pps catalog

# Buy CDDG:Split (probe 402, then pay + retry)
spl-pps buy --sku cddg-split --email you@x.com
# payFetch("https://www.slidphilabs.com/api/x402-products", { method:"POST", body: JSON.stringify({ sku: "cddg-split", email }) })

# Metered suite job
spl-pps x402-req --bytes 1048576 --class zeros --product zrw
# payFetch("https://www.slidphilabs.com/api/x402-suite", { ... })
```

**SKUs:** `cddg-split` · `zrw-n00b` · `zrw-pro` · `zrw-l33t` · `blackjack` · `shard-zip` · `shard-tsdb` · `slid-phi` · `support-integration` · `consulting` · `sponsor` · `donate` · `try-gate`

Server env (Vercel): `X402_PAY_TO`, `X402_ASSET`, `X402_NETWORK`, `SOLANA_RPC_URL`. Optional staging: `X402_DEV_BYPASS=1` + header `X-PAYMENT-DEV: ok`.

## MCP

```bash
npx spl-pay-per-suite mcp-serve
```

```json
{
  "mcpServers": {
    "spl-pay-per-suite": {
      "command": "npx",
      "args": ["-y", "spl-pay-per-suite", "mcp-serve"]
    }
  }
}
```

**Tools:** `spl_pps_info` · `spl_pps_quote` · `spl_pps_checkout` · `spl_pps_submit_job` · `spl_pps_classify` · **`spl_pps_x402_info`** · **`spl_pps_x402_catalog`** · **`spl_pps_x402_buy`** · **`spl_pps_x402_requirements`** · **`spl_pps_x402_submit`**

## Pricing model (public)

| Factor | Role |
|--------|------|
| Product base | Service value (auto / ZRW / CDDG Split / family) |
| Size | Progressive $/MB |
| Data class | Shape multiplier |
| Operation | compress · decompress · roundtrip |

Min **$9** · max **$10,000** per job (Stripe custom-amount limit).

## Env (optional)

| Var | Default |
|-----|---------|
| `SPL_PPS_API` | `https://www.slidphilabs.com` |
| `SPL_PPS_SITE` | `https://www.slidphilabs.com/pps` |
| `SPL_PPS_PAYMENT_LINK` | live Stripe PPP / suite link |

## License

© 2026 Slid Phi Labs. Client tooling only; engines and commercial fulfillment remain proprietary.
