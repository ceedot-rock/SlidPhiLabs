# SlidPhiLabs

<p align="center">
  <img src="https://raw.githubusercontent.com/ceedot-rock/splabs-brand/main/assets/splabs-logo-512.png" alt="SPLabs" width="120"/>
</p>

**SlidPhiLabs** / **slid-phi** — integer compression (Zeckendorf / hybrid Fib + optional gap–ANS path).

## Products (Stripe live)

| Product | Price | Payment link |
|---------|------:|--------------|
| Commercial | $499 | https://buy.stripe.com/28EbJ20kR0OY99r9kA6wE00 |
| Sponsor | $29 | https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01 |
| Consulting | $250 | https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02 |

Pricing page: [splabs-brand/docs/pricing-slid-phi.html](https://github.com/ceedot-rock/splabs-brand/blob/main/docs/pricing-slid-phi.html)

## Math (reconcile)

At **M = 10,000**:

| Scheme | Avg bits | Notes |
|--------|----------|--------|
| Shannon floor | ≈13.29 | log₂ M |
| Classic Fib bitmap | ≈18.23 | optimal under strict no-consecutive-1s + T=11 |
| Hybrid (slid-phi) | ≈17.45 | one `11` + terminator `111` + low-bits · **~4.3%** smaller |
| Gap + ANS (demo path) | ≈14.8 | different codec family · skewed gaps |

Skip any Fib base → coverage 100%→76%. True Tribonacci base deferred for v2 win.

## Demo

Open [`s2s6_ans_gaps.html`](./s2s6_ans_gaps.html) (browser, no build).

```
npm i slid-phi   # v1.0.3 zero-deps TABLE256 when published/mirrored
```

Logo assets live in [ceedot-rock/splabs-brand](https://github.com/ceedot-rock/splabs-brand).
