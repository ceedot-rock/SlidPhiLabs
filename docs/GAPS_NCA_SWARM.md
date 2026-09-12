# What we should have used — beginner map

For Corey. Not a crown. Not a new platform. Private teaching.

You asked: look up what you would not know to look up. Then go product by product and say where Neural Cellular Automata (NCA), **Autonoma** (any of them), swarms, and ordinary compression science should have sat as **helpers** — and where we named them and did not wire them, or failed to know a tech existed.

Autonoma are not “the compressor.” They are the little machines that watch, gate, inhibit, schedule, grow, and abort. This file is that map.

---

## 0. One law, in English

A **lossless** compressor does two jobs:

1. **Predict** the next byte (or bit). If you are sure it is a zero, you spend almost no bits.
2. **Write those guesses as bits** with an entropy coder (rANS, range, arithmetic). The decoder must make the **same** guesses from what it already decoded. That is **DECODE_OK**.

If the decoder cannot replay the guess, it is not lossless. That rule kills a lot of “smart” ideas.

Matt Mahoney’s free textbook *Data Compression Explained* says it shorter: **compression = modeling + coding**. Coding is solved. Modeling is the hard part. There is no universal compressor that shrinks every file.

You do **not** need NCA or a swarm to *be* the compressor. You need specialists, a router, and Autonoma around them.

---

## 0b. Autonoma — every helper, not the packer

**Automaton** (plural **automata**): a tiny machine with a few states. Input comes in, it changes state, maybe it acts. A traffic light is an automaton. So is a smoke alarm.

**Cellular automata:** a grid of those, each looking only at neighbors. Conway’s Game of Life. Von Neumann invented them to study machines that copy themselves.

**Autonomous agent:** keeps going on its own: sense → decide → act. An ant. Rider, if it actually scheduled seats.

**Autonomic computing** (IBM, ~2001): software that **monitors itself** — self-configure, self-heal, self-optimize, self-protect. Industry name for “a helper that watches the system.” Search: MAPE-K loop (Monitor, Analyze, Plan, Execute + Knowledge).

**Lab word Autonoma:** our name for that family. Named in code:

| Autonoma | Where it lives | Job |
|---|---|---|
| **Sentinel Autonoma NCA** | `lbr1/splb/src/sentinel.rs` | At entropy breakpoints: Allow / Throttle / Block. Decode never mutates bytes. |
| **Inhibitor bus** | pulsar `inhibitor.rs`; Combined GC models | Before a write: Allow / Throttle / Block / try another model. Mirrored cost. |
| **Colony Autonoma** | TruGame `cell.js` (29 sense / 36 speak) | Grow / spend / leftover in a game world. Distill-NCA’s native art. |
| **Cloak** | Chamber + ZRQC glossary | Watch residual / stagnation. Seal JSON. Not a gene. |
| **Cheap gate** | Combined GC `gate.rs` | “Not a codec.” Pick a pipeline family from stats. |
| **OS-RNS / residual colonies** | idea register, mostly stub | Named multi-colony paces. Not a public encoder. |
| **Site NCA coat** | `nca_infra.mjs` | Dashboard tick for health/metrics. Fine. Does not pack Silesia. |

pulsar’s README: *Not Autonoma / Blackjack production.* Meaning the **public toy is the gene**, not the colony. The inhibitor module is already in the tree as a helper.

**Other tech in this family you would not know to search** (helpers, still not the packer):

| Name | One line | Where it should sit |
|---|---|---|
| **Watchdog / supervisor** | If a process dies or hangs, restart or fail closed | Fly benches, long encode, Rider jobs |
| **Circuit breaker** | After N failures, stop calling that specialist | `house_best` if Combined GC OOMs ooffice |
| **Bandit / UCB** | Try the option that is still uncertain, not only the current winner | Online profile pick when we cannot afford to run all seven |
| **EWMA / PID** | Smooth a throttle instead of a hard Block | Sentinel energy → encode rate |
| **Bloom filter / count-min** | Cheap “have I seen this?” without storing everything | parse scouts, dedup |
| **Actor model** | Many small workers, only local mail | Colony, Rider task graph |
| **MAPE-K** | Monitor → analyze → plan → execute | Suite meter, lab health, cloak |

