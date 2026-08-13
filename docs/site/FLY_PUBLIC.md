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
| `/api/welcome` `/api/join-work` `/api/web-codec` … | APIs via `server.mjs` |

## vs Creator box

| App | Purpose |
|-----|---------|
| **slidphilabs** | Public marketing + freemium + Join the Work |
| **slidphi-smart-box** | Private Creator / lab (`/lord`) |
