#!/usr/bin/env python3
"""Board convenor — /board starts a meeting with all agents reporting.

Commands (run from this folder):
  meet [--with-verify]     reports, motions, interactive rulings, minutes
  readout [--with-verify]  reports + motions, print and save minutes
  record <minutes> "<motion>" <approved|deferred|rejected> [note]
                           file a ruling into saved minutes (chat chairing)
  ledger [n]               last n board receipts

Read-only by default: the only writes are the minutes file and this
board's own ledger receipt. Seat commands never deploy. `gh` runs with
prompts disabled so a missing login degrades to shown-as-is output.
Home override for tests: BOARD_HOME env var. Subprocess runner
injectable: pass run=<fake> to collect().
"""
import glob
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

HOME = os.environ.get("BOARD_HOME") or os.path.dirname(os.path.abspath(__file__))
AGENTS = os.path.dirname(HOME)
PY = sys.executable

FAIL_HINTS = ("FAIL", "Traceback", "refus", "DRIFT", "not green",
              "failed", "timed out", "unreadable")


def _p(*parts):
    return os.path.join(HOME, *parts)


def ledger(actor, action, subject):
    os.makedirs(HOME, exist_ok=True)
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor, "action": action,
                            "subject": subject}) + "\n")


def sh(cmd, cwd, timeout=180):
    env = dict(os.environ, GH_PROMPT_DISABLED="1")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True,
                              timeout=timeout, cwd=cwd, env=env)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, "could not run %s: %s" % (" ".join(cmd), e)
    out = (proc.stdout if proc.returncode == 0 else proc.stderr).strip()[:6000]
    return proc.returncode == 0, out or "(no output)"


def ledger_tail(agent, n=5):
    path = os.path.join(AGENTS, agent, "ledger.jsonl")
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()[-n:]
        return "\n".join(lines) if lines else "(ledger empty)"
    except OSError:
        return "(no ledger yet)"


def trim(text, n=80):
    lines = text.splitlines()
    if len(lines) <= n:
        return text
    return "\n".join(lines[:n]) + "\n… (%d more lines)" % (len(lines) - n)


def seat_commands(agent, with_verify=False, agents_dir=AGENTS):
    """Command lists to run for a seat; slidphi-agent reports from files."""
    d = os.path.join(agents_dir, agent)
    if agent == "advisor":
        return [[PY, "runner.py", "triage"]]
    if agent == "compression":
        cmds = [[PY, "runner.py", "status"], [PY, "runner.py", "price-check"]]
        if with_verify:
            cmds.append([PY, "runner.py", "verify"])
        return cmds
    if agent == "teachaid":
        cmds = [[PY, "runner.py", "status"]]
        if with_verify:
            cmds += [[PY, "runner.py", "verify"], [PY, "runner.py", "audit"]]
        return cmds
    if agent == "adswarm":
        camps = sorted(os.path.splitext(os.path.basename(p))[0]
                       for p in glob.glob(os.path.join(d, "campaigns", "*.json")))
        return [[PY, "runner.py", "review", c] for c in camps] or [None]
    if agent in ("github-webdev", "github-engineer"):
        return [[PY, "employee.py", "triage"]]
    if agent in ("law-scholar", "biz-scholar"):
        return [[PY, "runner.py", "status"]]
    return [None]


def greeter_report(agents_dir=AGENTS):
    d = os.path.join(agents_dir, "slidphi-agent")
    worker = "present" if os.path.exists(os.path.join(d, "worker.py")) else "MISSING"
    path = os.path.join(d, "issues.jsonl")
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()[-8:]
        feedback = "\n".join(lines) if lines else "(no customer feedback logged yet)"
    except OSError:
        feedback = "(no customer feedback logged yet)"
    return "worker.py: %s\nCUSTOMER FEEDBACK (last 8):\n%s" % (worker, feedback)


