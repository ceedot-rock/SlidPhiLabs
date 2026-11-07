# Compression guide — what is best for what and when

Measured 2026-11-06. Every cell is a real compress → decompress →
byte-compare round-trip. Corpora: judicial = 40 govinfo bill XML
(1.9 MB); financial = Binance BTC 1s klines (12 MB); medical = OWID
covid history (98 MB; slow algos ran on its first 8 MB). Smaller better.
Machine table: `llm/compression-matrix.json`.

| data | TNSSRC | xz -6 | pulsar / PCC | gzip -9 | swarm | trustream | ZRW |
|---|---|---|---|---|---|---|---|
| judicial XML | **4.53** | 4.81 | 5.92 | 10.22 | 13.41 | ~100 | expands |
| financial ticks | 17.86 | **15.68** | 18.65 | 20.85 | 30.6 | ~100 | expands |
| medical tables | 9.37 | **7.30** | 9.80 | 9.92 | 15.23* | ~100 | expands |

\* 8 MB head. ZRW figures are JSON-framed integers (478/440/252%).

## Rules by customer dataset

- **Legal, legislative, XML/doc archives** → TNSSRC. It beats xz
  (4.53 vs 4.81) and everything else by a mile. Grant-gated ($369/yr).
- **Market data, ticks, order books, logs** → xz if they insist on
  free; TNSSRC (17.86) if they buy; served PCC (18.66, beats gzip
  20.85) for pay-as-you-go without a grant.
- **Medical, EHR, epi tables** → TNSSRC (9.37); xz (7.30) the free
  runner-up. Served PCC trails here — say so.
- **Live streams** → trustream, the ONLY fit. 4 KiB tiles, zeros and
  ramps shrink, everything else stores, never expands past framing.
- **Integer telemetry / sequences** → ZRW. Never bytes — it expands them.
- **Zero-fill / sparse** → T_ZERO, 8 bytes, free demo.
- **Unknown bytes, no license, instant** → served PCC (1 GB free/IP,
  then $0.25/GB) or local pulsar (GPLv3).

## Never say

- xz parity for any lab algorithm (xz wins fin + med).
- Ratios for corpora not in the table above.
- Anything about licensed internals (T_SPARSE coefficients,
  Continuous-1088, CDDG tuning). Price the grant instead.
- "10x" or "#1" — the verse's own benchmark doc refuses these.
