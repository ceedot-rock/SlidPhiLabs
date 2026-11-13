# Slid Phi Labs · funding figures

Arithmetic of the public price book, not a demand forecast. Until Stripe
last-30-days is filled, treat incoming as $0 (per `USE_OF_FUNDS.md`).

## Unit economics (public prices, 2026-11-13)

The live book is https://www.slidphilabs.com/pricing.json. The October seat ladder ($37/mo, Lab Pass $890, 8¢/GB) is retired.

| Unit | Price |
|---|---|
| CuNi check | $0.05, first 100 a month free |
| CuNi translate, ingest | $0.10 |
| CuNi money, time, parity | $0.25 |
| CuNi chain, ship | $0.50 |
| CuNi audit | $1.00 |
| CuNi closed-app grant | $490/yr |
| PCC meter | first 1 GB free once per address, then $0.25/GB. Card charges start at $1 |
| PCC Pro | $25/mo (100 GB, then $0.20/GB) · $250/yr |
| Chamber | $20/mo · $200/yr |
| Rider | Solo $12/mo · Team $49/mo · Fleet $199/mo |
| Warrant | $8/mo · $80/yr on Solo. Included in Team and Fleet |
| Lab Pass | $495/yr. Parts sum $650. PCC is out |
| Quikgater | $0.02 per fetch, first 100 a month free |
| TNSSRC closed grant | $369/yr (tnssrc-grant, TNSSRC 0.1.0 only) |
| Rider Ops | $37/mo · $369/yr. Fleet includes the watch |

## Seat ladders

The October table (100 seats at $36,900 ARR, and the rows under it) used the retired $369 license. It is not a forecast. Enterprise above the published meters is priced on request.

## Break-even

| Mode | Monthly nut | Seats to cover |
|---|---|---|
| Funded (salary $10k + compute $3.3k + ops ~$1.7k) | ~$15,000 | The old "~490 seats" count used the retired $37 seat |
| Lean (compute ~$500 + fees, no draw) | ~$800 | The old "~27 seats" count used the retired $37 seat |

Compute budget: $60k / 18 mo from `USE_OF_FUNDS.md`. The PCC meter is $0.25/GB of input after the first 1 GB once per address. Pro overage is $0.20/GB. Card charges start at $1.

## Milestone mapping (18 mo, per USE_OF_FUNDS.md)

1. Month 3: Stripe + x402 numbers public, even if small.
2. Month 6: one seat category with repeat (~30 seats = ~$900/mo signal).
3. Month 12: priced seed or Demo Day; one named bulk/ops customer.
4. Month 18: default-alive (~500 seats) or clean shutdown.

## Rails

Humans: Stripe. Agents: x402 (USDC, Solana or Base), same catalog.
Enterprise: invoice / wire / Stripe, on request only — nothing
enterprise is sold self-serve. Contact: corey@slidphilabs.com.
