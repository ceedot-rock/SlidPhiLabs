# GitHub Engineer — operator manual

Full-stack employee for **Slid-Phi-Labs/gitdepot-hub**. See
[CHARTER.md](CHARTER.md) for the mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/github-engineer
python employee.py triage
python employee.py review 12
python employee.py draft 34 --title "Fix blob write" --body "What changed and why"
python employee.py approve 12 --by Corey
python employee.py merge 12 --by Corey --confirm
python employee.py ledger 5
python -m unittest tests.test_employee -v
```

Merge refuses without all three: approval receipt (`approve --by`),
`--confirm`, and green `gh pr checks`. Anything aimed at another repo
refuses by warrant. Auth is `gh`'s own login — never put a token in here.

## Layout

- `employee.py` — the loop: triage, review, draft, approve, merge, ledger.
- `github_adapter.py` — thin `gh` wrapper (subprocess, stdlib only).
- `repos.json` — warrant: the one repo and the merge preconditions.
- `approvals/` — human signatures per PR. Created by `approve`.
- `ledger.jsonl` — receipt per action. Auditability first.