def collect(with_verify=False, run=sh, agents_dir=AGENTS):
    """Run every seat. Returns {seat: text}; failures are shown as-is."""
    reports = {}
    for agent in ("advisor", "compression", "teachaid", "adswarm",
                  "github-webdev", "github-engineer",
                  "law-scholar", "biz-scholar"):
        d = os.path.join(agents_dir, agent)
        if not os.path.isdir(d):
            reports[agent] = "(seat not installed)"
            continue
        parts = []
        for cmd in seat_commands(agent, with_verify, agents_dir):
            if cmd is None:
                parts.append("(no campaigns)")
                continue
            ok, out = run(cmd, d)
            parts.append("$ %s\n%s" % (" ".join(cmd), out))
        parts.append("LEDGER TAIL:\n" + ledger_tail(agent))
        reports[agent] = "\n\n".join(parts)
    reports["slidphi-agent"] = greeter_report(agents_dir)
    return reports
def failure_lines(reports):
    hits = []
    for seat, text in reports.items():
        for line in text.splitlines():
            if any(h in line for h in FAIL_HINTS):
                hits.append("@%s: %s" % (seat, line.strip()[:200]))
    return hits[:12]


def greeter_complaints(agents_dir=AGENTS):
    path = os.path.join(agents_dir, "slidphi-agent", "issues.jsonl")
    try:
        with open(path, encoding="utf-8") as f:
            rows = [json.loads(l) for l in f.read().splitlines() if l.strip()]
    except (OSError, ValueError):
        return []
    return [r for r in rows[-5:]
            if str(r.get("kind", "")).lower() in ("criticism", "issue", "request")]


def unapproved_drafts(text):
    rows = []
    for line in text.splitlines():
        m = re.match(r"^(\S+) \[(.+?)\] (\S+) approved=(True|False)$", line.strip())
        if m and m.group(4) == "False":
            rows.append("%s [%s] %s" % (m.group(1), m.group(2), m.group(3)))
    return rows


def detect_motions(reports, agents_dir=AGENTS):
    """Motions are problems only; open-work lists stay reports."""
    motions = []
    drift = [l for l in reports.get("compression", "").splitlines() if "DRIFT" in l]
    if drift:
        motions.append({"title": "Meter drift across pricing surfaces",
                        "detail": "\n".join(drift[:8])})
    fails = failure_lines(reports)
    fails = [l for l in fails if "DRIFT" not in l]
    if fails:
        motions.append({"title": "Failures and refusals need rulings",
                        "detail": "\n".join(fails)})
    unapproved = unapproved_drafts(reports.get("adswarm", ""))
    if unapproved:
        motions.append({"title": "Unapproved ad drafts",
                        "detail": "\n".join(unapproved[:8])})
    complaints = greeter_complaints(agents_dir)
    if complaints:
        motions.append({"title": "Customer feedback needs answers",
                        "detail": "\n".join(
                            "- [%s] %s" % (c.get("kind"), c.get("summary")) for c in complaints)})
    return motions


def minutes_path(ts=None):
    ts = ts or time.strftime("%Y-%m-%d-%H%M%S", time.gmtime())
    os.makedirs(_p("minutes"), exist_ok=True)
    return _p("minutes", ts + ".md")


def write_minutes(reports, motions, rulings, mode, adjourned):
    path = minutes_path()
    with open(path, "w", encoding="utf-8") as f:
        f.write("# Board minutes — %s UTC\n_Mode: %s. Chair: Corey._\n"
                % (os.path.basename(path)[:-3], mode))
        f.write("\n## Reports\n")
        for seat, text in reports.items():
            f.write("\n### @%s\n```\n%s\n```\n" % (seat, trim(text)))
        f.write("\n## Motions\n")
        if motions:
            for i, m in enumerate(motions, 1):
                f.write("\n%d. %s\n```\n%s\n```\n" % (i, m["title"], trim(m["detail"], 20)))
        else:
            f.write("\n(none — quiet meeting)\n")
        f.write("\n## Rulings\n")
        f.write("\n".join("- %s — **%s**%s" % (r["motion"], r["ruling"],
                                              (". " + r["note"]) if r["note"] else "")
                         for r in rulings) + "\n" if rulings else "(none)\n")
        f.write("\n## Adjourned\n%s\n" % adjourned)
    ledger("board", "minutes", os.path.basename(path))
    return path


