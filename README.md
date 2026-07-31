# slid-phi

**Omni-Dormant integer codecs** — Zeckendorf / hybrid Fib roots with pathway routing, portable `Uint8Array` bitstreams.

| | |
|--|--|
| **site** | **[slidphilabs.vercel.app](https://slidphilabs.vercel.app)** |
| **npm** | [`slid-phi`](https://www.npmjs.com/package/slid-phi) |
| **repo** | [ceedot-rock/SlidPhiLabs](https://github.com/ceedot-rock/SlidPhiLabs) |
| **version** | **2.1.1** |
| **license** | [MIT](./LICENSE) |

---

## Install

```bash
npm i slid-phi
```

## Quick use

```js
import {
  encode,
  decode,
  OMNI_META,
  encodeHybrid,
  decodeHybrid,
} from "slid-phi";

// Dense list (default profile = auto)
const f = encode("dense", [1, 42, 999], { profile: "auto" });
const back = decode(f);

// Universe when max M is known (best on 1..M)
const u = encode("universe", data, { M: 10000 });

// Strictly increasing postings
const g = encode("gaps", [10, 15, 40, 41]);

// Sorted unique → interpolative
const i = encode("interp", sortedUnique);

// Compat hybrid (k=4 default)
const bits = encodeHybrid(12345, 4);
const n = decodeHybrid(bits, 4);
```

### Pathways (Omni-Dormant v2.1)

| Mode | When | Notes |
|------|------|--------|
| `universe` | **M known** | Fixed `ceil(log2 M)` bits |
| `dense` | M unknown | Hybrid k/auto · **default profile `auto`** |
| `gaps` | Strictly increasing postings | Classic gap codes |
| `interp` | Sorted unique | Structure-aware |
| `smooth` | Smooth series | Double-δ |
| `for` | Narrow band | Frame of reference |
| `classic` | Safe default | Zeckendorf / Fib 11 |

**Dormant unless called:** `mirror`, `rans` (B≥2048 research path), `deltaHyb`, `wasm_simd`.

Frames carry **mode + data**. Prefer `bytes` + `bitLen` (`Uint8Array`); some modes also keep a `bits` string for demos.

```js
import { OMNI_META } from "slid-phi";
console.log(OMNI_META.pathways, OMNI_META.dense_default);
```

### Subpath exports

```js
import { encode, decode } from "slid-phi/omni";
import { encodeHybrid, HYBRID_META } from "slid-phi/hybrid";
import { BitWriter, BitReader, packBits } from "slid-phi/bitstream";
```

---

## Numbers (truth table @ M = 10 000)

Lower avg bits = better. **Never claim below the ideal minimum.**

| Scheme | Avg bits | Notes |
|--------|----------|--------|
| **Ideal min** (uniform 1..10k) | **≈13.29** | log₂ M |
| **universe** (M known) | **14.00** | fixed-width |
| **dense auto** | **~14.57** | ~20% vs classic 18.23 |
| **hybrid k=4** | **16.47** | shipped hybrid default |
| **classic Fib** | **18.23** | strict no-consecutive-1s baseline |
| **gaps** geo ~p=0.2 | **~4.12** | postings |
| **gaps** sequential | **~2.00** | |
| **interp** dense sorted range | **~0.01** | structure-aware |
| **smooth** double-δ | **~3.6–3.8** | |

Policy: do **not** hybrid tiny geo gaps; do **not** always-on mirror.

---

## Stripe (commercial)

| Product | Price | Link |
|---------|------:|------|
| Commercial | $499 | https://buy.stripe.com/28EbJ20kR0OY99r9kA6wE00 |
| Sponsor | $29 | https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01 |
| Consulting | $250 | https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02 |

Brand: [splabs-brand](https://github.com/ceedot-rock/splabs-brand) · Site: [slidphilabs.vercel.app](https://slidphilabs.vercel.app)

---

## Dev

```bash
git clone https://github.com/ceedot-rock/SlidPhiLabs.git
cd SlidPhiLabs
npm test
```

Primary source: `src/omni.mjs` · entry: `src/index.mjs`.

SPLabs / SlidPhiLabs — compression research + product.
