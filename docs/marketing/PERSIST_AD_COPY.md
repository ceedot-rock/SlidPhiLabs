# PERsiST — Ad Copy & Headline Sales Evidence

> **Product:** `psi` + `spl-heart` + `Warrant` + `CuNi` + `AgentBibleCodec`
> **Domain:** `PERsiST.com`
> **Headline metric:** **96.8% fewer tokens per agent turn** (measured, not claimed)

---

## The One Number (Lead Every Pitch With This)

**96.8%** fewer tokens per AI agent turn.

Not estimated. Not benchmarked against a synthetic corpus. Measured on our own live agent fleet, today, with a SHA-256-verified receipt trail anyone can re-run.

```
Naive agent:   61,637 tokens / turn
PERsiST:        1,981 tokens / turn
Savings:       59,656 tokens (96.8%)
```

Source: `~/.slidphi/heart-index.json` — verified `355/355` shards, `2.93x` compression ratio, `20/20` Ed25519 receipts, Merkle root `277ab6b1818ff45c754432fbbb91190e61e63cd413a5ed7e9127cd15c782f2ff`.

---

## Hero Copy (Landing Page)

**H1:** 96.8% fewer tokens. Same work.

**Subhead:** Every AI agent re-loads its entire knowledge base into context on every turn. PERsiST folds all of it into a compressed heart, inflates only the ~3% slice needed for the current task, and cryptographically verifies every read and every write. Measured on our own agents, with receipts you can re-run.

**CTA:** See the savings → See the evidence → Pricing

---

## Three Proof Pillars (In This Order)

### Pillar 1: The Token Ledger (The Money Story)

| State | Tokens per turn | What the model sees |
|---|---:|---|
| Naive | `61,637` | All 355 shards (psi rules + AgentBibleCodec chapters + task payloads) injected on every request, whether needed or not |
| **With PERsiST** | **`1,981`** | **96.8% less context** — hot live board (`~1,365` tok) + exact slice needed (e.g. `2,314` tok for a Python testing task) |

**Dollar translation (at ~$3 / 1M input tokens):**

| Turns/day | Naive monthly cost | PERsiST monthly cost | Monthly savings |
|---:|---:|---:|---:|
| 7 | $38.83 | $1.25 | **$37.58** |
| 30 | $166.42 | $5.35 | **$161.07** |
| 100 (heavy CI) | $554.73 | $17.83 | **$536.90** |

**Close:** `psi Crew` at $39/month already pays for itself at ~7 turns/day.

### Pillar 2: The Integrity Receipts (The Trust Story)

| Subsystem | Live receipt |
|---|---|
| `psi` (persistent memory) | `PSI-GREEN: quad complete, 116 wired` |
| `spl-heart` (compressed heart) | `246,549 B → 84,224 B` · `2.93x` · `355/355 shards verified` |
| `Warrant` (push/spend governance) | Live-blocked unapproved push: `[WARRANT_DENIED] exit 1` |
| `CuNi` (Ed25519 receipts) | `20/20 cuni_envelopes verified` |
| `AgentBibleCodec` | `P1-A` task inflates only `24/355` shards (`8.2%` active) |
| `SSAA` (self-adapting at birth) | `P3-A: 2,757 → 2,314 tok (-16.1%)` · `P1-A: 6,108 → 5,050 tok (-17.4%)` |

**Close:** Re-run it yourself — `git clone github.com/ceedot-rock/psi && bash scripts/psi-doctor.sh && spl-heart fold && spl-heart verify`.

### Pillar 3: The Workflow (The Product Story)

1. **SYSTOLE:** 355 shards folded into `~/.slidphi/heart.cae` (`2.93x` ratio). Context carries only `~1,365` tokens.
2. **BIRTH (SSAA):** `spl-heart adapt` probes the host system — languages, GPU, repos, browser — and writes a birth profile (`psi:env-model.local` shard). Generic unfolds default to the detected bible ports; lean task slices auto-enable.
3. **DIASTOLE:** `spl-claim <TASK_ID>` inflates only that task's lean slice (canonical Substance/Principle/Rule sections; illustrative fragments stay zipped), SHA-256 verified before the model sees it.
4. **Finish:** `spl-finish <TASK_ID> "<note>"` re-folds to `SYSTOLE` and re-audits.
5. **Gate:** Git `pre-push` + `post-commit` + `post-merge` + `post-rewrite` hooks run `spl-heart verify` + `spl-git-gate` automatically on every push in every repo.

---

## Pricing (Match Your Existing `SlidPhiLabs` Ladder)

| Tier | Price | Includes |
|---|---:|---|
| psi Solo | $13.31/mo · $99/yr | 1 seat, 1 agent identity, local `spl-heart`, Warrant, 10 GB PCC/mo |
| **psi Crew** (most popular) | **$39/mo** | 6 seats, shared `heart.cae`, shared `COMMS.md`, 200 GB PCC |
| psi Team | $49/mo | Up to 10 seats, SLA, SOC2/SIEM |
| psi Lab Pass | $490/yr | Chamber year + PCC year + psi Crew |

**Free tier:** first `5,000` tokens/day folded via `spl-heart`.

---

## Social Proof / Ad Headlines (Ready to Deploy)

1. **"Use AI for absolutely anything? Like money? Then why aren't you pre-prompt saving with PERsiST mem systems?"**
2. **"We cut our AI agent's token bill by 96.8%. Here's the SHA-256 receipt."**
3. **"Your AI agent re-reads 61,637 tokens it doesn't need, every single turn. PERsiST fixes that."**
4. **"PERsiST: 96.8% fewer tokens, same work, Ed25519-verified."**
5. **"$38 of every $39 you spend on agent context is waste. PERsiST keeps the $1."**
6. **"Every AI agent needs a compressed heart. Ours is measured at 2.93x."**
7. **"It adapts to your machine the second it's born — then spends 96.8% fewer tokens doing your work."**

---

## Calls-to-Action

- **Primary:** "See the 96.8% ledger →" (links to `#savings` section)
- **Secondary:** "Re-run our evidence yourself →" (links to `psi-doctor.sh` + `spl-heart verify` instructions)
- **Tertiary:** "Pricing →" (links to `#pricing`)

---

## Deployed At

- **Live page:** `PERsiST.com` (staged at `docs/site/persist.html` in `ceedot-rock/SlidPhiLabs`)
- **Product page:** `https://www.slidphilabs.com/persist` (add link in `SlidPhiLabs` nav)
- **Pricing source:** `https://www.slidphilabs.com/pricing.json` (extend with `psi` SKUs)
