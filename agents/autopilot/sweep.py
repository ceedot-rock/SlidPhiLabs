#!/usr/bin/env python3
"""Autopilot sweep — the lab's agents acting on their own, inside bounds.

What a sweep does, every time, with no human in the loop:
  1. DETECT: collect all 7 board reports and detect motions (read-only).
  2. AUTOFIX (pre-authorized): PCC meter drift where 2-of-3 canonical
     sources agree — patch the odd one out, with backup + ledger receipt.
     Standing rule: price discrepancies autofix when the truth is sure.
  3. PROPOSE: every other motion becomes a proposal file for the next
     board meeting. Humans decide those.

What a sweep NEVER does: merge, deploy, publish, spend, or touch any
repo outside SlidPhiLabs. No spend command exists anywhere in here.

Commands (run from this folder):
  sweep [--home DIR]     one full pass (detect, autofix, propose)
  watch <minutes>        loop sweep until stopped (Ctrl-C or STOP file)
  ledger [n]             last n autopilot receipts

Schedule it with Windows Task Scheduler (example in README.md).
Home override for tests/sandbox: AUTOPILOT_HOME env var.
Board module injectable: pass board_mod=<fake> to sweep_once().
"""
import importlib.util
import json
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import acn
import psi
import tavily

BASE = os.path.dirname(os.path.abspath(__file__))
HOME = os.environ.get("AUTOPILOT_HOME") or BASE
LAB = os.path.dirname(os.path.dirname(BASE))


def _p(*parts):
    return os.path.join(HOME, *parts)


def load_board():
    path = os.path.join(os.path.dirname(BASE), "board", "board.py")
    spec = importlib.util.spec_from_file_location("board_mod", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def ledger(actor, action, subject):
    os.makedirs(HOME, exist_ok=True)
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor, "action": action,
                            "subject": subject}) + "\n")


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def meter_votes(lab=LAB):
    """2-of-3 consensus on the PCC meter: pricing.json, package.json, README.

    Returns (canonical_dict_or_None, votes_dict). canonical is set only
    when at least two sources agree exactly — that is the standing rule's
    'sure'. Fields: free_gb (int), usd_per_gb (float).
    """
    votes = {}
    try:
        suite = read_json(os.path.join(lab, "docs", "site", "pricing.json"))["suite"]
        votes["pricing.json"] = (suite.get("free_cap_gb"), suite.get("usd_per_gb_after_free"))
    except (OSError, ValueError, KeyError):
        votes["pricing.json"] = None
    try:
        sp = read_json(os.path.join(lab, "package.json"))["agentic"]["suite_pricing"]
        votes["package.json"] = (sp.get("free_cap_gb"), sp.get("usd_per_gb_after_free"))
    except (OSError, ValueError, KeyError):
        votes["package.json"] = None
    try:
        with open(os.path.join(lab, "README.md"), encoding="utf-8") as f:
            text = f.read()
        free = 1 if "first 1 GB free" in text else "?"
        rate = 0.25 if "$0.25/GB" in text else "?"
        votes["README.md"] = (free, rate)
    except OSError:
        votes["README.md"] = None
    tally = {}
    for src, v in votes.items():
        if v is None or "?" in v:
            continue
        tally.setdefault(v, []).append(src)
    for value, srcs in tally.items():
        if len(srcs) >= 2:
            return {"free_gb": value[0], "usd_per_gb": value[1]}, votes
    return None, votes
