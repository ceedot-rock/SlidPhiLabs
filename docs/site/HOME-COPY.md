# Slid Phi Labs — Home (copy source of truth)

**Hosting:** Fly app `slidphilabs` (`docs/site/`, deploys on push to `main`). Wix is retired; do not paste copy into Wix.
**Canonical site:** https://www.slidphilabs.com  
**Tagline:** Tools that check. Proof before praise.
**Brand art:** https://raw.githubusercontent.com/ceedot-rock/splabs-brand/main/assets/brand/slid-phi-labs-master.jpg  
**IP:** marketing + metrics only. No engine source, coefficients, or residual internals.  
**Design pack:** `docs/site/` — `index.html`, `try.html`, `access.html` (source of truth for layout + links).

---

## SEO (`index.html` head)

| Field | Value |
|--------|--------|
| **Title** | Slid Phi Labs — tools that check |
| **Description** | Slid Phi Labs: hosted lossless compression (PCC), signed agent identity (Rider), exact programs (CuNi), agent payments (AwLPay), and the TEACHAiD teaching campus. Proof before praise. |
| **Canonical** | https://www.slidphilabs.com/ |

---

## Nav

Home · Rider · CuNi · Warrant · Compress · Silesia · Wiki · Pricing

---

## Post-purchase banner

When Stripe lands on `/?purchase=PRODUCT` or `/?purchase=…&session=…`:

- Show toast: **Payment received** for {product} → **Go to Access**
- Access link: `/access?product={key}&session={id}` when session present

---

## Hero

**H1:**
Tools that check.

**Lede:**
Hosted lossless compression, a two-key JSON seal, signed agent identity, and a small language that refuses to lie. Smaller or same size. Every byte back. Receipt.

**Hero cards:**
1. **Compress a file** — first 2 GB free
2. **Name an agent** — $3.31/mo
3. One person builds this — Corey Tasz. Plans from $9/mo.

**Silesia strip:** TNSSRC 43,724,575 · PCC 51,498,645 — 12 of 12 back, byte-identical. Try your own file.

---

## 01 Shipped — live products

Each one links to itself: docs, demo, or source.

| Product | Line |
|---------|------|
| **PCC** | Hosted lossless compression. Send a file, get a smaller one back, restore every byte. Nothing to install. Silesia 51,498,645 · $9/day · $39/mo · 2 GB free |
| **TNSSRC** | The local engine. Compress where the file sits, verify with decode plus SHA-256. 43,724,575 · 12/12 DECODE_OK · AGPL $0 |
| **pulsar** | Free GPLv3 binary for your own machine. No account, no phone-home. Silesia 55,745,438 · $0 |
| **TRUSTREAM** | The PCC plan for live logs — agent traces, SIEM, telemetry in 4 KiB tiles. Empty shrinks · never inflates · on a PCC seat |
| **Agent-Rider** | Signed identity for AI agents — a name that lasts fifteen minutes and proves itself on public keys. Solo $3.31/mo · live at agentrider.fly.dev |
| **Warrant** | Signed mandates — these hosts, these actions, this spend cap — plus a receipt when the job runs. In Rider Bundle and Team seats |
| **Tollkeeper** | Ten live metered tools behind the lab meter. Call it, meter ticks, receipt files. Pay per call |
| **CuNi** | One program, 53 targets. Python, Go, and JS must print the same stdout, or it refuses. Studio $0 · signed Ed25519 audit receipts |
| **ExactOdds** | Provably-fair game rules — commit-reveal dice with identical rules on six runtimes. Open source · AGPL / commercial |
| **AwLPay** | Any token, any chain, converted through checkable value — or refused. x402 rails. Tron · BTC · Lightning · XLM · BSC |
| **Quikgater** | Pay-per-fact web fetching for agents. No subscription for a snippet. Pay per fetch |
| **TEACHAiD** | Campus app with a personal teacher that cites the textbook, builds curriculum, and speaks it aloud. Live campus · teacher API moving to Llama |
| **Chamber** | Two-key JSON seal. One share is useless; every envelope carries its custody stamp. $9/mo · $99/yr · 33/33 tests green |

---

## 02 Building now

Dated, in progress, no vapor. Private R&D is labeled as such. Current items (Oct 2026): Llama teacher rollout for TEACHAiD, x402 money rails, monorepo verse fusion, new instruments. Edit dates in `index.html`; do not let entries go stale.

---

## 03 Proof

Public benches with numbers (Silesia scores, decode rates, test counts). Every claim links to its run. No claim without a receipt.

---

## 04 From code

Full catalog link-out. Keep counts in sync with `llms.txt` / `ai.txt`.

---

## Access page (`/access`)

**Query params:** `product` (e.g. residual-governance, zrw-starting-gate) · `session` (Stripe Checkout Session id `cs_…`).

**When session present:** show “Checkout session received” + deliverable + mailto PACKAGE ACCESS prefilled with product + session.
**When product only:** show buy CTA + already-paid email path.

**Keyword:** **PACKAGE ACCESS** → corey@slidphilabs.com only.
**Do not** put the real engine on public npm or a permanent public URL.
**Future (needs host secret):** server retrieve session → `payment_status === 'paid'` → signed download URL. Secret key never in browser.

---

## Color / theme (poster-locked)

From `splabs-brand` **BRAND.md**: *gold ornate metal · teal/cyan glow · lotus · wings · mandala · third-eye light · deep cosmic navy*.

| Token | Hex | Use |
|-------|-----|-----|
| Cosmic navy BG | `#050b16` | page |
| Panel | `#0c1524` / `#122033` | cards |
| Text | `#eef4fb` | body |
| Muted | `#8fa3b8` | secondary |
| Teal glow | `#3dd6c6` / `#5ef0df` | primary CTAs, accents |
| Gold metal | `#e8c547` / `#c9a227` | ribbons, champion, Cinzel headings |
| Third-eye fire | `#ff9a3c` | badge pulse |
| Eye blue | `#5ba8ff` | secondary buttons |

**Type:** Cinzel (gold banners / brand) + IBM Plex Sans/Mono  
**House mark:** `/assets/logos/logo-slid-phi-labs.jpg?v=14`  
**Poster:** `https://www.slidphilabs.com/assets/now/og.jpg` (hero + footer strip)

---

## Do / don’t

| Do | Don’t |
|----|--------|
| Tagline + proof-first ledger | “Under Construction” |
| Every claim with a receipt | Residual coefficients / hierarchy internals |
| Full Stripe map wired | Dead `*.vercel.app` links |
| Stub honesty + /access delivery | “Download full source on npm” |
| Master poster full-bleed | Crop third-eye or banners |
| Date every Building-now entry | Undated vapor |
