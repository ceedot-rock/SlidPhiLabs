# Compression — operator manual

Owner of PCC / TRUSTREAM / pulsar in **Slid-Phi-Labs/SlidPhiLabs**. See
[CHARTER.md](CHARTER.md) for the mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/compression
python runner.py status
python runner.py verify
python runner.py price-check
python runner.py ledger 5
python -m unittest tests.test_runner -v
```

`verify` runs the codec tests (`test/pccz.test.mjs`,
`src/consolidator.test.mjs`). `price-check` compares the meter (1 GB
free, $0.25/GB, $0.20 bulk) across `package.json`, `README.md`, and
`docs/site/pricing.json` — drift fails loudly, never ships silently.

## Layout

- `runner.py` — status, verify, price-check, ledger.
- `scope.json` — warrant: owned paths, meter truth, verify commands.
- `ledger.jsonl` — receipt per action. Auditability first.
