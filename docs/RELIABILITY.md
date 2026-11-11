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

## 32. Off-Fly backup: procedure drilled 2026-11-10, Fly-volume copy pending access

- Today: Fly volume snapshots exist (provider schedule). The restore
  procedure is proven by `docs/site/scripts/backup-drill.mjs` (seed labeled
  DRILL records via the real `recordSale` writer → copy off-volume with a
  SHA-256 manifest → restore into a clean directory → hashes must match).
- Drill receipt 2026-11-10 (owner-box destination, zero spend, temp dirs):
  3 DRILL records, 417 bytes, known SHA-256
  `ae7fa915da87a9e93f13fcc498fff5aef72ac92a27fc4b72357300595535e459` —
  restored copy reproduces it exactly. Drill PASSED.
- Remaining: run the same script against the live Fly volume (`fly ssh
  console` or a volume fork) with `--source/--backup/--restore` pointing at
  real paths. That step needs Fly access from an equipped box, not new code.
- Until the live-volume run lands: do not promise a recovery point.

## 37. Depot data (tracks step 37)

- `gitdepot-hub` honors `GITDEPOT_DATA` (default `./data`). `fly.toml` now
  declares a `[mounts]` volume and sets `GITDEPOT_DATA` to the mount path;
  creating the volume (`fly volumes create`) is the remaining provider step.
- Restart durability is proven by `test_depot.py::test_restart_preserves_blobs`
  (publish → kill → restart → fetch identical bytes).
