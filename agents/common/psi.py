"""PSI experience memory for lab agents (stdlib only).

Ledger.jsonl says what happened; observatory.jsonl says what was
learned: {"at", "d", "c", "o"} — decision/situation, context, outcome.
Runners recall lessons at startup-worthy moments and remember failures
the instant they happen, so the next run starts smarter.
"""
import json
import os
import time

MEMORY = "observatory.jsonl"


def remember(home, d, c, o):
    """Append one lesson. All three fields required, capped."""
    if not (d and c and o):
        return False, "lesson needs d, c, and o"
    os.makedirs(home, exist_ok=True)
    with open(os.path.join(home, MEMORY), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "d": str(d)[:300], "c": str(c)[:300],
                            "o": str(o)[:300]}) + "\n")
    return True, "remembered"


def recall(home, n=5):
    """Last n lessons, newest last. Empty memory is normal, not an error."""
    try:
        with open(os.path.join(home, MEMORY), encoding="utf-8") as f:
            rows = [json.loads(l) for l in f.read().splitlines() if l.strip()]
    except (OSError, ValueError):
        return []
    return rows[-n:]


def formatted(home, n=5):
    rows = recall(home, n)
    if not rows:
        return "(no lessons yet — failures will teach this memory)"
    return "\n".join("- [%s] d:%s c:%s o:%s" % (r.get("at", "?")[:10], r.get("d"),
                                                r.get("c"), r.get("o")) for r in rows)
