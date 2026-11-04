#!/usr/bin/env python3
"""explore_nca_apps.py: TextNCA-like cells for parsing, matching, routing,
compression — grown (12 NCA steps) vs static (0 steps), numpy only.

Reuses Stage from textnca_cell.py (paper eq. 5-6, windows [2,4,8], Ts=4).
Random weights throughout: anything grown wins here wins on mechanism
alone, which is the only honest claim available before training.

Tasks:
  parse   balanced-paren classification, least-squares probe on final states
  match   near-duplicate separation margin (dup cosine minus random cosine)
  route   query-to-slice accuracy after in-context refinement vs raw
  compress coarse-to-fine profile: R^2 of final state from each stage state

Usage: python explore_nca_apps.py
"""
import numpy as np

from textnca_cell import Stage, run_schedule

rng = np.random.default_rng(11)
SEED0 = 100


def stages():
    return [Stage(32, w, SEED0 + i) for i, w in enumerate([2, 4, 8])]


def lstsq_probe(X, y):
    w, *_ = np.linalg.lstsq(X, y, rcond=None)
    return X @ w


def task_parse():
    """20 balanced / 20 unbalanced paren strings, len 12."""
    d = 32
    E = {'(': rng.normal(0, 1, d), ')': rng.normal(0, 1, d)}
    P = rng.normal(0, 0.2, (12, d))  # fixed positional signal
    X, y = [], []
    while len(X) < 40:
        s = ''.join(rng.choice(['(', ')']) for _ in range(12))
        bal = s.count('(') == s.count(')')
        # force class balance
        if bal and sum(y) >= 20:
            continue
        if not bal and len(y) - sum(y) >= 20:
            continue
        h = np.stack([E[c] for c in s]) + P
        X.append(h)
        y.append(float(bal))
    y = np.array(y)
    st = stages()
    acc = {}
    for name, it in (("static", 0), ("grown", 4)):
        feats = np.array([run_schedule(h.copy(), st, it).mean(axis=0)
                          for h in X])
        pred = lstsq_probe(feats, y) > 0.5
        acc[name] = float((pred == y).mean())
    return acc


def task_match():
    """10 near-dup pairs (1-bit flip) + 10 random pairs, binary strings."""
    d = 32
    E = rng.normal(0, 1, (2, d))
    st = stages()
    margins = {}
    for name, it in (("static", 0), ("grown", 4)):
        dup, rnd = [], []
        for _ in range(10):
            a = rng.integers(0, 2, 12)
            b = a.copy()
            b[rng.integers(0, 12)] ^= 1
            c = rng.integers(0, 2, 12)
            fa = run_schedule(E[a].copy(), st, it).mean(axis=0)
            fb = run_schedule(E[b].copy(), st, it).mean(axis=0)
            fc = run_schedule(E[c].copy(), st, it).mean(axis=0)
            dup.append(fa @ fb / (np.linalg.norm(fa) * np.linalg.norm(fb)))
            rnd.append(fa @ fc / (np.linalg.norm(fa) * np.linalg.norm(fc)))
        margins[name] = float(np.mean(dup) - np.mean(rnd))
    return margins


def task_route():
    """40 noisy queries to 4 slice centroids; argmax-cosine routing."""
    d = 32
    cents = rng.normal(0, 1, (4, d))
    cents /= np.linalg.norm(cents, axis=1, keepdims=True)
    st = stages()
    acc = {}
    for name, it in (("static", 0), ("grown", 4)):
        ok = 0
        for i in range(40):
            k = i % 4
            q = cents[k] + rng.normal(0, 0.6, d)
            # refine in context: query followed by the four slices
            h = np.stack([q, *cents])
            h = run_schedule(h, st, it)
            q2 = h[0] / np.linalg.norm(h[0])
            if int(np.argmax(cents @ q2)) == k:
                ok += 1
        acc[name] = ok / 40
    return acc


def task_compress():
    """R^2 of final state from each stage output: coarse-to-fine profile."""
    d = 32
    E = rng.normal(0, 1, (64, d))
    st = stages()
    h0 = E[rng.integers(0, 64, 128)]
    snaps, h = [h0.copy()], h0.copy()
    for s in st:
        for _ in range(4):
            h = s.step(h)
        snaps.append(h.copy())
    final = snaps[-1]
    prof = {}
    for k, s in enumerate(snaps):
        w, *_ = np.linalg.lstsq(s, final, rcond=None)
        pred = s @ w
        ss = 1 - np.sum((final - pred) ** 2) / np.sum(final ** 2)
        prof[f"stage{k}"] = float(ss)
    return prof


def main():
    p = task_parse()
    print("parse   static=%.2f grown=%.2f" % (p["static"], p["grown"]))
    m = task_match()
    print("match   static margin=%.3f grown margin=%.3f"
          % (m["static"], m["grown"]))
    r = task_route()
    print("route   static=%.2f grown=%.2f" % (r["static"], r["grown"]))
    c = task_compress()
    print("compress R^2 by stage: " + " ".join("%s=%.3f" % kv
                                               for kv in sorted(c.items())))
    print("OK: 4-track probe complete")


if __name__ == "__main__":
    main()
