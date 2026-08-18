# Public Black Box Bench

Full engines under the json-chamber control plane. **Metrics only** — no residuals, key shares, or sealed payloads.

## Policy

- 24h trial → hard off until payment
- Shared killswitch + entitlement for all products
- Public benches never publish internal buffers

## Headline (2026-08-18 run)

| Suite | Result |
|-------|--------|
| License gate | trial → paid OK |
| Seal 64 KB | ~36 ms cloak / ~36 ms open, round-trip OK |
| Benefit funnel | compress candidates → **tru8-chamber ($1,900/project/year)** |
| TruGame engine | **~1,265 ticks/s** under entitlement |
| Streamer + netcode | gated, pack OK |

## Contact

corey@slidphilabs.com · https://www.slidphilabs.com/access

Full machine-readable: `PUBLIC_BENCH_LATEST.json`  
Harness: `run_public_bench.py`
