# Secret rotation inventory (LAB50 step 11)

Names and rotation dates only. Values live in the owner vault or provider
dashboards — never here, never in chat, never in git.

## Vault (DPAPI, owner box)

Managed keys include: lab Tavily pair, xAI, Cartesia, LiveKit pair,
dev.to, Hashnode, lab Solana/EVM wallet passes, Rider seats, GitDepot Hub
key, SlidPhiLabs account credential, SMTP set, Mongo Atlas set, Runpod set,
Shopify, Confluent, Gmail app password, lab warrant secret.

## Repo-adjacent (untracked by design)

- `agents/slidphi-agent/.env` — LIVEKIT_URL, LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET, TAVILY_API_KEY, LLM_MODEL, LLM_BASE_URL,
  OPENAI_API_KEY. Only `.env.example` is tracked. If this box is ever
  shared, rotate all seven.
- `docs/site/voice-agent/.env.example` — tracked template, no values.

## Repo scan 2026-11-10

Searched for live-key patterns (`sk-live`, test-key material, PEM
blocks, assigned api_key values): hits are fixtures, docs shapes, and
redacted examples only. No live secret in git.

## Rotation log

| Secret | Last rotated | Next due | Notes |
|---|---|---|---|
| xAI lab key | 2026-11-07 | on 403s | team credits $0 — purchase, not rotation, unblocks |
| Everything else | unknown | TBD | Fill dates as each dashboard rotation lands |

Rule: any secret that appears in chat, a DM, or a committed file rotates
the same day, and the exposure is receipted here with the date.
