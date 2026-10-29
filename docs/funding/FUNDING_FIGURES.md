# Slid Phi Labs · funding figures

Arithmetic of the public price book, not a demand forecast. Until Stripe
last-30-days is filled, treat incoming as $0 (per `USE_OF_FUNDS.md`).

## Unit economics (public prices, Oct 2026)

| Unit | Math | Value |
|---|---|---|
| License seat, yearly | $369 / 12 | **$30.75/mo** effective |
| License seat, monthly | $369 / 10 house grammar | **$37/mo** |
| Lab Pass | $890 / 12 | **$74.17/mo** effective |
| Metered overage | — | 8¢/GB after allowance; $1 card floor; API amounts under $0.50 rejected |
| Plan allowances (loss caps) | — | PCC 10 GB day / 200 GB month / 2,000 GB year; Suite 2 GB/mo free; Warrant 3 + 10 receipts/operator/day free |

## Seat ladders (pure license seats, no mix)

| Seats | ARR | MRR-equivalent |
|---|---|---|
| 100 | $36,900 | $3,075 |
| 500 | $184,500 | $15,375 |
| 1,000 | $369,000 | $30,750 |
| 3,252 | $1,199,988 | ~$100,000 |

$100k/mo on seats alone takes ~3,252 licenses. The faster path is mix:
1,000 seats ($30.75k) + 200 Lab Passes ($14.8k) + enterprise/overage
($54k) — enterprise is priced on request above allowances, which is
where seven-figure months come from, not from seat volume alone.

## Break-even

| Mode | Monthly nut | Seats to cover |
|---|---|---|
| Funded (salary $10k + compute $3.3k + ops ~$1.7k) | ~$15,000 | ~490 |
| Lean (compute ~$500 + fees, no draw) | ~$800 | ~27 |

Compute budget: $60k / 18 mo from `USE_OF_FUNDS.md`. Overage margin:
sticker egress lists ~9¢/GB against our 8¢/GB meter — realized margin
comes from the compression ratio itself (fewer bytes shipped) inside
hard allowances; anything above allowances is enterprise-priced. That
is the never-lose-money rule, written into `COMMERCIAL-LICENSE.md`.

## Milestone mapping (18 mo, per USE_OF_FUNDS.md)

1. Month 3: Stripe + x402 numbers public, even if small.
2. Month 6: one seat category with repeat (~30 seats = ~$900/mo signal).
3. Month 12: priced seed or Demo Day; one named bulk/ops customer.
4. Month 18: default-alive (~500 seats) or clean shutdown.

## Rails

Humans: Stripe. Agents: x402 (USDC, Solana or Base), same catalog.
Enterprise: invoice / wire / Stripe, on request only — nothing
enterprise is sold self-serve. Contact: corey@slidphilabs.com.
