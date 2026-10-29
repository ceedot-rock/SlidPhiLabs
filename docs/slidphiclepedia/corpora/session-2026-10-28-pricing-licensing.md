# Session research 2026-10-28 — psi sale: x402 rail, flat pricing, caps

Type: session synthesis (decisions + measurements from live tree, not web pulls).
Supersedes nothing; append-only. Prices live in the SlidPhiLabs catalog;
this file is the reasoning record.

## x402 rail (reused, not rebuilt)

- Endpoint `POST /api/x402-products` (`docs/site/api/x402-products.js`):
  no payment → 402 + accepts[] (Solana mainnet USDC + Base mainnet USDC);
  X-PAYMENT → on-chain verify → signed `spl1.*` claim (45-day HMAC) → `/access?claim=`.
- Humans ride dynamic Stripe Checkout (`createStripeCheckoutSession` builds
  price_data from catalog at call time) — no Stripe dashboard objects needed
  for new SKUs. Checkout, crypto-manual, and invoice rails are all
  catalog-driven via `resolveSku` in `payments-rails.js`.
- Fulfillment lands in `buildDeliverable` (`access-verify.js`): chamber SEATS
  flow, instant try-gate pattern, else generic human-fulfilled. New SKU kinds
  want their own instant branch mirroring try-gate.
- AgentCore Payments (AWS) evaluated and rejected for this path: the repo's
  own direct-verify rail is live; a migration buys nothing today.

## Pricing decisions (operator-set 2026-10-28)

- ALL yearly licenses flat $369/yr: chamber-year, gc-year, rider-ops-year,
  warrant-year, pulsar-exception, cuni-exception, tnssrc-grant.
- Lab Pass $890/yr = Chamber year + PCC year + psi commercial seat (not Rider).
- Monthly logic: $369/yr ÷ 10 house grammar → $37/mo license seats (pending apply).
- Contradictions found and fixed: lab-pass $490 vs $369, pulsar-exception
  $490 vs $390, cuni-exception file $490 vs $390, SEATS gc-year $490 vs $390.
- Still open: SEATS gc-month $49 vs catalog $39; `commercial` alias → gc-year
  misroutes psi buyers; tnssrc-grant/bakeoff/foundry-plus advertised but
  unresolvable in catalog; CuNIverse vs cuni-repo holder naming differs.

## No-loss caps (operator rule: never lose money)

- Hosted/metered carry hard allowances, overage metered or throttled, never
  free: PCC 10GB/200GB/2TB then 8c/GB; suite 2GB free then metered, $1 card
  minimum; API amounts under $0.50 rejected; Warrant free tier 3+10/day.
- Source licenses (exceptions, psi seats): zero marginal cost, no usage cap;
  one product, one term. Support/consulting scope fixed in invoice pre-work.
- Abuse (credential sharing, seat resale, metering evasion) terminates
  without refund. Enterprise (10+ seats, private deploy, SLA) priced on
  request via inbox; invoice/ACH/wire/Stripe terms.

## Revenue math (flat $369/yr = $30.75/mo per license)

- 100 licenses: $36,900/yr = $3,075/mo MRR.
- 1,000 licenses: $369,000/yr = $30,750/mo — NOT $100k/mo; that needs
  ~3,250 flat licenses or enterprise mix (e.g. base + $50k/yr contracts).
- 100 Lab Pass ($890): $89,000/yr. Monthly $37 seats annualize to $444 max.

## psi close (operator: psi can't be open)

- Sole author (14 commits) so forward relicense is clean; published AGPL
  copies (85 clones / 45 uniques last 14d, v1.0.0 + v1.0.1) stay AGPL forever.
- psi-month/psi-year seats ($39/$37-mo pending, $369/yr) + Lab Pass inclusion
  decided; catalog wiring drafted, not yet applied.
