#!/usr/bin/env python3
"""GitHub Engineer employee — full-stack owner of Slid-Phi-Labs/gitdepot-hub.

Commands (run from this folder):
  triage                    open issues + PRs
  review <pr#>              diff + checks for one PR
  draft <issue#> --title T --body B [--branch NAME]
                            new branch + draft PR for an issue (human does the fix;
                            this wires the branch and PR)
  approve <pr#> --by NAME   human approval receipt (needed before merge)
  merge <pr#> --by NAME --confirm
                            merge ONLY with approval receipt + green checks
  ledger [n]                last n receipts

Home override for tests: GH_EMP_HOME env var. gh runner injectable:
all live calls go through adapter.run_gh so tests can fake it.
"""
import json
import os
import sys
import time

import github_adapter as adapter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import acn
import psi
import tavily

HOME = os.environ.get("GH_EMP_HOME") or os.path.dirname(os.path.abspath(__file__))


def _p(*parts):
    return os.path.join(HOME, *parts)


def warrant():
    with open(_p("repos.json"), encoding="utf-8") as f:
        return json.load(f)


def repo():
    return warrant()["repo"]


def _guard_repo(given):
    """Refuse anything aimed outside the warrant. Returns (ok, msg)."""
    if given and given != repo():
        return False, "warrant denies repo %r (mine is %r)" % (given, repo())
    return True, ""


def ledger(actor, action, subject):
    os.makedirs(HOME, exist_ok=True)
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor, "action": action,
                            "subject": subject}) + "\n")


def approval_path(number):
    os.makedirs(_p("approvals"), exist_ok=True)
    return _p("approvals", "%s.json" % number)


def approve(number, by):
    with open(approval_path(number), "w", encoding="utf-8") as f:
        json.dump({"pr": number, "by": by,
                   "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=1)
    ledger(by, "approve", "PR #%s" % number)
    return True, "PR #%s approved by %s" % (number, by)


def merge(number, by, confirm, checks_text=None, merge_text=None):
    """Gate chain: warrant -> approval receipt -> --confirm -> green checks -> gh merge."""
    ok, msg = _guard_repo(repo())
    if not ok:
        ledger("engineer", "merge-refused", "PR #%s: %s" % (number, msg))
        return False, msg
    apath = os.path.join(HOME, "approvals", "%s.json" % number)
    if not os.path.exists(apath):
        ledger("engineer", "merge-refused", "PR #%s: no human approval" % number)
        return False, "no human approval receipt for PR #%s (approve --by NAME first)" % number
    if not confirm:
        ledger("engineer", "merge-refused", "PR #%s: missing --confirm" % number)
        return False, "pass --confirm to merge PR #%s" % number
    if checks_text is None:
        okc, checks_text = adapter.pr_checks(repo(), number)
        if not okc:
            ledger("engineer", "merge-refused", "PR #%s: checks unreadable" % number)
            return False, "could not read checks: " + checks_text
    low = checks_text.lower()
    if "fail" in low or "pending" in low or "no checks" in low:
        ledger("engineer", "merge-refused", "PR #%s: checks not green" % number)
        return False, "checks are not green for PR #%s" % number
    if merge_text is None:
        okm, merge_text = adapter.pr_merge(repo(), number)
        if not okm:
            ledger("engineer", "merge-failed", "PR #%s: %s" % (number, merge_text[:120]))
            return False, merge_text
    ledger(by, "merge", "PR #%s" % number)
    return True, merge_text or ("PR #%s merged" % number)


def main(argv):
    if len(argv) < 2:
        print("usage: employee.py triage|review|draft|approve|merge|ledger ...")
        return 2
    cmd = argv[1]
    if cmd == "lookup":
        if len(argv) < 3:
            print("usage: lookup <query...>")
            return 2
        ok, out = tavily.search(" ".join(argv[2:]))
        print(out)
        return 0 if ok else 1
    if cmd == "seat":
        print(acn.status(HOME))
        return 0
    if cmd == "recall":
        n = int(argv[2]) if len(argv) > 2 else 5
        print(psi.formatted(HOME, n))
        return 0
    if cmd == "ledger":
        n = int(argv[2]) if len(argv) > 2 else 10
        try:
            with open(_p("ledger.jsonl"), encoding="utf-8") as f:
                lines = f.read().splitlines()
        except OSError:
            lines = []
        print("\n".join(lines[-n:]))
        return 0
    if cmd == "triage":
        ok1, issues = adapter.issue_list(repo())
        ok2, prs = adapter.pr_list(repo())
        print("ISSUES:\n" + issues + "\n\nPRS:\n" + prs)
        ledger("engineer", "triage", repo())
        return 0 if (ok1 and ok2) else 1
    if cmd == "review":
        if len(argv) < 3:
            print("usage: employee.py review <pr#>")
            return 2
        number = argv[2]
        ok1, diff = adapter.pr_diff(repo(), number)
        ok2, checks = adapter.pr_checks(repo(), number)
        print("DIFF:\n" + diff + "\n\nCHECKS:\n" + checks)
        ledger("engineer", "review", "PR #%s" % number)
        return 0 if (ok1 and ok2) else 1
    if cmd == "draft":
        if len(argv) < 3 or "--title" not in argv:
            print("usage: employee.py draft <issue#> --title T --body B [--branch NAME]")
            return 2
        issue = argv[2]
        title = argv[argv.index("--title") + 1]
        body = argv[argv.index("--body") + 1] if "--body" in argv else ("For #%s" % issue)
        branch = (argv[argv.index("--branch") + 1] if "--branch" in argv
                  else ("engineer/%s" % issue))
        ok, out = adapter.pr_create(repo(), title, body + "\n\nCloses #%s." % issue, branch)
        print(out)
        ledger("engineer", "draft-pr" if ok else "draft-pr-failed",
               "issue #%s -> %s" % (issue, branch))
        return 0 if ok else 1
    if cmd == "approve":
        if len(argv) < 3 or "--by" not in argv:
            print("usage: employee.py approve <pr#> --by NAME")
            return 2
        ok, msg = approve(argv[2], argv[argv.index("--by") + 1])
        print(msg)
        return 0 if ok else 1
    if cmd == "merge":
        if len(argv) < 3:
            print("usage: employee.py merge <pr#> --by NAME --confirm")
            return 2
        by = argv[argv.index("--by") + 1] if "--by" in argv else ""
        ok, msg = merge(argv[2], by or "Corey", "--confirm" in argv)
        print(msg if isinstance(msg, str) else json.dumps(msg, indent=1))
        if not ok:
            psi.remember(HOME, "merge refused", "PR #%s" % argv[2],
                         str(msg)[:200] if isinstance(msg, str) else "see ledger")
        return 0 if ok else 1
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