def record(minutes_file, motion, ruling, note=""):
    ruling = ruling.lower()
    if ruling not in ("approved", "deferred", "rejected"):
        return False, "ruling must be approved|deferred|rejected"
    path = os.path.abspath(minutes_file)
    if os.path.dirname(path) != os.path.abspath(_p("minutes")):
        return False, "minutes file must live in %s" % _p("minutes")
    if not os.path.exists(path):
        return False, "no such minutes file: %s" % minutes_file
    with open(path, "a", encoding="utf-8") as f:
        f.write("- %s — **%s**%s\n" % (motion, ruling, (". " + note) if note else ""))
    ledger("board", "ruling", "%s: %s" % (motion[:80], ruling))
    psi.remember(HOME, "ruling filed: %s" % motion[:120], "board %s" % os.path.basename(path),
                 "%s%s" % (ruling, (". " + note) if note else ""))
    return True, "recorded: %s — %s" % (motion[:80], ruling)
def chair(motions):
    """Interactive rulings. Returns (rulings, adjourned_line)."""
    rulings = []
    queue = list(motions)
    print("\n%d motion(s) on the table. a/d/r rule (add words for a note), s=skip, "
          "raise <text>, note <text>, end." % len(queue))
    i = 0
    while i < len(queue):
        m = queue[i]
        print("\n--- Motion %d/%d: %s ---\n%s" % (i + 1, len(queue), m["title"], trim(m["detail"], 12)))
        try:
            cmd = input("(a/d/r/s/raise/note/end) ").strip()
        except EOFError:
            return rulings, "chair adjourned early at motion %d (EOF)" % (i + 1)
        verb, _, rest = cmd.partition(" ")
        verb, rest = verb.lower(), rest.strip()
        if verb in ("a", "approve"):
            rulings.append({"motion": m["title"], "ruling": "approved", "note": rest})
            i += 1
        elif verb in ("d", "defer"):
            rulings.append({"motion": m["title"], "ruling": "deferred", "note": rest})
            i += 1
        elif verb in ("r", "reject"):
            rulings.append({"motion": m["title"], "ruling": "rejected", "note": rest})
            i += 1
        elif verb in ("s", "skip"):
            i += 1
        elif verb == "end" and not rest:
            return rulings, "chair ended the meeting at motion %d" % (i + 1)
        elif verb == "raise" and rest:
            queue.append({"title": rest, "detail": "(raised from the chair)"})
            print("raised as motion %d" % len(queue))
        elif verb == "note" and rest:
            if rulings:
                rulings[-1]["note"] = rest
            else:
                print("nothing ruled yet — note dropped")
        else:
            print("say a/d/r (+ optional note), s, raise <text>, note <text>, or end")
    return rulings, "all motions heard"


def main(argv):
    if len(argv) < 2:
        print("usage: board.py meet|readout|record|ledger [--with-verify]")
        return 2
    cmd = argv[1]
    with_verify = "--with-verify" in argv
    if cmd == "ledger":
        n = int(argv[2]) if len(argv) > 2 and not argv[2].startswith("--") else 10
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
    if cmd == "readout":
        reports = collect(with_verify)
        motions = detect_motions(reports)
        for seat, text in reports.items():
            print("\n===== @%s =====\n%s" % (seat, trim(text, 30)))
        print("\n===== MOTIONS (%d) =====" % len(motions))
        for m in motions:
            print("\n- %s\n%s" % (m["title"], trim(m["detail"], 8)))
        path = write_minutes(reports, motions, [], "readout", "readout filed, no rulings")
        print("\nMinutes: %s" % path)
        return 0
    if cmd == "meet":
        reports = collect(with_verify)
        motions = detect_motions(reports)
        for seat, text in reports.items():
            print("\n===== @%s =====\n%s" % (seat, trim(text, 15)))
        rulings, adjourned = chair(motions)
        path = write_minutes(reports, motions, rulings, "meet", adjourned)
        print("\nMinutes: %s" % path)
        return 0
    if cmd == "record":
        if len(argv) < 5:
            print('usage: board.py record <minutes> "<motion>" <approved|deferred|rejected> [note]')
            return 2
        ok, msg = record(argv[2], argv[3], argv[4], " ".join(argv[5:]))
        print(msg)
        return 0 if ok else 1
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
