# www.slidphilabs.com DOWN — fix now

## Diagnosis (2026-08-08)

| Check | Result |
|-------|--------|
| `https://www.slidphilabs.com` | **HTTP 402** `DEPLOYMENT_DISABLED` (Vercel) |
| DNS A records | `216.150.1.1` / `216.150.16.1` → **Vercel** |
| NS | Google Domains (`ns-cloud-f1…f4.googledomains.com`) |
| Vercel redeploy | **Blocked:** team overdue balance |
| Working face | **https://www.slidphilabs.com** → **200** |

## Root cause

Vercel team **nektaronbase-cells-projects** has an **overdue balance**. All deployments for project `site` are disabled — including custom domains.

Billing: https://vercel.com/teams/nektaronbase-cells-projects/settings/billing

## Fix A — restore Vercel (if you want to stay on Vercel)

1. Open billing link above
2. Add valid payment method / pay overdue
3. Redeploy: `cd docs/site && vercel --prod --yes`
4. Confirm `curl -I https://www.slidphilabs.com` → 200

## Fix B — point domain to Fly (works today, no Vercel money)

DNS is at **Google Domains / Squarespace Domains** (not Cloudflare).

In DNS for `slidphilabs.com`, set:

### Apex `slidphilabs.com`
| Type | Name | Value |
|------|------|-------|
| A | `@` | `66.241.125.123` |
| AAAA | `@` | `2a09:8280:1::164:6d7:0` |

### www
| Type | Name | Value |
|------|------|-------|
| A | `www` | `66.241.125.123` |
| AAAA | `www` | `2a09:8280:1::164:6d7:0` |

Optional ACME helper (if certs lag):
- CNAME `_acme-challenge` → `slidphilabs.com.ykp0np0.flydns.net.`
- CNAME `_acme-challenge.www` → `www.slidphilabs.com.ykp0np0.flydns.net.`

Remove old Vercel A records for 216.150.x.

Then:
```bash
fly certs check www.slidphilabs.com -a slidphilabs
fly certs check slidphilabs.com -a slidphilabs
```

Fly already has certs registered (Not verified until DNS moves).

## Temporary public URL (works now)

**https://www.slidphilabs.com**

Creator face: https://slidphi-smart-box.fly.dev/lord
