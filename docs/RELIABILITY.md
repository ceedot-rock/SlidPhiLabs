# Reliability posture: capacity and recovery (LAB50 steps 31–32)

Single operator, no standby hardware. This file states what is accepted and
what waits on a spend go — it does not imply coverage that has not been
drilled. See also [INCIDENT-RESPONSE.md](INCIDENT-RESPONSE.md).

## 31. Paid-surface machines: accepted downtime (runbook option taken)

- Today: one Fly machine (`spl-slidphilabs`, `min_machines_running = 1`,
  `auto_stop_machines = "off"`), one 1 GB volume (`spl_auth` → `/data`).
  A host failure or bad deploy drops paid traffic until redeploy or Fly
  reschedules.
- Accepted: brief paid-surface downtime on single-machine failure. Rationale:
  current paid volume does not justify standby spend; the uptime workflow
  (`.github/workflows/uptime.yml`) files an issue within the hour, and the
  deploy log gives a known-good SHA for `fly deploy` rollback.
- To close 31 with hardware instead: provision a second machine in `iad`
  (`fly scale count 2` or a standby in `fly.toml`). That is a spend go —
  requested, not taken.

## 32. Off-Fly backup: OPEN, drill defined, destination needed

- Today: Fly volume snapshots exist (provider schedule); no off-Fly copy, no
  restore drill. Recovery point is unproven — the incident card says so.
- Drill when a destination is approved:
  1. Copy `/data` (auth DB, ledger) plus the sales-ledger export off-Fly
     (owner box or object storage — needs the per-item go).
  2. Restore into a clean volume.
  3. Done when the restored ledger reproduces a known SHA-256 (step 32's
     check), receipted here with the date.
- Until then: do not promise a recovery point.

## 37. Depot data (tracks step 37)

- `gitdepot-hub` honors `GITDEPOT_DATA` (default `./data`). `fly.toml` now
  declares a `[mounts]` volume and sets `GITDEPOT_DATA` to the mount path;
  creating the volume (`fly volumes create`) is the remaining provider step.
- Restart durability is proven by `test_depot.py::test_restart_preserves_blobs`
  (publish → kill → restart → fetch identical bytes).
