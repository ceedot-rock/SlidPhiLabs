# DNS → Fly · **DONE** (use the .com)

## Status (2026-08-09)

| Host | Serves | Product paths |
|------|--------|---------------|
| **https://www.slidphilabs.com** | Fly `slidphilabs` | `/`, `/pay`, `/pps`, `/web`, `/api/*` · **200** |
| **https://slidphilabs.com** | Fly `slidphilabs` | same |
| https://slidphilabs.fly.dev | Fly alternate | same app |

Certs: `www.slidphilabs.com` · `slidphilabs.com` · **Issued** on Fly.  
Verify: `curl -sSI https://www.slidphilabs.com/pay | grep -i x-host` → `fly-slidphilabs`.

## Law

**Use the .com for all pub-facing and agent product URLs.**  
`slidphilabs.fly.dev` is **alternate only** (failover / debug), not the brand face.

## Fly addresses (reference)

```bash
fly ips list -a slidphilabs
# v4  66.241.125.123
# v6  2a09:8280:1::164:6d7:0
```

## History

Earlier: www was Wix → product paths 404. Cutover moved A/AAAA (or CNAME) to Fly so brand and product share one host (domain supremacy).

## If DNS ever regresses to Wix

1. Registrar DNS: point `@` and `www` at Fly IPs again (not Wix).
2. `fly certs list -a slidphilabs` must show Issued for both hostnames.
3. Until fixed, temporary alternate only: `https://slidphilabs.fly.dev` — then restore .com.
