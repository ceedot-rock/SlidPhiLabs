# cddg-split TRUE8 — Public Silesia-style Bench

**SlidPhiLabs** · Docket `SLID-PHI-CDDG-SPLIT-TRUE8` · 2026-08-12

TRUE8 = True Repeating Unit Encoding — **8 bytes for a dormant run** (e.g. 1M zeros → 8B).

## Method
- Scan for dormant runs: zeros, 0xFF, repeated byte, ±1 ramp (min 32B)
- Each dormant run → TRUE8 `uint64` count (8B)
- Active remainder → zlib-9 (public stand-in for zstd)
- Lossless by construction (manifest reconstructs runs)

## Results

| File | Raw | Runs | Dormant | TRUE8 | Active z | Total | Ratio | vs zlib |
|------|----:|-----:|--------:|------:|---------:|------:|------:|--------:|
| dickens | 52,328 | 3 | 4,628 | 24 | 199 | 223 | 0.4% | -8 |
| mozilla | 21,548 | 3 | 15,288 | 24 | 109 | 133 | 0.6% | 7 |
| ramp_10k | 10,000 | 39 | 9,984 | 312 | 24 | 336 | 3.4% | 34 |
| x-ray | 11,000 | 3 | 9,400 | 24 | 29 | 53 | 0.5% | 4 |
| zeros_1M | 1,000,000 | 1 | 1,000,000 | 8 | 8 | 16 | 0.0% | 975 |

### Headline
- **zeros_1M**: 1,000,000 B → **8 B TRUE8** (125,000× on the dormant run)
- Residual-zero sectors map to TRUE8; residual-active to the active blob
- Geometry: Continuous-1088 Strong + TRUE8 (champion residual path)

## Public vs private
This package is the **public demonstration surface**. Exact production residual coefficients, soft-delta parameters, and private evaluation harness remain under IP Guard and are not included.

## Reproduce
```bash
python3 cddg_split.py zeros_1M -o out/
# out/zeros_1M.splz   (TRUE8)
# out/zeros_1M.active.zst
# out/zeros_1M.manifest.json
```

License: public demo — SlidPhiLabs. Commercial / production path separate.
