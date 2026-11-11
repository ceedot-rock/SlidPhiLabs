#!/usr/bin/env python3
"""AdSwarm runner — draft, critic, approve, schedule, publish.

Every action appends a receipt to ledger.jsonl. Publishing refuses
anything without a human approval receipt or outside the warrant.
Home dir override for tests: ADSWARM_HOME env var.
"""
import json
import os
import re
import sys
import time

import adapters

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import acn
import psi
import tavily

HOME = os.environ.get("ADSWARM_HOME") or os.path.dirname(os.path.abspath(__file__))


def _p(*parts):
    return os.path.join(HOME, *parts)


def ledger(actor, action, subject):
    os.makedirs(HOME, exist_ok=True)
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor, "action": action,
                            "subject": subject}) + "\n")


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def campaign(name):
    return load_json(_p("campaigns", name + ".json"))


def warrant(name):
    return load_json(_p("warrants", name + ".json"))


def parse_draft(text):
    """Split --- front-matter from body. Returns (meta dict, body str)."""
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2).strip() + "\n"


def read_draft(draft_id):
    path = _p("drafts", draft_id + ".md")
    with open(path, encoding="utf-8") as f:
        return parse_draft(f.read())


def write_draft(draft_id, meta, body):
    head = "---\n" + "".join("%s: %s\n" % (k, v) for k, v in meta.items()) + "---\n"
    with open(_p("drafts", draft_id + ".md"), "w", encoding="utf-8") as f:
        f.write(head + body)


def critic(camp, meta, body):
    """Return a list of flags; empty means clean."""
    flags = []
    claims = camp.get("claims", [])
    refs = [r.strip() for r in str(meta.get("claim_refs", "")).strip("[]").split(",") if r.strip()]
    if not refs:
        flags.append("no claim_refs: every draft must cite campaign claims")
    for r in refs:
        if not r.isdigit() or int(r) >= len(claims):
            flags.append("bad claim_ref %r: outside campaign claims" % r)
    low = body.lower()
    for word in camp.get("banned", []):
        if word.lower() in low:
            flags.append("banned word %r" % word)
    limit = camp.get("limits", {}).get(meta.get("channel", ""), 20000)
    if len(body) > limit:
        flags.append("over channel limit: %d > %d chars" % (len(body), limit))
    if re.search(r"\bTODO\b|\[.+?\]|lorem ipsum", body, re.I):
        flags.append("placeholder text left in draft")
    return flags


def approve(camp_name, draft_id, by):
    camp = campaign(camp_name)
    meta, body = read_draft(draft_id)
    flags = critic(camp, meta, body)
    if flags:
        ledger("scheduler", "approve-refused", draft_id)
        return False, "critic flags: " + "; ".join(flags)
    os.makedirs(_p("approvals"), exist_ok=True)
    with open(_p("approvals", draft_id + ".json"), "w", encoding="utf-8") as f:
        json.dump({"draft": draft_id, "by": by,
                   "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, f, indent=1)
    meta["status"] = "approved"
    write_draft(draft_id, meta, body)
    ledger(by, "approve", draft_id)
    return True, "approved by " + by


def publish(camp_name, draft_id):
    w = warrant(camp_name)
    if "publish-with-approval" not in w.get("allows", []):
        ledger("publisher", "publish-refused", draft_id)
        return False, "warrant denies publishing for " + camp_name
    apath = _p("approvals", draft_id + ".json")
    if not os.path.exists(apath):
        ledger("publisher", "publish-refused", draft_id)
        return False, "no human approval receipt for " + draft_id
    camp = campaign(camp_name)
    meta, body = read_draft(draft_id)
    channel = meta.get("channel", "")
    if channel not in camp.get("channels", []):
        return False, "channel %r not in campaign" % channel
    receipt = adapters.publish(HOME, channel, {"id": draft_id, "body": body})
    if not receipt.get("ok"):
        ledger("publisher", "publish-failed", draft_id)
        psi.remember(HOME, "publish failed", "%s via %s" % (draft_id, channel),
                     receipt.get("error", "adapter failed")[:200])
        return False, receipt.get("error", "adapter failed")
    meta["status"] = "published"
    write_draft(draft_id, meta, body)
    ledger("publisher", "publish", "%s via %s dry_run=%s" % (draft_id, channel, receipt.get("dry_run")))
    return True, receipt


def review(camp_name):
    camp = campaign(camp_name)
    rows = []
    d = _p("drafts")
    if not os.path.isdir(d):
        return rows
    for fn in sorted(os.listdir(d)):
        if not fn.endswith(".md"):
            continue
        meta, body = read_draft(fn[:-3])
        apath = _p("approvals", fn[:-3] + ".json")
        rows.append({"id": fn[:-3], "channel": meta.get("channel", "?"),
                     "status": meta.get("status", "draft"),
                     "approved": os.path.exists(apath),
                     "flags": critic(camp, meta, body)})
    return rows


def main(argv):
    if len(argv) < 2:
        print("usage: runner.py review|critic|approve|publish|schedule|ledger <campaign> [id] [--by NAME]")
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
    if len(argv) < 3:
        print("usage: runner.py %s <campaign> [id]" % cmd)
        return 2
    camp_name, draft_id = argv[2], (argv[3] if len(argv) > 3 else None)
    if cmd == "review":
        for r in review(camp_name):
            print("%s [%s] %s approved=%s" % (r["id"], r["channel"], r["status"], r["approved"]))
        return 0
    if cmd == "critic":
        camp = campaign(camp_name)
        meta, body = read_draft(draft_id)
        flags = critic(camp, meta, body)
        print("clean" if not flags else "\n".join("FLAG: " + f for f in flags))
        return 0 if not flags else 1
    if cmd == "approve":
        by = argv[argv.index("--by") + 1] if "--by" in argv else "Corey"
        ok, msg = approve(camp_name, draft_id, by)
        print(msg)
        return 0 if ok else 1
    if cmd == "publish":
        ok, msg = publish(camp_name, draft_id)
        print(msg if isinstance(msg, str) else json.dumps(msg, indent=1))
        return 0 if ok else 1
    if cmd == "schedule":
        camp = campaign(camp_name)
        for slot in camp.get("cadence", []):
            print(slot)
        return 0
    print("unknown command: " + cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
