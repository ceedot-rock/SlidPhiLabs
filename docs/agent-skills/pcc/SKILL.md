---
name: pcc
description: Use PCC, the Slid Phi Labs hosted lossless compressor. Send a file, get a smaller restore-safe copy. MCP spl_compress / POST /api/compress. Use for backups, datasets, archives, logs, TRUSTREAM, .pcc zip, Silesia numbers, or pay-per-suite usage.
version: 1.0.0
---

# PCC

Hosted lossless compression. Dual-licensed (AGPL-3.0-or-later or a paid grant). The host races every pathway it owns and keeps the smallest file that still restores every byte.

Product: https://www.slidphilabs.com/pcc  
API: POST https://www.slidphilabs.com/api/compress · POST /api/decompress  
MCP: `spl_compress` / `spl_decompress` / `spl_zip` / `spl_unzip` / `spl_quote`  
npm: `slid-phi` `compress()` / `decompress()` / `zip()` / `unzip()`  
Source tag for OSCB: https://github.com/ceedot-rock/lbr1/tree/pcc-0.12.1  

TRUSTREAM is the same plan for live logs: https://www.slidphilabs.com/trustream  
`.pcc` is the multi-file archive (our zip): https://www.slidphilabs.com/archive  

## Pay

- **Usage:** first 2 GB each month free, then 8¢/GB. SKU `suite`.
- **Pro:** $49/mo, 200 GB included, then 8¢/GB. Public SKU `pcc-month` (product name is PCC).
- Day / year: public SKUs `pcc-day` / `pcc-year`. (`gc-*` remain silent legacy checkout aliases for Stripe/x402 compat.)

Agents: POST `/api/x402-products` `{"sku":"suite"}` or `{"sku":"pcc-month"}`. Humans: `/pay?sku=pcc-month`.

## Official Silesia (12 whole files, 211,938,580, DECODE_OK)

| Program | Packed |
|---------|-------:|
| pulsar 2.5.0 | 55,745,438 |
| PCC pcc-0.12.1 | 51,498,645 |
| gzip-9 | 67,631,990 |
| bzip2-9 | 54,506,769 |

xz-6 is still smaller (~49.4M). Board: https://www.slidphilabs.com/silesia  

Lab squeeze (PCCX) is a separate verb: POST https://spl-lab-agent.fly.dev/v1/squeeze SKU `lab-squeeze` $0.10.
