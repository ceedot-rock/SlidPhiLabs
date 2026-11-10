# AdSwarm — autonomous advertising, human-gated publishing

See [CHARTER.md](CHARTER.md) for the mission, the five seats, and the iron
gates. This file is the operator manual.

## Layout

- `runner.py` — the whole loop: review, critic, approve, schedule, publish.
- `adapters.py` — one publish interface per channel. Dry-run unless
  `ADSWARM_LIVE=1` plus that channel's credential env var.
- `campaigns/` — one JSON per campaign: verifiable claims, banned words,
  channels, length limits, cadence.
- `warrants/` — what the swarm may do per campaign. Publish always needs
  a human approval on top.
- `drafts/` — pieces with front-matter (`id`, `channel`, `claim_refs`,
  `status`). Never edited in place by another seat; revise as new files.
- `approvals/` — human signatures. Never committed with keys; names only.
- `outbox/` — dry-run publish landing zone.
- `ledger.jsonl` — receipt per action. Auditability first.

## Run

```bash
cd SlidPhiLabs/agents/adswarm
python runner.py review teachaid-launch
python runner.py critic teachaid-launch teachaid-001
python runner.py approve teachaid-launch teachaid-001 --by Corey
python runner.py publish teachaid-launch teachaid-001
python runner.py ledger 5
python -m unittest tests.test_adswarm -v
```

Publish without an approval refuses. Approval of a flagged draft refuses.
Live adapters activate per channel: dev.to is live (credential proven,
first post edge-blocked, see ledger). Other channels still need a written
adapter plus an approval, in that order, or nothing posts.

## Adding a campaign

1. Add `campaigns/<name>.json` with claims you can prove.
2. Add `warrants/<name>.json` (start from the TeachAid one).
3. Draft into `drafts/` citing claim indices.
4. Critic clean, human approval, publish.
