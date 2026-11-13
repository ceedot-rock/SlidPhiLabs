# Lab Advisor — operator manual

Corey's personal lab assistant. See [CHARTER.md](CHARTER.md) for the
mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/advisor
python runner.py triage
python runner.py advise money
python runner.py deploy teachaid --by Corey --confirm
python runner.py ledger 5
python -m unittest tests.test_runner -v
```

`triage` sweeps every repo's git state plus every agent's ledger tail.
`advise` points at doors and never acts. `deploy` runs allow-listed
commands only (see `scope.json:deploys`) with `--by` + `--confirm`.
There is no spend command: purchases and paid tiers always stop and ask.

## Layout

- `runner.py` — triage, advise, deploy, ledger.
- `scope.json` — warrant: repos, deploy allow-list, doors.
- `ledger.jsonl` — receipt per action. Auditability first.
