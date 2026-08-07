# OmniWave / Apex Path (lab scaffold)

**Private complementary generalist** for SLiD Phi Labs.

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

## Product map

```
Input → FastProfiler → Router
  → ZRW_delegate          (existing ZRW / Blackjack / CDDG / shards)
  → float_xor + entropy
  → struct_text + lz + entropy   (JSON/HTML hook — expand tokenizer for real wins)
  → delta + lz + entropy
  → general lz + entropy         (high-entropy / unknown)
→ OMWV frame + agent meta
```

## Next (production)

1. Real ZRW handoff (live compress/decompress)  
2. Structural JSON tokenizer (keys / strings / numbers streams)  
3. Replace zlib with zstd/brotli/ANS  
4. Cascade: top-2 specialists + GP, pick smallest  
5. Public API: route label + sizes only (no process leak)  
6. Bench vs gzip/brotli/zstd on general JSON corpus  

## Pricing note

Public freemium (100 GB free / under first paid egress) is independent of this lab codec. OmniWave is **capability**; suite is **commerce**.
