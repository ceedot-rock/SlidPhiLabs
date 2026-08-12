# cddg-split TRUE8 — Public Silesia Bench Package

**SlidPhiLabs** · Docket `SLID-PHI-CDDG-SPLIT-TRUE8`

TRUE8 packs dormant runs (zeros / 0xFF / repeat / ramp) as **8-byte uint64 counts**.

## Quick result
| File | Raw | TRUE8 | Total | Ratio |
|------|----:|------:|------:|------:|
| zeros_1M | 1,000,000 | 8 B | 16 B | 0.0% |

Full table: [SILESIA_TRUE8_BENCH.md](SILESIA_TRUE8_BENCH.md)

## Run
```bash
python3 cddg_split.py /path/to/file -o out/
```

## Note
Public demonstration only. Production residual coefficients are private (IP Guard).
