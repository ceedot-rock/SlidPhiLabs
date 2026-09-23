# Omni Head Display (OHD) — Design Card

**Status:** VERTICAL_GREEN (smallest-among-DECODE_OK)  
**Lab name:** Omni Head Display / OHD  
**Identity:** **OHD = OmniWave** (Corey lock 2026-09-18) — same router; lab rename only. Not a second product.  
**Role:** Router + dispatch only. **Not a codec.** Seats compress; OHD peeks, tries, gates.  
**Public product:** **PCC** (see site / suite). OHD is the lab router name.

---

## Product law (locked)

1. **DECODE_OK required** — never select by packed size alone without a successful round-trip decode that matches the input byte-for-byte.
2. **Smallest DECODE_OK wins** — race every available seat; keep the shortest blob that passed the gate. Ties go to `scout`. `OHD_PICK=first` restores v0 first-win.
3. **No soft-route** — every winning path must pass the DECODE gate; no “looks smaller so ship it.” A DECODE_OK blob that does not shrink vs raw is dropped.
4. **Honest labels** — never claim Fast for Sniper; seat id in the frame is the truth.
5. **Don’t wait on under-40** — Sniper tip already **43,724,575** (TNSSRC E stacked). That number is Sniper alone, not an OHD output. Do not print it as the PCC product row.
6. **Genes only** — host gzip / xz / brotli are opponents, not seats. Do not substitute them for a missing Scout binary.
7. **Router does not compress** — seats-are-jobs (see OmniWave prior art). Packer does not parse.
8. **Sniper is capped on the host path** — default `OHD_SNIPER_MAX_BYTES=4194304` and `OHD_SNIPER_TIMEOUT_SEC=30`. `OHD_SNIPER_FORCE=1` ignores the size cap. Scout timeout is `OHD_SCOUT_TIMEOUT_SEC` (default 30).

---

## Architecture

```
Input bytes
  → cheap peek (features only; no encode)
  → ordered seat try-list (registry ∩ available binaries ∩ caps)
  → for each seat: encode → decode → cmp(raw)
       keep DECODE_OK + shrinks-vs-raw
  → pick smallest packed; tie → scout
  → write framed blob (meta + payload)
  → print seat id
```

If no seat returns DECODE_OK → fail loud (non-zero exit). No soft fallback.

---

## Peek features (cheap)

Computed in-process; never invoke a seat just to classify.

| Feature | Notes |
|---------|--------|
| `size` | byte length |
| `entropy_proxy` | shannon over byte hist (or 4k sample if huge) |
| `zero_frac` | fraction of 0x00 |
| `ascii_frac` | printable / whitespace fraction |
| `magic` | first 8 bytes hex (hint only) |

Peek may **order** or **skip** seats; it never picks a winner without DECODE_OK.

---

## Seat registry

| Seat id | Role | Binary / status | Claim |
|---------|------|-----------------|-------|
| `scout` | Dial A / PCC (`lb pcc`) | **UNPARKED** — `bin/scout-dial-a` (env → `lb`; override with `OHD_SCOUT` / `SCOUT_LB`) | Fast when Scout wins DECODE_OK |
| `sniper` | TNSSRC E stacked | `npcc` on PATH, or `OHD_SNIPER` / `SNIPER_BIN` | Sniper — **not** Fast; tip **43,724,575** ([tnssrc](https://github.com/ceedot-rock/tnssrc) `b5d2a88`) |

CLI contract (Sniper):

```text
npcc c <in> <out>
npcc d <in> <out>
```

Scout CLI (Dial A / PCC):

```text
scout-dial-a c <in> <out>   # Dial A env + lb pcc
scout-dial-a d <in> <out>   # lb decode (PCC1)
```

Try order: **scout then sniper**. Winner is smallest DECODE_OK, not first success.

---

## Dispatch order

1. `scout` — try if binary exists and executable.
2. `sniper` — tried if present and under the size/time cap (or `OHD_SNIPER_FORCE=1`).

Among seats that produce **DECODE_OK** and shrink vs raw, keep the shortest packed blob. Tie → scout.

---

## DECODE gate

```text
DECODE_OK ⇔ decode(encode(raw)) == raw  (byte-identical)
```

Anything else (encode fail, decode fail, timeout, length mismatch, byte mismatch) → drop that seat.

---

## Frame / meta

Magic: `OHD1` (4 bytes ASCII)  
Then: `u32be` JSON length  
Then: UTF-8 JSON meta  
Then: packed payload bytes

Meta fields (v1):

```json
{
  "magic": "OHD1",
  "seat": "sniper",
  "raw_size": 6,
  "packed_size": 42,
  "decode_ok": true,
  "elapsed_sec": 0.12,
  "pick": "smallest",
  "raced": [{"seat": "scout", "decode_ok": true, "packed_size": 50, "elapsed_sec": 0.04}],
  "peek": { "size": 6, "entropy_proxy": 2.25, "zero_frac": 0.0, "ascii_frac": 1.0 },
  "label": "sniper"
}
```

`decode_ok` in the written frame is always `true` for emitted blobs (gate already passed). Decompress reads `seat` and routes to that seat’s `d`.

---

## API sketch

### CLI (vertical)

```bash
ohd compress <in> <out>     # peek → race seats → smallest DECODE_OK → framed out; prints seat
ohd decompress <out> <raw>  # unframe → seat.d → raw
```

### HTTP (sketch only; not required for vertical)

```http
POST /v1/compress   body: raw octets → 200 + OHD1 frame; header X-OHD-Seat: sniper
POST /v1/decompress body: OHD1 frame → 200 + raw octets
```

---

## Non-goals

- Not a size theorem / not “always smaller than X.”
- Not a public codec story — lab router + dispatch.
- Dual seats (scout + sniper). Honest labels only.
- Do not publish private engine guts beyond seat names.
- No Fast claim for Sniper.
- No host gzip/xz/brotli as gene substitutes.
- Do not print 43,724,575 as the PCC product number. That lock is Sniper alone.
- Do not rename the paid SKU. PCC stays the storefront.

---

## Prior art

- [`lab/omniwave/README.md`](../omniwave/README.md) — seats-are-jobs; router does not compress.
- Name migration: OmniWave → Omni Head Display (OHD). Same router identity.
- v0 law was first DECODE_OK. v1 is smallest among DECODE_OK (this card).

---

## Vertical location

`lab/ohd/` — Python CLI + README + proof fixture (`testdata/hello.txt`).
