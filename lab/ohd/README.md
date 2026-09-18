# OHD — Omni Head Display (lab vertical)

Router only. **First DECODE_OK wins.** **OHD = OmniWave** (rename only; not a second product). Public product face is **PCC**.

Scout = Dial A / PCC via `lb pcc`, then Sniper = TNSSRC `npcc`. Honest labels — never claim Fast for Sniper.

## Law

- Peek → try seats in order → first seat with encode+decode byte-identical wins
- No soft-route; no Fast claim for Sniper
- Host gzip/xz/brotli are not genes

## Seats

| Seat | How to point at it | Role |
|------|--------------------|------|
| scout | `bin/scout-dial-a` (or `OHD_SCOUT`); needs `lb` via `SCOUT_LB` / `LB` / PATH | Dial A / PCC |
| sniper | `npcc` on PATH, or `OHD_SNIPER` / `SNIPER_BIN` | TNSSRC E tip **43,724,575** ([tnssrc](https://github.com/ceedot-rock/tnssrc)) |

Private seat binaries are **not** shipped in this tree. Build or install them yourself.

## Env

```bash
export SCOUT_LB=/path/to/lb          # or: export LB=lb  (PATH)
export OHD_SNIPER=/path/to/npcc      # or install npcc on PATH
# optional overrides:
# export OHD_SCOUT=/path/to/scout-dial-a
```

## Run

```bash
cd lab/ohd
./ohd compress testdata/hello.txt /tmp/hello.ohd
./ohd decompress /tmp/hello.ohd /tmp/hello.raw
cmp testdata/hello.txt /tmp/hello.raw && echo PROOF_DECODE_OK_IDENTICAL
```

Or: `bash prove.sh` (creates `testdata/hello.txt` if missing; exits 2 if no seats).

## CLI

```text
ohd compress <in> <out>
ohd decompress <out> <raw>
```

Design card: [DESIGN.md](DESIGN.md). Prior art: [../omniwave/README.md](../omniwave/README.md).
