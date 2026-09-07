# NOTES FOR GROK — Slid Phi Labs
Updated: 2026-08-29 (session with owner Corey / ceedot-rock)

Cinema intro notes stay in `docs/site/assets/intro/NOTES_FOR_GROK.md`. This file is shop + codec + SoT.

Read this before inventing a second site, asking for secrets, or restating old Suite copy.

## Who / doors

- Owner: Corey Tasz · ceedot-rock · corey@slidphilabs.com · @slidphilabs
- Canonical store: https://www.slidphilabs.com/
  `/pay` `/access` `/agents` `/products` `/pricing.json` `/llms.txt` `/api/x402-products`
- Fly `slidphilabs.fly.dev` is an alias, not a second shop.
- Do not create `*.vercel.app` storefronts. They already pay for the domain.
- Secrets live on the team (Vercel / Cloudflare wrangler). Never ask them to paste keys. Names: `PAY_TO_ADDRESS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## SoT

| book | file |
|---|---|
| Money | `docs/site/pricing.json` |
| Methods | `docs/site/METHODS.md` + `docs/site/lab/METHODS_LOCK.json` |
| Platform | `docs/site/platform.json` |

Git `main` 2026-08-29: Suite **6.9 GB + 3 hours**. Live www may lag.
Check: `curl -s https://www.slidphilabs.com/pricing.json | grep free_cap` — want `6.9`.

## Measured (do not invent)

Silesia 211,938,580: zpaq-m5 39,112,870 · **AWARE+XZ1 47,752,368** · xz-9 48,795,480 · brotli-11 49,564,563 · zstd-19 53,024,573 · gzip-9 67,631,990.
2nd in that set. Four AWARE files are host xz (XZ1). Not top-1 vs paq.

Calgary 3,141,622 Loom Hangry **980,769** vs gzip-9 1,017,680 vs xz-9 845,840. 14/14. Loom is not the GC SKU.

AWARE ≠ Loom ≠ xz. AWARE = commercial SKU. TRUSTREAM = live residual pipe. Engine private: `ceedot-rock/combined-gc`.

## Law

Never expand. Suite unpaid 6.9 GB + 3 h. Tamper 69s. Public: box → pay → access.

## Pay

Humans: /pay Stripe (team secrets).
Robots: x402 POST /api/x402-products, `X-PAYMENT`.
Quikgater `worker/src/payment.ts`: facilitator https://x402.org/facilitator, `base-sepolia`, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
PAY_TO this session: `0xAd3dB8e2b1A311701E6233f17F6d648e4A52287c`.
Mainnet = CDP keys in team env, not chat.

## SKUs

GC $9/$49/$490 · Chamber $9/$49/$490 · GC+Chamber $990 · Lab Pass $1088 · TruGame $12/$79 · Suite meter · Blackjack $199.
Retired: separate TRU8/Gate years, ZRW $79/$249/$699, $1900/$950 rent desk.

## Git public vs private

Public: SlidPhiLabs, quikgater, pulsar-best.
Private: combined-gc, ZRW engine, lab-team-dump, host-*.
`slidphi-storefront` was a scratch repo this session — not the shop.

## Loom names

Still STIL, Pulse PULS, Weave WEAV, Drift DRFT, Shift SHFT, Bare BARE, Thread THRD (Hangry), RUNS, Melt, container LOOM.
Pulsar-ZPAQ-Fixed card is process, not the 39.1 MB zpaq row. Do not advertise that as ours.

## Do not repeat

Side Vercel shop. Asking for keys. Lab MCP traffic as revenue. Putting CGS1 forward after gzip loss. 100 GB free. Confusing Loom with AWARE. Claiming general SoTA / top-3.

## Next

1. Confirm live pricing.json is 6.9.
2. npm 2.3.0 only after that.
3. No new website repo.
4. Outcomes only on public doors.