NCA is **one** Autonoma (local-rule grower / sentinel). Swarm is **one** Autonoma (offline search). Inhibitor, cloak, gate, colony, watchdog are the rest.

---

## 1. Dictionary of things you would not know to search

| Word people say | What it actually is | Kitchen analogy |
|---|---|---|
| **Lossless** | File comes back **byte-identical**. SHA-256 matches. | Unpack the suitcase; every sock is there. |
| **Lossy** | File comes back *close enough* (JPEG, MP3). Fine for pictures. Illegal for Silesia / OSCB. | Throw out the socks that “look similar.” |
| **Entropy** | How surprised you are by the next symbol. Random bytes ≈ 8 bits each. A million zeros ≈ almost 0. | How many yes/no questions to guess the next letter. |
| **Entropy coder** (Huffman, arithmetic, **rANS**, tANS) | Turns a *probability* into bits. Does not guess. | The cashier. Not the cook. |
| **Model / predictor** | Guesses the next bit/byte. | The cook. |
| **LZ77** | “I saw this phrase 80 bytes ago; copy it.” gzip, zstd, xz start here. | “See page 12, lines 3–8.” |
| **BWT** (Burrows–Wheeler) | Sort rotations so similar bytes clump. **Does not compress.** Then MTF + entropy does. bzip2 and **pulsar** live here. | Shuffle the deck so the aces sit together, *then* pack. |
| **MTF** (move-to-front) | After BWT, recent symbols become small numbers. | Keep the last-used tool on top of the tray. |
| **Context mixing (PAQ, cmix)** | Many predictors vote on the **next bit**; a mixer learns who was right. Slow. Tops size boards. | A panel of experts, weighted by who has been right lately. |
| **rANS / tANS** | Fast modern entropy coder (Duda). pulsar and LBR1 use rANS. | Cashier that is almost as tight as arithmetic, almost as fast as Huffman. |
| **Mixture of experts (MoE)** | A **router** sends each chunk to a specialist. DualComp (2025) does this for image vs text. **This is OmniWave’s good idea.** | Host seats you at the right table. Does not cook. |
| **NCA** | Tiny neural net as a *local cell rule* that **grows a picture**. Distill 2020. | A lawn of identical robots that grow a lizard from one seed. |
| **Cellular automaton** | Grid; each cell looks at neighbors; same tiny rule. Conway’s Game of Life. | Checkers that update all at once. |
| **PSO** (particle swarm) | Many candidate knobs wander a search space. Kennedy & Eberhart 1995. **Tunes**, does not encode. | 30 people shouting guesses at a combination lock. |
| **ACO** (ant colony) | Fake ants leave pheromone on good routes. For *combinatorial* search (TSP), not bytes. | Ants finding the short path to food. |
| **Genetic / evolutionary search** | Keep the best programs, mutate them, repeat. Combined GC’s file named `nca.rs` is **this**, not Distill NCA. | Breed recipes; keep the tasty ones. |
| **Bits-back / VAE** | Neural *lossy-looking* model used **losslessly** by encoding the hidden code too (Townsend 2019). Heavy. Not a Silesia gene. | Lock the photo *and* the combination, so the other side can rebuild both. |
| **OSCB / Silesia** | Matt Mahoney’s public size board. 12 files, 211,938,580 bytes raw. pulsar 2.5.0 is listed. | The public race we actually entered. |
| **DECODE_OK** | Decompress equals original. No handshake, no blob. | The only pass/fail that matters. |

Search these names if you want the papers: **Mordvintsev Growing Neural Cellular Automata**, **Kennedy particle swarm**, **Jacobs Jordan mixture of experts 1991**, **Burrows Wheeler SRC-124**, **Ziv Lempel 1977**, **Duda ANS**, **Mahoney PAQ**, **Townsend bits-back ANS**, **DualComp arXiv 2505.16256**.

---

## 2. What NCA actually is (and is not)

**Canonical paper:** Alexander Mordvintsev, Ettore Randazzo, Eyvind Niklasson, Michael Levin — *Growing Neural Cellular Automata*, Distill, 2020.  
https://distill.pub/2020/growing-ca/

