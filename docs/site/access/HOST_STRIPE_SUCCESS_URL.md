# Stripe success URLs — Chamber + TRU8 (host)

SoT: `/pricing.json` · One inbox: `corey@slidphilabs.com`

Two products. Each has Day · Month · Year.  
Chamber = security only (half). TRU8 Year = both products.

## After payment redirect

| SKU | Amount (cents) | Payment Link | Success URL |
|-----|----------------|--------------|-------------|
| `chamber-day` | 1250 | https://buy.stripe.com/14A4gAebHcxG0CV9kA6wE0x | `…/access?product=chamber-day&session={CHECKOUT_SESSION_ID}` |
| `chamber-month` | 8750 | https://buy.stripe.com/3cI5kEffL0OY4TbfIY6wE0y | `…/access?product=chamber-month&session={CHECKOUT_SESSION_ID}` |
| `chamber-year` | 95000 | https://buy.stripe.com/7sYfZid7D55edpHcwM6wE0z | `…/access?product=chamber-year&session={CHECKOUT_SESSION_ID}` |
| `tru8-day` | 2499 | https://buy.stripe.com/4gM3cw0kR9lu4Tb54k6wE0A | `…/access?product=tru8-day&session={CHECKOUT_SESSION_ID}` |
| `tru8-month` | 17500 | https://buy.stripe.com/8x23cw9Vr0OY85n54k6wE0B | `…/access?product=tru8-month&session={CHECKOUT_SESSION_ID}` |
| `tru8-year` | 190000 | https://buy.stripe.com/dRmaEYgjPbtCclDaoE6wE0C | `…/access?product=tru8-year&session={CHECKOUT_SESSION_ID}` |

Checkout metadata: `sku=<sku>` (preferred) and `product=<sku>`.  
Aliases: `truchamber-*` → `tru8-*`.

## Retired (do not sell)

| Old | Why |
|-----|-----|
| json-chamber $99 forever | Undercuts every paid tier |
| mashed TruChamber $1,750 | Split into Chamber + TRU8 ladders |
| month $90 | Inverts vs yearly |
| v3 links `28E5kE…` / `4gMaEY…` / `8x200k8…` | Old $24.99 / $175 / $1,750 TruChamber links |

## Env

`STRIPE_SECRET_KEY` or `STRIPE_RESTRICTED_KEY` with `checkout.sessions` read on Fly app **slidphilabs**.
