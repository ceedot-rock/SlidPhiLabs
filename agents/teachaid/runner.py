#!/usr/bin/env python3
"""TeachAid agent runner — status, verify, audit, deploy, ledger.

Owns the repo dir in scope.json. Stdlib only. Shell runner injectable
for tests: pass run=<fake>. Home override: TEACHAID_HOME env var.
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

HOME = os.environ.get("TEACHAID_HOME") or os.path.dirname(os.path.abspath(__file__))


def _p(*parts):
    return os.path.join(HOME, *parts)


def scope():
    with open(_p("scope.json"), encoding="utf-8") as f:
        return json.load(f)


def repo():
    return scope()["repo_dir"]


def ledger(actor, action, subject):
    os.makedirs(HOME, exist_ok=True)
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor, "action": action,
                            "subject": subject}) + "\n")


def sh(cmd, cwd):
    try:
        proc = subprocess.run(cmd, shell=True, capture_output=True,
                              text=True, timeout=600, cwd=cwd)
    except subprocess.TimeoutExpired:
        return False, "timed out: " + cmd
    out = (proc.stdout if proc.returncode == 0 else proc.stderr).strip()[:4000]
    return proc.returncode == 0, out


def status(run=sh):
    sc = scope()
    lines = ["APP: TeachAid @ %s (%s)." % (sc["live"], sc["plan"])]
    try:
        with open(os.path.join(repo(), "package.json"), encoding="utf-8") as f:
            lines.append("VERSION: " + json.load(f).get("version", "?"))
    except OSError as e:
        lines.append("VERSION: unreadable (%s)" % e)
    ok, git = run("git status --short", repo())
    lines.append("GIT:\n" + (git if ok else "(git unreadable: %s)" % git))
    return "\n".join(lines)


def verify(run=sh):
    results = []
    all_ok = True
    for cmd in scope()["verify"]:
        ok, out = run(cmd, repo())
        tail = "\n".join(out.splitlines()[-8:])
        results.append(("$ PASS " if ok else ("$ FAIL ")) + cmd + "\n" + tail)
        all_ok = all_ok and ok
    ledger("teachaid", "verify-pass" if all_ok else "verify-fail",
           "; ".join(scope()["verify"]))
    if not all_ok:
        psi.remember(HOME, "npm test failed", "; ".join(scope()["verify"]),
                     "red tests block the ship; see ledger")
    return all_ok, "\n\n".join(results)


def audit(run=sh):
    results = []
    all_ok = True
    for cmd in scope()["audit"]:
        ok, out = run(cmd, repo())
        tail = "\n".join(out.splitlines()[-15:])
        results.append(("$ PASS " if ok else ("$ FAIL ")) + cmd + "\n" + tail)
        all_ok = all_ok and ok
    ledger("teachaid", "audit-pass" if all_ok else "audit-fail",
           "; ".join(scope()["audit"]))
    return all_ok, "\n\n".join(results)


def deploy(by, confirm, run=sh):
    """Fly deploy, gated: --by human, --confirm, tests green first."""
    if not by:
        return False, "deploy needs --by NAME (human owner of this ship)"
    if not confirm:
        ledger("teachaid", "deploy-refused", "missing --confirm")
        return False, "pass --confirm to deploy TeachAid"
    ok, report = verify(run=run)
    if not ok:
        ledger("teachaid", "deploy-refused", "tests red")
        return False, "tests are red — deploy refused:\n" + report
    print("SPEND REMINDER: deploys that create paid resources still need "
          "Corey's per-item go. This runs the pinned command only.")
    okd, out = run(scope()["deploy"]["teachaid"], repo())
    ledger(by, "deploy" if okd else "deploy-failed", "teachaid -> %s" % scope()["live"])
    if not okd:
        psi.remember(HOME, "fly deploy failed", "teachaid -> %s" % scope()["live"],
                     out[-200:] if out else "no output")
    return okd, out


def main(argv):
    if len(argv) < 2:
        print("usage: runner.py status|verify|audit|deploy|ledger ...")
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
    if cmd == "status":
        print(status())
        return 0
    if cmd == "verify":
        ok, report = verify()
        print(report)
        return 0 if ok else 1
    if cmd == "audit":
        ok, report = audit()
        print(report)
        return 0 if ok else 1
    if cmd == "deploy":
        by = argv[argv.index("--by") + 1] if "--by" in argv else ""
        ok, msg = deploy(by, "--confirm" in argv)
        print(msg)
        return 0 if ok else 1
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