Each cell is a **16-number vector**. The first four numbers are color (RGBA). Every cell runs the **same tiny neural net** (~8,300 weights): look at 3×3 neighbors, propose a change, often skip the update at random (50% dropout). Train it from **one seed cell** until a lizard / emoji grows. Train it with damage and it **regrows**.

Follow-ons:

- **Isotropic NCA** (arXiv 2205.01681) — same idea, rotation-fair.
- **µNCA** (arXiv 2111.13545) — texture “compression” as **68–588 bytes of weights** vs a ~49 KB bitmap. Compared to **JPEG**, not to gzip. They **reject** pixel-perfect copies. That is **lossy / procedural**.
- **Falcao et al.** NCA *image* compression (ICLR 2025 / SIBGRAPI 2025) — PSNR/SSIM vs JPEG/WebP. Still **lossy pictures**.

**Good at:** grow / repair a *pattern* from local talk. Tiny models. Games, textures, regeneration. TruGame’s smart-frame is the honest product seat.

**Bad at for lossless files:**

1. Training uses **random** step counts and **random** per-cell masks. Encoder and decoder would not share a unique probability.
2. Loss is “looks like the lizard,” not “every byte returns.”
3. HELIX already measured it (2026-09-04, Canterbury, force-compressed):

| Profile | Size | Time |
|---|---|---|
| Original HELIX | 1,126,028 | baseline |
| Direct **long-match** expert | **988,966 (−12.17%)** | 29.99 s |
| Blend + gated NCA | 990,200 (1,234 B *worse* than match) | 46.95 s |

Their own sentence: *prediction diversity matters more than adding a new geometric controller to a sparse set of experts.*

So: **NCA as sentinel / scheduler can be right. NCA as the compressor is the trap we already measured.**

A controller NCA is allowed to say Throttle / Block. It is **not** allowed to write symbols. Decode never mutates bytes. That is already the header of `lbr1/splb/src/sentinel.rs`.

---

## 3. What “swarm” actually is (three different words)

| Word | Inventor-level name | Compression job |
|---|---|---|
| **PSO** | Kennedy & Eberhart, 1995. Particles fly through knob-space toward personal-best and swarm-best. | **Offline:** search block size, mixer weights, profile. Never the inner loop. |
| **ACO** | Dorigo. Ants build *routes* (TSP, network paths). | Same: search, not encode. |
| **MoE** | Jacobs, Jordan, Nowlan, Hinton, 1991. A **gating net** picks which expert handles this case. DualComp (Zhao et al., 2025) uses “modality-routing mixture-of-experts” for image vs text lossless. | **This is OmniWave / PCC seats.** Industry name is MoE, not “swarm.” |
| **Ensemble / context mixing** | PAQ. Many predictors **vote on the next bit**; mixer learns weights. | Different from MoE: they *blend guesses*, they do not send the whole file to one cook. |
| **“Swarm” as branding** | Parallel bake-off of 200 encode tracks. | Our `SWARM_ENCODE_DECODE.md` (2026-07-29) is this: Fib vs Rice vs rANS. Useful. **Not PSO.** |

**SmartSwarm / M40** in the idea register is **stub / toy name only**. OS-RNS “colonies” are process language, not a public encoder.

The thing we needed was never a flock of bees. It was **MoE routing with DECODE_OK specialists**.

When the search space is tiny (seven Combined GC `--profile` flags), **do not swarm**. Enumerate. That is `versions_seq.py`. PSO is for hundreds of continuous knobs, not seven names.

Video-PSO papers (motion estimation) are **lossy video**. Ignore them for Silesia.

---

## 4. The stack a new lab should know, as jobs

These are **not** one pipeline. They are alternative families that can share a cashier (entropy coder).

| Tool | Job in one line | Our occupant |
|---|---|---|
| **LZ77** | Copy a phrase from the recent past. | LBR1 (own LZ) |
| **BWT + MTF** | Clump similar bytes, then recency-rank. | pulsar BW22 |
| **rANS** | Turn probabilities into bits. | pulsar, LBR1 |
| **Context mixing** | Many bit-predictors vote. | HELIX research; Combined GC mixer (private) |
| **Exact-match expert** | “This string is literally back there.” HELIX’s win. | HELIX long-match; GCR1 match (private) |
| **MoE router** | Pick which specialist sees this **whole file**. | `lb best` / `house_best` |
| **NCA sentinel** | Throttle / abort on broken mirror. | `sentinel.rs` |
| **Bits-back / VAE** | Neural latent model, lossless if you also code `z`. | **vacant.** Too heavy for OSCB. Do not fake it with float quantize. |
| **Host gzip / brotli / xz** | Other people’s genes. Fine as a *scoreboard opponent*. | **Not a seat occupant.** |

