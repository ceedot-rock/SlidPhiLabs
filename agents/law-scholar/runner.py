#!/usr/bin/env python3
"""Builder-law scholar runner — status, lookup, brief, review, ledger.

Researches licenses/terms/grants, drafts cited briefs into briefs/.
Writes nothing outside scope owns. Home override: LAW_HOME env var.
Tavily transport injectable: pass post=<fake> to brief().
"""
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import acn
import psi
import tavily

HOME = os.environ.get("LAW_HOME") or os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(HOME))


def _p(*parts):
    return os.path.join(HOME, *parts)


def scope():
    with open(_p("scope.json"), encoding="utf-8") as f:
        return json.load(f)


def ledger(actor, action, subject):
    os.makedirs(HOME, exist_ok=True)
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor, "action": action,
                            "subject": subject}) + "\n")


def sh(cmd, cwd):
    try:
        proc = subprocess.run(cmd, shell=True, capture_output=True,
                              text=True, timeout=120, cwd=cwd)
    except subprocess.TimeoutExpired:
        return False, "timed out: " + cmd
    out = (proc.stdout if proc.returncode == 0 else proc.stderr).strip()[:2000]
    return proc.returncode == 0, out


def status(run=sh):
    ok, git = run("git status --short", LAB)
    return "\n".join([
        "SEAT: builder-law — licenses, terms, grant language. Drafts only.",
        "BRIEFS: %s" % ", ".join(sorted(
            f for f in os.listdir(_p("briefs")) if f.endswith(".md"))
            if os.path.isdir(_p("briefs")) else []),
        "GIT:\n" + (git if ok else "(git unreadable: %s)" % git)])


def lookup(query, note="law-scholar"):
    ok, out = tavily.search(query, note=note)
    ledger("law-scholar", "lookup-ok" if ok else "lookup-failed", query[:120])
    if not ok:
        psi.remember(HOME, "lookup failed", query[:150], out[:200])
    return ok, out


def brief(topic, post=None):
    """Research TOPIC: Tavily pulls + cited draft brief. Returns (ok, path|msg)."""
    kw = {"post": post} if post else {}
    ok, out = tavily.search(topic, note="law-scholar-brief", **kw)
    if not ok:
        ledger("law-scholar", "brief-failed", topic[:120])
        return False, out
    slug = re.sub(r"[^a-z0-9]+", "-", topic.lower())[:40].strip("-") or "brief"
    os.makedirs(_p("briefs"), exist_ok=True)
    path = _p("briefs", "%s-%s.md" % (time.strftime("%Y-%m-%d", time.gmtime()), slug))
    with open(path, "w", encoding="utf-8") as f:
        f.write("# Brief (DRAFT — human approves before use): %s\n\n" % topic)
        f.write("_Pulled %s. Every claim below needs its pull citation before use._\n\n" %
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        f.write("```\n%s\n```\n" % out[:4000])
    ledger("law-scholar", "brief", os.path.basename(path))
    return True, path


def main(argv):
    if len(argv) < 2:
        print("usage: runner.py status|lookup|brief|review|ledger|seat|recall ...")
        return 2
    cmd = argv[1]
    if cmd == "ledger":
        n = int(argv[2]) if len(argv) > 2 else 10
        try:
            with open(_p("ledger.jsonl"), encoding="utf-8") as f:
                lines = f.read().splitlines()
        except OSError:
            lines = []
        print("\n".join(lines[-n:]))
        return 0
    if cmd == "seat":
        print(acn.status(HOME))
        return 0
    if cmd == "recall":
        n = int(argv[2]) if len(argv) > 2 else 5
        print(psi.formatted(HOME, n))
        return 0
    if cmd == "status":
        print(status())
        return 0
    if cmd == "lookup":
        if len(argv) < 3:
            print("usage: runner.py lookup <query...>")
            return 2
        ok, out = lookup(" ".join(argv[2:]))
        print(out)
        return 0 if ok else 1
    if cmd == "brief":
        if len(argv) < 3:
            print("usage: runner.py brief <topic...>")
            return 2
        ok, out = brief(" ".join(argv[2:]))
        print(out)
        return 0 if ok else 1
    if cmd == "review":
        d = _p("briefs")
        try:
            names = sorted(f for f in os.listdir(d) if f.endswith(".md"))
        except OSError:
            names = []
        print("\n".join(names) if names else "(no briefs yet)")
        return 0
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
