# spl-pay-per-suite — financial

Updated 2026-11-02. Source: `packages/spl-pay-per-suite` v1.2.3, NPM pricing.

- Canonical meter: first **6.9 GB / 3 h** unpaid, then **$0.05/GB**
  (first 100 paid GiB), **$0.04/GB** bulk, min $0.05.
- Dual-licensed AGPL; paid grant via `gc-month`-class SKUs.
- npm live copy 1.1.8 still says 100 GB — stale, needs publish with auth.
- Revenue to date: $0 (Stripe last-30-days unfilled).
- Next money step: M3 milestone — Stripe + x402 numbers public, even small.

## History

- 2026-08-07: x402 commerce surface; Try Gate retired for freemium suite.
- Price path: ~1.5¢/GB → 1 GB free → 100 GB free → 6.9 GB / 3 h gate
  (08-29). Each step documented in git, none earned revenue.
- 2026-09-05: npm 1.1.9 published. 2026-10-16: LLC attribution.
- 2026-10-28: price truth sweep; owner gratis lane (suite 36/36 tests).
- Rails history: Stripe day-1 (07-29) → x402 08-07 → aligned 08-25.
