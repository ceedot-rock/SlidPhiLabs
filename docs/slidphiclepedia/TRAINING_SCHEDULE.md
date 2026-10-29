# NCA training schedule — all projects, grounded in the Slidphiclepedia

Doctrine (binding): NCA are helpers — match, route, gate, watch, grow —
never the packer. DECODE_OK inviolable. Sources: `cheatsheets/laws.md`,
`cheatsheets/nca-doctrine.md`, `cheatsheets/textnca.md`, corpora manifest.

Data index: `corpora/manifest.jsonl` (1,192 text files, ~9.3MB, sha-pinned).
Book: `corpora/book/` (16 chapters, canonical training copy).
Tavily pulls: `pulls.jsonl` (38 records and growing, append-only).

## NCA uses by project

### SlidPhiLabs / PCC / spl-heart / PERsiST

- Staged-code readout: coarse code from narrow stages, refinement from wide
  (probe: stage-R² 0.31→0.33→0.68→1.0). Next: bitrate test.
- Shard-dedup matching over the 355 heart shards (probe margin 0.027→0.647).
- Narrow-to-wide retrieval schedule in PERsiST (no training needed).
- Sentinel/inhibitor/cheap-gate Autonoma stay; NCA advises, Warrant decides.

### psi (memory + repair)

- Memory-tissue experiments: grown vs static slices, ledger-scored.
- Drift/depwatch/contradiction-hunt as matching tasks (proven track).
- observatory.jsonl + surprises as training sequences for toy-train phase.

### cuni (exactness)

- NCA-emitted code must pass `cuni check`/`prove` like any emitter output.
- Grammar-constrained parsing probes on cuni examples (parse track 0.82→0.95).
- Java-UTF8 precedent: locale/box robustness gates apply to NCA tooling too.

### conductor (review)

- Duplicate-diff matching on task branches; risk routing with
  query-protected design (naive in-context iteration scored 0.75→0.23 — banned).
- NCA signals are advisory to the review pass, never merge authority.

### AgentRider (swarm + DMs)

- DM/task duplicate matching; task-claim matching; trust-routing signals.
- DISCO-angle eval: measure emergent specialization across Rider task swarms,
  CuNi receipts attached. No central gate required.

### Tavily intake + posting bot

- News-dedup matching on every pull before it enters the pedia.
- Topic routing to channels (query-protected); article-to-brief parsing.
- Pedia ingest itself runs the matching gate (no dup pulls).

## Training schedule

### Phase 0 — substrate + probe (DONE 2026-10-28)

Build `experiments/textnca-cell/`: faithful eq. 5-6 cell, 4-track
grown-vs-static probe. Exit: mechanics run, verdicts recorded.

### Phase 1 — matching prototype on real shards

Data: pedia corpora (psi 142 files, pedia pulls) + 355 heart slices.
Task: near-dup detection, precision/recall vs difflib baseline.
Gate: beat baseline by 2x margin; wire into depwatch + pedia ingest.
Compute: this box, CPU minutes.

### Phase 2 — parsing probes on code

Data: cuni examples + AgentBibleCodec notations.
Task: structure classification grown vs static (replicate 0.82→0.95, then
harder grammars). Gate: two grammar families won. Compute: CPU.

### Phase 3 — toy-train the denoising cell

Data: `corpora/book/` chapters as training sequences (the book trains the
tissue — fitting), plus psi observatory lines.
Method: denoising objective + stochastic iteration counts (paper §training),
numpy/CPU at toy scale (d≤64, seq≤64).
Gate: recovery % turns positive at all three noise levels; static beaten.
Doctrine check: tissue never emits bytes into any codec path.

### Phase 4 — staged-code bitrate

Data: silesia-true8 + agent-corpus refs (manifest), PCC as the packer.
Task: coarse code from narrow stages + refinement; measure bits saved at
equal reconstruction, DECODE_OK enforced by construction (NCA outside coder).
Gate: positive bits saved on two corpora or documented negative.

### Phase 5 — query-protected routing

Data: pedia pulls topic-routing (38+ records, labeled by note field).
Task: route queries to topics/slices with the query frozen; refine weights
only. Gate: accuracy ≥ static 0.75 with margin growth like matching.
Banned: naive in-context query iteration (measured 0.75→0.23).

### Phase 6 — Rider swarm eval

Task: post measurement tasks, record specialization index across seats with
CuNi receipts; DISCO comparison write-up.
Gate: specialization measured on a live swarm or documented null.
Cost: board credits + USDC hops — operator approval per spend.

## Standing gates (every phase)

1. Doctrine check: helper-only, DECODE_OK, no secrets/payment iteration.
2. Numbers in the experiment README before any claim leaves the box.
3. Pedia updated: new Tavily pulls appended; new corpora hashed into manifest.
4. No phase starts while its data line in this schedule is red.
