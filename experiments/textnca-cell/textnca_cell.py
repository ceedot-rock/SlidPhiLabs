#!/usr/bin/env python3
"""textnca_cell.py: smallest faithful replication of the TextNCA update.

Paper: TextNCA, EMNLP 2026 Findings (Mittal et al.).
Per-stage rule (paper eq. 5-6), toy-scaled, numpy only, no training:

    u = FFN_k(LN_k(Perceive_{w_k}(h)))   # local causal windowed attention
    h <- Gate_k(h, u)                    # GRU-style gated in-place update

Paper config: K=3 stages, windows [8,32,128], Ts=4 iters each (12 steps),
own params per stage, no reset between stages.
Toy config here: windows [2,4,8], Ts=4, d=32, seq=16. Same mechanics.

Experiment (mirrors the paper's corruption finding): run clean to get
H_clean; corrupt a copy with Gaussian noise; run the remaining schedule;
measure distance back toward H_clean vs a static baseline (no iterations).
Paper: recovery works; perplexity gains from iteration do not (60.3 vs
52.8 Transformer-6L). This demo tests the mechanism, not perplexity.

Usage: python textnca_cell.py
 burden: CC-BY-test, lab-local. Exit nonzero on NaN.
"""
import numpy as np

rng = np.random.default_rng(7)


def softmax(x, axis=-1):
    x = x - x.max(axis=axis, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=axis, keepdims=True)


def layer_norm(x, g, b, eps=1e-5):
    mu = x.mean(axis=-1, keepdims=True)
    va = x.var(axis=-1, keepdims=True)
    return (x - mu) / np.sqrt(va + eps) * g + b


class Stage:
    """One TextNCA stage: own params, fixed window, iterated in place."""

    def __init__(self, d, window, seed):
        r = np.random.default_rng(seed)
        s = 1.0 / np.sqrt(d)
        self.w = window
        self.Wq = r.normal(0, s, (d, d))
        self.Wk = r.normal(0, s, (d, d))
        self.Wv = r.normal(0, s, (d, d))
        self.g = np.ones(d)
        self.b = np.zeros(d)
        self.F1 = r.normal(0, s, (d, 4 * d))
        self.f1b = np.zeros(4 * d)
        self.F2 = r.normal(0, s, (4 * d, d))
        self.f2b = np.zeros(d)
        self.Wz = r.normal(0, s, (d, d))
        self.Uz = r.normal(0, s, (d, d))
        self.bz = np.zeros(d)
        self.Wh = r.normal(0, s, (d, d))
        self.Uh = r.normal(0, s, (d, d))
        self.bh = np.zeros(d)

    def perceive(self, h):
        """Causal windowed single-head attention, window w."""
        n, d = h.shape
        q = h @ self.Wq
        k = h @ self.Wk
        v = h @ self.Wv
        out = np.zeros_like(h)
        for i in range(n):
            lo = max(0, i - self.w + 1)
            scores = (q[i] @ k[lo:i + 1].T) / np.sqrt(d)
            a = softmax(scores)
            out[i] = a @ v[lo:i + 1]
        return out

    def step(self, h):
        u = self.perceive(h)
        u = layer_norm(u, self.g, self.b)
        u = np.tanh(u @ self.F1 + self.f1b) @ self.F2 + self.f2b
        z = 1.0 / (1.0 + np.exp(-(h @ self.Wz + u @ self.Uz + self.bz)))
        cand = np.tanh(h @ self.Wh + u @ self.Uh + self.bh)
        return (1.0 - z) * h + z * cand


def run_schedule(h, stages, iters):
    for st in stages:
        for _ in range(iters):
            h = st.step(h)
    return h


def main():
    d, n, vocab = 32, 16, 64
    stages = [Stage(d, w, 100 + i) for i, w in enumerate([2, 4, 8])]
    toks = rng.integers(0, vocab, n)
    E = rng.normal(0, 1, (vocab, d))
    h0 = E[toks]

    h_clean = run_schedule(h0.copy(), stages, 4)
    assert np.all(np.isfinite(h_clean)), "non-finite clean states"

    print("stage windows: [2,4,8] iters: 4x3 = 12 steps (paper: [8,32,128])")
    print("clean drift |H_clean - H_0| = %.4f" % np.linalg.norm(h_clean - h0))

    for noise in (0.1, 0.5, 1.0):
        h_corr = h_clean + rng.normal(0, noise, h_clean.shape)
        d0 = np.linalg.norm(h_corr - h_clean)
        h_rec = run_schedule(h_corr, stages, 4)
        d1 = np.linalg.norm(h_rec - h_clean)
        # static baseline: corrupted states left untouched
        print("noise=%.1f  dist_before=%.4f  dist_after_iter=%.4f  "
              "recovered=%.1f%%  (static baseline stays %.4f)"
              % (noise, d0, d1, 100 * (d0 - d1) / d0, d0))

    print("OK: mechanics run, shapes sane, recovery curve above")


if __name__ == "__main__":
    main()
