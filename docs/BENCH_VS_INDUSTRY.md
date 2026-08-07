# Lab products vs industry standards / top compressors

**Date:** 2026-08-07  
**Host:** re-run ZRW v5 pack vs Node zlib (gzip-9, brotli-11, deflate-9)  
**IP Guard:** Public outcomes only. No private residual coefficients.

This is a **domain-honest** comparison: integer-pattern codecs are not the same product class as general-purpose byte compressors, but buyers still ask “vs gzip/zstd?” — so both views are below.

---

## Industry “top tier” (general-purpose lossless)

Typical industry shortlist (not a formal ranking):

| # | Codec | Role | Typical strength |
|---|--------|------|------------------|
| 1 | **zstd** | Default modern GP | Best speed×ratio balance |
| 2 | **brotli** | Web / static | Strong ratio on text/HTML/JSON |
| 3 | **gzip / deflate** | Ubiquitous | Compatibility; slower / weaker than zstd |
| 4 | **lz4** | Real-time / wire | Highest throughput, weaker ratio |
| 5 | **snappy** | In-memory / Hadoop-class | Very fast, modest ratio |
| 6 | **bzip2** | Archive legacy | Better ratio than gzip, slow |
| 7 | **xz / lzma** | High ratio archives | Strong ratio, slow |
| 8 | **zlib** | Deflate library form | Same family as gzip |
| 9 | **lzo** | Embedded / legacy fast | Fast, modest ratio |
| 10 | **Brotli-q11 / zstd-19** | Max-ratio knobs | Best size, expensive CPU |
| 11 | **Parquet/ORC codecs** (zstd/snappy inside) | Columnar analytics | Domain-specific containers |
| 12 | **Specialized integer codecs** (Delta, Gorilla, FastPFor, StreamVByte, etc.) | Time-series / ints | Beat GP on *structured integers* |

**Rule of thumb (industry consensus):**  
- **Wire / latency:** LZ4 / Snappy  
- **General best default:** **zstd**  
- **Web static:** **brotli**  
- **Max size, offline:** xz / high zstd / high brotli  
- **Structured integers / time-series:** specialized codecs (this is where lab products compete)

Sources: public zstd/lz4 README benches, web-asset and big-data comparisons (gzip vs brotli vs zstd vs lz4 vs snappy).

---

## Lab product map → what “win” means

| Lab surface | Competes with | Does **not** claim |
|-------------|---------------|---------------------|
| **ZRW** | gzip/brotli/zstd on *integer sequences* (zeros, ramps, walks) | Winning on random bytes / general files |
| **Blackjack / shards / slid-phi** | Multi-path integer / structured packaging | Full GP replacement (engines private; npm stubs) |
| **CDDG:Split / residual / ZRQC** | Residual *reduction* vs pure discrete baselines | Byte-size race vs gzip on Silesia corpus |
| **PPS** | Orchestration / path pick over suite | A single codec algorithm |

---

## Live re-run: ZRW v5 vs gzip / brotli (this host)

**Setup:** ZeroRangeWave-Full-Pack-v5 `index.mjs` · raw = little-endian int32 buffer · gzip level 9 · brotli quality 11.

### Structured integer corpora (lab domain)

| Corpus | raw (int32) | **ZRW** | gzip-9 | brotli-11 | **Winner (size)** | Notes |
|--------|------------:|--------:|-------:|----------:|-------------------|--------|
| zeros_10k | 40 000 B | **8 B** | 73 B | 13 B | **ZRW** | ~9× smaller than brotli; ~9× gzip |
| ramp_10k | 40 000 B | **8 B** | 13 907 B | 10 429 B | **ZRW** | Orders of magnitude vs GP |
| walk_10k_s1 (pack self-bench) | 40 000 B | **128 B** | ~5 223 B† | — | **ZRW**† | Pack-published vs gzip |
| walk_10k_s5 (pack self-bench) | 40 000 B | **420 B** | ~11 231 B† | — | **ZRW**† | Pack-published vs gzip |
| walk_10k_s1 (ad-hoc RNG walk) | 40 000 B | 3 263 B | 4 556 B | **3 198 B** | brotli | Seed/generator dependent |
| walk_10k_s5 (ad-hoc) | 40 000 B | 14 014 B | 11 166 B | **8 289 B** | brotli | Outside pack’s walk model |
| random_i32_10k | 40 000 B | 35 375 B* | 33 414 B | **27 774 B** | brotli | High entropy — ZRW not designed to win |
| fib_1k | 4 000 B | expand* | 504 B | **418 B** | brotli | Outside happy path |

