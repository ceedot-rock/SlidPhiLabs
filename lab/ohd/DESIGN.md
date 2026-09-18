# Omni Head Display (OHD) — Design Card

**Status:** VERTICAL_GREEN (minimal)  
**Lab name:** Omni Head Display / OHD  
**Identity:** **OHD = OmniWave** (Corey lock 2026-09-18) — same router; lab rename only. Not a second product.  
**Role:** Router + dispatch only. **Not a codec.** Seats compress; OHD peeks, tries, gates.  
**Public product:** **PCC** (see site / suite). OHD is the lab router name.

---

## Product law (locked)

1. **First DECODE_OK seat wins** — never select by packed size alone without a successful round-trip decode that matches the input byte-for-byte.
2. **No soft-route** — every winning path must pass the DECODE gate; no “looks smaller so ship it.”
3. **Honest labels** — never claim Fast for Sniper; seat id in the frame is the truth.
4. **Don’t wait on under-40** — Sniper tip already **43,724,575** (TNSSRC E stacked). Ship with what DECODE_OK’s.
5. **Genes only** — host gzip / xz / brotli are opponents, not seats. Do not substitute them for a missing Scout binary.
6. **Router does not compress** — seats-are-jobs (see OmniWave prior art). Packer does not parse.

---

## Architecture

```
Input bytes
  → cheap peek (features only; no encode)
  → ordered seat try-list (registry ∩ available binaries)
  → for each seat: encode → decode → cmp(raw)
       if DECODE_OK → STOP (first win)
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

Peek may **order** or **skip** seats later; today vertical uses peek for meta only and tries registry order. Peek never picks a winner without DECODE_OK.

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

Try order: **scout then sniper**; first DECODE_OK wins. No soft-route; no host gzip.

---

## Dispatch order

1. `scout` — try if binary exists and executable.
2. `sniper` — tried if present on PATH or via env.

First seat that produces **DECODE_OK** wins. No size tournament across DECODE_OK candidates in v0 (could add later **among** DECODE_OK only — never without).

---

## DECODE gate

```text
DECODE_OK ⇔ decode(encode(raw)) == raw  (byte-identical)
```

Anything else (encode fail, decode fail, length mismatch, byte mismatch) → try next seat or fail.

---

## Frame / meta

Magic: `OHD1` (4 bytes ASCII)  
Then: `u32be` JSON length  
Then: UTF-8 JSON meta  
Then: packed payload bytes

Meta fields (v0):

```json
{
  "magic": "OHD1",
  "seat": "sniper",
  "raw_size": 6,
  "packed_size": 42,
  "decode_ok": true,
  "peek": { "size": 6, "entropy_proxy": 2.25, "zero_frac": 0.0, "ascii_frac": 1.0 },
  "label": "sniper"
}
```

`decode_ok` in the written frame is always `true` for emitted blobs (gate already passed). Decompress reads `seat` and routes to that seat’s `d`.

---

## API sketch

### CLI (vertical)

```bash
ohd compress <in> <out>     # peek → seats → first DECODE_OK → framed out; prints seat
ohd decompress <out> <raw>  # unframe → seat.d → raw
```

### HTTP (sketch only; not required for vertical)

```http
POST /v1/compress   body: raw octets → 200 + OHD1 frame; header X-OHD-Seat: sniper
POST /v1/decompress body: OHD1 frame → 200 + raw octets
```

One file in → seat → DECODE_OK out. No multi-candidate soft pick.

---

## Non-goals

- Not a size theorem / not “always smaller than X.”
- Not a public codec story — lab router + dispatch.
- Dual seats (scout then sniper). Honest labels only.
- Do not publish private engine guts beyond seat names.
- No Fast claim for Sniper.
- No host gzip/xz/brotli as gene substitutes.
- No waiting on under-40 tip before shipping vertical.

---

## Prior art

- [`lab/omniwave/README.md`](../omniwave/README.md) — seats-are-jobs; router does not compress.
- Name migration: OmniWave → Omni Head Display (OHD). Same router identity.

---

## Vertical location

`lab/ohd/` — Python CLI + README + proof fixture (`testdata/hello.txt`).
