# Software-Business Scholar — operator manual

Researches pricing, market, and competitors. See [CHARTER.md](CHARTER.md).

## Run

```bash
cd SlidPhiLabs/agents/biz-scholar
python runner.py status
python runner.py lookup lossless compression API pricing 2026
python runner.py brief competitor metered build minutes
python runner.py review
python runner.py ledger 5
python -m unittest tests.test_runner -v
```

`lookup` searches Tavily (auto-deposited to the Slidphiclepedia).
`brief` writes a cited DRAFT memo into `briefs/` — numbers carry
source + URL + date, and nothing reprices from a memo.

## Layout

- `runner.py` — status, lookup, brief, review, ledger, seat, recall.
- `scope.json` — warrant: `briefs/` takes writes, reads pinned.
- `briefs/` — draft memos. Created on first brief.
- `ledger.jsonl` — receipt per action.
