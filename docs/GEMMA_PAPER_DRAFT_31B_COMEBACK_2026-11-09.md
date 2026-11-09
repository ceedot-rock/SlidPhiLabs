# The Model Is the Variable: A 31B Minimal Agent Tree Triples the Lab's BENCH10 Floor

*SlidPhi Labs — Gemma 4 Developer Agent paper track submission. ≈1,100 words.*

## Abstract

We report the first 31B measurement of any SlidPhi Labs agent tree: a minimal, clinic-off configuration retargeted from E4B to `gemma-4-31b-it-qat-w4a16-ct` with every other variable held byte-identical. Run as a committed batch kernel (Python 3.12 pinned image, 4×L4, offline vLLM serve), it resolved **3/10 BENCH10 tasks** against an E4B floor of 1/10. Under our pre-registered read (≥3/10 promotes), the 31B minimal tree becomes the **main-final candidate** for the Dec 2 deadline, pending BENCH20 + holdout-10 confirmation. We also document the two infrastructure failures that preceded the scored run and their fixes, since both are load-bearing for anyone reproducing batch work on this competition.

## 1. Introduction

Our lab's best public score (0.05) came from the untouched sample's 31B configuration, while our scored clinic entry ran E4B and posted 0.03. No lab-built tree had ever been measured on 31B, so the "model term" behind the sample's lead was an untested hypothesis (fix-program/REGRESSIONS.md R1). This paper tests exactly that term: one tree, two model sizes, everything else frozen.

## 2. Method

**The tree.** `submission/` minimal, clinic-off: sample-conformed prompts, a single repro-first skill, one sub-agent, the control budgets and sampling. The only functional change vs `submission/` is the model line (`gemma-4-e4b-it-qat-w4a16-ct` → `gemma-4-31b-it-qat-w4a16-ct` in `agent.yaml` and `sub_agents/code_analyzer.yaml`). Prompts, skills, `eval_config.yaml`, and `configs/sampling.yaml` are byte-identical to `submission/` and to the C1 control (sha256-asserted at staging: system.md `c135a54e…`, sampling `ab1f0af3…`, eval_config `b34fb471…`). No adapters bound. The tree validates VALID under `scripts/validate_submission.py`.

**Budgets (identical to controls).** 300 s eval timeout, 60 tool calls, 15 min cap, 200 turns per task.

**Driver.** The swegemma Evaluator — the same driver as the C1 control and the adapter-v1 run. Ten BENCH10 fastapi tasks with canonical target counts derived in a fixed pre-flight cell (snapshot `.tgz` discovery, exact-HEAD assert, phase2 fallback with content arbitration).

**Batch protocol.** Committed Kaggle kernel, never interactive: Python 3.12 image pinned 2026-06-30, GPU L4 ×4, internet OFF, all inputs hash-asserted before serving. vLLM serve of the stock 31B base at `gpu_memory_utilization=0.90`, `max_model_len=32768`, tensor-parallel 4, then the Evaluator over the staged tree.

## 3. Controls

| Arm | Model | BENCH10 | Detail |
|---|---|---|---|
| C1 (a1-clinic) | E4B | **1/10** | 187 calls, 1,821 s; solved fastapi_9753 |
| Baseline (`submission/`, BENCH20 subset) | E4B | **1/10** | shared-task aggregate |
| Public reference (untouched sample) | 31B | 0.05 public | different split (~120 tasks); context only |

## 4. The two failures before the scored run

**Fresh-notebook 3.13 trap.** A kernel created via API gets the Python 3.13 image, under which the competition wheelhouse (cp312) cannot install (`apache_tvm_ffi` rejected, whole 41-wheel install fails). The established fix, executed here: fork the pinned C1 kernel (3.12 image comes with the copy), import the 9 cells, attach the four inputs, commit the copy. Two dead versions on the fresh kernel preceded this; both are abandoned, private, and out of the paper's lineage.

**`ModelRegistry.keys()` AttributeError.** The scored lineage's first pinned run cleared staging, pre-flight, imports, guard, and vLLM startup (server live at 449 s), then died at 452 s on `list(models.keys())`: the installed `adk_submission-0.2.13` `ModelRegistry` exposes `list_available()` / `get()` / `__contains__`, not `.keys()` — verified against the shipped wheel source, not inferred. One-line fix plus a loud assert that the declared alias is registered. The Evaluator consumes the registry object directly (the C1 path), so no driver change was needed.

## 5. Results

`BENCH10 31B-MINIMAL COMPLETE: resolved 3/10; total tool calls 294; total duration 4043.5 s.`

| Task | Resolved | Calls | Duration | Note |
|---|---|---|---|---|
| fastapi_11194 | Yes | 47 | 475 s | canonical ×2 |
| fastapi_14458 | Yes | 18 | 414 s | phase2_fallback, sanctioned target |
| fastapi_14794 | Yes | 14 | 182 s | canonical ×7 |
| fastapi_13920 | No | 28 | 258 s | exit 1 |
| fastapi_14297 | No | 22 | 298 s | exit 2 |
| fastapi_14361 | No | 14 | 299 s | exit 2 |
| fastapi_14512 | No | 47 | 482 s | exit −1, empty patch |
| fastapi_14986 | No | 22 | 776 s | exit 1, longest task |
| fastapi_15763 | No | 60 | 468 s | budget-exhaustion shape, empty patch |
| fastapi_9753 | No | 22 | 392 s | the C1 solve; missed here |

Notably, the three solves do not overlap C1's single solve (fastapi_9753) — the model change moved capability, not just added it. The two empty-patch failures (14512, 15763) are agent-side non-starts, the largest available headroom for a follow-up configuration.

## 6. Pre-registered read and verdict

Set before the run: ≥3/10 promotes the 31B minimal tree to **main-final candidate** (model term real at this n); 2/10 provisional (BENCH20 decides); ≤1/10 rejected (E4B path keeps the slot). At **3/10 vs the 1/10 E4B floor, the read fires: the 31B minimal tree is the main-final candidate.** Required before any final lock: BENCH20 + holdout-10 on this tree. BENCH10 promotes; it does not lock.

## 7. Limitations

n=10, so single-task differences are noise — the claim is candidacy, not a projected public score. BENCH10 is all-fastapi (the dev set's shape). One scored run only; no variance estimate. The 0.05 sample reference is a different split and task set, recorded as context rather than a control.

## 8. Conclusion

Holding prompts, skills, budgets, sampling, and driver fixed, moving the minimal tree from E4B to 31B tripled resolved tasks (1/10 → 3/10). The model term is real. The main-final slot moves to the 31B minimal configuration pending BENCH20 + holdout-10 confirmation before Dec 2.

## Reproducibility record

Kernel `coreytasz/bench10-31b-minimal-pinned-batch` v2 (commit 2026-11-09T00:45:19Z, GPU L4 ×4, pinned 3.12 image, internet off). Inputs dataset `coreytasz/gemma4-bench10-31b-minimal-inputs` (private) + competition + wheelhouse + `gemma-4-31b-it-qat-w4a16-ct` model. Outputs: `bench10_31b_minimal_results.json` (`BENCH10 31B-MINIMAL COMPLETE: resolved 3/10; total tool calls 294; total duration 4043.5s`), `preflight_targets.json`, Evaluator `results/` per-task traces. Run ledger: `SlidPhiLabs/docs/lab-ledger/acn-runs/run-comeback.jsonl` (plan → dataset → fix9 → terminal receipts + psi sidecars).

---
*Follow-up work: BENCH20 + holdout-10 confirmation on this tree; retry configuration aimed at the two empty-patch tasks.*