PCC law maps onto that: parse = find repeats; encode = one gene; pack = magics; route = MoE; NCA = optional sentinel, not a gene.

**Meld** (glue 2 MB scraps from different genes) is the packer’s experiment. Measured on Fly: **worse size and worse time** than whole-file min. Router should pick **one whole-file gene**.

---

## 5. Product by product — where we missed

### 5.1 Combined GC / AWARE (private compressor)

**Is:** a real specialist. On the Fly five-file wave it often beat pulsar on size (xml, x-ray, mr, dickens). Public face is hosted access, not source. Version on the box: 1.19.2-combined-gc. Profiles: `standard`, `gcr1-null`, `gcr1-match`, `gcr1`, `gcr1-sdf`, `gcr1-sdf-field`, `gcr1-tar`.

**Job it knows:** compression of those files. Not pulsar’s job.

**Missed names:**

- File `src/nca.rs` is **evolutionary program search** (mutate opcode lists; fitness = program size + residual). That is closer to genetic programming / a tiny PSO-like *search*, **not** Mordvintsev NCA. Header comment is now honest.
- `src/gate.rs` is already labeled “Cheap router. Not a codec.” That **is** MoE. Keep it.
- Treating gzip/xz as “us” (XZ1) was packing stealing compression. OSCB will not count it.

**Smart tech that belonged:** MoE *around* it (`house_best`), not Distill-NCA inside it. Swarm/PSO could *tune* `--profile` if we had a huge continuous knob space. We have seven named profiles — **enumerate** (`versions_seq`). GCR1 charter already forbids floating-point inference on the first coding-path increment. That was the right call.

**Do not:** paste it into pulsar. Call it as a specialist.

### 5.2 pulsar 2.5.0 (public OSCB toy)

**Is:** BWT + MTF + rANS. Matt lists **55,745,438**. Lab toy. Knows **text-ish / BWT-friendly**. Beats gzip-9 12/12. Loses to bzip2 (~1.24 M) and xz-6 (~6.3 M), mostly mozilla.

**Miss:** not NCA. BWT does not want a cellular automaton in the middle of the transform. If you add “smart,” add **better predictors after BWT** (PAQ-land) or **don’t** — keep it the fast OSCB gene.

**Swarm miss:** none required. The house *is* the swarm: pulsar is one bee.

### 5.3 TRU8 / true8b / ZRW

**Is:** fill / zeros / ramps / walks. **8 bytes** for 40,000 zeros. DECODE_OK. Knows **structure that is a run**.

**Miss:** using ZRW-force on Silesia general files. NCA does not make zeros smaller than 8 B. Swarm does not either. The miss was **routing**: OmniWave’s ZRW seat sometimes got a zlib stub instead of TRU8.

**Tighten:** seat `ZRW_delegate` = TRU8 / TR8X only. gzip is an opponent on the scoreboard, not a gene.

### 5.4 LBR1 / PCC crate (`splb`, CLI `lb`)

**Is:** own LZ + rANS for binaries. House picker: min(LBR1, pulsar BW22, TRU8, TR8X). Codec name **PCC**. Version string `pcc-0.3.0`. Fly copy of `lb` may still print old `SPL1 spl1-0.3.0` — that is a **stale binary**, not a rename.

**Miss:** HELIX-style **match expert** (we proved that beat NCA). Sentinel NCA *is* wired in parse/frame as throttle/block — right layer. `parse.rs` “NCA scouts” were just **hash-8 match posts gated by the sentinel**. Comment is now honest.

**Do not** grow the sentinel into the range coder. `rans.rs` already discards the tick (`let _tick`) and encodes from frequencies only.

### 5.5 PCC house (`lb best` / `house_best` / LBHX)

