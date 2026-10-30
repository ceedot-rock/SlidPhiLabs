# Commercial license — Slid Phi Labs

Owner: Corey Tasz / Slid Phi Labs  
Inbox: corey@slidphilabs.com  
Machine-readable: https://www.slidphilabs.com/licensing.json  
Public specialist machine: https://www.slidphilabs.com/specialist

## Plain English (read this first)

Every product we bring forward is **dual-licensed**. You pick the open license, or you pay a commercial grant and ship closed. Compression through your tools runs every pathway we own on that grant. npm and MCP are clients.

pulsar is GPL-3.0-or-later, or SKU `pulsar-exception` at **$490/year** for one closed product, one year, via the unified grant. CuNi is AGPL-3.0-or-later, or SKU `cuni-exception` at **$490/app/year** via the unified grant. Chamber SDK, Warrant, and Agent-Rider source are AGPL-3.0-or-later, or the unified grant at **$490/product/year**. Chooser files live in each repo as `LICENSE`.

PCC is a compressor through your tools. You pay the meter ($0.25 per GB of input; first 1 GB/month free) or buy Pro ($25/month including 100 GB, then $0.20/GB). Every meter has a customer-set monthly spend cap (default $25 pay-as-you-go) with an alert at 80% of cap/allowance. Agents settle per call with x402; humans pay monthly with Stripe. You do **not** get the source.

Chamber ($20/month · $200/year; 24-hour try; opening already-sealed blobs free forever; sealing not metered), Agent-Rider (Solo $12/month, 1 identity, 500 verifications/month · Team $49/month, 10 identities, 5,000 verifications/month, Warrant included · Fleet $199/month, 100 identities, 50,000 verifications/month, Warrant + fleet watch included; overage $0.02 per verification, customer-set monthly cap default 2× plan price, alert at 80%), and Lab Pass ($495/year: Chamber year + Rider Solo year + PSI Meter 1 seat year + Warrant add-on year; parts sum $650; PCC/compression out; no monthly version) are paid product seats. CuNi’s playground is free; shipping CuNi in a closed app is $490/app/year (SKU `cuni-exception`).

The production engine is private. A $199 OSS-support SKU is help, not a license, unless the invoice says otherwise.

## Three lanes

1. **Public demo / copyleft.** pulsar is GPL-3.0-or-later. CuNi is public. The zeros demo (all-zero data → 8 bytes) is a public specialist on `POST /api/specialist`. You may run, study, and share those trees under their own licenses.

2. **Paid closed-source exception.** To ship pulsar or CuNi **inside a closed-source product**, you need a written exception. Pay the matching SKU; the invoice is the grant.

   - pulsar exception: `$490 / year` · SKU `pulsar-exception` · https://www.slidphilabs.com/pay?sku=pulsar-exception
   - CuNi exception: `$490 / year` · SKU `cuni-exception` · https://www.slidphilabs.com/pay?sku=cuni-exception

## Unified closed-use grant schedule

One schedule for all shipped code (TNSSRC, pulsar, CuNi, Chamber SDK, Agent-Rider source, Warrant source, PSI Embed): **$490 per product per year**; **$190 for the first 10 grants** (founding rate); **$390 each for 3+ products**. Written grant, human-fulfilled, one product + one year per grant. Renewal at the then-current schedule price. Each grant names the exact build it covers: TNSSRC grants cover **0.1.0 only**.

   The public tree stays GPL / public. The exception is extra permission for one closed product, one year.

3. **Hosted seat.** PCC, Chamber, Rider, Lab Pass, and related seats are **access**. You buy the right to run the product on our machines (or, for Chamber, to seal new JSON). You do not receive the production engine.

## What a pulsar exception grants

- Permission to link or embed **pulsar** (the public GPL compressor) into **one** closed-source product for **one year**.
- Decode of blobs that product wrote with that pulsar build.
- Support only if the invoice also lists a support SKU.

## What no paid SKU on this page grants

No SKU sells the production engine or its internals. You buy a seat or a written exception.

Without a matching invoice, you do not receive PCC encoder source, the Chamber kernel, or Agent-Rider signing keys.

## Hosted seats (access, not engine)

| Product | SKU | Price |
|---|---|---|
| PCC meter | `pcc-meter` | $0.25 / GB of input (first 1 GB/month free; cap default $25, alert at 80%) |
| PCC Pro | `pcc-pro` | $25 / month (100 GB included, then $0.20/GB) |
| PCC Pro year | `pcc-pro-year` | $250 / year |
| Lab Pass year | `lab-pass` | $495 (Chamber year + Rider Solo year + PSI Meter 1 seat year + Warrant add-on year; PCC out) |
| Chamber month / year | `chamber-month` / `chamber-year` | $20 / $200 |
| Agent-Rider Solo / Team / Fleet | `rider-solo` / `rider-team` / `rider-fleet` | $12 / $49 / $199 per month |
| Warrant add-on | `warrant-addon` | $8 / month to Solo ($80/year); included in Team and Fleet |

Compression through your tools: first 1 GB each month is free. After that, $0.25 per GB of input. Pro includes 100 GB each month, then $0.20/GB. Every meter has a customer-set monthly spend cap (default $25 pay-as-you-go) with an alert at 80% of cap/allowance. That meter pays for the machines on the PCC plan.

After Stripe, claim on https://www.slidphilabs.com/access.

## Public specialist machine

`POST /api/specialist` looks at your bytes and points you at the matching product.

- A file of zeros: compressed here, free demo, 8 bytes, original restored.
- Text you want to run yourself: download pulsar, or pay `pulsar-exception` to put it in a closed app.
- Everyday files: buy PCC. You run it on our machines. Source is dual-licensed; the PCC year seat is the closed-product grant and the PCC grant.

gzip, brotli, xz, and bzip2 are other compressors we publish numbers against. They are not included in what you buy.

## Usage caps and caveats (no-loss rule)

Every hosted or metered product carries a hard allowance; overage is
metered or throttled, never free. Source licenses (closed exceptions,
psi seats) cost nothing per copy, so they carry no usage cap — one
product, one term, as written above.

| Product | Allowance | Overage |
|---|---|---|
| PCC meter / Pro | first 1 GB/mo free; Pro 100 GB/mo included | $0.25/GB of input; Pro overage $0.20/GB; cap default $25, alert at 80% |
| Suite meter | first 1 GB/mo free | $0.25/GB of input; cap default $25, alert at 80% |
| Warrant | 3 warrants + 10 receipts/operator/day free | Warrant add-on required above free tier |
| Chamber | automated fair-use rate limits | sustained bulk use moves to metered/enterprise |
| Rider identity | per-seat issuance | extra seats per tier |
| Support $199 | scope and window fixed in the invoice before work starts | extra work re-quoted |
| Consulting | $175/hour, 2-hour minimum, scoped SOW | extra time re-quoted |

Minimums: card charges start at $1; API-created amounts below $0.50
are rejected. Refunds per refund-policy. Abuse (credential sharing,
seat resale, scraping to evade metering) terminates the seat without
refund.

## Commercial and enterprise pricing on request

Volume seats (10+), private deploy, SLA-backed production, and
anything above plan allowances: email corey@slidphilabs.com with
subject "Enterprise pricing". We reply with invoice, ACH/wire, or
Stripe terms. Nothing enterprise is sold self-serve.

## Warranty

AS IS. No warranty of merchantability, fitness, or non-infringement.
