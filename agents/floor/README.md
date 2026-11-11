# Floor — operator manual

Live terminal chat + voice with all nine lab employees. See
[CHARTER.md](CHARTER.md) for the mission and iron gates.

## Run

```bash
cd SlidPhiLabs/agents/floor
python floor.py              # full floor (brief + Ollama + voice if ready)
python floor.py --text-only  # skip the slow opening brief
python -m unittest tests.test_floor -v
```

Needs: Ollama serving locally (`OLLAMA_HOST`, default
`http://localhost:11434`; `OLLAMA_MODEL`, default
`qwen2.5:7b-instruct`). Voice needs `CARTESIA_API_KEY` plus the
sounddevice/numpy/requests modules — without them the floor is
text-only and says so.

## On the phone (SlidPhiFloor PWA)

```bash
cd SlidPhiLabs/agents/floor
FLOOR_TOKEN=<long-random> python server.py 8410   # localhost only
```

Then one tunnel (install once: `winget install Cloudflare.cloudflared`):

```bash
cloudflared tunnel --url http://127.0.0.1:8410
```

Open the printed `https://…trycloudflare.com` URL on the phone,
paste the token when asked, then **Install** from the header to put
SlidPhiFloor on the home screen. Mic and spoken replies use the
phone's own speech (no keys). The tunnel URL changes on free tiers —
re-open the new URL after a restart. Nothing here survives the Legion
sleeping: server and tunnel both run on it.

## On the floor (terminal)

Bare line talks to the active seat (`/use <seat>` to switch).
`/tell <seat> <msg>`, `/all <msg>`, `/refresh` re-pulls the brief.
`/act <seat> <cmd...>` runs palette actions; writes ask YES.
`/note <text>` saves a note, `/notes` lists them, transcripts land in
`transcripts/`. `/talk <seat>` is push-to-talk, `/say <text>` speaks.

## Layout

- `floor.py` — the loop, commands, fresh brief.
- `brain.py` — Ollama chat over per-seat grounded context.
- `actions.py` — palettes, scope enforcement, gated exec.
- `voice.py` — Cartesia STT/TTS over stdlib wave.
- `notes.py` — transcripts + notes.
- `transcripts/`, `notes/` — created on first chat.
