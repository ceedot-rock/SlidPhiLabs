# textnca-cell — smallest faithful TextNCA replication (numpy, toy scale)

Paper: TextNCA, EMNLP 2026 Findings. Config mirrored: K=3 stages,
windows [2,4,8] (paper [8,32,128]), Ts=4 iters (12 steps), own params per
stage, no reset between stages, eq. 5-6 update.

## Result 2026-10-28 (random weights, no training)

Mechanics run clean. Recovery does NOT hold untrained:

| noise | dist before | dist after iters | recovered |
|---|---|---|---|
| 0.1 | 2.27 | 13.96 | -516% |
| 0.5 | 11.46 | 16.78 | -46% |
| 1.0 | 21.71 | 20.16 | +7% |

Finding: self-repair is a TRAINED property (paper used stochastic
iteration-count training), not free from the equations. Random tissue
diverges; static storage beats it. The grown-memory attack therefore
requires a training step, however small — or pivots to the paper's
strongest claim, the narrow-to-wide schedule, which needs no training.

## Next

1. Toy-train the cell (denoising objective, stochastic iters) on CPU, re-measure.
2. Retrieval-schedule A/B in PERsiST: local slice first, then wide context.

## 4-track probe 2026-10-28 (`explore_nca_apps.py`, random weights)

| track | static | grown | verdict |
|---|---|---|---|
| parse (balanced parens) | 0.82 | 0.95 | PURSUE — local iteration builds structure |
| match (near-dup margin) | 0.027 | 0.647 | PURSUE HARD — 24x margin; immediate use: shard dedup, drift/depwatch |
| route (query-to-slice) | 0.75 | 0.23 | STOP naive path — iteration scrambles query identity; needs query-protected design |
| compress (stage R^2) | 0.313 | 0.328/0.675/1.000 | PURSUE — monotone coarse-to-fine profile supports staged codes; next: bitrate test |
