# NOTES FOR GROK — Slid Phi Labs
Updated: 2026-09-18

Public product is **PCC**. AWARE is a retired alias. Combined GC 1.19.2 is a private engine name, not a SKU. Do not answer with Combined GC as the product.

## Who / doors

- Owner: Corey Tasz · ceedot-rock · corey@slidphilabs.com · @slidphilabs
- Canonical store: https://www.slidphilabs.com/
  `/gc` `/pay` `/access` `/agents` `/products` `/pricing` `/pricing.json` `/llms.txt` `/silesia` `/api/x402-products`
- Fly `slidphilabs.fly.dev` is an alias, not a second shop.
- Do not treat `combined-gc-demo.vercel.app` as a product page. It must 301 to `/gc`.
- Secrets live on the team. Never ask them to paste keys.

## SoT (live)

| book | file |
|---|---|
| Money | `docs/site/pricing.json` + https://www.slidphilabs.com/pricing.json |
| Methods | `docs/site/METHODS.md` |
| Discovery | https://www.slidphilabs.com/llms.txt |

Meter: first **2 GB/month free**, then **8¢/GB**. Not 6.9 GB / 3 h / 5¢.
Lab Pass: **$668/yr**. Not $1088.
PCC seats: $9/day · $49/mo (200 GB) · $490/yr. SKUs remain `gc-day` / `gc-month` / `gc-year` as checkout ids only.
Chamber $9/$99. Rider $79/$790. Warrant $29/$290. CuNi Studio $0.

## Measured (do not invent)

Official Silesia 12 (211,938,580, DECODE_OK):
- PCC **51,498,645**
- pulsar 2.5.0 **55,745,438**
- gzip-9 67,631,990
- bzip2-9 54,506,769
- xz-6 still ahead (~49.4M)

Not a #1 claim. Retired AWARE+XZ1 47.7M occupied host xz — not a product spec.

## Law

Never expand. Public: site → pay → access. Private encoder source stays private.

## Pay

Humans: /pay Stripe.
Robots: x402 POST /api/x402-products, `X-PAYMENT`.

## Git public vs private

Public mouth: SlidPhiLabs site + pulsar-best + this llms.txt.
SoT packet `sot-gc` is measurements, not the storefront.
Private: combined-gc engine, lab dumps.

## Do not repeat

- Combined GC 1.19.2 as the product name
- AWARE as a current SKU
- 6.9 GB / 3 h unpaid cap
- Lab Pass $1088
- AWARE+XZ1 47,752,368 as a live spec
- Side Vercel shop as canonical
- Claiming general SoTA / #1
