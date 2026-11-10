# LAB50 Step 7 closeout — 100-row audit re-verification (2026-11-10)

Dual license: AGPL-3.0-or-later OR Slid Phi Labs Commercial. See /LICENSE.

## What this is

Re-verification of the 100-row lab-gaps audit against the live tree on branch
`docs/work-report-2026-11-09`. Method: 7 parallel researchers, read-only, each
row re-opened against file bodies (not grep snippets). “Observed” = a command
I ran this session with quoted output. “Inferred” = follows from code read.

## Re-verified this session (observed)

| Row(s) | Claim | Verdict |
|---|---|---|
| ledger / webhook | `hasOrderId` fail-closed, `ledger_unreadable` → webhook 500 | CLOSED — code + tests landed |
| health | `api/health.js` 200/503, no painted badges | CLOSED — `health.test.mjs` green |
| status page | live probes, `checked_at` + source URL | CLOSED — `node --check` clean |
| uptime | hourly `uptime.yml` + `UPTIME.md` drill log | CLOSED — workflow committed |
| SKU map | 42 SKUs, 0 Price IDs → script FAILs loudly | OPEN by design — Stripe dashboard work pending |
| refund | offline legs green; live leg skips without `STRIPE_TEST_KEY` | OPEN — needs test key + test PI |
| agents.json | lifetime-per-IP is canonical (`pricing.json`) | FIXED — 4 monthly remnants corrected, validated |
| secret.txt | 64 B file vaulted as `warrant-secret-txt` (metadata only, never read) | VAULTED — disk copy still present, delete pending |
| host-pulsar | archived | CLOSED — `gh repo archive` confirmed |
| legal pages | Terms / Privacy / DPA / Refund Policy + footer + sitemap | LANDED — counsel review pending (v1 templates) |
| conductor review | `conductor-review.test.mjs` 13/13 pass observed | CLOSED — “tested: no” was a stale field |
| zero-trust.mjs | string appears nowhere under `docs/` | NO ACTION — phantom claim, no caller, nothing to fix |
| conductor approve | `approveTask` did not require a recorded verdict (legacy file-store records could skip review) | FIXED — `not_reviewed` gate + seeded-legacy test, 11/11 green |

## Contradictions A–H — dispositions

- **A (concurrency-suite name):** canonical to the audit file only; no such name in
  site code. Kept as stated-in/audited. No code change.
- **B (row 37 vs conductor gate):** different surfaces — gitforge merge gate (proven,
  row stays closed) vs conductor task pipeline (hole was real for legacy store
  records). Fixed with `not_reviewed` gate. Both statements now true, no conflict.
- **C/D (robots.txt):** file is 60+ lines, dated 2026-10-15, `Allow: /` for all
  including AI trainers — while banners warn in words only. Genuine posture
  mismatch. **Decision needed (yours):** tighten robots or reword banner to match
  the open policy. No change made — discoverability is a business call.
- **E (telemetry):** no consent/configbook switch in site code; only a GA4
  server-side collector (`api/lib/ga4.mjs`, secret-injected) plus marketing prose.
  “Telemetry disabled” referred to this CLI session, not product code. Flagged, no
  change — analytics removal is a business call.
- **F (Depot push target):** tension stands — Depot named as push target while lab
  posture says externals untrusted. Needs your explicit per-item go per push.
- **G (conductor + zero-trust):** resolved — tests green, phantom file confirmed
  absent with zero references.
- **H (offline-only rows):** rows whose only gate is a skipped-unless-key live test
  stay OPEN until keys exist (SKU map, refund live, SMTP/uptime drill). No
  silent closes.

## Still open (not closed by this batch)

1. 42 Stripe Price IDs → fill `stripe-prices.json`, rerun map to OK.
2. Refund live test with `STRIPE_TEST_KEY` + test-mode PI; file receipt.
3. External 5-minute monitor + SMTP secrets; run uptime drill, link run/issue/alert.
4. Counsel packets: waiver, IP assignments, 83(b) (before 2026-12-04), patent
   file-or-abandon.
5. Robots posture decision (C/D) + GA4 collector decision (E).
6. Delete or secure disk copy of `secret.txt` after vault confirm.
7. Re-point remotes `ceedot-rock` → `Slid-Phi-Labs`; verify redirects.
8. Lab login credential invalid (4 rejections) — reset or Passkey; Hashnode PAT
   dead — fresh token + publication; dev.to 403 edge bot wall — appeal route.

## Suite state observed

- `npm run test:site`: 700 tests, 699 pass, 1 skip (refund live, no key).
- `conductor-tasks.test.mjs`: 11/11. `conductor-review.test.mjs`: 13/13.
- `npm install hashnode` (unrelated, earlier): 17 vulns (5 low / 5 moderate /
  7 high) — triage pending, left as-is.
