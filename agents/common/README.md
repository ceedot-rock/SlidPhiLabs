# Common — shared AcN + PSI sidecars

Single-source modules every lab runner imports (path-relative, no installs):

- `acn.py` — seat discipline: load `seat.json`, warrant checks,
  spend-cap checks, seat status, AcN receipts into the ledger.
- `psi.py` — experience memory: `remember(home, d, c, o)` appends a
  lesson to `observatory.jsonl`; `recall(home, n)` reads them back.

Import from any runner:

```python
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import acn
import psi
```

Conventions: seats ship spend-closed (`cap_usd: 0`); keys ride env
(`SPL_ACN_KEY`), never the repo; failures teach — every refused or
failed action also calls `psi.remember`.
