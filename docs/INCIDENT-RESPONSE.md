# Incident response card (LAB50 step 30)

One page. If something is on fire, work top to bottom. Values live in the
owner vault or provider dashboards — never here, never in chat, never in git.

## 1. Triage (first 5 minutes)

1. What is exposed or down? Secret leak, bad deploy, billing anomaly, or
   data loss — pick one, say it out loud, timestamp it.
2. Stop the bleeding before diagnosing:
   - Leaked key → revoke at the provider dashboard first, rotate second.
   - Bad deploy → `fly deploy` the last known-good SHA (see deploy log).
   - Billing spike → cap spend in AWS Settings > Billing, then investigate.
3. Open an incident note: date, symptom, first action, who is driving
   (default: Corey, single operator).

## 2. Revoke and rotate

| Secret | Revoke at | Rotate to | Verify with |
|---|---|---|---|
| Stripe keys | Stripe Dashboard > Developers > API keys | New key into Fly secrets / vault | `stripe prices list --limit 1` |
| Fly deploy token | Fly dashboard / `fly tokens revoke` | `fly tokens create deploy` into CI secret | `fly status -a spl-slidphilabs` |
| x402 wallet keys | Wallet provider / rotation | Vault, then Fly secrets | Test-mode payment probe |
| Depot member key | `POST /api/invites/revoke` + reissue invite | Member vaults new key | `/api/members` lists seat |
| Lab Pass / misc | Provider dashboard | Vault, then Fly secrets | Health + smoke probes |

Rule (step 11): any secret that appears in chat, a DM, or a committed file
rotates the same day; the exposure is receipted in `docs/SECRET-ROTATION.md`.

## 3. Known-good guardrails (already in code)

- Production boot with `X402_DEV_BYPASS=1` refuses (`api/lib/prod-guard.mjs`).
  Drill: boot refusal is the expected outcome, not an outage.
- Money paths fail closed: unreadable ledger → 5xx, no write
  (`api/lib/sales-ledger.mjs`).
- Paid CORS is allowlisted; foreign origins get no data
  (`api/lib/cors.mjs`).

## 4. Stop billing

- Stripe: Dashboard > Payments — refund/void the anomalous charges; for a
  runaway meter, lower the customer cap (default $25) and pause the rail.
- Fly: `fly scale count 0 -a <app>` stops machines; volumes persist.
- AWS/project spend: AWS Settings > Billing — spend limit pauses the project.

## 5. Restore data

- Fly volumes snapshot on their own schedule; verify snapshot age in
  `fly volumes list -a <app>` before trusting it.
- Off-Fly restore drill is OPEN (step 32): until it lands, a volume restore
  has not been proven. Do not promise a recovery point you have not drilled.

## 6. Communicate

- Status page (`docs/site/status.html`) shows live probe state with
  `checked_at` — fix the outage first, the page follows the endpoint.
- Uptime incidents file automatically as issues (`.github/workflows/uptime.yml`).
- Customer receipts come from the sales ledger; every refund writes a ledger
  entry (step 20).

## 7. After: blameless note within 48h

What happened, time to detect, time to fix, what caught it (human or
monitor), one action item with an owner. Append to the drill log below.

## Drill log

- 2026-11-10 — Tabletop + live-gate drill (operator: Muse Code session).
  Scenario: `X402_DEV_BYPASS=1` reaches production boot.
  Checks run: prod-guard refuses boot with `NODE_ENV=production` (observed in
  `prod-guard.test.mjs`, 3/3); `stripe` CLI present with the Slid Phi Labs
  profile in config (observed `stripe --version 1.55.8`; no live API call
  made); Depot revoke route live-tested (`test_depot.py`, 10/10).
  Gaps found: (1) off-Fly restore undrilled (step 32 open) — card states it
  explicitly rather than implying coverage; (2) no `fly` CLI on this box, so
  Fly-side revocation is dashboard-only until the CLI is installed where
  deploys run.
