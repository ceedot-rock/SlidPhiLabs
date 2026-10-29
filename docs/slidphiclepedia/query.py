#!/usr/bin/env python3
"""query.py: prompt keywords kick matching pedia records to the top.

Usage: query.py "your prompt text..."
Ranks pulls.jsonl, cheatsheets/cases, and the corpora manifest by fit
to the prompt. Scoring mirrors psi retrieval/score.py (stop-words,
+2 exact token, +1 substring) plus +3 per exact query bigram so
multi-word keywords float above single-word noise. Stdlib only.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
STOP = set("a an the to of in on for with and or is are was were be by at as it its this that these those how what when which who will would can could should have has had do does did not no yes if then than so such via per my our your".split())


def toks(s):
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP]


def bigrams(q):
    return [" ".join(q[i:i + 2]) for i in range(len(q) - 1)]


def score_doc(q, bigr, text):
    words = toks(text)
    wset = set(words)
    blob = " ".join(words)
    # Distinct-token cap: each query token pays once, so long files
    # cannot spam their way above a dense short match.
    s = 0
    for w in set(q):
        if w in wset:
            s += 2
        elif any(w != v and (w in v or v in w) for v in wset):
            s += 1
    s += sum(3 for b in set(bigr) if b in blob)
    return s


def main(query):
    q = toks(query)
    bigr = bigrams(q)
    rows = []

    def add(score, tag, text):
        if score > 0:
            rows.append((score, tag, text[:220]))

    pulls = os.path.join(HERE, "pulls.jsonl")
    if os.path.exists(pulls):
        for line in open(pulls, encoding="utf-8", errors="replace"):
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                r = json.loads(line)
            except ValueError:
                continue
            text = " ".join(str(r.get(k, "")) for k in ("q", "title", "snippet", "note"))
            add(score_doc(q, bigr, text), "pull",
                "%s | %s" % (r.get("title", "?"), r.get("note", "")))

    for sub in ("cheatsheets", "cases"):
        d = os.path.join(HERE, sub)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            fp = os.path.join(d, fn)
            if not os.path.isfile(fp) or not fn.endswith(".md"):
                continue
            try:
                body = open(fp, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            add(score_doc(q, bigr, fn + " " + body), sub[:-1], "%s: %s" % (fn, body.strip().split("\n")[0]))

    ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
    TEXT_EXT = (".md", ".txt", ".json", ".jsonl", ".mjs", ".js",
                ".py", ".html", ".yaml", ".yml", ".toml", ".cfg")
    man = os.path.join(HERE, "corpora", "manifest.jsonl")
    if os.path.exists(man):
        for line in open(man, encoding="utf-8", errors="replace"):
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                r = json.loads(line)
            except ValueError:
                continue
            rel = str(r.get("path", ""))
            text = "%s %s" % (r.get("role", ""), rel)
            fp = os.path.join(ROOT, *rel.split("/"))
            try:
                if (os.path.isfile(fp) and fp.lower().endswith(TEXT_EXT)
                        and os.path.getsize(fp) < 200000):
                    with open(fp, encoding="utf-8", errors="replace") as fh:
                        text += " " + fh.read()
            except OSError:
                pass
            add(score_doc(q, bigr, text), "corpus:" + str(r.get("role", "?")), rel)

    rows.sort(key=lambda x: -x[0])
    if not rows:
        print("no keyword hits for: %s" % query)
        return
    for score, tag, text in rows[:8]:
        print("%d [%s] %s" % (score, tag, text))


main(" ".join(sys.argv[1:]) or input("prompt: "))
