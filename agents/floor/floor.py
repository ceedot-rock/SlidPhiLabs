#!/usr/bin/env python3
"""Floor — live terminal chat + voice with all lab employees.

  python floor.py                      # chat floor (Ollama brain)
  python floor.py --text-only          # skip the opening brief's slow calls

On start it pulls an up-to-the-minute brief (board.collect over all
seats) so every employee answers from fresh reports, not memory.
Slash commands below; a bare line talks to the active seat.

  use <seat> | seats | tell <seat> <msg> | all <msg> | refresh
  act <seat> <cmd...>     run in-scope actions (writes ask YES first)
  recall [n] | seat       active seat's lessons / ACN seat
  note <text> | notes     save + list notes (chat auto-logs transcripts/)
  voice on|off|status | talk <seat> | say <text>
  help | quit
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
AGENTS = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(AGENTS, "common"))
import acn
import psi
import actions
import brain
import notes

SEATS = ("advisor", "compression", "teachaid", "autopilot", "board",
         "adswarm", "github-webdev", "github-engineer", "slidphi-agent",
         "law-scholar", "biz-scholar")
TEXT_ONLY = "--text-only" in sys.argv


def load_board():
    path = os.path.join(AGENTS, "board", "board.py")
    spec = importlib.util.spec_from_file_location("floor_board", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def seat_home(seat):
    return os.path.join(AGENTS, seat)


def read_text(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""


def load_card(seat):
    home = seat_home(seat)
    try:
        with open(os.path.join(home, "seat.json"), encoding="utf-8") as f:
            s = json.load(f)
    except (OSError, ValueError):
        s = {"allows": []}
    return {"identity": read_text(os.path.join(home, "identity.md")) or seat,
            "allows": s.get("allows", [])}


def opening_brief(board):
    """Up-to-the-minute context for the whole floor. Slow calls once."""
    if TEXT_ONLY:
        return {s: "(brief skipped --text-only)" for s in SEATS}, []
    reports = board.collect()
    return reports, board.detect_motions(reports)


class Floor:
    def __init__(self):
        self.board = load_board()
        print("Pulling the up-to-the-minute brief from all seats...")
        self.reports, self.motions = opening_brief(self.board)
        self.cards = {s: load_card(s) for s in SEATS}
        self.active = "advisor"
        self.history = {s: [] for s in SEATS}
        self.voice_on = False
        ok, msg = self.voice_status()
        print("Floor open. Talking to @advisor. %d open motion(s). Voice: %s."
              % (len(self.motions), msg))
        for m in self.motions:
            print("  MOTION: %s" % m["title"])

    def voice_status(self):
        try:
            import voice as v
            return v.status()
        except ImportError as e:
            return False, "voice module unloadable: %s" % e

    def system_for(self, seat):
        lessons = psi.recall(seat_home(seat))
        motions = [m["title"] for m in self.motions]
        return brain.build_system(seat, self.cards[seat]["identity"],
                                  self.cards[seat]["allows"],
                                  self.reports.get(seat, "(no brief)"),
                                  lessons, motions)

    def tell(self, seat, message, speak_also=None):
        if seat not in SEATS:
            return "no such seat (try: %s)" % ", ".join(SEATS)
        notes.log(HERE, "Corey→@%s" % seat, message)
        hist = self.history[seat][-8:]
        ok, reply = brain.chat(self.system_for(seat), hist, message)
        if ok:
            self.history[seat].append(("user", message))
            self.history[seat].append(("assistant", reply))
        notes.log(HERE, "@%s" % seat, reply)
        if (speak_also or self.voice_on) and ok:
            try:
                import voice as v
                vok, vmsg = v.status()
                if vok:
                    v.speak(reply, HERE)
                else:
                    reply += "\n(voice off: %s)" % vmsg
            except ImportError as e:
                reply += "\n(voice off: %s)" % e
        return reply if ok else "brain unreachable: %s" % reply
    def act(self, seat, cmd, args):
        if seat not in SEATS:
            return "no such seat (try: %s)" % ", ".join(SEATS)
        if cmd not in actions.palette(seat):
            return "@%s cannot %r (in scope: %s)" % (seat, cmd, ", ".join(actions.palette(seat)))
        if actions.needs_confirm(cmd):
            print("Destructive: @%s %s %s — type YES to proceed."
                  % (seat, cmd, " ".join(args)))
            if input().strip() != "YES":
                return "stood down."
        notes.log(HERE, "Corey⚙@%s" % seat, "%s %s" % (cmd, " ".join(args)))
        ok, out = actions.run(seat, cmd, args, AGENTS)
        notes.log(HERE, "@%s⚙" % seat, ("OK: " if ok else "FAIL: ") + out[:500])
        return ("OK\n" if ok else "FAILED\n") + actions.trim(out)

    def refresh(self):
        print("Re-pulling the brief...")
        self.reports, self.motions = opening_brief(self.board)
        return "%d open motion(s) now." % len(self.motions)

    def talk(self, seat):
        try:
            import voice as v
        except ImportError as e:
            return "voice module unloadable: %s" % e
        ok, msg = v.status()
        if not ok:
            return msg
        audio = v.record_until_enter()
        ok, text = v.transcribe(audio)
        print("You (voice): %s" % text)
        if not ok:
            return text
        return self.tell(seat, text, speak_also=True)

    def handle(self, line):
        line = line.strip()
        if not line:
            return None
        if not line.startswith("/"):
            return self.tell(self.active, line)
        parts = line[1:].split(None, 2)
        cmd = parts[0].lower() if parts else ""
        rest = parts[1:] + [""] * (2 - len(parts[1:]))
        if cmd in ("quit", "q", "exit"):
            return "QUIT"
        if cmd == "help":
            return ("seats | use <seat> | tell <seat> <msg> | all <msg> | refresh\n"
                    "act <seat> <cmd...> (writes ask YES) | recall [n] | seat\n"
                    "note <text> | notes | voice on|off|status | talk <seat> | say <text> | quit")
        if cmd == "seats":
            return "\n".join("@%s — %s" % (s, self.cards[s]["identity"].splitlines()[0][:80]) for s in SEATS)
        if cmd == "use" and rest[0] in SEATS:
            self.active = rest[0]
            return "talking to @%s" % self.active
        if cmd == "tell" and len(parts) == 3 and parts[1] in SEATS:
            return self.tell(parts[1], parts[2])
        if cmd == "all" and len(parts) >= 2:
            msg = line[1:].split(None, 1)[1]
            outs = []
            for s in SEATS:
                print("... @%s thinking" % s)
                outs.append("@%s: %s" % (s, self.tell(s, msg)))
            return "\n\n".join(outs)
        if cmd == "act" and len(parts) == 3:
            sub = parts[2].split()
            return self.act(parts[1], sub[0].lower() if sub else "", sub[1:])
        if cmd == "refresh":
            return self.refresh()
        if cmd == "recall":
            n = int(rest[0]) if rest[0].isdigit() else 5
            return psi.formatted(seat_home(self.active), n)
        if cmd == "seat":
            return acn.status(seat_home(self.active))
        if cmd == "note" and len(parts) >= 2:
            return "noted in %s" % notes.note(HERE, line[1:].split(None, 1)[1])
        if cmd == "notes":
            found = notes.list_notes(HERE)
            return "\n".join(found) or "(no notes yet)"
        if cmd == "voice":
            if rest[0] == "on":
                ok, msg = self.voice_status()
                self.voice_on = ok
                return ("voice on — replies will speak" if ok else msg)
            if rest[0] == "off":
                self.voice_on = False
                return "voice off"
            ok, msg = self.voice_status()
            return msg
        if cmd == "talk" and rest[0] in SEATS:
            return self.talk(rest[0])
        if cmd == "say" and len(parts) >= 2:
            try:
                import voice as v
            except ImportError as e:
                return "voice module unloadable: %s" % e
            ok, msg = v.status()
            if not ok:
                return msg
            vok, vmsg = v.speak(line[1:].split(None, 1)[1], HERE)
            return vmsg
        return "unknown command — try help"


def main():
    floor = Floor()
    while True:
        try:
            line = input("[@%s] " % floor.active)
        except EOFError:
            break
        try:
            out = floor.handle(line)
        except KeyboardInterrupt:
            break
        except Exception as e:
            out = "floor error (logged, kept going): %s" % e
        if out == "QUIT":
            break
        if out:
            print(out)
    print("Floor closed. Transcript + notes saved beside the app.")


if __name__ == "__main__":
    main()
