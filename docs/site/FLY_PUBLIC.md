# Public site on Fly.io

**Live now:** https://www.slidphilabs.com  
**App:** `slidphilabs`  
**Creator (separate):** https://slidphi-smart-box.fly.dev/lord  

Vercel www is **402 DEPLOYMENT_DISABLED** — this Fly app is the replacement public door.

## Deploy

```bash
export FLY_API_TOKEN=…   # ~/.env_secrets
cd /home/cee/projects/SlidPhiLabs/docs/site
fly deploy --remote-only --ha=false
```

## Point www.slidphilabs.com at Fly

1. Certificates already requested on the app (`fly certs list -a slidphilabs`).
2. In DNS (wherever apex is managed — often Wix/registrar):

| Host | Type | Value |
|------|------|--------|
| `@` or apex | **A** | dedicated IPv4 from `fly ips list -a slidphilabs` (or use AAAA / CNAME per Fly cert check) |
| `www` | **CNAME** | `slidphilabs.fly.dev`  *(preferred)* |

3. Check:

```bash
fly certs check www.slidphilabs.com -a slidphilabs
fly certs check slidphilabs.com -a slidphilabs
```

4. Until DNS moves, use **https://www.slidphilabs.com** as the public face.

## Routes

| Path | What |
|------|------|
| `/` | Home |
| `/join` | Join the Work |
| `/humans` `/agents` `/standings` `/pps` | Dual doors |
| `/api/welcome` `/api/join-work` `/api/web-codec` `/api/specialist` | APIs via `server.mjs` |
| `/specialist` | Public specialist machine (fill runs; pulsar/PCC licensed) |
| `/licensing.json` `/COMMERCIAL-LICENSE.md` | License SoT |

## vs Creator box

| App | Purpose |
|-----|---------|
| **slidphilabs** | Public marketing + freemium + Join the Work |
| **slidphi-smart-box** | Private Creator / lab (`/lord`) |

## Refresh bin/lb (PCC repeat + walk crowns)

`docs/site/bin/` is **gitignored** (host-only engines). Kolmogorov seating for
`repeat` / `walk_lcg` / `walk_d1` is **not** claimed from the JS twins in
`api/lib/repeat-peel.mjs` / `api/lib/walk-peel.mjs` — those modules price the
program and test wire shape. Crowns seat only when Fly ships a `bin/lb` rebuilt
from **ceedot-rock/lbr1** `main` (merged repeat PR #4 + walk PRs).

Before `fly deploy`:

```bash
# on a glibc≥2.39 host (see Dockerfile: node:20-trixie-slim)
cd /path/to/lbr1
git pull origin main
cargo build -p splb --release --bin lb

SITE=/path/to/SlidPhiLabs/docs/site
mkdir -p "$SITE/bin"
cp -f target/release/lb "$SITE/bin/lb"
chmod +x "$SITE/bin/lb"

# prove repeat crown (model_id=7)
# text_repeat_256k: aware_bytes=33 → LBHX frame 46 B, kind=repeat
# json_128k:        aware_bytes=61 → LBHX frame 74 B, kind=repeat
"$SITE/bin/lb" aware /path/to/corpora/periodic/text_repeat_256k.bin /tmp/t.out
"$SITE/bin/lb" aware /path/to/corpora/periodic/json_128k.bin /tmp/j.out
# expect: kind=repeat  coded=46 / 74  DECODE_OK

# prove walk_lcg crown (aware_bytes=9 → LBHX frame 22 B)
"$SITE/bin/lb" aware /path/to/corpora/walks/walk_10k_s1.i32le.bin /tmp/w1.out
"$SITE/bin/lb" aware /path/to/corpora/walks/walk_10k_s5.i32le.bin /tmp/w5.out
# expect: kind=walk_lcg  coded=22  DECODE_OK

# /api/compress proof gate (after deploy, or locally with refreshed LB_BIN):
# POST periodic fixtures → program.model=repeat, program.seated=true,
# program.aware_bytes=33|61, program.unit_len=24|52

cd "$SITE"
fly deploy --remote-only --ha=false
```

Or: `bash scripts/refresh-lb-from-lbr1.sh /path/to/lbr1` from `docs/site/`
(optional `REPEAT_TEXT` / `REPEAT_JSON` / `WALK_S1` env paths for proof).

Stale `bin/lb` may still compress via other seats (e.g. STR1 / pulsar) and will
**not** report `program.model=repeat` / 33|61 B aware_bytes (or walk_lcg / 9 B)
through `/api/compress`.
