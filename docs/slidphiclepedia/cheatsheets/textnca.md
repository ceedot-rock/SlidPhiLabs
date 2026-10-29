# TextNCA — equations and honest results

Source of record: TextNCA, EMNLP 2026 Findings (pedia pulls + methods extract).

## Update (paper eq. 5-6)

Per stage k, own params θk = (Perceive_wk, LNk, FFNk, Gatek), Ts iters:

    u = FFN_k(LN_k(Perceive_{w_k}(h)))
    h <- Gate_k(h, u)

1D causal windowed attention replaces 2D convolution; GRU gate replaces
fire rate; in-place; no reset between stages.

## Config

K=3 stages, windows [8,32,128], Ts=4 (12 steps). Chosen by architecture
search over schedules, stage counts, iteration counts.

## Honest results (do not overclaim)

- Trails Transformer-6L: 60.3 vs 52.8 PPL. Probe, not replacement.
- Narrow-to-wide schedule is THE result: reorder/flatten costs +16.7–70.8 PPL.
- Iterated weight sharing: no reliable PPL gain over non-iterating control.
- Self-repair after hidden-state corruption: WORKS (remaining iterations
  recover loss). Repair is learned (stochastic iteration-count training).

## Lab replication (experiments/textnca-cell, random weights)

- Mechanics run; untrained tissue diverges (recovery -516%/-46%/+7%).
- 4-track probe: parse 0.82→0.95 pursue; match 0.027→0.647 pursue hard;
  route 0.75→0.23 stop naive; compress stage-R² 0.31→0.33→0.68→1.0.
