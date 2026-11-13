# Autopilot — operator manual

Scripts so the lab's agents act on their own, inside the bounds in
[CHARTER.md](CHARTER.md). Detect runs itself; fixes run only on 2-of-3
meter consensus; everything else becomes a proposal for `/board`.

## Run

```bash
cd SlidPhiLabs/agents/autopilot
python sweep.py sweep          # one pass; exit 1 when motions remain
python sweep.py watch 60       # loop hourly until STOP file appears
python sweep.py ledger 5
python -m unittest tests.test_sweep -v
```

## Schedule (Windows Task Scheduler, nightly 03:00)

Action: `C:\Program Files\Python312\python.exe`
Arguments: `C:\Users\ptasz\SlidPhiLabs\agents\autopilot\sweep.py sweep`
Start in: `C:\Users\ptasz\SlidPhiLabs\agents\autopilot`
The exit code is 1 on nights with open motions — point the task's
alerting at that, and read `findings/` in the morning.

## Layout

- `sweep.py` — detect, meter autofix, proposals, findings, ledger.
- `findings/` — one JSON per sweep. Created on first sweep.
- `proposals/` — one file per undecided motion. Humans decide at board.
- `ledger.jsonl` — receipt per sweep, fix, and proposal batch.
