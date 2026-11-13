# Board — operator manual

`/board` starts a meeting with all agents reporting. See
[CHARTER.md](CHARTER.md) for the mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/board
python board.py meet              # interactive: reports, motions, rulings, minutes
python board.py readout           # non-interactive: print + save minutes
python board.py record minutes/<file>.md "Motion title" deferred "note"
python board.py ledger 5
python -m unittest tests.test_board -v
```

Add `--with-verify` to `meet`/`readout` to also run the slow codec and
app test suites. In chat, `/board` runs the readout, then rulings are
taken conversationally and filed with `record`.

## Layout

- `board.py` — collect, motions, chair, minutes, record, ledger.
- `minutes/` — one file per meeting. Created on first meeting.
- `ledger.jsonl` — receipt per meeting and ruling.
