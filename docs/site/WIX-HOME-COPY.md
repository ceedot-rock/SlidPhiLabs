# Slid Phi Labs — Wix Home (paste-ready)

**Canonical site:** https://www.slidphilabs.com  
**Tagline:** Impressive Compression..... see for yourself  
**Brand art:** https://raw.githubusercontent.com/ceedot-rock/splabs-brand/main/assets/brand/slid-phi-labs-master.jpg  
**IP:** marketing + metrics only. No engine source, coefficients, or residual internals.  
**Design pack:** `docs/site/` — `index.html`, `try.html`, `access.html` (source of truth for layout + links).

---

## SEO (Wix Site Settings)

| Field | Value |
|--------|--------|
| **Title** | Slid Phi Labs — Impressive Compression |
| **Description** | Impressive Compression..... see for yourself. Zero Range Wave, Residual Governance (CDDG + Mirrored Cost), Try Gate, commercial licenses. |
| **Keywords** | slid phi labs, impressive compression, zero range wave, ZRW, residual governance, CDDG, integer compression, try gate |
| **Canonical** | https://www.slidphilabs.com/ |
| **OG image** | Master poster (full, no crop of third-eye / banners) |

---

## Nav

**Logo:** Slid Phi **Labs** (Labs in teal `#3dd6c6`)

| Link | Target |
|------|--------|
| Champion | #champion |
| ZRW | #zrw |
| Packages | #packages |
| Pricing | #pricing |
| Access | /access |
| **Try Gate** (teal button) | /try |

---

## Post-purchase banner

When Stripe lands on `/?purchase=PRODUCT` or `/?purchase=…&session=…`:

- Show toast: **Payment received** for {product} → **Go to Access**
- Access link: `/access?product={key}&session={id}` when session present

---

## 1. Hero

**Badge:** `COMMERCIAL · TRY GATE · PROPRIETARY`

**Tagline:**  
**Impressive Compression..... see for yourself**

**H1:**  
Integer compression that actually fits your data

**Lede:**  
Zero Range Wave, Residual Governance, and the Slid Phi Labs codec family hit structured integer workloads hard. Public registry is a stub. Real engines move through Try Gate and license. Don’t take our word for it.

**CTAs:**  
1. **See for yourself** → `/try` (teal)  
2. **Residual Governance** → `#champion` (gold)  
3. **The numbers** → `#proof` (blue)  
4. **Pricing** → `#pricing` (ghost)

**Meta:** Champion · CDDG + Mirrored Cost · Stub on public npm · Access after gate / purchase

---

## 2. Champion (`#champion`) — LEAD WITH THIS

**Section label:** LEAD PRODUCT · RESIDUAL GOVERNANCE  
**Pill:** CHAMPION LOCKED

**H2:** Continuous Dark-Degree Geometry + Mirrored Cost

**Body:**  
Hierarchy is the attractor. Code only what remains. Residual Governance packages the closed-loop residual math for production — not a public dump of coefficients.

**Axiom strip (mono):**  
`ΔE + ΔC ≈ 0 · mirror_error → 0.000 · quality ~2.09× vs pure 360`

| Metric | Value |
|--------|--------|
| Mirror error | **0.000** |
| Quality vs 360 | **~2.09×** |
| Phase align | **&lt;0.02°** |
| Residual cut | **64–84%** |

**CTAs:**  
- **Buy Residual Governance · $199** → https://buy.stripe.com/14A4gA4B79lu71jdAQ6wE0f  
- **After purchase → Access** → `/access?product=residual-governance`

---

## 3. Proof (`#proof`)

**Section label:** RESULTS · PUBLIC BENCHES

| Card | Big line |
|------|----------|
| Zeros × 1k | **8 B** packed |
| Ramp × 1k | **~141×** vs brotli-class |
| Walk series | **Crushing** vs gzip-class |
| Stance | **#1** on shapes we target |

---

## 4. ZRW (`#zrw`)

