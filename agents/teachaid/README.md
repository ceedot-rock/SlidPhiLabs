# TeachAid — operator manual

Owner of the TeachAid learning app (`teachaid` repo). See
[CHARTER.md](CHARTER.md) for the mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/teachaid
python runner.py status
python runner.py verify
python runner.py audit
python runner.py deploy --by Corey --confirm
python runner.py ledger 5
python -m unittest tests.test_runner -v
```

`verify` runs `npm test`, `audit` runs the curriculum audit, `deploy`
re-runs tests then `fly deploy`s to https://teachaid.fly.dev — and
refuses without `--by`, `--confirm`, and green tests.

## Layout

- `runner.py` — status, verify, audit, deploy, ledger.
- `scope.json` — warrant: repo dir, live URL, plan, commands.
- `ledger.jsonl` — receipt per action. Auditability first.
