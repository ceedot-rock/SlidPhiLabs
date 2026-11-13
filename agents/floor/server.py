#!/usr/bin/env python3
"""Floor phone server — SlidPhiFloor backend + PWA shell (stdlib only).

One process serves the installable phone app and a token-gated JSON
API over the same port; put a TLS tunnel in front (see README) and the
phone talks straight to the Legion — same runners, same Ollama brain.

  FLOOR_TOKEN=... python server.py [port]     # default port 8410

API (all /api/* need header X-Floor-Token):
  GET  /api/health                 seats, brief age
  GET  /api/seats                  roster + identity lines
  POST /api/refresh                re-pull the up-to-the-minute brief
  POST /api/chat    {seat,message} chat (history kept server-side)
  POST /api/act     {seat,cmd,args} run palette action; destructive
                                   commands answer {need_confirm,ticket}
  POST /api/act/confirm {ticket}   single-use, 5-minute tickets
  GET  /api/motions                current open motions
  GET  /api/notes | POST /api/notes {text}

The PWA shell (/) is public; every watt of power sits behind the token.
"""
import hashlib
import hmac
import importlib.util
import json
import os
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
AGENTS = os.path.dirname(HERE)
NHOME = os.environ.get("FLOOR_HOME") or HERE
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(AGENTS, "common"))
import acn
import psi
import actions
import brain
import notes

TOKEN = os.environ.get("FLOOR_TOKEN", "")
if not TOKEN:
    TOKEN = secrets.token_hex(24)
    print("FLOOR_TOKEN unset — ephemeral token for this run only: %s" % TOKEN)
    print("Set FLOOR_TOKEN in the environment to keep it across restarts.")

SEATS = ("advisor", "compression", "teachaid", "autopilot", "board",
         "adswarm", "github-webdev", "github-engineer", "slidphi-agent",
         "law-scholar", "biz-scholar")
BRIEF_TTL = 300
TICKET_TTL = 300


