# Slid Phi Labs

AWARE is a retired alias for PCC (the hosted lossless compressor). TRU8 is not the current product lead.

Hosted lossless compression, a two-key JSON seal, signed agent identity, and a small language that refuses to lie.

This repository is the public website, API, and npm clients. Dual-licensed: AGPL-3.0-or-later or a paid commercial grant. Hosted compression runs every pathway we own.

SoT for money: https://www.slidphilabs.com/pricing.json (updated 2026-09-24).
Door line: Smaller or same size. Every byte back. Receipt.

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
| **PCC** | Hosted lossless compression. Dual-licensed. Send a file, get a smaller file back, restore every byte. | $9/day · $39/mo (200 GB) · $390/yr, then 8¢/GB |
| **TRUSTREAM** | The same plan, for live logs. | Included with PCC |
| **Chamber** | Two-key JSON seal. One share is useless. You store the blob. | $9/mo · $99/yr |
| **Agent-Rider** | Signed identity so you know which agent acted. | Solo $13.31 · Bundle $19.31 · Crew $49 · Shop $199 · Fleet $631 |
| **Warrant** | Signed mandate and receipts bound to a Rider (hosts, actions, spend cap). | Included in Rider Bundle and Team seats |
| **CuNi** | Write one program. Print many languages. Python, Go, and JS must match, or it refuses. | Studio $0 · closed-app exception $390/yr |
| **pulsar** | Free GPLv3 compressor you run on your own machine (binary + source). | Free · $390/yr to embed in a closed product |
| **Lab Pass** | Chamber year + PCC Year. | $490/yr |

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
2. **Paid grant — buy a PCC seat.** A live seat covers commercial use of the surface (LICENSE.COMMERCIAL): Day $9 → usage, Month $39 → 200 GB, Year $390. $39 is an access grant (license + API + TRUSTREAM), not a volume discount versus the 8¢ meter.

Agents buy machine-to-machine with x402 (USDC on Solana or Base): `POST /api/x402-products {"sku":"gc-day"}` → HTTP 402 says where to pay → retry with `X-PAYMENT` → `claim_token` (`spl1.…`, 45 days). (`gc-day` is the legacy Stripe/x402 checkout token; the product is PCC.) The claim token **is** the API key: `compress(buf, { apiKey: claim })`. Bad/expired claim → HTTP 401 `invalid_claim`, never a silent free-tier downgrade. Live settle via XPay is in flight — do not invent a completed debit.

## License

Site and clients: see LICENSE. pulsar is GPLv3. CuNi is AGPL-3.0-or-later or Commercial. The hosted encoder stays here.
