# npm · product prices (canonical)

**Updated:** 2026-08-21  
**Live product host:** https://www.slidphilabs.com  
**Catalog:** https://www.slidphilabs.com/api/x402-products  
**Pay UI:** https://www.slidphilabs.com/pay  
**Team Mesh:** https://spl-team-mesh.fly.dev  

Public product face is **TRU8** (not these npm names).  
`blackjack-compression`, `shard-zip`, and `shard-tsdb` are already-public OSS libraries. The $199 site SKU is **support / integration / indemnification** — not a secret extra engine.  
`slid-phi`, `zero-range-wave-compression`, and `spl-pay-per-suite` are **stubs or quote rails**.  
Access after pay is an entitlement claim, not a private-engine dump. x402 auto-claim is not wired.

## Standing SKU prices (USD)

| SKU | Name | USD | Stripe Payment Link | npm package(s) |
|-----|------|----:|---------------------|----------------|
| `cddg-split` | CDDG:Split | **199** | https://buy.stripe.com/14A4gA4B79lu71jdAQ6wE0f | (process product; site) |
| `zrw-n00b` | ZRW N00b | **retired** | do not sell | stub npm only; git **private** |
| `zrw-pro` | ZRW Pro | **retired** | do not sell | stub npm only; git **private** |
| `zrw-l33t` | ZRW L33t$aUC3 | **retired** | do not sell | stub npm only; git **private** |
| `blackjack` | Blackjack | **199** | https://buy.stripe.com/00w00k6Jf8hqgBTaoE6wE0h | `blackjack-compression` |
| `shard-zip` | shard-zip | **199** | https://buy.stripe.com/3cI7sMd7D8hq1GZaoE6wE0i | `shard-zip` |
| `shard-tsdb` | shard-tsdb | **199** | https://buy.stripe.com/9B628sd7DeFO99r9kA6wE0j | `shard-tsdb` (MIT open + commercial path) |
| `slid-phi` | slid-phi | **199** | https://buy.stripe.com/dRm6oI6JfgNWetL8gw6wE0k | `slid-phi` |
| `support-integration` | Support + Integration | **199** | https://buy.stripe.com/8x28wQebH41a85n2Wc6wE0l | services |
| `consulting` | Consulting | **250** | https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02 | services |
| `sponsor` | Sponsor | **29** | https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01 | support |
| `donate` | Donate | **29.99** | https://buy.stripe.com/eVq9AUd7D0OY0CVdAQ6wE0a | support |
| `gao-entry` | GAO Entry | **1** | https://buy.stripe.com/8x24gAd7D7dm2L31S86wE0m | olympiad |

## Suite (metered freemium)

| | |
|--|--|
| Free | first **100 GB** per job |
| Then | **$0.05 / GB** (first 100 paid GiB) |
| Bulk | **$0.04 / GB** after that |
| Quote | `POST https://slidphilabs.fly.dev/api/ppp-quote` |
| Checkout | multi-method Stripe or x402 suite |

## package.json fields (standard)

Each commercial package should expose:

```json
{
  "homepage": "https://slidphilabs.fly.dev",
  "funding": {
    "type": "individual",
    "url": "https://slidphilabs.fly.dev/pay"
  },
  "pricing": {
    "sku": "<sku>",
    "amount_usd": "199.00",
    "amount_cents": 19900,
    "currency": "usd",
    "buy": "https://buy.stripe.com/…",
    "checkout": "https://slidphilabs.fly.dev/api/checkout",
    "access": "https://slidphilabs.fly.dev/access?product=<sku>",
    "catalog": "https://slidphilabs.fly.dev/api/x402-products",
    "pay_ui": "https://slidphilabs.fly.dev/pay"
  },
  "agentic": {
    "discovery": "https://slidphilabs.fly.dev/api/agent",
    "catalog": "https://slidphilabs.fly.dev/api/x402-products",
    "suite_pricing": { "free_cap_gb": 100, "usd_per_gb_after_free": 0.05, "usd_per_gb_bulk": 0.04 }
  },
  "x402": {
    "discovery": "https://slidphilabs.fly.dev/api/agent",
    "catalog": "https://slidphilabs.fly.dev/api/x402-products",
    "networks": ["solana-mainnet-beta", "eip155:8453"],
    "payment_header": "X-PAYMENT"
  }
}
```

## Publish status (this Host Grok · 2026-08-09)

| Package | Local prices wired | npm publish |
|---------|-------------------|-------------|
| blackjack-compression | yes | **1.4.8** published (`pricing` $199 + Fly pay) |
| shard-zip | yes | **0.3.8** published |
| shard-tsdb | yes | **0.2.12** published |
| spl-pay-per-suite | yes · MCP + quote `SUITE_PRICING` | **1.1.7** published (100 GB · 5¢/4¢) |
| zero-range-wave-compression | pending local tree | **Other Grok / Host** |
| slid-phi | pending local tree | **Other Grok / Host** |

**Canonical suite (must match API + MCP + npm):** free **100 GB** · then **$0.05/GB** · bulk **$0.04/GB** · min **$0.05**.

## Handoff · This Grok ↔ Other Grok

### This Grok (session) **did / owns**
- Stripe Payment Links split per SKU (no shared $199 link)
- Live Fly catalog + `/api/checkout` multi-method
- Canonical price table (this doc)
- package.json `pricing` blocks on local package repos
- Team Mesh context

### **Other Grok** (or Host with npm auth) **must**
1. `npm publish` each package with bumped version after price field patch  
2. Confirm npm page shows new `funding` / readme buy links  
3. Point www DNS → Fly so `www` URLs in old published packages stop 404  
4. Optionally rewrite published package descriptions that still say Try Gate / 1.5¢  

### Either side
- Do not invent new SKU prices without Host lock  
- Prefer Fly product host until www DNS flips  
