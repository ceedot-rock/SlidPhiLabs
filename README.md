# Slid Phi Labs

[![Audited checks](https://github.com/Slid-Phi-Labs/SlidPhiLabs/actions/workflows/audited-checks.yml/badge.svg)](https://github.com/Slid-Phi-Labs/SlidPhiLabs/actions/workflows/audited-checks.yml)
[![License: AGPL-3.0-or-later / Commercial](https://img.shields.io/badge/license-AGPL--3.0--or--later%20%2F%20Commercial-blue)](LICENSE)

We build tools that check. Agent Rider gives any agent a signed name that strangers can check. It is an open ride with protection, not a private club. CuNi takes one program and makes sure it prints the same result everywhere you run it, or it refuses.

This repository is our public website, its API, and the npm clients. It is dual-licensed: AGPL-3.0-or-later, or a paid commercial grant. If you are an agent, start with https://www.slidphilabs.com/llms.txt.

Prices below match https://www.slidphilabs.com/pricing.json as of 2026-11-13. If they ever disagree, pricing.json wins.

| Surface | URL |
|---|---|
| Website | https://www.slidphilabs.com |
| Products | https://www.slidphilabs.com/products |
| Pricing | https://www.slidphilabs.com/pricing |
| MCP | https://www.slidphilabs.com/mcp |
| npm | https://www.slidphilabs.com/npm |
| pulsar (free compressor) | https://github.com/ceedot-rock/pulsar-best |

## Products

| Product | What it is | Price |
|---------|------------|-------|
| **Agent Rider** | A signed name for any agent, so you know which agent acted. Anyone can check it on the public keys. | Solo $12/mo · Team $49/mo · Fleet $199/mo |
| **Warrant** | Writes down what an agent may do (hosts, actions, spend cap), then files the receipt. | $8/mo add-on to Rider Solo ($80/yr) · included in Team and Fleet |
| **CuNi** | Write one program. Python, Go, and JavaScript must print the same result, or it refuses. | Studio $0 · hosted checks from $0.05 · closed-app grant $490/yr |
| **Chamber** | A two-key lock for JSON. One key alone opens nothing. You keep the sealed file. | $20/mo · $200/yr · opening a sealed file is free |
| **Lab Pass** | Chamber, Rider Solo, a PSI Meter seat, and the Warrant add-on, all for a year. Compression is not included. | $495/yr |
| **PCC** | Hosted lossless compression. Send a file, get a smaller one back, restore every byte. | First 1 GB free once per address, then $0.25/GB · Pro $25/mo (100 GB, then $0.20/GB) |
| **TNSSRC** | Our compressor that runs on your own machine. Silesia: 43,724,575 bytes (about 43.72M). Beats xz-9. Not a #1 claim. | AGPL $0 · closed grant $369/yr |
| **TRUSTREAM** | The same compression, for live logs and streams. | Included with PCC |
| **pulsar** | Free GPLv3 compressor you run yourself (binary and source). | Free · $490/yr to embed in a closed product |

The free gigabyte for compression is once per address, for life. It does not reset each month. Compare plans: https://www.slidphilabs.com/compare

## npm

```bash
npm i slid-phi
npm i spl-pay-per-suite
npx -y spl-pay-per-suite mcp
```

These packages call the live host: `compress()` / `decompress()` / `zip()` / `unzip()`. A `.pcc` file is our zip. Dual-licensed.

## Status

See [STATUS.md](STATUS.md) · [LAB50](docs/LAB50.md) · [CHANGELOG.md](CHANGELOG.md) · [SECURITY.md](SECURITY.md). Inbox: corey@slidphilabs.com

## Agents: getting a license

Two legal ways to use the npm clients. Pick one.

1. **Free (AGPL-3.0-or-later).** Install and use. No key, no payment. Hosted compression: first 1 GB free once per address, then $0.25/GB.
2. **Paid grant: buy a PCC seat.** A live seat covers commercial use of the surface (LICENSE.COMMERCIAL): PCC Pro $25/mo (100 GB/mo included, then $0.20/GB) or PCC Pro $250/yr. Legacy gc-* seats are retired; the meter is $0.25/GB of input after the 1 GB lifetime allowance.

Agents buy machine-to-machine with x402 (USDC on Solana or Base): `POST /api/x402-products {"sku":"pcc-pro"}` → HTTP 402 says where to pay → retry with `X-PAYMENT` → `claim_token` (`spl1.…`, 45 days). (legacy `gc-*` SKUs are retired and map to PCC Pro / the meter.) The claim token **is** the API key: `compress(buf, { apiKey: claim })`. Bad/expired claim → HTTP 401 `invalid_claim`, never a silent free-tier downgrade. Live settle via XPay is in flight — do not invent a completed debit.

## License

Site and clients: see LICENSE. pulsar is GPLv3. CuNi is AGPL-3.0-or-later or Commercial. The hosted encoder stays here.
