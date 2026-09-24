# Slid Phi Labs

AWARE is a retired alias for PCC (the hosted lossless compressor). TRU8 is not the current product lead.

Hosted lossless compression, a two-key JSON seal, signed agent identity, and a small language that refuses to lie.

This repository is the public website, API, and npm clients. Dual-licensed: AGPL-3.0-or-later or a paid commercial grant. Hosted compression runs every pathway we own.

| Surface | URL |
|---|---|
| Website | https://www.slidphilabs.com |
| Products | https://www.slidphilabs.com/products |
| MCP | https://www.slidphilabs.com/mcp |
| npm | https://www.slidphilabs.com/npm |
| pulsar (free compressor) | https://github.com/ceedot-rock/pulsar-best |

## Products

| Product | What it is | Price |
|---------|------------|-------|
| **PCC** | Hosted lossless compression. Dual-licensed. Send a file, get a smaller file back, restore every byte. | $9/day · $49/mo (200 GB) · $490/yr (2,000 GB), then 8¢/GB |
| **TRUSTREAM** | The same plan, for live logs. | Included with PCC |
| **Chamber** | Two-key JSON seal. One share is useless. You store the blob. | $9/mo · $99/yr |
| **Agent-Rider** | Signed identity so you know which agent acted. | $79/mo · $790/yr |
| **Warrant** | Signed mandate and receipts bound to a Rider (hosts, actions, spend cap). | $29/mo · $290/yr |
| **CuNi** | Write one program. Print many languages. Python, Go, and JS must match, or it refuses. | Studio $0 · closed-app exception $490/yr |
| **pulsar** | Free GPLv3 compressor you run on your own machine (binary + source). | Free · $490/yr to embed in a closed product |

First 2 GB each month are free with no plan. Compare: https://www.slidphilabs.com/compare

## npm

```bash
npm i slid-phi
npm i spl-pay-per-suite
npx -y spl-pay-per-suite mcp
```

These packages call the live host: `compress()` / `decompress()` / `zip()` / `unzip()`. A `.pcc` file is our zip. Dual-licensed.

## Status

See [STATUS.md](STATUS.md) · [CHANGELOG.md](CHANGELOG.md) · [SECURITY.md](SECURITY.md). Inbox: corey@slidphilabs.com

## Agents: getting a license

Two legal ways to use the npm clients. Pick one.

1. **Free — AGPL-3.0-or-later.** Install and use. No key, no payment. Hosted compression: first 2 GB/month free, then 8¢/GB.
2. **Paid grant — buy a PCC seat.** A live seat covers commercial use of the surface (LICENSE.COMMERCIAL): Day $9 → 10 GB, Month $49 → 200 GB, Year $490 → 2,000 GB included.

Agents buy machine-to-machine with x402 (USDC on Solana or Base): `POST /api/x402-products {"sku":"pcc-day"}` → HTTP 402 says where to pay → retry with `X-PAYMENT` → `claim_token` (`spl1.…`, 45 days). (`gc-day` still works as a silent legacy checkout id; the product is PCC.) The claim token **is** the API key: `compress(buf, { apiKey: claim })`. Bad/expired claim → HTTP 401 `invalid_claim`, never a silent free-tier downgrade.

## License

Site and clients: see LICENSE. pulsar is GPLv3. CuNi is AGPL-3.0-or-later or Commercial. The hosted encoder stays here.
