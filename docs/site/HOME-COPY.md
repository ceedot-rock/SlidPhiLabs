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
Slid Phi Labs

**Lede:**
The cost of computing is the cost of everything now — data that takes too much room, agents that spend without proof, evidence that can't survive a dispute. We build the technology that removes those costs.

**Second paragraph:**
We are a computation and AI company. Our compression engines shrink the data enterprises pay to store and move. Our agent infrastructure gives autonomous software a signed identity, a spending mandate it cannot exceed, and a receipt trail anyone can verify. Not dashboards about the problem — the layer that makes the problem stop costing money.

**Hero actions:** Products (→ #products) · The evidence (→ #costs) · Invest (→ /invest)

**Homepage rule (Corey, 2026-10-22): NO price figures anywhere on the homepage.** The homepage sells the tech and funnels to product pages and /pricing; prices live there, never here.

**Sections:** 01 The costs (pain → solution → financial-impact table: data-center overhead / TNSSRC+PCC; agents spending without authority / Warrant; no record that stands up / Agent-Rider+CuNi; IP risk in open-source / open interface, private engines) · 02 The products (Compression, Agent-Rider, Warrant, CuNi — one sell line each, links to their pages) · 03 What it is. What it isn't. · 04 From code.

---

## Product catalog reference

The homepage no longer carries the full shipped ledger (it carries the four lines in §02 above); the full catalog lives on /products. This table remains the reference for product lines and where their prices appear (product pages and /pricing only — never the homepage).

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

## Building now (retired from the homepage 2026-10-22)

Dated, in progress, no vapor. Private R&D is labeled as such. Current items (Oct 2026): Llama teacher rollout for TEACHAiD, x402 money rails, monorepo verse fusion, new instruments. The sell-the-tech homepage no longer carries this section; keep items current wherever they surface, and do not let entries go stale.

---

## 03 Proof

Public benches with numbers (Silesia scores, decode rates, test counts) now lead the homepage via the §01 costs table. Every claim links to its run. No claim without a receipt.

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
| No price figures on the homepage; funnel to product pages + /pricing | Any price, plan, or per-unit figure on the homepage |
| Every claim with a receipt | Residual coefficients / hierarchy internals |
| Full Stripe map wired | Dead `*.vercel.app` links |
| Stub honesty + /access delivery | “Download full source on npm” |
| Master poster full-bleed | Crop third-eye or banners |
| Date every Building-now entry | Undated vapor |