def autofix_meter(canonical, lab=LAB):
    """Patch pricing.json meter numerics to canonical. Backup + receipt.

    Numbers only — prose (suite.plain) is never rewritten by machine;
    prose drift becomes a proposal. Returns changed field names.
    """
    path = os.path.join(lab, "docs", "site", "pricing.json")
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    data = json.loads(raw)
    suite = data["suite"]
    math = data["math"]
    changed = []
    checks = [("suite.free_cap_gb", suite, "free_cap_gb", canonical["free_gb"]),
              ("suite.usd_per_gb_after_free", suite, "usd_per_gb_after_free",
               canonical["usd_per_gb"]),
              ("math.pcc_meter_gb", math, "pcc_meter_gb", canonical["usd_per_gb"])]
    for _label, obj, key, want in checks:
        if obj.get(key) != want:
            obj[key] = want
            changed.append(key)
    if not changed:
        return []
    shutil.copy2(path, path + ".bak")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    ledger("autopilot", "price-autofix", "pricing.json: %s" % ", ".join(changed))
    return changed


def write_proposal(motion):
    os.makedirs(_p("proposals"), exist_ok=True)
    slug = "".join(c.lower() if c.isalnum() else "-" for c in motion["title"])[:40].strip("-")
    path = _p("proposals", "%s-%s.md" % (time.strftime("%Y-%m-%d-%H%M%S", time.gmtime()), slug))
    with open(path, "w", encoding="utf-8") as f:
        f.write("# Proposal: %s\n\n_Source: autopilot sweep (human decides)._"
                "\n\n```\n%s\n```\n" % (motion["title"], motion["detail"][:2000]))
    return path


def sweep_once(board_mod=None, lab=LAB):
    """One pass. Returns dict with motions, autofixed fields, proposals."""
    board = board_mod or load_board()
    reports = board.collect()
    motions = board.detect_motions(reports)
    canonical, votes = meter_votes(lab)
    drift = [m for m in motions if m["title"].startswith("Meter drift")]
    autofixed = []
    if drift and canonical:
        odd = [s for s, v in votes.items()
               if v is not None and "?" not in v
               and tuple(v) != (canonical["free_gb"], canonical["usd_per_gb"])]
        if odd == ["pricing.json"]:
            autofixed = autofix_meter(canonical, lab)
            if autofixed:
                motions = [m for m in motions if not m["title"].startswith("Meter drift")]
    proposals = [write_proposal(m) for m in motions]
    findings = {"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "motions": [m["title"] for m in motions],
                "autofixed": autofixed, "proposals": proposals}
    os.makedirs(_p("findings"), exist_ok=True)
    with open(_p("findings", findings["at"].replace(":", "") + ".json"),
              "w", encoding="utf-8") as f:
        json.dump(findings, f, indent=1)
    ledger("autopilot", "sweep",
           "%d motion(s), autofixed=%s" % (len(motions), ",".join(autofixed) or "none"))
    if motions:
        psi.remember(HOME, "sweep left %d motion(s)" % len(motions),
                     "; ".join(m["title"] for m in motions)[:250],
                     "%d proposal(s) filed for board" % len(proposals))
    return findings


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "sweep"
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
    if cmd == "lookup":
        if len(argv) < 3:
            print("usage: lookup <query...>")
            return 2
        ok, out = tavily.search(" ".join(argv[2:]))
        print(out)
        return 0 if ok else 1
    if cmd == "sweep":
        out = sweep_once()
        print("motions: %s" % (out["motions"] or "none"))
        print("autofixed: %s" % (out["autofixed"] or "none"))
        print("proposals: %d filed" % len(out["proposals"]))
        return 1 if out["motions"] else 0
    if cmd == "watch":
        minutes = int(argv[2]) if len(argv) > 2 else 60
        stop = _p("STOP")
        if os.path.exists(stop):
            os.remove(stop)
        print("autopilot watch every %d min — create %s to stop" % (minutes, stop))
        while not os.path.exists(stop):
            out = sweep_once()
            print("[%s] motions=%d autofixed=%s" % (out["at"], len(out["motions"]),
                                                   out["autofixed"] or "none"))
            for _ in range(minutes * 6):
                if os.path.exists(stop):
                    break
                time.sleep(10)
        print("stopped")
        return 0
    print("usage: sweep.py sweep|watch <minutes>|ledger")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
