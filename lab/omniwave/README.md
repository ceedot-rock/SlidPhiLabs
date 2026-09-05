# OmniWave / Apex Path (lab scaffold)

**Teach:** seats are jobs. Occupants are specialists that know encode/decode. See `lbr1/JOBS.md`. Router does not compress. Packer does not parse. Host gzip/brotli/xz are not genes. Combined GC is a private compressor that knows compression — meld or alongside in the house, never copied into pulsar.

**Private complementary generalist** for Slid Phi Labs. Occupants must be lab engines. Host gzip/brotli/xz are opponents.

- **Strong where ZRW is weak:** general bytes, high-entropy, floats, text/nested  
- **Router preserves ZRW** on zeros / ramps / walks (high structured score)  
- **Exact lossless** on implemented reverse paths  
- **Agent-ready** framed output (`OMWV` + JSON meta + payload)

## IP Guard

- Lab-only scaffold. **Do not** publish private engines, coefficients, or production process.  
- Public site remains outcomes + freemium suite commerce.  
- Wire real ZRW via constructor callables; do not embed closed source here.

## Layout

| File | Role |
|------|------|
| `omniwave.py` | Profiler, router, specialists, LZ+zlib entropy, frame codec, demo |
| `README.md` | This file |

Python scaffold is **host-only** (not on the public default branch). This README stays as the public pointer.

## Run demo

```bash
cd /home/cee/projects/SlidPhiLabs
python3 lab/omniwave/omniwave.py
```

## Integration sketch

```python
from lab.omniwave.omniwave import OmniWave

def zrw_c(data: bytes) -> bytes: ...
def zrw_d(data: bytes) -> bytes: ...

ow = OmniWave(zrw_compress=zrw_c, zrw_decompress=zrw_d)
framed, meta = ow.compress(payload)
# meta["engine"] in {ZRW_delegate, float_xor+entropy, struct_text+..., general_lz_entropy, ...}
raw = ow.decompress(framed)
```

## Product map (own genes in OmniWave seats)

Same seats. Occupants are lab engines. Host gzip / brotli / xz are not genes.

```
Input → classify (Fill / Sparse / Text / Binary)
  → ZRW_delegate     TRU8 / TR8X          (zeros, ramps, sparse)
  → struct_text      pulsar BW22          (was brotli-11 skin)
  → general          LBR1                 (was gzip-9 skin)
  → mixed            LBHX                 (own split, ≥8% mixed)
  → CDDG             residual / Split     (not a Silesia GP)
  → AWARE            Combined GC          (private house; competes with struct_text + general)
  → float_xor        vacant               (lossy quantize retired — GC does not fill this as a skin)
→ lab magics only + DECODE_OK
```

Public CLI: `lb best` = TRU8 / LBR1 / pulsar. Combined GC is **not** copied into pulsar.

Private house: `house_best.py` **combines Combined GC with** those genes — same OmniWave seats, min() the smallest DECODE_OK blob. GC source stays in `combined-gc`.

## Next (production)

1. Real ZRW handoff (live compress/decompress)  
2. Structural JSON tokenizer (keys / strings / numbers streams)  
3. Replace zlib with zstd/brotli/ANS  
4. Cascade: top-2 specialists + GP, pick smallest  
5. Public API: route label + sizes only (no process leak)  
6. Bench vs gzip/brotli/zstd on general JSON corpus  

## Pricing note

Public freemium (100 GB free / under first paid egress) is independent of this lab codec. OmniWave is **capability**; suite is **commerce**.