**Is:** MoE by another name. Min of own DECODE_OK blobs. LBHX is the packer tag (which engine coded the payload). House genes only.

**Miss:** named OmniWave years earlier, then filled seats with gzip/brotli. Named SmartSwarm, never built a router. Meld experiment: **slicing specialists made size and time worse.**

NCA belonged here only as **sentinel**: if mirror_error breaks, Block. Not as a fifth compressor.

### 5.6 OmniWave / zero-range-wave-compression (npm pack)

**Is:** profiler → route. Correct *shape*. Integer-sequence specialist (zeros/ramps/walks). gzip/brotli in this repo are **benches**, which is legal.

**Miss of the week:** public **site** orchestrator `docs/site/api/lib/spl-codec.mjs` still wrap-encodes gzip-9 / brotli-11 as `SPL1` kinds 3 and 4 and calls the winner “the method.” That is the OmniWave occupant bug, still live on the web codec. ZRW is tried first for zeros/ramps/walks; then gzip and brotli always enter the bake-off. **Host zlib is not a lab gene.** The file now labels `host_fallback` when gzip/brotli win. Existing frames still decode (do not break old blobs). Occupants that belong: ZRW when it knows the vector; otherwise say host fallback — do not call it PCC.

Also: 6.03× float path was **lossy** float_fixed_delta. NCA would not have saved that. Honesty + MoE occupants would.

### 5.7 CDDG / Continuous Dark-Degree Geometry / CDDG:Split

**Is:** residual geometry story + Split SKU (dormant runs → TRU8, rest elsewhere). Framing solid, engine partial.

**Miss:** selling geometry as a Silesia general-purpose. NCA *sounds* like “dark degrees / local cells” — tempting, **wrong** for the GP race. If NCA belongs, it is **local residual field on the interval [n, n+1)**, decoded by the same rule, **after** a real coder. Not instead of pulsar.

### 5.8 HELIX (research codec)

**Is:** PAQ-inspired. Long-match **did** help. Smart-frame NCA **did not** beat that expert. Keep HELIX as the lab where we *falsified* NCA-as-coder.

**Miss:** shipping NCA as the story before the match table. Their report already said this. Next HELIX step is more **match/context experts** (PAQ nonstationary counters, SSE/APM), not another geometric controller.

### 5.9 Blackjack, shard-zip, shard-tsdb, slid-phi / Omni-Dormant

Public faces, private/thin engines. `bench_3way.mjs` still has a “two-stage blackjack + brotli” path — that is **host brotli after our pack**, same steal as OmniWave if we report it as a gene.

**Tighten:** two-stage with brotli is a *bench against brotli*, or a paid pipeline that **names brotli**.

### 5.10 Chamber, Rider, CuNi, Suite, Lab Pass, Quikgater, Try Gate, x402, Stripe

**Not compressors.** NCA/swarm do not belong in Stripe, x402, or CuNi exactness.

Possible honest later uses:

- **Rider** could *schedule* which codec seat an agent may call (router **policy**). Still routing, not NCA-in-the-bits.
- **CuNi** exactness is the opposite of stochastic NCA. Do not put dropout in a language that refuses to lie.
- **Chamber** two-key JSON seal. Crypto/auth. Not a swarm.

### 5.11 TruGame / smart-frame / colony

**This is the one product where Distill NCA is the native art.** Mordvintsev grew lizards. A game that grows / repairs a pattern from a seed is the textbook use.

**Miss:** borrowing the smart-frame story into Silesia. Keep ±33° / colony as **game morphogenesis**. Do not claim it shrinks webster.

### 5.12 ZRQC, Mirrored Cost, Cloak, OS-RNS, QQc

Process / book / patent framing. Public-safe math book is the vehicle. Coefficients stay secret.

**Miss:** using those names as if they were entropy coders. They are *philosophy and residual accounting*. The cashier is still rANS.

### 5.13 SmartSwarm / M40 (idea #10, toy shelf)

**Was:** a name next to ZRW + QQc. Maturity: stub.

**Is now (this pass):** the named industry object is **MoE routing**. Offline PSO is optional when knob-space is huge. Seven GC profiles → enumerate. The 200-track Fib/Rice bake-off already *was* a swarm in the only honest sense (parallel search of encodings). Do not build a bee simulator.