def load_board():
    path = os.path.join(AGENTS, "board", "board.py")
    spec = importlib.util.spec_from_file_location("phone_board", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


BOARD = load_board()
BRIEF = {"at": 0.0, "reports": {}, "motions": []}
HIST = {s: [] for s in SEATS}
TICKETS = {}
CARDS = {}


def seat_home(seat):
    return os.path.join(AGENTS, seat)


def load_cards():
    for seat in SEATS:
        ident = ""
        try:
            with open(os.path.join(seat_home(seat), "identity.md"), encoding="utf-8") as f:
                ident = f.read()
        except OSError:
            ident = seat
        try:
            with open(os.path.join(seat_home(seat), "seat.json"), encoding="utf-8") as f:
                allows = json.load(f).get("allows", [])
        except (OSError, ValueError):
            allows = []
        CARDS[seat] = {"identity": ident, "allows": allows}


_REFRESH = {"running": False}


def _refresh_bg():
    """Re-collect off-thread; callers keep serving the stale cache."""
    if _REFRESH["running"]:
        return
    _REFRESH["running"] = True

    def go():
        try:
            BRIEF["reports"] = BOARD.collect()
            BRIEF["motions"] = BOARD.detect_motions(BRIEF["reports"])
            BRIEF["at"] = time.time()
        finally:
            _REFRESH["running"] = False

    threading.Thread(target=go, daemon=True).start()


def get_brief(force=False):
    if force:
        BRIEF["reports"] = BOARD.collect()
        BRIEF["motions"] = BOARD.detect_motions(BRIEF["reports"])
        BRIEF["at"] = time.time()
        return BRIEF
    if not BRIEF["reports"] or time.time() - BRIEF["at"] > BRIEF_TTL:
        _refresh_bg()
    return BRIEF


def system_for(seat):
    b = get_brief()
    if not b["reports"]:
        b = {"reports": {s: "(brief warming — answer from charter, offer refresh)" for s in SEATS},
             "motions": []}
    return brain.build_system(seat, CARDS[seat]["identity"], CARDS[seat]["allows"],
                              b["reports"].get(seat, "(no brief)"),
                              psi.recall(seat_home(seat)),
                              [m["title"] for m in b["motions"]])
STATIC = {"/": ("index.html", "text/html; charset=utf-8"),
          "/app.js": ("app.js", "text/javascript; charset=utf-8"),
          "/sw.js": ("sw.js", "text/javascript; charset=utf-8"),
          "/manifest.webmanifest": ("manifest.webmanifest", "application/manifest+json"),
          "/icon.svg": ("icon.svg", "image/svg+xml")}
PWA = os.path.join(HERE, "pwa")


def authed(handler):
    return hmac.compare_digest(handler.headers.get("X-Floor-Token", ""), TOKEN)


class Handler(BaseHTTPRequestHandler):
    server_version = "SlidPhiFloor/1"

    def log_message(self, *args):
        pass

    def _send(self, code, body, ctype):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj), "application/json")

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        try:
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except ValueError:
            return {}

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in STATIC or path.startswith("/icons/"):
            name = STATIC[path][0] if path in STATIC else path[1:]
            ctype = STATIC[path][1] if path in STATIC else "image/png"
            target = os.path.normpath(os.path.join(PWA, *name.split("/")))
            if not target.startswith(os.path.abspath(PWA) + os.sep):
                return self._json({"error": "no"}, 404)
            try:
                with open(target, "rb") as f:
                    return self._send(200, f.read(), ctype)
            except OSError:
                return self._json({"error": "missing"}, 404)
        if path == "/api/health":
            good = authed(self)
            return self._json({"ok": True, "seats": list(SEATS),
                               "brief_age_s": round(time.time() - BRIEF["at"], 1),
                               "authed": good})
        if not authed(self):
            return self._json({"error": "bad token"}, 401)
        if path == "/api/seats":
            return self._json({s: CARDS[s]["identity"].splitlines()[0][:120] for s in SEATS})
        if path == "/api/motions":
            b = get_brief()
            return self._json([{"title": m["title"], "detail": m["detail"][:500]} for m in b["motions"]])
        if path == "/api/notes":
            return self._json({"notes": notes.list_notes(NHOME)})
        return self._json({"error": "no such route"}, 404)

    def do_POST(self):
        if not authed(self):
            return self._json({"error": "bad token"}, 401)
        path = self.path.split("?", 1)[0]
        body = self._body()
        if path == "/api/refresh":
            b = get_brief(force=True)
            return self._json({"motions": [m["title"] for m in b["motions"]]})
        if path == "/api/chat":
            seat, message = body.get("seat", ""), (body.get("message", "") or "").strip()
            if seat not in SEATS or not message:
                return self._json({"error": "need seat + message"}, 400)
            notes.log(NHOME, "Corey→@%s" % seat, message)
            hist = HIST[seat][-8:]
            ok, reply = brain.chat(system_for(seat), hist, message)
            if ok:
                HIST[seat].extend([("user", message), ("assistant", reply)])
            notes.log(NHOME, "@%s" % seat, reply)
            if not ok:
                return self._json({"error": reply}, 502)
            return self._json({"reply": reply})
        if path == "/api/act":
            seat, cmd = body.get("seat", ""), (body.get("cmd", "") or "").lower()
            args = [str(a) for a in body.get("args", [])]
            if seat not in SEATS or cmd not in actions.palette(seat):
                return self._json({"error": "out of scope"}, 400)
            if actions.needs_confirm(cmd):
                ticket = secrets.token_hex(8)
                TICKETS[ticket] = {"seat": seat, "cmd": cmd, "args": args,
                                   "expires": time.time() + TICKET_TTL}
                return self._json({"need_confirm": True, "ticket": ticket,
                                   "preview": "@%s %s %s" % (seat, cmd, " ".join(args))})
            ok, out = actions.run(seat, cmd, args, AGENTS)
            return self._json({"ok": ok, "output": actions.trim(out)})
        if path == "/api/act/confirm":
            spec = TICKETS.pop(body.get("ticket", ""), None)
            if not spec or spec["expires"] < time.time():
                return self._json({"error": "ticket expired or used"}, 400)
            ok, out = actions.run(spec["seat"], spec["cmd"], spec["args"], AGENTS)
            return self._json({"ok": ok, "output": actions.trim(out)})
        if path == "/api/notes":
            if not (body.get("text", "") or "").strip():
                return self._json({"error": "empty note"}, 400)
            return self._json({"saved": notes.note(NHOME, body["text"])})
        return self._json({"error": "no such route"}, 404)


def main(argv):
    load_cards()
    _refresh_bg()
    print("brief warming in background; chat serves stale cache meanwhile")
    port = int(argv[1]) if len(argv) > 1 else 8410
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("SlidPhiFloor on http://127.0.0.1:%d/ (bind localhost; expose via tunnel)" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main(sys.argv)
