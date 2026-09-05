# npm · product prices (canonical)

**Updated:** 2026-09-05  
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
| `cddg-split` | CDDG:Split | **199** | https://www.slidphilabs.com/pay?sku=consulting | (process product; site) |
| `zrw-n00b` | ZRW N00b | **retired** | do not sell | stub npm only; git **private** |
| `zrw-pro` | ZRW Pro | **retired** | do not sell | stub npm only; git **private** |
| `zrw-l33t` | ZRW L33t$aUC3 | **retired** | do not sell | stub npm only; git **private** |
| `blackjack` | Blackjack | **199** | https://www.slidphilabs.com/pay?sku=oss-support | `blackjack-compression` |
| `shard-zip` | shard-zip | **199** | https://www.slidphilabs.com/pay?sku=oss-support | `shard-zip` |
| `shard-tsdb` | shard-tsdb | **199** | https://www.slidphilabs.com/pay?sku=oss-support | `shard-tsdb` (MIT open + commercial path) |
| `slid-phi` | slid-phi | **199** | https://www.slidphilabs.com/pay?sku=consulting | `slid-phi` |
| `support-integration` | Support + Integration | **199** | https://www.slidphilabs.com/pay?sku=consulting | services |
| `consulting` | Consulting | **250** | https://www.slidphilabs.com/pay?sku=consulting | services |
| `sponsor` | Sponsor | **29** | https://www.slidphilabs.com/pay?sku=sponsor | support |
| `donate` | Donate | **29.99** | https://www.slidphilabs.com/pay?sku=donate | support |
| `gao-entry` | GAO Entry | **1** | https://www.slidphilabs.com/olympiad | olympiad |

## Suite (metered)

| | |
|--|--|
| Unpaid | **6.9 GB and 3 hours** |
| Then | **~$0.05 / GB** (first 100 paid GiB) |
| Bulk | **$0.04 / GB** after that |
| Quote | `POST https://www.slidphilabs.com/api/ppp-quote` |
| Checkout | Stripe or x402 suite |

Do not advertise 100 GB free.

## package.json fields (standard)

Each commercial package should expose:

```json
{
  "homepage": "https://www.slidphilabs.com",
  "funding": {
    "type": "individual",
    "url": "https://www.slidphilabs.com/pay"
  },
  "pricing": {
    "sku": "<sku>",
    "amount_usd": "199.00",
    "amount_cents": 19900,
    "currency": "usd",
    "buy": "https://buy.stripe.com/…",
    "checkout": "https://www.slidphilabs.com/api/checkout",
    "access": "https://www.slidphilabs.com/access?product=<sku>",
    "catalog": "https://www.slidphilabs.com/api/x402-products",
    "pay_ui": "https://www.slidphilabs.com/pay"
  },
  "agentic": {
    "discovery": "https://www.slidphilabs.com/api/agent",
    "catalog": "https://www.slidphilabs.com/api/x402-products",
    "suite_pricing": { "free_cap_gb": 6.9, "free_window_hours": 3, "usd_per_gb_after_free": 0.05, "usd_per_gb_bulk": 0.04 }
  },
  "x402": {
    "discovery": "https://www.slidphilabs.com/api/agent",
    "catalog": "https://www.slidphilabs.com/api/x402-products",
    "networks": ["solana-mainnet-beta", "eip155:8453"],
    "payment_header": "X-PAYMENT"
  }
}
```

## Publish status (2026-09-05)

| Package | Local | npm (live until Host `npm login`) |
|---------|-------|-----------------------------------|
| slid-phi | **2.2.11** | **2.2.10** |
| spl-pay-per-suite | **1.1.9** (6.9 GB / 3 h) | **1.1.8** (still says 100 GB) |
| blackjack-compression | **1.5.3** | **1.5.2** |
| @cptasz13/tru8 | **0.1.1** zeros → 8 B | **0.1.0** (broken: missing `stroke-ls.mjs`) |
| shard-zip | historical | **0.4.1** |
| shard-tsdb | historical | **0.3.1** |
| pulsar | cargo/git, not npm | — |
| zero-range-wave-compression | pending local tree | **Other Grok / Host** |

**Canonical suite (must match API + MCP + npm):** unpaid **6.9 GB / 3 h** · then **$0.05/GB** · bulk **$0.04/GB** · min **$0.05**.

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
3. `npm login` on this machine, then publish local versions above  
4. Optionally rewrite published package descriptions that still say 100 GB free / Try Gate / 1.5¢  

### Either side
- Do not invent new SKU prices without Host lock  
- Public homepage is https://www.slidphilabs.com  
