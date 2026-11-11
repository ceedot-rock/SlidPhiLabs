"""Floor brain — per-employee Ollama chat over fresh runner context.

No new dependencies: urllib to a local Ollama (qwen2.5:7b-instruct on
this box by default). Every reply is grounded in a just-collected
brief: the seat's live board report plus its recalled lessons.
HTTP layer injectable for tests: pass post=<fake> to chat().
"""
import json
import os
import urllib.request

HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b-instruct")


def _post(path, payload, timeout=180):
    req = urllib.request.Request(
        HOST + path, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return True, json.loads(res.read().decode("utf-8"))
    except Exception as e:
        return False, "ollama unreachable at %s: %s" % (HOST, e)


def trim(text, n=25):
    lines = text.splitlines()
    if len(lines) <= n:
        return text
    return "\n".join(lines[:n]) + "\n… (%d more lines)" % (len(lines) - n)


def build_system(seat, identity, allows, brief, lessons, motions, brief_lines=25):
    return "\n".join([
        "You are @%s, a lab employee of Slid Phi Labs. Voice-short: under 80 words." % seat,
        "Who you are: %s" % " ".join(identity.split()),
        "Your ACN warrant allows: %s. Cap $0 — you never spend." % (", ".join(allows) or "nothing"),
        "LIVE BRIEF (collected seconds ago — trust this over memory):",
        trim(brief, brief_lines),
        "Your recalled lessons: %s" % (" | ".join(
            "%s→%s" % (r.get("d"), r.get("o")) for r in lessons) or "(none yet)"),
        "Open lab motions: %s" % ("; ".join(motions) or "none",
        ) + " Never invent links, prices, or test results. If asked to act, say which command to run.",
    ])


def chat(system, history, message, post=_post, num_predict=350):
    """One reply. history = [(role, text)] oldest first, trimmed by caller."""
    ok, out = post("/api/chat", {"model": MODEL, "stream": False,
                                 "options": {"temperature": 0.3, "num_predict": num_predict},
                                 "messages": [{"role": "system", "content": system}] +
                                 [{"role": r, "content": t} for r, t in history] +
                                 [{"role": "user", "content": message}]})
    if not ok:
        return False, out
    try:
        return True, out["message"]["content"].strip()
    except (KeyError, TypeError):
        return False, "odd ollama reply shape: %s" % json.dumps(out)[:200]