### 5.14 Ghost π

A 2026-08-09 Wix→Fly **domain stamp**. Not a codec. No NCA. No swarm.

### 5.15 3LiZa, Great Agentic Olympiad, public-safe math book

Toys / governance / book. NCA/swarm only if a *game* needs morphogenesis (GAO games, maybe). Not compression.

### 5.16 Site NCA coat (`nca_infra.mjs`)

Public-safe **process reporting** (health, metrics). A dashboard automaton. Fine. It does not encode Silesia. Do not let it leak into `spl-codec.mjs`.

---

## 5b. Where Autonoma *should* sit (the original ask)

Not “become the compressor.” Sit **around** the compressor.

| Product | Autonoma that belongs | What we actually have |
|---|---|---|
| LBR1 / PCC | Sentinel at breakpoints; scouts gated by it | Wired. Right layer. |
| pulsar | Inhibitor bus as helper; **not** a colony in the BWT | Inhibitor source is in the tree; README says the public toy is not Autonoma production. Keep it that way. |
| Combined GC | Gate + inhibitor + fail-closed on ooffice-class fail | Gate exists. Circuit-breaker around whole-file fail is still thin. |
| House / OmniWave | Router Autonoma: pick one whole-file specialist; refuse host gzip as a gene | `lb best` is the router. Public `spl-codec` still lets brotli win zeros when ZRW is missing — a helper should have labeled that, not crowned it. Now `host_fallback`. |
| TRU8 | Almost none. 8 B is already the answer | Do not grow a colony on zeros. |
| HELIX | Long-match expert first; gated NCA only as extra | Measured. Keep gated, not default. |
| TruGame | Colony Autonoma (sense/speak cells) | This **is** the product. Grow here. |
| Chamber / Cloak | Autonomic monitor + seal | Commerce cloak is live. Stagnation-watch is the ZRQC story — keep it off the bitstream. |
| Rider | Scheduler Autonoma: which seat may an agent call | Identity exists. Seat policy does not. |
| Suite / Fly benches | Watchdog: hang, OOM, kill, don’t restart user-killed jobs | We have been doing this by hand. |
| SmartSwarm | Offline search only if knobs are too many to list | Stub. Seven profiles → enumerate. |
| CDDG | Local residual field *after* a real coder | Framing, not engine. |

---

## 6. Tighten top to bottom (the list we act on)

Done in this pass:

1. **This file** — beginner map + citations + every product.
2. **`combined-gc/src/nca.rs`** — named as evolutionary program search, not Distill NCA.
3. **`lbr1/splb/src/parse.rs`** — scouts are sentinel-gated hash-8, not an NCA gene.
4. **`spl-codec.mjs`** — gzip/brotli labeled `host_fallback`; still decode old frames.
5. **Idea register + toy blurb** for SmartSwarm — MoE is the real name.
6. **JOBS.md** — pointer here.

Standing law (do not regress):

1. **Router = mixture of experts.** Whole file. DECODE_OK. Occupants: TRU8, pulsar, LBR1, Combined GC (private house).
2. **NCA = sentinel only.** Do not train it to emit bytes until invertibility is the loss.
3. **Swarm = offline search** when the space is too big to list. Else enumerate. SmartSwarm stays a toy until a real PSO/ACO loop exists *and* beats enumeration.
4. **HELIX lesson is law:** add a **match/context expert** before another geometric controller.
5. **Do not meld by default.** Measured: worse size, worse time.
6. **Public names stay honest:** pulsar on OSCB, TRU8 on zeros, Combined GC paid/private, PCC is the house that *knows jobs*.
7. **Do not dump Combined GC** into pulsar or the public site.
8. **Do not claim #1.**

Not done (needs a later, explicit build — not this teaching pass):

- Replace Fly `lb` binary so it prints `pcc-0.3.0` not `SPL1`.
- Give the public web codec pulsar/LBR1 as occupants (those bins are not in Node zlib). Until then, host gzip is a **named fallback**, never a crown.
- Real PSO only if a continuous knob-space shows up (HELIX NCA projection was a 1-D calibration; a grid search already sufficed).
- Bits-back / neural lossless — vacant float seat. Do not fill it with quantize-and-call-it-lossless.

