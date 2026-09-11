# Slid Phi Labs · one pager

**Lossless compression you can measure. Agent identity and pay rails that actually settle.**

Cherry Hill, NJ · Corey Tasz (solo) · https://www.slidphilabs.com · corey@slidphilabs.com

## What we sell

Four paid surfaces, one free playground:

| Product | What it is | Price |
|---------|------------|-------|
| **CuNi** | One source → Python, Go, JS match or refuse | $0 |
| **Chamber** | Two-key JSON seal | $9/mo · $99/yr |
| **PCC** | Hosted lossless compressor. Engine stays in the lab. | $9/day · $49/mo · $490/yr |
| **Agent-Rider** | Signed agent identity L0–L4 | $79/mo · $790/yr |
| **Suite** | Metered PCC jobs | 6.9 GB / 3 h unpaid, then ~5¢/GB |
| **Lab Pass** | Chamber + PCC + TruGame, 365 days. Not Rider. | $668/yr |

Humans: Stripe. Agents: x402 (USDC, Solana or Base) + hosted MCP `https://www.slidphilabs.com/mcp`.

## Public proof (not a ranking)

- **TRU8 / zeros:** 1 000 000 zeros → **8 bytes**, round-trip. gzip-9 is thousands of bytes on the same class. This is a fill gene, not a general compressor.  
- **pulsar 2.5.0** (GPLv3, not the private engine): Silesia **55,745,438 / 211,938,580**, DECODE_OK 12/12. Beats gzip-9 (~67.6M). Loses to xz-6 (~49.4M) and to zpaq-class tools.  
- npm clients live: `slid-phi` 2.2.11, `spl-pay-per-suite` 1.1.9, `blackjack-compression` 1.5.3, `@cptasz13/tru8` 0.1.1. Stubs and quote rails. **No private encoder in the tarball.**

We do not claim #1 on Silesia. Combined GC (the hosted PCC engine) is not on GitHub.

## Why this is a company

Cloud egress is ~9¢/GB. We meter jobs at ~5¢/GB after a small unpaid cap. Agents already have a catalog and a 402. Identity (Rider) and secrets (Chamber) are seats, not blogs. The lab is one person with live checkout, not a slide.

## Ask

**Y Combinator W27** ($500k standard) and/or a **$500–750k seed** for 18 months: founder salary, one infra/sales hire, compute for honest benches, legal. Details: `USE_OF_FUNDS.md`.

## What we will not say

- That pulsar or PCC is the best compressor.  
- Fake MRR. Stripe totals come from Host.  
- That Combined GC is open source.

## Links

Site · MCP · `/standings` · `/pps` · `/npm` · pulsar release https://github.com/ceedot-rock/pulsar-best/releases/tag/v2.5.0
