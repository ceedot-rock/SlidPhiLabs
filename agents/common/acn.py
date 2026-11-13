"""AcN seat discipline for lab agents (stdlib only).

A seat is the agent's warrant on the Agent Commerce Network: which tools
it may call and the spend cap that binds it. Seats ship spend-closed
(cap_usd 0, no key in the repo); a live paid call additionally needs a
claim token in SPL_ACN_KEY and Corey's per-item go.

seat.json shape (lives beside the runner, never holds secrets):
  {"seat": "<name>", "network": "https://www.slidphilabs.com/api/mcp",
   "allows": ["spl_catalog", ...], "cap_usd": 0, "key_env": "SPL_ACN_KEY"}
"""
import json
import os
import time

NETWORK = "https://www.slidphilabs.com/api/mcp"
KEY_ENV = "SPL_ACN_KEY"


def load(home):
    with open(os.path.join(home, "seat.json"), encoding="utf-8") as f:
        seat = json.load(f)
    seat.setdefault("network", NETWORK)
    seat.setdefault("key_env", KEY_ENV)
    seat.setdefault("allows", [])
    seat.setdefault("cap_usd", 0)
    return seat


def key_present(seat):
    return bool(os.environ.get(seat.get("key_env", KEY_ENV), "").strip())


def allowed(seat, tool):
    """Warrant check. Returns (ok, reason)."""
    if tool not in seat.get("allows", []):
        return False, "tool %r outside seat warrant (allows: %s)" % (
            tool, ", ".join(seat.get("allows", [])) or "(none)")
    return True, ""


def spendable(seat, usd):
    """Cap check. Returns (ok, reason). cap 0 closes all paid calls."""
    try:
        amount = float(usd)
    except (TypeError, ValueError):
        return False, "bad amount %r" % (usd,)
    if amount <= 0:
        return True, ""
    if amount > float(seat.get("cap_usd", 0)):
        return False, "amount $%s over seat cap $%s" % (usd, seat.get("cap_usd", 0))
    if not key_present(seat):
        return False, "no claim token in %s" % seat.get("key_env", KEY_ENV)
    return True, ""


def status(home):
    seat = load(home)
    return "\n".join([
        "seat: %s" % seat.get("seat", "?"),
        "network: %s" % seat.get("network", NETWORK),
        "allows: %s" % (", ".join(seat.get("allows", [])) or "(none)"),
        "cap_usd: %s" % seat.get("cap_usd", 0),
        "claim token: %s" % ("present (env only)" if key_present(seat) else "absent — paid calls closed"),
    ])


def receipt(home, actor, tool, ok, detail=""):
    """Write an AcN receipt into the agent's ledger. Same envelope."""
    with open(os.path.join(home, "ledger.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "actor": actor,
                            "action": "acn-%s" % ("ok" if ok else "refused"),
                            "subject": "%s %s" % (tool, detail[:160])}) + "\n")
