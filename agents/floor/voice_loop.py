#!/usr/bin/env python3
"""Voice loop — talk to every lab employee, no keyboard needed.

Push-to-talk without the push: open mic turns start on speech and end
on silence. Say "talk to <seat>" to switch desks, "ask <seat> to
<command>" to run real actions (dangerous ones ask for a spoken YES),
"take a note ..." to log, "refresh the brief" for fresh reports,
"goodbye" to leave.

  python voice_loop.py              # full voice floor (mic + speakers)
  python voice_loop.py --text-only  # skip the slow opening brief

Hearing and speech injectable for tests: VoiceLoop(mic=<fn>, speaker=<fn>).
"""
import os
import re
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
import voice as voice_mod
import floor as floor_mod

TEXT_ONLY = "--text-only" in sys.argv
ALIASES = {"greeter": "slidphi-agent", "webdev": "github-webdev",
           "engineer": "github-engineer", "law": "law-scholar",
           "business": "biz-scholar", "biz": "biz-scholar"}


def norm_seat(words):
    slug = re.sub(r"\s+", "-", words.strip().lower())
    slug = ALIASES.get(slug, slug)
    return slug if slug in floor_mod.SEATS else None


def parse(utterance):
    """Route one utterance. Returns (kind, payload). kinds: switch,
    refresh, motions, note, act, quit, chat."""
    low = utterance.strip().lower()
    m = re.match(r"^(talk to|switch to|go to)\s+(.+)$", low)
    if m:
        seat = norm_seat(m.group(2))
        return ("switch", seat) if seat else ("chat", utterance)
    if "refresh the brief" in low or low == "refresh":
        return ("refresh", None)
    if "motion" in low:
        return ("motions", None)
    m = re.match(r"^(take a note|note this|make a note)[:\s]+(.+)$", low)
    if m:
        return ("note", m.group(2))
    if low in ("goodbye", "quit", "exit", "leave", "hang up"):
        return ("quit", None)
    m = re.match(r"^ask\s+(.+?)\s+to\s+(\w+)\s*(.*)$", low)
    if m:
        seat = norm_seat(m.group(1))
        if seat:
            return ("act", (seat, m.group(2), m.group(3).split()))
    return ("chat", utterance)


class VoiceLoop:
    def __init__(self, mic=None, speaker=None):
        self.board = floor_mod.load_board()
        self.extra = ""
        print("Pulling the up-to-the-minute brief from all seats...")
        self.reports, self.motions = floor_mod.opening_brief(self.board)
        self.cards = {s: floor_mod.load_card(s) for s in floor_mod.SEATS}
        self.active = "advisor"
        self.history = {s: [] for s in floor_mod.SEATS}
        self.mic = mic or self._hear
        self.speaker = speaker or self._say

    def _hear(self, seconds=60):
        audio = voice_mod.listen(max_seconds=seconds)
        ok, text = voice_mod.transcribe(audio)
        return text if ok else ""

    def _say(self, text):
        ok, msg = voice_mod.status()
        if not ok:
            print("(voice off: %s)" % msg)
            return
        voice_mod.speak(text, HERE)

    def system_for(self, seat):
        base = brain.build_system(
            seat, self.cards[seat]["identity"], self.cards[seat]["allows"],
            self.reports.get(seat, "(no brief)"),
            psi.recall(floor_mod.seat_home(seat)),
            [m["title"] for m in self.motions], brief_lines=10)
        if self.extra:
            base += "\n" + self.extra
        return base

    def confirm_voice(self, preview):
        self.speaker("This will %s. Say yes to proceed." % preview)
        answer = (self.mic(8) or "").lower()
        return "yes" in answer

    def handle(self, utterance):
        kind, payload = parse(utterance)
        if kind == "quit":
            return "QUIT"
        if kind == "switch":
            self.active = payload
            return "You're with @%s." % payload
        if kind == "refresh":
            self.reports, self.motions = floor_mod.opening_brief(self.board)
            return "%d open motion(s) now." % len(self.motions)
        if kind == "motions":
            if not self.motions:
                return "Quiet floor — no open motions."
            return "On the table: " + "; ".join(m["title"] for m in self.motions)
        if kind == "note":
            notes.note(HERE, payload)
            return "Noted."
        if kind == "act":
            seat, cmd, args = payload
            if cmd not in actions.palette(seat):
                return "@%s cannot %s. In scope: %s." % (seat, cmd, ", ".join(actions.palette(seat)))
            if actions.needs_confirm(cmd):
                if not self.confirm_voice("@%s %s %s" % (seat, cmd, " ".join(args))):
                    return "Stood down."
            notes.log(HERE, "Corey(voice)@%s" % seat, "%s %s" % (cmd, " ".join(args)))
            ok, out = actions.run(seat, cmd, args, AGENTS)
            notes.log(HERE, "@%s(voice)" % seat, ("OK: " if ok else "FAIL: ") + out[:500])
            return ("Done. " if ok else "That failed. ") + out[:400]
        notes.log(HERE, "Corey(voice)→@%s" % self.active, utterance)
        hist = self.history[self.active][-8:]
        ok, reply = brain.chat(self.system_for(self.active), hist, utterance,
                               num_predict=150)
        if ok:
            self.history[self.active].extend([("user", utterance), ("assistant", reply)])
        notes.log(HERE, "@%s(voice)" % self.active, reply)
        return reply if ok else "I lost the brain: %s." % reply

    def run(self):
        ok, msg = voice_mod.status()
        if not ok:
            print("No voice: %s" % msg)
            return 2
        self.speaker("Floor open. You're with @advisor. Say talk to, then a name, to switch desks.")
        while True:
            heard = (self.mic() or "").strip()
            if not heard:
                continue
            print("You: %s" % heard)
            try:
                out = self.handle(heard)
            except Exception as e:
                out = "Floor error, kept going: %s." % e
            if out == "QUIT":
                self.speaker("Floor closed.")
                return 0
            print("@%s: %s" % (self.active, out))
            self.speaker(out)


def main():
    loop = VoiceLoop()
    return loop.run()


if __name__ == "__main__":
    sys.exit(main())
