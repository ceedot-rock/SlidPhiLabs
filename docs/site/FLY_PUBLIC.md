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
| `/specialist` | Public specialist machine (fill runs; pulsar/AWARE licensed) |
| `/licensing.json` `/COMMERCIAL-LICENSE.md` | License SoT |

## vs Creator box

| App | Purpose |
|-----|---------|
| **slidphilabs** | Public marketing + freemium + Join the Work |
| **slidphi-smart-box** | Private Creator / lab (`/lord`) |

## Refresh bin/lb (AWARE walk_lcg crown)

`docs/site/bin/` is **gitignored** (host-only engines). Kolmogorov seating for
`walk_lcg` / `walk_d1` is **not** claimed from the JS twin in `api/lib/walk-peel.mjs`
— that module prices `{step,seed}` and tests wire shape. The crown is seated only
when Fly ships a `bin/lb` rebuilt from **ceedot-rock/lbr1** `main` (merged walk PR).

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

# prove crown (aware_bytes=9 → LBHX frame 22 B, kind=walk_lcg)
"$SITE/bin/lb" aware /path/to/corpora/walks/walk_10k_s1.i32le.bin /tmp/w1.out
"$SITE/bin/lb" aware /path/to/corpora/walks/walk_10k_s5.i32le.bin /tmp/w5.out
# expect: kind=walk_lcg  coded=22  DECODE_OK

cd "$SITE"
fly deploy --remote-only --ha=false
```

Or: `bash scripts/refresh-lb-from-lbr1.sh /path/to/lbr1` from `docs/site/`.

Stale `bin/lb` may still compress walks via other seats (e.g. STR1) and will **not**
report `program.model=walk_lcg` / 9 B aware_bytes through `/api/compress`.
