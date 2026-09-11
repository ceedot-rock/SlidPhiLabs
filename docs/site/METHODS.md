# Methods the public doors must show

Canonical: https://www.slidphilabs.com/
SoT money: /pricing.json
SoT methods (this file)

## Compression (outcomes only)

- Product face: PCC. Hosted lossless compression. Dual-licensed public source (AGPL or paid grant). Host xz/gzip/bzip are opponents, not occupants.
- Official Silesia 12, whole files, DECODE_OK, raw **211,938,580** (`pcc-0.12.1` matrix):
  - pulsar 2.5.0 **55,745,438** (matches OSCB)
  - PCC **51,498,645** (4.25M inside pulsar; still loses to xz-6 ~49.4M)
  - champ **50,541,135** DECODE_OK 12/12
  - gzip-9 **67,631,990** (opponent)
  - bzip2-9 **54,506,769** (opponent)
  - xz-6 still ahead (~49.4M; no exact lab total published)
  - best / aware: no total until 12/12
- Retired: AWARE+XZ1 **47,752,368**. That line occupied host xz. Off this scoreboard.
- Zeros: 1e6 zero bytes → **8 B**, round-trip.
- Hosted API: 4 MiB, 45s, `/bench`. Not official Silesia.
- Law: coded ≥ raw → raw + flag. Never expand. Not a #1 claim.

## Gate

- Unpaid: **2 GB per calendar month**. Then **8¢/GB**, **$1** minimum on card.
- Humans: /pay Stripe (team secrets).
- Robots: x402 POST /api/x402-products, header X-PAYMENT. Same PAY_TO_ADDRESS as quikgater.
- MCP / npm / Fly / git copy this file. Do not say 6.9 GB / 3 h unpaid. The live meter is 2 GB/month then 8¢/GB.

## Doors

| door | URL |
|---|---|
| site | https://www.slidphilabs.com |
| Fly | https://slidphilabs.fly.dev (alias, not a second store) |
| npm | package slid-phi homepage www.slidphilabs.com |
| MCP/agents | /api/agent · /llms.txt · /agents.json |
| measurements | https://www.slidphilabs.com/gc |
