#!/usr/bin/env python3
"""Copy seat. Drafts web and ad lines. Does not invent prices.

Stdlib only. Home override: COPY_HOME.
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "common"))
import tavily

HOME = os.environ.get("COPY_HOME") or os.path.dirname(os.path.abspath(__file__))

REFUSED = re.compile(
    r"surprise fee|no hidden|nothing shady|trust us|honest pricing|"
    r"not trying to|no tricks|we'?re not",
    re.I,
)


def _p(*parts):
    return os.path.join(HOME, *parts)


def ledger(action, subject):
    with open(_p("ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "actor": "copy",
            "action": action,
            "subject": subject,
        }) + "\n")


def lint(text):
    hit = REFUSED.search(text or "")
    return None if hit is None else hit.group(0)


def draft(buyer, job, mechanism, outcome, price, action):
    """Five lines. Raises ValueError if a line defends the price."""
    lines = [
        "%s, %s." % (buyer.strip(), job.strip()),
        mechanism.strip(),
        outcome.strip(),
        price.strip(),
        action.strip(),
    ]
    text = "\n".join(lines)
    bad = lint(text)
    if bad:
        raise ValueError("refused: %s" % bad)
    os.makedirs(_p("drafts"), exist_ok=True)
    name = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + ".md"
    with open(_p("drafts", name), "w", encoding="utf-8") as f:
        f.write(text + "\n")
    ledger("draft", name)
    return text


def research(query):
    ok, text = tavily.search(query, note="copy", max_results=4)
    ledger("research", query[:120])
    return ok, text


def main(argv):
    if len(argv) < 2:
        print("use: draft | research <query>")
        return 2
    if argv[1] == "research":
        ok, text = research(" ".join(argv[2:]))
        print(text)
        return 0 if ok else 1
    if argv[1] == "draft":
        if len(argv) != 8:
            print("draft needs buyer, job, mechanism, outcome, price, action")
            return 2
        try:
            print(draft(*argv[2:]))
        except ValueError as exc:
            print(exc)
            return 1
        return 0
    print("unknown command")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
