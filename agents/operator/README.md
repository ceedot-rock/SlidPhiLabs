# Operator — manual

Voice-controlled hands on the Legion. Wake word: **Yolegion**.
See [CHARTER.md](CHARTER.md) for the mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/operator
python yolegion.py                 # standby for "Yolegion"
WAKE_WORD="hey lab" python yolegion.py
python -m unittest tests.test_operator -v
```

Say "Yolegion", then order: "ask compression to verify",
"open calculator", "read notes/today.md", "how's the system",
"run compression tests", "look up fly volumes", "stand down".

Mic choice: `MIC_DEVICE="Krisp Microphone" python yolegion.py`
(index or name fragment; default is the system mic).
Quiet room? `ENERGY_THRESH=0.01` (default 0.02; room reads ~0.006).
Deletes, overwrites, deploys, and anything irreversible ask for a
spoken YES first. "Shut down" quits.

Needs: mic + speakers, `CARTESIA_API_KEY`, Ollama local for chat
answers. Standby sips audio and only spends STT on loud blocks.

## Layout

- `operator.py` — wake loop, router, confirms.
- `machine.py` — closed verbs, redaction, blocklist, ledger.
- `scope.json` — wake word, apps, irreversible patterns, blocklist.
- `ledger.jsonl` — receipt per wake and acted order.
