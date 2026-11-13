"""Tavily web lookup for lab agents, with mandatory pedia deposits.

Standing rule: everything ever pulled from Tavily lands in the
Slidphiclepedia (pulls.jsonl append-only) before anything is built on
it. This module enforces that: search() deposits first, then reports.

Key rides env TAVILY_API_KEY (provisioned from the DPAPI vault by the
operator). The key value is never printed, logged, or deposited.
Transport injectable for tests: pass post=<fake> and pedia=<tmp path>.
"""
import datetime
import json
import os
import urllib.request

API = "https://api.tavily.com/search"
KEY_ENV = "TAVILY_API_KEY"
LAB = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PEDIA = os.path.join(LAB, "docs", "slidphiclepedia", "pulls.jsonl")


def _post(payload, timeout=60):
    req = urllib.request.Request(
        API, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def deposit(query, results, note="", pedia=PEDIA):
    """Append one record per result. Returns count deposited."""
    day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    os.makedirs(os.path.dirname(pedia), exist_ok=True)
    n = 0
    with open(pedia, "a", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps({
                "d": day, "q": query,
                "title": str(r.get("title", ""))[:200],
                "url": str(r.get("url", ""))[:300],
                "snippet": str(r.get("content", ""))[:280],
                "note": note[:200],
            }) + "\n")
            n += 1
    return n


def search(query, note="", max_results=5, post=_post, pedia=PEDIA):
    """Search, deposit to the pedia, then report. Returns (ok, text)."""
    key = os.environ.get(KEY_ENV, "").strip()
    if not key:
        return False, "web lookup is not configured (no %s)." % KEY_ENV
    try:
        out = post({"api_key": key, "query": query, "search_depth": "basic",
                    "max_results": max_results})
    except Exception as e:
        return False, "lookup failed: %s" % e
    results = out.get("results", []) if isinstance(out, dict) else []
    if not results:
        return True, "No results."
    deposit(query, results, note, pedia)
    lines = ["- %s: %s" % (r.get("title", "?"), str(r.get("content", ""))[:300])
             for r in results[:max_results]]
    return True, "\n".join(lines)
