#!/usr/bin/env python3
"""Lab advisor runner — Corey's personal lab assistant.

Triage sweeps every repo in scope.json, advise points at doors,
deploy runs allow-listed commands only, ledger receipts everything.
Spend is impossible by construction: no spend command exists.
Stdlib only. Shell runner injectable: pass run=<fake>.
Home override: ADVISOR_HOME env var.
"""
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import acn
import psi
import tavily

HOME = os.environ.get("ADVISOR_HOME") or os.path.dirname(os.path.abspath(__file__))


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


def triage(run=sh):
    """One pulse: git state per repo + ledger tails per agent."""
    blocks = []
    for repo in scope()["repos"]:
        name = os.path.basename(repo.rstrip("/\\")) or repo
        ok, out = run("git status --short", repo)
        if not ok and ("not a git repository" in out or "unreadable" in out.lower()
                       or "cannot find" in out.lower()):
            blocks.append("== %s ==\n(not a git repo or unreadable)" % name)
        else:
            blocks.append("== %s ==\n%s" % (name, out if out else "(clean)"))
    agents_dir = os.path.join(os.path.dirname(HOME), "")
    try:
        agents = sorted(d for d in os.listdir(agents_dir)
                        if os.path.isdir(os.path.join(agents_dir, d)))
    except OSError:
        agents = []
    tails = []
    for agent in agents:
        led = os.path.join(agents_dir, agent, "ledger.jsonl")
        if not os.path.exists(led):
            continue
        with open(led, encoding="utf-8") as f:
            lines = f.read().splitlines()[-3:]
        tails.append("@%s:\n%s" % (agent, "\n".join(lines)))
    blocks.append("LEDGERS:\n" + ("\n".join(tails) if tails else "(no ledgers yet)"))
    ledger("advisor", "triage", "%d repos, %d agent ledgers" % (len(scope()["repos"]), len(tails)))
    return "\n\n".join(blocks)


def advise(topic):
    """Point at the right door for TOPIC. Advice only — never acts."""
    doors = scope()["doors"]
    low = (topic or "").lower()
    if any(w in low for w in ("money", "stripe", "spend", "budget", "invoice", "billing")):
        return ("Money door: %s. Incoming stays $0 until Stripe last-30-days fills. "
                "Spend needs your per-item go (which card, how much) — I cannot spend." % doors["money"])
    if any(w in low for w in ("deploy", "ship", "publish", "release", "fly")):
        return ("Deploy door: %s. I run allow-listed deploys only "
                "(currently: %s), each needing --by and --confirm." %
                (doors["deploys"], ", ".join(sorted(scope()["deploys"]))))
    if any(w in low for w in ("product", "price", "pricing", "pcc", "rider", "cuni")):
        return "Product doors: %s · %s." % (doors["products"], doors["docs"])
    if any(w in low for w in ("agent", "hire", "employee", "swarm", "worker")):
        return ("Agents live in %s — adswarm (ads), slidphi-agent (greeter), "
                "compression, teachaid, advisor, github-*. Each has a CHARTER, "
                "a warrant, and a ledger." % doors["agents"])
    return ("Doors — money: %s · products: %s · docs: %s · agents: %s. "
            "Ask me about money, deploys, products, or agents." %
            (doors["money"], doors["products"], doors["docs"], doors["agents"]))


def deploy(target, by, confirm, run=sh):
    """Run an allow-listed deploy. Refuses everything else."""
    allowed = scope()["deploys"]
    if target not in allowed:
        ledger("advisor", "deploy-refused", "%s: outside allow-list" % target)
        return False, ("warrant denies deploy target %r (allow-list: %s). "
                       "Advise-only for this one — here is the plan instead: "
                       "pin the command in scope.json, then re-run." %
                       (target, ", ".join(sorted(allowed)) or "(empty)"))
    if not by:
        return False, "deploy needs --by NAME (human owner of this ship)"
    if not confirm:
        ledger("advisor", "deploy-refused", "%s: missing --confirm" % target)
        return False, "pass --confirm to deploy %s" % target
    print("SPEND REMINDER: paid resources need Corey's per-item go first. "
          "Running the pinned command only.")
    spec = allowed[target]
    ok, out = run(spec["cmd"], spec["cwd"])
    ledger(by, "deploy" if ok else "deploy-failed", target)
    if not ok:
        psi.remember(HOME, "allow-listed deploy failed", target,
                     out[-200:] if out else "no output")
    return ok, out


def main(argv):
    if len(argv) < 2:
        print("usage: runner.py triage|advise|deploy|ledger ...")
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
    if cmd == "lookup":
        if len(argv) < 3:
            print("usage: lookup <query...>")
            return 2
        ok, out = tavily.search(" ".join(argv[2:]))
        print(out)
        return 0 if ok else 1
    if cmd == "triage":
        print(triage())
        return 0
    if cmd == "advise":
        if len(argv) < 3:
            print("usage: runner.py advise <topic>")
            return 2
        print(advise(" ".join(argv[2:])))
        return 0
    if cmd == "deploy":
        if len(argv) < 3:
            print("usage: runner.py deploy <target> --by NAME --confirm")
            return 2
        by = argv[argv.index("--by") + 1] if "--by" in argv else ""
        ok, msg = deploy(argv[2], by, "--confirm" in argv)
        print(msg)
        return 0 if ok else 1
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
