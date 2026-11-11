#!/usr/bin/env python3
"""Compression agent runner — status, verify, price-check, ledger.

Owns the paths in scope.json (PCC/TRUSTREAM/pulsar). Stdlib only.
Shell runner is injectable for tests: pass run=<fake> to verify().
Home override for tests: COMPRESSION_HOME env var.
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

HOME = os.environ.get("COMPRESSION_HOME") or os.path.dirname(os.path.abspath(__file__))
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
                              text=True, timeout=300, cwd=cwd)
    except subprocess.TimeoutExpired:
        return False, "timed out: " + cmd
    out = (proc.stdout if proc.returncode == 0 else proc.stderr).strip()[:4000]
    return proc.returncode == 0, out


def guard_path(path):
    """Refuse anything outside scope owns. Returns (ok, msg)."""
    owns = scope()["owns"]
    norm = path.replace("\\", "/").lstrip("./")
    if any(norm == o.rstrip("/") or norm.startswith(o.rstrip("/") + "/")
           or norm.startswith(o) for o in owns):
        return True, ""
    return False, "warrant denies path %r (owns: %s)" % (path, ", ".join(owns))


def status(run=sh):
    ok, git = run("git status --short", LAB)
    lines = ["METER: 1 GB free once per IP, then $0.25/GB ($0.20/GB bulk).",
             "OWNS: " + ", ".join(scope()["owns"]),
             "GIT:\n" + (git if ok else "(git unreadable: %s)" % git)]
    return "\n".join(lines)


def verify(run=sh):
    results = []
    all_ok = True
    for cmd in scope()["verify"]:
        ok, out = run(cmd, LAB)
        tail = "\n".join(out.splitlines()[-8:])
        results.append(("$ PASS " if ok else ("$ FAIL ")) + cmd + "\n" + tail)
        all_ok = all_ok and ok
    ledger("compression", "verify-pass" if all_ok else "verify-fail",
           "; ".join(scope()["verify"]))
    if not all_ok:
        psi.remember(HOME, "codec verify failed", "; ".join(scope()["verify"]),
                     "fix before claiming anything; see ledger")
    return all_ok, "\n\n".join(results)


def price_check(lab=LAB):
    """Compare meter numbers across package.json, README, pricing.json."""
    meter = scope()["meter"]
    findings = []
    try:
        with open(os.path.join(lab, "package.json"), encoding="utf-8") as f:
            pkg = json.load(f).get("agentic", {}).get("suite_pricing", {})
        if pkg.get("free_cap_gb") != meter["free_gb"]:
            findings.append("package.json free_cap_gb=%r (want %s)"
                            % (pkg.get("free_cap_gb"), meter["free_gb"]))
        if pkg.get("usd_per_gb_after_free") != meter["usd_per_gb"]:
            findings.append("package.json usd_per_gb_after_free=%r (want %s)"
                            % (pkg.get("usd_per_gb_after_free"), meter["usd_per_gb"]))
    except OSError as e:
        findings.append("package.json unreadable: %s" % e)
    try:
        with open(os.path.join(lab, "README.md"), encoding="utf-8") as f:
            readme = f.read()
        if "$0.25/GB" not in readme:
            findings.append("README missing $0.25/GB meter line")
        if "first 1 GB free" not in readme:
            findings.append("README missing first-1-GB-free line")
    except OSError as e:
        findings.append("README unreadable: %s" % e)
    pj = os.path.join(lab, "docs", "site", "pricing.json")
    if os.path.exists(pj):
        with open(pj, encoding="utf-8") as f:
            text = f.read()
        if "0.25" not in text:
            findings.append("docs/site/pricing.json missing 0.25 meter")
    else:
        findings.append("docs/site/pricing.json absent (drift risk)")
    ledger("compression", "price-check",
           "clean" if not findings else "; ".join(findings)[:200])
    if findings:
        psi.remember(HOME, "meter drift found", "; ".join(findings)[:200],
                     "numbers must match everywhere before shipping")
    return findings


def main(argv):
    if len(argv) < 2:
        print("usage: runner.py status|verify|price-check|ledger ...")
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
    if cmd == "price-check":
        findings = price_check()
        print("clean: meter matches everywhere" if not findings
              else "\n".join("DRIFT: " + f for f in findings))
        return 0 if not findings else 1
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