**Buttons (exact Stripe):**  
- See for yourself → `/try`  
- npm stub → zero-range-wave-compression  
- Starting Gate $79 → https://buy.stripe.com/28EfZic3z69i3P72Wc6wE0b  
- Pro $249 → https://buy.stripe.com/cNidRaebHbtC71j8gw6wE0c  
- l33t $699 → https://buy.stripe.com/14AeVe9Vr8hqadvbsI6wE0d  

---

## 5. Packages (`#packages`)

| Card | Footer |
|------|--------|
| **residual-governance** (featured gold) | Buy $199 · Access |
| **zero-range-wave-compression** | Starting Gate · Access |
| **blackjack-compression** | Get access |
| **shard-zip · shard-tsdb · slid-phi** | Get access |

---

## 6. How you get the engine (`#access-how`)

1. **Try Gate or buy** — Stripe / free review  
2. **Land on Access** — `/access?product=…&session=…`  
3. **Private install** — signed URL / tarball. Interim: email subject **PACKAGE ACCESS**

---

## 7. Pricing (`#pricing`) — full map

### Champion & support

| Product | Price | Checkout |
|---------|------:|----------|
| Residual Governance | $199 | https://buy.stripe.com/14A4gA4B79lu71jdAQ6wE0f |
| Support + Integration | $199 | https://buy.stripe.com/7sYbJ27NjfJSbhz8gw6wE09 |
| Consulting | $250 | https://buy.stripe.com/eVqfZi0kR41a4TbgN26wE02 |

### ZRW gates

| Product | Price | Checkout |
|---------|------:|----------|
| Starting Gate | $79 | https://buy.stripe.com/28EfZic3z69i3P72Wc6wE0b |
| Pro Starter | $249 | https://buy.stripe.com/cNidRaebHbtC71j8gw6wE0c |
| l33t Unlimited | $699 | https://buy.stripe.com/14AeVe9Vr8hqadvbsI6wE0d |

### Fuel

| Product | Price | Checkout |
|---------|------:|----------|
| Try Gate chip-in | $9 | https://donate.stripe.com/eVq8wQffL2X60CVfIY6wE0e |
| Sponsor | $29 | https://buy.stripe.com/cNi6oI8RnbtCgBTgN26wE01 |
| Donate | $29.99 | https://buy.stripe.com/eVq9AUd7D0OY0CVdAQ6wE0a |

---

## Access page (`/access`)

**Query params:**  
- `product` — e.g. residual-governance, zrw-starting-gate, zrw-pro-starter, zrw-l33t-unlimited  
- `session` — Stripe Checkout Session id (`cs_…`)

**When session present:**  
Show “Checkout session received” + deliverable + mailto PACKAGE ACCESS prefilled with product + session.

**When product only:**  
Show buy CTA + already-paid email path.

**Interim keyword:** **PACKAGE ACCESS** → ceedotrock@gmail.com

**Do not** put the real engine on public npm or a permanent public URL.

**Future (needs host secret):**  
Server retrieve session → `payment_status === 'paid'` → signed download URL. Secret key never in browser.

---

## Try Gate (`/try`)

Unchanged paths A/B. Add nav Champion + link Residual Governance $199 for buyers who skip free gate.

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
**House mark:** `/assets/logos/logo-slid-phi-labs.jpg?v=13`  
**Product marks:** `/assets/logos/logo-*.jpg`  
**Poster:** `/assets/slid-phi-labs-master.jpg` (hero + footer strip)

---

## Do / don’t

| Do | Don’t |
|----|--------|
| Tagline + See for yourself → Try Gate | “Under Construction” |
| Lead with CDDG + Mirrored Cost champion | Residual coefficients / hierarchy internals |
| Full Stripe map wired | Dead `*.vercel.app` links |
| Stub honesty + /access delivery | “Download full source on npm” |
| Master poster full-bleed | Crop third-eye or banners |
