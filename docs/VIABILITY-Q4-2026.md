# Quarterly viability review — Q4 2026 (first review, LAB50 step 50)

Date: 2026-11-11. Previous review: none. Next review due: 2027-02-11. Owner: Corey (operator).

## Revenue: $0, by design

No live revenue. The money path is fail-closed and still gated:

- 42 SKUs mapped in `docs/site/scripts/sku-price-map.mjs`, 0 with live
  Stripe Price IDs (`stripe-prices.json`). Script fails loudly until filled.
- Refund logic is tested offline; the live test-mode refund is skipped
  until `STRIPE_TEST_KEY` is provided.
- No sale may be recorded without a Stripe receipt (sales-ledger refuses).

## Marketing analytics → position

- Published posts this quarter: 0. dev.to publish is edge-blocked (403 bot
  wall, not evaded). Hashnode PAT is dead (`nobody`). Lab login rejected.
  No adapter was written on a dead key. No invented reach.
- Position: pre-revenue, direct-traffic only. The homepage has one primary
  CTA (PCC = lead; other products labelled proof/parked, step 46).

## Uptime

- Hourly probe workflow (`.github/workflows/uptime.yml`) plus `UPTIME.md`
  incident drill; live `status.html` probes `/api/health` with checked_at.
- Backup restore drilled on temp dirs (SHA ae7fa915…, PASSED). Live-volume
  run still needs Fly access from an equipped box.

## Open security items (owner: operator unless noted)

1. Counsel-gated: liability waiver, IP assignments, 83(b) before 2026-12-04,
   patent file-or-abandon (needs lawyer/CPA).
2. `C:/Users/ptasz/data/warrant/secret.txt` vaulted but still on disk —
   delete/rotate pending owner go.
3. Owner decisions: robots.txt posture, GA4 collector removal, second Fly
   machine, backup destination, spend approvals.

## Open LAB50 steps

All 50 now have this file as their dated record except the items above,
which stay open by design until keys, counsel, or spend approvals land.
Suite: 762 pass / 1 by-design skip (refund live). Registry: both public
packages agree with local manifests on name, version, license.