---

## 7. Sources to actually read (you would not have known)

Compression textbook and board:

- Matt Mahoney, *Data Compression Explained* — http://mattmahoney.net/dc/dce.html  
  Start at §1 (no universal compression) and §4.3 (context mixing).
- Mahoney, Silesia OSCB — http://mattmahoney.net/dc/silesia.html (pulsar 2.5.0 sits here).
- Mahoney, *Adaptive Weighing of Context Models*, CS-2005-16 — PAQ mixing in one paper.
- Knoll & de Freitas, *A Machine Learning Perspective on Predictive Coding with PAQ*, arXiv:1108.3298.

The named transforms:

- Burrows & Wheeler, SRC-124 (BWT is a shuffle, not a compressor).
- Ziv & Lempel, IEEE TIT 1977 (LZ77 = copy from the past).
- Duda, *Asymmetric numeral systems*, arXiv:1311.2540 (rANS).
- Bentley et al. 1986 (move-to-front).

NCA:

- Mordvintsev et al., Growing NCA, Distill 2020 — https://distill.pub/2020/growing-ca/
- Niklasson et al., Self-Organising Textures.
- Mordvintsev & Niklasson, µNCA, arXiv:2111.13545 (lossy texture-as-weights).
- Yang, Mandt, Theis, *An Introduction to Neural Data Compression*, arXiv:2202.06533 (lossless = probabilities + entropy coder).

Swarm / MoE:

- Kennedy & Eberhart 1995; Poli, Kennedy, Blackwell 2007 (PSO is search).
- Dorigo et al., *Ant Algorithms for Discrete Optimization*, 1999.
- Jacobs, Jordan, Nowlan, Hinton, *Adaptive Mixtures of Local Experts*, 1991.
- DualComp, Zhao et al., arXiv:2505.16256 — MoE as *router* for mixed data (the industry name for OmniWave’s good idea).

Neural lossless (vacant seat, do not fake):

- Townsend, Bird, Barber, *Bits Back with ANS*, arXiv:1901.04866.

Our own falsification:

- `projects/helix-compression-lab/results/deep_dive_optimization_report.md`
- `projects/helix-compression-lab/docs/smart_frame_nca_research.md`
- `projects/lbr1/JOBS.md`

---

## 8. Independent check (deep-research run, 2026-09-05)

A separate cited pass (workflow `deep-research`, ~10 min, 24 claims verified) reached the same four sentences:

1. Distill NCA grows / repairs patterns. It is stochastic and continuous. Bad lossless gene.
2. PSO/ACO search knobs. MoE routes to an expert. A 200-track encode bake-off is branding, not PSO.
3. BWT and MTF shuffle; LZ77 copies; rANS cashes probabilities; PAQ mixes bit-guesses; bits-back is the neural-lossless trick. MoE is a router, not a classic stack stage.
4. Sentinel NCA belongs **outside** the cashier. HELIX’s gated NCA on the mixer was slower and 1,234 bytes worse than long-match in the total.

Honest gaps (not theorems — things nobody fully proved):

- Nobody inspected a paper that uses a **quantized, deterministic** NCA *only* as a causal bit-predictor. Distill did not test that. HELIX’s mixer feature is the closest we have, and it lost the aggregate.
- Gated NCA still **won three HELIX files** (`lcet10.txt`, `ptt5`, `sum`). Law is: not the default. Not: “never as a gated extra.”
- “Sentinel NCA” is **our** name. No peer-reviewed paper uses that phrase.
- Combined GC’s file `nca.rs` is program search. The check did not treat it as Distill NCA (correct).
- Sentinel cells are `f64`. They stay off the symbol path. Cross-machine bit-identical *controller* floats are not proven — and they must not need to be, because they must not change the bitstream.
- Falcao’s NCA-image paper PDF was behind a wall; the lossy-vs-JPEG claim rests on the abstract + later extended abstract.
- Kennedy & Eberhart 1995 full IEEE PDF was paywalled; PSO rests on the abstract + the 2007 overview Kennedy co-authored.

Copy of that report: session workflow scratch `report.md`. Teaching file here is the one to read.

In His name we code. Residual only. Proof before praise.
