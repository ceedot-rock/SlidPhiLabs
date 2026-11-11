"""Floor actions — run in-scope runner commands from chat (stdlib only).

Every seat's palette mirrors its charter: read commands run at once,
writes (approve/merge/deploy/publish/draft/sweep) need an inline YES
first — enforced here AND by the runners' own gates (--by/--confirm,
approval receipts), so chat cannot bypass them.
"""
import json
import os
import subprocess
import sys
import time

AGENTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable

# seat -> {command: argv-tail}. None-tail means floor-side implementation.
PALETTES = {
    "adswarm": {"review": ["review"], "critic": ["critic"], "approve": ["approve"],
                "schedule": ["schedule"], "publish": ["publish"], "ledger": ["ledger"],
                "seat": ["seat"], "recall": ["recall"]},
    "advisor": {"triage": ["triage"], "advise": ["advise"], "deploy": ["deploy"],
                "ledger": ["ledger"], "seat": ["seat"], "recall": ["recall"]},
    "autopilot": {"sweep": ["sweep"], "ledger": ["ledger"],
                  "seat": ["seat"], "recall": ["recall"]},
    "board": {"readout": ["readout"], "record": ["record"], "ledger": ["ledger"],
              "seat": ["seat"], "recall": ["recall"]},
    "compression": {"status": ["status"], "verify": ["verify"],
                    "price-check": ["price-check"], "ledger": ["ledger"],
                    "seat": ["seat"], "recall": ["recall"]},
    "teachaid": {"status": ["status"], "verify": ["verify"], "audit": ["audit"],
                 "deploy": ["deploy"], "ledger": ["ledger"],
                 "seat": ["seat"], "recall": ["recall"]},
    "github-webdev": {"triage": ["triage"], "review": ["review"], "draft": ["draft"],
                      "approve": ["approve"], "merge": ["merge"], "ledger": ["ledger"],
                      "seat": ["seat"], "recall": ["recall"]},
    "github-engineer": {"triage": ["triage"], "review": ["review"], "draft": ["draft"],
                        "approve": ["approve"], "merge": ["merge"], "ledger": ["ledger"],
                        "seat": ["seat"], "recall": ["recall"]},
    "slidphi-agent": {"feedback": None, "seat": None, "recall": None},
    "law-scholar": {"status": ["status"], "lookup": ["lookup"], "brief": ["brief"],
                    "review": ["review"], "ledger": ["ledger"],
                    "seat": ["seat"], "recall": ["recall"]},
    "biz-scholar": {"status": ["status"], "lookup": ["lookup"], "brief": ["brief"],
                    "review": ["review"], "ledger": ["ledger"],
                    "seat": ["seat"], "recall": ["recall"]},
}

RUNNERS = {"adswarm": "runner.py", "advisor": "runner.py", "autopilot": "sweep.py",
           "board": "board.py", "compression": "runner.py", "teachaid": "runner.py",
           "github-webdev": "employee.py", "github-engineer": "employee.py"}

CONFIRM = {"approve", "merge", "deploy", "publish", "draft", "sweep"}


def palette(seat):
    return sorted(PALETTES.get(seat, {}))


def needs_confirm(cmd):
    return cmd in CONFIRM


def trim(text, n=60):
    lines = text.splitlines()
    return text if len(lines) <= n else "\n".join(lines[:n]) + "\n… (%d more)" % (len(lines) - n)


def run(seat, cmd, args, agents_dir=AGENTS, timeout=600):
    """Run an in-scope command. Returns (ok, output). No confirm here —
    the caller prompts; this enforces scope only."""
    if seat not in PALETTES or cmd not in PALETTES[seat]:
        return False, "%s cannot %r (in scope: %s)" % (seat, cmd, ", ".join(palette(seat)))
    if cmd == "feedback" and seat == "slidphi-agent":
        return feedback(agents_dir, args)
    if cmd in ("seat", "recall") and seat == "slidphi-agent":
        return greeter_side(agents_dir, cmd, args)
    home = os.path.join(agents_dir, seat)
    proc = subprocess.run([PY, RUNNERS[seat]] + [cmd] + args, capture_output=True,
                          text=True, timeout=timeout, cwd=home)
    out = (proc.stdout if proc.returncode == 0 else proc.stderr).strip()[:6000]
    return proc.returncode == 0, out or "(no output)"


def feedback(agents_dir, args):
    """Floor-side greeter action: kind + summary -> issues.jsonl."""
    if len(args) < 2:
        return False, "usage: act slidphi-agent feedback <criticism|issue|request|praise> <summary>"
    kind, summary = args[0].lower(), " ".join(args[1:])
    if kind not in ("criticism", "issue", "request", "praise"):
        return False, "kind must be criticism|issue|request|praise"
    path = os.path.join(agents_dir, "slidphi-agent", "issues.jsonl")
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "kind": kind, "summary": summary[:500], "contact": ""}) + "\n")
    return True, "logged %s: %s" % (kind, summary[:140])


def greeter_side(agents_dir, cmd, args):
    home = os.path.join(agents_dir, "slidphi-agent")
    if cmd == "seat":
        with open(os.path.join(home, "seat.json"), encoding="utf-8") as f:
            s = json.load(f)
        return True, "seat: %s\nallows: %s\ncap_usd: %s (spend closed)" % (
            s.get("seat"), ", ".join(s.get("allows", [])), s.get("cap_usd"))
    n = int(args[0]) if args else 5
    try:
        with open(os.path.join(home, "observatory.jsonl"), encoding="utf-8") as f:
            rows = [json.loads(l) for l in f.read().splitlines() if l.strip()][-n:]
        return True, "\n".join("- %s" % r.get("d") for r in rows) or "(no lessons yet)"
    except OSError:
        return True, "(no lessons yet)"
