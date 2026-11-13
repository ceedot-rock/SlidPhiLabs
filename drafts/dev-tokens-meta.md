# Developer tokens request — Meta (Llama API)

Status: DRAFT, unsent. Send from corey@slidphilabs.com to the Llama
startup / research-credits contact. Replace [brackets] before sending.

---

Subject: API credit pilot for an open-core agent lab running 9 production seats on Llama-class models

Hi Meta team,

Slid Phi Labs builds open-core agent infrastructure (AGPL-3.0-or-later):
signed agent identity (Agent Rider), a 53-target exactness language
(CuNi), chapter-by-chapter learning (TeachAid), and hosted lossless
compression (PCC). Our operators talk to nine employee agents daily
through a local qwen2.5:7b-instruct box — it works, and it is the
quality ceiling on everything we ship.

What we would run on Llama API credits (90-day pilot):

| Use case | Volume | Why Llama |
|---|---|---|
| Employee chat (9 seats, grounded briefs, ~150 tokens/reply) | ~50k replies | Open weights we can also self-host; consistent behavior local↔cloud |
| tru8-chat fallback (our xAI key is at $0 credits today) | ~20k calls | Drop-in OpenAI-compatible endpoint |
| Slidphiclepedia enrichment (research pulls, cited) | ~10k calls | Long-context summarization with citations |
| Nightly eval sweeps (agent harness, pass/fail grading) | ~5k calls | Deterministic, low-temp grading |

Our measured profile: 787.7M input / 6.35M output tokens across 5
operator sessions, ~94% prompt-cache hit — we are cheap per useful
answer by construction, and we publish our eval methodology.

In return: a public pilot writeup (what broke, latency/quality deltas
vs local 7B), bug reports with reproductions, and our agent-eval
harness released open-source.

Ask: $[amount] in Llama API credits for 90 days, or startup-program
admission — whichever is the lighter process on your side.

Corey — Slid Phi Labs, https://www.slidphilabs.com