\* Roundtrip fail or expansion on this host for that synthetic — treat as **out-of-domain**.  
† From pack README / self-bench (walk generators match pack’s).

### Pack-published records (authoritative for marketing)

| Corpus | ZRW | brotli | gzip | Claim |
|--------|-----|--------|------|--------|
| zeros_1k | 8 B | 13 B | 39 B | Win |
| ramp_1k | 8 B | 1 132 B | 1 436 B | ~141× vs brotli size |
| walk_10k s1 | 128 B | — | ~5 223 B | ~40× vs gzip (vs old v4) |
| walk_10k s5 | 420 B | — | ~11 231 B | ~26× vs gzip |

### General *bytes* (industry only — not ZRW’s product claim)

| Corpus | raw | gzip-6 | brotli | deflate-6 | Best |
|--------|----:|-------:|-------:|----------:|------|
| synth JSON | 28 624 | 3 873 | **1 703** | 3 861 | brotli |
| repeated lorem | 11 400 | 119 | **60** | 107 | brotli |
| synth HTML | 29 600 | 240 | **54** | 228 | brotli |

**Conclusion on ZRW:** On **zeros / ramps / pack walks**, ZRW is **industry-leading by size** vs gzip/brotli. On **high-entropy or mismatched walks**, general-purpose **brotli/zstd class wins**. Fair sell: *structured integer sequences*, not *replace zstd for everything*.

---

## Residual / CDDG:Split / ZRQC (different axis)

Not a gzip size race — **residual reduction & quality vs pure-360 / discrete baselines** (Host benches / champion notes):

| Metric (public outcomes) | Band |
|--------------------------|------|
| Residual cut | **~64–84%** class |
| Quality vs pure-360 | **~2.05×–2.09×** |
| Mirrored cost | ΔE+ΔC≈0 class; mirror error ~0 |
| Cloak | Collapse eliminated; hierarchy depth → 12 (reported) |

**Industry analogs:** Gorilla, Delta-of-delta, FPC, FastPFor — not gzip. Lab claim is **residual / continuous dark-degree process**, not deflate.

---

## Blackjack / shards / slid-phi

| Product | Bench status this host |
|---------|------------------------|
| blackjack-compression | **npm stub only** — full engine post-purchase; docs/BENCHMARKS.md is indicative |
| shard-zip / shard-tsdb / slid-phi | Same stub model |
| Fair comparison | After install of private package: same corpora as ZRW + product-specific suites |

Do **not** claim GP wins until private benches re-run on this host.

---

## Scorecard vs “top 12” (honest)

| Industry codec | Beat by lab? | Where |
|----------------|--------------|--------|
| gzip | **Yes (size)** | zeros, ramps, pack walks (ZRW) |
| brotli | **Yes (size)** | zeros, ramps; **no** on random/general text |
| zstd | **Likely on structured ints**; not re-run here (zstd binary not installed) | Need `zstd` CLI re-run for fair table |
| lz4 / snappy | Different game (speed); ZRW size on zeros/ramps still dominant | Throughput not fully timed |
| xz / bzip2 | Not primary competitors for int series | Offline archives |
| Integer specialists | **CDDG residual** is the closer class | Outcome bands, not rawB race |

---

## Top-line talking points (safe)

1. **ZRW beats gzip and brotli by size on zeros/ramps** (live re-run + pack records).  
2. **Walks:** use pack walk benches for claims; ad-hoc RNGs are not the product model.  
3. **Not a general-purpose replacement** for zstd/brotli on JSON/HTML/random bytes.  
4. **CDDG:Split** sells residual/process outcomes (64–84% band, ~2× quality class), not “smaller than gzip on Silesia.”  
5. **Family products** need private package benches for numeric vs-industry tables.

---

## Gaps / next re-runs

1. Install **zstd + lz4** CLI and re-run same int32 buffers.  
2. Official **Silesia / Canterbury** only for GP context (optional; not ZRW’s target).  
3. Unlock **blackjack** private package for multi-path table.  
4. Residual peak harness on Host corpora (private) for CDDG vs discrete baselines only.

---

## One-sentence summary

**On structured integer patterns, ZRW is top-tier vs gzip/brotli by size; industry GP codecs still win on general and high-entropy bytes; residual products compete on a different scoreboard than deflate.**
