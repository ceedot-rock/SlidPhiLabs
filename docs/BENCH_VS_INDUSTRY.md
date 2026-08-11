# Lab products vs industry standards / top compressors

**Date:** 2026-08-10  
**Standings:** v1.2.2  
**Host:** ZRW pack + Node zlib (gzip-9, brotli-11) + OmniWave Silesia context  
**IP Guard:** Public outcomes only. No private residual coefficients.

This is a **domain-honest** comparison: integer-pattern codecs are not the same product class as general-purpose byte compressors, but buyers still ask “vs gzip/zstd?” — so both views are below.

---

## Industry “top tier” (general-purpose lossless)

| # | Codec | Role | Typical strength |
|---|--------|------|------------------|
| 1 | **zstd** | Default modern GP | Best speed×ratio balance |
| 2 | **brotli** | Web / static | Strong ratio on text/HTML/JSON |
| 3 | **gzip / deflate** | Ubiquitous | Compatibility |
| 4 | **lz4** | Real-time / wire | Highest throughput |
| 5 | **snappy** | In-memory / analytics | Very fast, modest ratio |
| 6 | **bzip2** | Legacy archives | Better ratio than gzip, slow |
| 7 | **xz / lzma** | Max offline ratio | Strong size, slow |
| 8 | **zlib** | Deflate library form | Same family as gzip |
| 9–12 | lzo, high-zstd/brotli, columnar, integer specialists | Domain niches | — |

**Rule of thumb:** wire → LZ4/Snappy · default GP → **zstd** · web static → **brotli** · structured integers → specialized codecs (lab domain).

---

## Lab product map → what “win” means

| Lab surface | Competes with | Does **not** claim |
|-------------|---------------|---------------------|
| **ZRW** | gzip/brotli/zstd on *integer sequences* (zeros, ramps, walks) | Winning on random bytes / general files |
| **Blackjack / shards / slid-phi** | Multi-path integer / structured packaging | Full GP replacement (engines private; npm stubs) |
| **CDDG:Split / residual / ZRQC** | Residual *reduction* vs pure discrete baselines | Byte-size race vs gzip on Silesia |
| **PPS / Suite** | Orchestration + freemium path | A single codec algorithm |

---

## Flagship size records (structured integers)

| Corpus | raw | **ZRW** | gzip-9 | brotli-11 | Status |
|--------|----:|--------:|-------:|----------:|--------|
| zeros_10k | 40 KB | **8 B** | 73 B | 13 B | leading |
| zeros_1M | 4 MB | **10 B** | 3910 B | 14 B | record |
| ramp_10k | 40 KB | **8 B** | 13907 B | 10429 B | leading |
| zeros_1k | — | **8 B** | 39 B | 13 B | record |
| ramp_1k | — | **8 B** | 1436 B | 1132 B | record |
| walk_10k s1 (pack) | 40 KB | **128 B** | ~5223 B | — | record |
| walk_10k s5 (pack) | 40 KB | **420 B** | ~11231 B | — | record |

Source of truth: [standings](https://www.slidphilabs.com/standings) (v1.2.2, 2026-08-10).

**Out-of-domain note:** On high-entropy / ad-hoc RNG walks / random int32 / general text, brotli or zstd typically win. ZRW is not designed as a general-purpose compressor.

---

## Silesia context (OmniWave)

| Codec | Approx. size / ratio | Note |
|-------|----------------------|------|
| brotli-11 | ~50.3 MB (~4.21×) | Field size leader |
| zstd-19 | ~52.9 MB (~4.01×) | — |
| zstd-3 | ~66.2 MB (~3.20×) | ~39 MB/s encode |
| gzip-9 | ~67.6 MB (~3.13×) | Baseline |
| **OmniWave lossless freeze** | ~3.13–3.60× | **close** (not crown) |
| OmniWave mixed auto (incl. float) | ~6.03× | Diagnostic only — not lossless claim |

---

## Residual / CDDG:Split / ZRQC (different axis)

Not a gzip size race.

| Metric (public outcomes) | Band |
|--------------------------|------|
| Residual cut | **~64–84%** class |
| Quality vs pure-360 | **~2.05×–2.09×** |
| Mirrored cost | ΔE+ΔC ≈ 0 class |

Industry analogs: Gorilla, Delta-of-delta, FPC, FastPFor — not deflate.

---

## Stubs & access

All public npm packages ship **stubs only**. Real engines are delivered after freemium use or purchase.

- Free first **100 GB / job** → [https://www.slidphilabs.com/pps](https://www.slidphilabs.com/pps)
- Access / support / private install → [https://www.slidphilabs.com/access](https://www.slidphilabs.com/access)
- Agent rail (x402) → [https://www.slidphilabs.com/api/agent](https://www.slidphilabs.com/api/agent)

---

## Top-line talking points (safe)

1. **ZRW beats gzip and brotli by size on zeros / ramps / pack walks.**
2. **zeros_1M → 10 B** is the current large-corpus flagship record.
3. Not a general-purpose replacement for zstd/brotli on JSON/HTML/random bytes.
4. CDDG:Split sells residual/process outcomes, not “smaller than gzip on Silesia.”
5. All public code paths are stubs that point to freemium or payment.

---

## One-sentence summary

**On structured integer patterns, ZRW is top-tier vs gzip/brotli by size; industry GP codecs still win on general and high-entropy bytes; residual products compete on a different scoreboard; every public stub routes to the freemium suite or paid access.**
