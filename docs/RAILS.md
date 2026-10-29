# Rails — which products ride CLI / SDK / API / MCP, and why

Rule zero, everywhere: **no private keys in our code.** CLI, SDK, and
the MCP server pass a buyer-signed `paymentHeader` through to
`/api/x402-products`. They never hold wallets, never sign, never see
seed phrases. Stripe is the human rail, x402 the agent rail, invoice
the enterprise rail. Anything new sells through the catalog
(`PRODUCT_CATALOG` in `api/lib/payments-rails.js`) — all four rails
proxy it, so one entry lights up every rail at once.

## The calls

| Product | CLI | SDK | API | MCP | Why |
|---|---|---|---|---|---|
| Compression goods: PCC seats, Chamber, TNSSRC grant/bake-off, pulsar/CuNi exceptions, TRU8 path, suite metered | buy | catalog + quote + pay-URL | x402 + Stripe + invoice | catalog + buy | The core goods. Everywhere a buyer can reach. |
| Seats: Rider, Rider Ops, Warrant, Lab Pass, Foundry+, psi-month/psi-year | buy | catalog + pay-URL only | x402 + Stripe + invoice | catalog + buy | SDKs use seats; they don't sell them. Payment execution stays out of libraries. |
| Metered tools: suite, quikgater, tollkeeper | submit + quote | full client | x402 jobs | full tools | Usage rails by nature. |
| Human services: support, consulting, oss-support, integration | quote | catalog only | Stripe + invoice | quote only | Buying consulting is a human intent decision. Agents may price it, never purchase it. |
| Gifts: donate, sponsor | — | catalog only | Stripe | — | Same reason: human intent. |
| Retired / parked / internal | none | none | none | none | Dead SKUs stay unbuyable on purpose. |

## Adding a product to every rail

1. One entry in `PRODUCT_CATALOG` (sku, `amount_cents`, `stripe` pay
   link, `kind`, `list: true`, `blurb`). This alone enables API
   (x402 402-flow + Stripe dynamic checkout + invoice), CLI
   (`spl-pps buy --sku X`), MCP (`spl_pps_x402_buy`), and SDK
   (`x402BuyProduct`).
2. Aliases in `SKU_ALIASES` only for human-friendly shortcuts.
3. Fulfillment in `buildDeliverable` (`access-verify.js`): instant
   branch for license grants (mirror the psi-seat branch); written or
   scheduled goods ride the generic human-fulfilled path.
4. Legal truth in `licensing.json` `skus` (the license files point
   here). Machine discovery (`agents.json`, `llms.txt`, `ai.txt`)
   follows automatically on the next discovery sync.

## Explicit non-rails

- The SDK never executes payment: no `pay()` that signs, no key
  storage, no dev-bypass outside local testing.
- The MCP server never invents SKUs: unknown sku → 400 with the
  catalog, never a guess.
- Support/consulting/gifts never ride MCP purchase: quote only.
