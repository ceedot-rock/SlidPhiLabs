"""Machine verbs for the Yolegion operator (stdlib only).

Closed verb list — there is no raw-shell path. Destructive verbs take
an explicit confirmed=True they can only get from a spoken YES upstream.
Secrets policy: blocklisted paths refuse; outputs are redacted.
"""
import ctypes
import json
import os
import re
import shutil
import subprocess
import sys
import time

HOME = os.environ.get("OPERATOR_HOME") or os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(HOME))
FLOOR = os.path.join(os.path.dirname(HOME), "floor")
sys.path.insert(0, os.path.join(os.path.dirname(HOME), "common"))
sys.path.insert(0, FLOOR)
import tavily

REDACT = [re.compile(r"(?i)(api[_-]?key|token|secret|password|passwd)\s*[:=]\s*\S+"),
          re.compile(r"spl1\.[A-Za-z0-9]+")]


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


def redact(text):
    for rx in REDACT:
        text = rx.sub("[redacted]", text)
    return text


def blocked(path):
    low = os.path.abspath(path).lower()
    return any(re.search(pat.lower(), low) for pat in scope().get("blocklist", []))


def is_irreversible(text):
    return any(re.search(pat, text, re.I) for pat in scope().get("irreversible", []))


def open_app(name):
    apps = scope().get("apps", {})
    key = name.strip().lower()
    if key not in apps:
        return False, "I can open: %s." % ", ".join(sorted(apps))
    try:
        subprocess.Popen(apps[key], shell=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        return False, "could not open %s: %s" % (name, e)
    ledger("operator", "open-app", key)
    return True, "Opening %s." % key


def read_file(path, limit=4000):
    if blocked(path):
        return False, "That path is sealed — I don't read secret stores."
    try:
        if os.path.getsize(path) > 200000:
            return False, "That file is over 200 KB — say a smaller part."
        with open(path, encoding="utf-8", errors="replace") as f:
            text = f.read(limit)
    except OSError as e:
        return False, "cannot read it: %s" % e
    ledger("operator", "read-file", os.path.basename(path))
    return True, redact(text)


def write_file(path, content, confirmed=False):
    if blocked(path):
        return False, "That path is sealed — I don't write secret stores."
    if os.path.exists(path) and not confirmed:
        return False, "That file exists — overwriting needs a spoken YES."
    try:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    except OSError as e:
        return False, "cannot write it: %s" % e
    ledger("operator", "write-file", path)
    return True, "Wrote %s." % os.path.basename(path)


def delete_file(path, confirmed=False):
    if not confirmed:
        return False, "Deleting needs a spoken YES — say it and I'll do it."
    if blocked(path):
        return False, "That path is sealed."
    try:
        os.remove(path)
    except OSError as e:
        return False, "cannot delete it: %s" % e
    ledger("operator", "delete-file", path)
    return True, "Deleted %s." % os.path.basename(path)


def project_check(which):
    targets = {
        "compression": (LAB, "node --test test/pccz.test.mjs"),
        "teachaid": (os.path.join(os.path.dirname(LAB), "teachaid"), "npm test"),
    }
    if which not in targets:
        return False, "I can check: %s." % ", ".join(sorted(targets))
    cwd, cmd = targets[which]
    try:
        proc = subprocess.run(cmd, shell=True, capture_output=True, text=True,
                              timeout=600, cwd=cwd)
    except subprocess.TimeoutExpired:
        return False, "the check timed out"
    out = (proc.stdout if proc.returncode == 0 else proc.stderr).strip()[-1500:]
    ledger("operator", "check-pass" if proc.returncode == 0 else "check-fail", which)
    return proc.returncode == 0, redact(out or "(no output)")


def system_status():
    try:
        disk = shutil.disk_usage(os.path.abspath(os.sep))
        free_gb = disk.free / 1e9
    except OSError:
        free_gb = -1.0
    mem_gb = -1.0
    try:
        class Mem(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        m = Mem()
        m.dwLength = ctypes.sizeof(Mem)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
        mem_gb = m.ullAvailPhys / 1e9
    except Exception:
        pass
    return True, "Disk free %.1f GB. Memory free %.1f GB." % (free_gb, mem_gb)


def lab_action(seat, cmd, args):
    import actions
    ok, out = actions.run(seat, cmd, args, os.path.dirname(HOME))
    return ok, redact(out)


def uptime_hours():
    try:
        ms = ctypes.windll.kernel32.GetTickCount64()
        return round(ms / 3600000.0, 1)
    except Exception:
        return -1.0


def _git_short(repo):
    try:
        proc = subprocess.run("git status --short", shell=True, capture_output=True,
                              text=True, timeout=30, cwd=repo)
        if proc.returncode != 0:
            return "(not a repo)"
        out = proc.stdout.strip()
        return "(clean)" if not out else out[:600]
    except (OSError, subprocess.TimeoutExpired):
        return "(unreadable)"


def _ollama_models():
    import json as _json
    import urllib.request as _url
    try:
        with _url.urlopen("http://localhost:11434/api/tags", timeout=5) as res:
            return [m.get("name", "?") for m in _json.loads(res.read().decode())["models"]]
    except Exception:
        return []


def full_brief():
    """Whole-machine snapshot for the operator's brain. Presence, never values."""
    agents_dir = os.path.dirname(HOME)
    lab_root = os.path.dirname(agents_dir)
    lines = ["=== MACHINE (full systems brief) ==="]
    ok, sysline = system_status()
    lines.append("system: %s uptime %.1f h" % (sysline, uptime_hours()))
    keys = {k: ("present" if os.environ.get(k, "").strip() else "absent")
            for k in ("CARTESIA_API_KEY", "TAVILY_API_KEY", "SPL_ACN_KEY",
                      "FLOOR_TOKEN", "OPENAI_API_KEY")}
    lines.append("keys: " + ", ".join("%s=%s" % kv for kv in keys.items()))
    models = _ollama_models()
    lines.append("ollama: %s" % (", ".join(models) if models else "unreachable"))
    workspace = os.path.dirname(lab_root)
    for repo in ("SlidPhiLabs", "teachaid", "gitdepot-hub", "hello-solo", "Agent-Rider"):
        state = _git_short(os.path.join(workspace, repo)).splitlines()
        lines.append("repo %s: %s" % (repo, state[0][:120] if state else "(?)"))
    try:
        agents = sorted(d for d in os.listdir(agents_dir)
                        if os.path.isdir(os.path.join(agents_dir, d)))
    except OSError:
        agents = []
    lines.append("agents: %s" % ", ".join(agents))
    for agent in agents:
        led = os.path.join(agents_dir, agent, "ledger.jsonl")
        try:
            with open(led, encoding="utf-8") as f:
                tail = f.read().splitlines()[-2:]
            if tail:
                lines.append("@%s: %s" % (agent, " | ".join(tail)[:200]))
        except OSError:
            pass
    prop = os.path.join(agents_dir, "autopilot", "proposals")
    try:
        lines.append("proposals waiting: %d" % len(
            [f for f in os.listdir(prop) if f.endswith(".md")]))
    except OSError:
        lines.append("proposals waiting: ?")
    return redact("\n".join(lines))


def lookup(query):
    return tavily.search(query, note="operator")
