# YC Winter 2027 · draft answers

**Live draft (not submitted):** https://apply.ycombinator.com/apps/0d081c3f-fc53-477d-a625-ea389b783989/edit  
**YC login shown:** agentrider (founder account). Company on the form is **Slid Phi Labs**.  
**On-time deadline:** 2 Nov 2026, 8pm PT  
**Batch:** Jan–Mar 2027, San Francisco (must be there)

Submit is disabled until the 1-minute founder video is on the form. Do not click Submit until Host records that video and confirms Stripe / entity.

Do not paste Combined GC internals. Do not write “#1.” Host fills `[STRIPE]` and `[ENTITY]`.

---

## Company

**Company name:** Slid Phi Labs

**Describe what your company does (≤50 chars):**  
Hosted lossless compression and agent seats.

**Company URL:** https://www.slidphilabs.com

**Demo / product:** https://www.slidphilabs.com/gc  
**MCP:** https://www.slidphilabs.com/mcp  
**Public compressor:** https://github.com/ceedot-rock/pulsar-best

---

## What will you make? (3–5 sentences)

We sell access to a hosted lossless compressor (PCC) and two adjacent seats: Chamber (two-key JSON secrets) and Agent-Rider (signed agent identity). Humans pay Stripe. Agents pay x402 in USDC and can quote jobs on MCP. CuNi Studio is free: one source must print the same in Python, Go, and JS or it never publishes. The production compressor is private; pulsar is a public GPLv3 cousin so people can measure something without getting the engine.

---

## How far along are you?

Live site, live checkout, live MCP, live npm clients (2026-09). Hosted compression: POST /api/compress (pulsar 2.5.0 + zeros specialist). First 2 GB/month free, then 8¢/GB. PCC month $49 includes 200 GB. Public pulsar 2.5.0: Silesia 55,745,438 of 211,938,580; beats gzip-9, loses to xz-6. Zeros: 1e6 zeros → 8 bytes round-trip. Solo founder, Cherry Hill NJ. Revenue last 30 days: `[STRIPE — Host fills, or write $0]`.

---

## Why this? What do you know that others don’t?

Lossless compression is sold as a ratio contest. Buyers actually pay **egress and restore**. If decode is wrong, ratio is fraud. We keep DECODE_OK as the gate and we do not ship the private engine in npm. Most “AI compression” decks hide that. Agents already have 402 and catalogs; they do not have a compressor that will admit it lost to xz. We will.

---

## Who needs this?

1. **Ops / datacenter people** moving cold and warm blobs who already pay ~9¢/GB egress. Suite undercuts that after a small unpaid cap.  
2. **Agent platforms** that need a signed actor (Rider) and a pay header (x402), not another chat plugin.  
3. **People storing JSON secrets** who want two keys, not a password manager essay (Chamber).

We know because we run the checkout and the MCP ourselves. Named logos: none yet. Do not invent.

---

## Competitors (who you fear)

- **xz / zstd / brotli / gzip** — default tools. pulsar loses to xz-6 on Silesia. If we pretend otherwise we are done.  
- **zpaq / PAQ family** — better ratio, worse product.  
- **Hosted compression SaaS and CDN features** (Cloudflare, AWS). They have distribution.  
- **Agent identity / x402 wallets** — Coinbase stack, other 402 shops. Rider is a seat, not a chain.  
There are many file compressors. We are not “the 20th codec.” We are a **measured hosted job + seats**.

---

## Equity / funding

- Prior funding: **none** (Host correct if wrong).  
- Cap table: Corey Tasz 100% until a round.  
- Entity: `[ENTITY]`.

---

## Founders

**Corey Tasz** — founder, builds the lab. Location: Cherry Hill, NJ. Email: corey@slidphilabs.com. X: @slidphilabs / @ceedotrock.

**Why solo:** One person shipped site, codec benches, MCP, Stripe, x402, and npm. A co-founder is a hire after money, not a name on an NJIF form. Skill gap: outbound sales. That is the first hire in USE_OF_FUNDS.

**Video (Host):** 60 seconds, webcam, no music. Script:

> I’m Corey Tasz. Slid Phi Labs is in Cherry Hill. We host a lossless compressor you can pay for, and we publish a smaller GPLv3 cousin so you can measure us. One million zeros become eight bytes and come back. On Silesia, pulsar beats gzip and loses to xz — we say that out loud. Agents pay in USDC; humans use Stripe. I’m applying because I am one person and the product is already live.

---

## Other YC fields (short)

**How did you hear about YC?** Other founders / public batches.  
**Where do you live?** Cherry Hill, New Jersey, USA.  
**Can you be in SF for the batch?** `[YES/NO — Host]`. If no, do not apply this cycle.  
**Tech stack:** Rust engines (private), Node site, Fly, Stripe, x402, MCP.  
**Category:** B2B / developer tools / infrastructure.

---

## After submit

Keep shipping. Interview is 10 minutes. Numbers in this doc must match Stripe if they ask.
