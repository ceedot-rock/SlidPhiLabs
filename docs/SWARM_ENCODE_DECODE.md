# SlidPhiLabs · Encode/Decode Swarm Report

**Agents:** 200 encode tracks · 200 decode tracks (family-batched)  
**Date:** 2026-07-29  
**Baseline:** classic Fib ~17.23 bits @ uniform M=10k · Shannon ≈13.29

---

## Executive result

| Workload | Winner | Avg bits | vs classic |
|----------|--------|----------|------------|
| Uniform 1..5k codebook | **hybrid (≤1× `11`)** | 13.43 | **−15.1%** |
| Uniform + terminator | hybrid+`111` | 16.43 | vs classic+`11` 17.81 (**−7.8%**) |
| Hybrid + low-bits k=4 | **15.35** | vs classic 15.81 (**−2.9%**) |
| Geometric p=0.2 (postings) | classic Fib | 3.13 | beats Rice-k (3.70+) |
| Geometric p=0.5 | classic Fib | 1.82 | beats all Rice/Elias tested |

**Takeaway**

1. **Posting-list deltas (geometric):** classic Zeckendorf Fib is already best among universal codes tested (Rice k=0..5, Elias γ). Do not replace it with Golomb for pure geometric d-gaps.
2. **Dense integer sets / uniform:** allowing **one consecutive `11`** in the codeword densifies the codebook ~15%. Self-delimiting with terminator `111` + **low-bits binary (k=3..4)** recovers a clean hybrid win matching the product thesis (~3–8% depending on framing).
3. **Gap unary** is bit-length equivalent to classic Fib (same Zeckendorf support) — useful representation, not a ratio win.
4. **rANS on single-int gaps** loses to header overhead; only helps in **large blocks** (32–64 ints) where it approaches classic.
5. **Tribonacci** needs a complete representation theorem (no three consecutive 1s) before claiming a ratio win — partial maps failed roundtrip.

---

## Encode families (200)

| IDs | Family | Result |
|-----|--------|--------|
| E001–025 | classic Fib Zeckendorf | Lossless; 17.23 uni; **wins geometric** |
| E026–050 | classic + terminator `11` | Lossless; +2 bits overhead |
| E051–100 | hybrid_phi low-split | Terminator collision — **fixed by codebook approach** |
| E101–125 | gaps unary | = classic bits; 100% RT after gap fix |
| E126–175 | gaps Rice k=1,2 | Lossless; worse than classic on geo |
| E176–200 | Tribonacci greedy | Smaller bits but **incomplete RT** — deferred v2 |
| E-ANS | static rANS on gaps | Overhead-dominated for single ints |
| E-H11 | ≤1 consecutive `11` codebook | **Best dense codebook** |
| E-H11+k | hybrid11 + k low bits | **Best practical hybrid** at k=3..4 |

---

## Decode families (200)

| IDs | Family | Result |
|-----|--------|--------|
| D001–050 | classic roundtrip | **100%** @ 2k–10k |
| D051–100 | gaps unary RT | **100%** after gap indexing fix |
| D101–150 | classic speed | ~4–15M ops/s (JS) |
| D151–200 | rice / hybrid speed | 3–11M ops/s; classic still fastest |

Decode priority: keep **TABLE256** path for classic (0.25 ops/bit claim). Hybrid decode = strip terminator → split low-bits → table/bit parse core.

---

## Math note (reconcile product copy)

Published product numbers (M=10k):

- Shannon ≈13.29  
- Classic ≈18.23  
- Hybrid ≈17.45 (**~4.3%** smaller)

Swarm convention differences (Fib indexing / terminator accounting) shift absolute levels by ~1 bit, but **relative hybrid win holds** under the “one `11` + `111` + low-bits” construction.

Skip any Fib base → coverage 100%→76% (confirmed earlier brute force).

---

## Next ship targets

1. **v1.1 hybrid encoder/decoder** — codebook or generative “at most one `11`” + `111` + k=4 low bits; full RT tests.  
2. **TABLE256** for classic + hybrid core (encode & decode).  
3. **Tribonacci complete system** (v2) once representation is proven unique.  
4. Keep classic as default for **geometric postings**; hybrid as default for **dense/uniform integer streams**.

---

## Artifacts

Local swarm outputs: `swarm_v2_results.json`, `swarm_golomb.json`, `swarm_rans.json` (session).
