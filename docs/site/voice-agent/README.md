# TRU8 voice guide — LiveKit Agents worker

Voice in/out on LiveKit Cloud. STT + TTS via LiveKit Inference (covered by
the Startup Program credits). The brain is a Nebius-hosted open model over
its OpenAI-compatible endpoint, answering under `instructions.md`.

## Setup (Windows, fresh shell in this directory)

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy the keys (never in git):

```
copy .env.example .env
```

`.env` needs: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
`NEBIUS_API_KEY`, optional `NEBIUS_MODEL`.

## Run

```
.venv\Scripts\activate
python agent.py dev      # LiveKit playground
python agent.py start    # production dispatch
```

Browsers join room `tru8-guide` with a token from `POST /api/livekit-token`.

## Pending before first live call

1. Corey claims the LiveKit Startup Program (card + promo code, Nov 5 email).
2. `NEBIUS_API_KEY` from the lab's Nebius grant goes in `.env`.
3. Fly billing fixed ($77.04 declined Nov 5) before the worker deploys anywhere.

## Notes

- `instructions.md` is the voice wording of the same brain as the SYSTEM
  prompt in `api/tru8-chat.js`. Change one, change both.
- STT/TTS ride LiveKit Inference so no extra vendor keys are needed.
- `requirements.txt` pins major versions; if the resolver disagrees on first
  install, re-pin and note the working set here.
