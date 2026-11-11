# Builder-Law Scholar — operator manual

Researches licenses, terms, and grant language. See [CHARTER.md](CHARTER.md).

## Run

```bash
cd SlidPhiLabs/agents/law-scholar
python runner.py status
python runner.py lookup AGPL closed exception pricing
python runner.py brief unified grant for developer tools
python runner.py review
python runner.py ledger 5
python -m unittest tests.test_runner -v
```

`lookup` searches Tavily (auto-deposited to the Slidphiclepedia).
`brief` writes a cited DRAFT into `briefs/` — human approves before use.

## Layout

- `runner.py` — status, lookup, brief, review, ledger, seat, recall.
- `scope.json` — warrant: `briefs/` takes writes, reads pinned.
- `briefs/` — draft briefs. Created on first brief.
- `ledger.jsonl` — receipt per action.
