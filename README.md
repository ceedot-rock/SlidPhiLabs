# SlidPhiLabs

**SlidPhiLabs** — Zeckendorf / Tribonacci gap encoding + ANS entropy coding (S2S6).

## Products (Stripe live)

| Product | Price | Payment link |
|---------|------:|--------------|
| Commercial | $499 | https://buy.stripe.com/28EbJ20kR0OY99r9kA6wE00 |
| Sponsor | $29 | https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01 |
| Consulting | $250 | https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02 |

## Compression idea

Classic Fibonacci bitmaps pay ~1 bit per scanned position. After Zeckendorf, the *gaps* between used positions are tiny and skewed (mean ≈ 2.7, P(g=2)≈0.5). Encoding those gaps with rANS costs ~1.2 bits per gap and closes most of the remaining distance to the Shannon bound.

At M = 10,000: Shannon 13.29 · Classic Fib 18.23 · **Hybrid+ANS 14.80** (~18.8% better).

## Demo

Open [`s2s6_ans_gaps.html`](./s2s6_ans_gaps.html) in a browser (self-contained).

```
N → Zeckendorf positions → gaps (≥2) → rANS over gap frequencies
```
