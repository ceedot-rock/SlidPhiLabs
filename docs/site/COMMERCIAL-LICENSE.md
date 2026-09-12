# Commercial license — Slid Phi Labs

Owner: Corey Tasz / Slid Phi Labs  
Inbox: corey@slidphilabs.com  
Machine-readable: https://www.slidphilabs.com/licensing.json  
Public specialist machine: https://www.slidphilabs.com/specialist

## Plain English (read this first)

Every product we bring forward is **dual-licensed**. You pick the open license, or you pay a commercial grant and ship closed. Hosted compression runs every pathway we own on that grant. npm and MCP call the live host.

pulsar is GPL-3.0-or-later, or SKU `pulsar-exception` at **$490/year** for one closed product, one year. CuNi is AGPL-3.0-or-later, or SKU `cuni-exception` at **$490/year**. Chamber SDK, Warrant, and Agent-Rider are AGPL-3.0-or-later, or their matching seat. Chooser files live in each repo as `LICENSE`.

PCC is a **hosted** compressor. You buy a seat to run it ($9/day · $49/month · $490/year). You do **not** get the source.

Chamber ($9/month · $99/year), Agent-Rider ($79/month · $790/year), and Lab Pass ($668/year: Chamber + PCC + TruGame, not Rider) are paid product seats. CuNi’s playground is free; shipping CuNi in a closed app is $490/year (SKU `cuni-exception`).

The production engine is private. A $199 OSS-support SKU is help, not a license, unless the invoice says otherwise.

## Three lanes

1. **Public demo / copyleft.** pulsar is GPL-3.0-or-later. CuNi is public. The zeros demo (all-zero data → 8 bytes) is a public specialist on `POST /api/specialist`. You may run, study, and share those trees under their own licenses.

2. **Paid closed-source exception.** To ship pulsar or CuNi **inside a closed-source product**, you need a written exception. Pay the matching SKU; the invoice is the grant.

   - pulsar exception: `$490 / year` · SKU `pulsar-exception` · https://www.slidphilabs.com/pay?sku=pulsar-exception
   - CuNi exception: `$490 / year` · SKU `cuni-exception` · https://www.slidphilabs.com/pay?sku=cuni-exception

   The public tree stays GPL / public. The exception is extra permission for one closed product, one year.

3. **Hosted seat.** PCC, Chamber, Rider, Lab Pass, and related seats are **access**. You buy the right to run the product on our machines (or, for Chamber, to seal new JSON). You do not receive the production engine.

## What a pulsar exception grants

- Permission to link or embed **pulsar** (the public GPL compressor) into **one** closed-source product for **one year**.
- Decode of blobs that product wrote with that pulsar build.
- Support only if the invoice also lists a support SKU.

## What no paid SKU on this page grants

No SKU sells the production engine or its internals. You buy a seat or a written exception.

Without a matching invoice, you do not receive Combined GC, LBR1 / `splb` / ASMD, PCC encoder source, the Chamber kernel, Agent-Rider signing keys, or a right to paste a host codec (gzip, brotli, xz, bzip2) into a lab frame and call it ours.

## Hosted seats (access, not engine)

| Product | SKU | Price |
|---|---|---|
| PCC day / month / year | `gc-day` / `gc-month` / `gc-year` | $9 / $49 / $490 |
| Lab Pass year | `lab-pass` | $668 (Chamber + PCC + TruGame; not Rider) |
| Chamber month / year | `chamber-month` / `chamber-year` | $9 / $99 |

Hosted compression: first 2 GB each month are free. After that, 8¢ per GB. Card charges start at $1. A PCC plan includes more (day 10 GB, month 200 GB, year 2,000 GB), then the same 8¢. That meter pays for the machines on the PCC plan.

After Stripe, claim on https://www.slidphilabs.com/access.

## Public specialist machine

`POST /api/specialist` looks at your bytes and points you at the matching product.

- A file of zeros: compressed here, free demo, 8 bytes, original restored.
- Text you want to run yourself: download pulsar, or pay `pulsar-exception` to put it in a closed app.
- Everyday files: buy PCC. You run it on our machines. Source is dual-licensed; the PCC year seat is the closed-product grant and the hosted grant.

gzip, brotli, xz, and bzip2 are other compressors we publish numbers against. They are not included in what you buy.

## Warranty

AS IS. No warranty of merchantability, fitness, or non-infringement.
