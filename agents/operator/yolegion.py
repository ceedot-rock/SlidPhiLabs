#!/usr/bin/env python3
"""Yolegion — wake-word voice operator for the Legion (stdlib + audio).

Standby sips the mic in short blocks and only spends STT on blocks
that actually contain speech. On "Yolegion" it wakes, works the full
lab roster plus everyday machine verbs, and stands back down on
"stand down", idle timeout, or "shut down".

  python operator.py                  # standby for "Yolegion"
  WAKE_WORD="hey lab" python operator.py

Hearing/speech injectable for tests: Operator(hear=<fn>, say=<fn>).
"""
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ECHO = "--echo" in sys.argv
AGENTS = os.path.dirname(HERE)
FLOOR = os.path.join(AGENTS, "floor")
sys.path.insert(0, HERE)
sys.path.insert(0, FLOOR)
sys.path.insert(0, os.path.join(AGENTS, "common"))
import machine
import psi
import voice as voice_mod
import voice_loop


def wake_word():
    return os.environ.get("WAKE_WORD", machine.scope().get("wake", "yolegion")).lower()


def heard_wake(text, wake):
    """Normalize before matching: STT returns 'yo legion', scope says 'yolegion'."""
    norm = re.sub(r"[^a-z]", "", (text or "").lower())
    return re.sub(r"[^a-z]", "", wake) in norm


def wake_in(text, tail, wake):
    """Match across a 3-second block split: tail carries the prior block's last words."""
    return heard_wake(text, wake) or heard_wake((tail or "") + " " + text, wake)


def echo_heard(text, enabled=ECHO):
    """Diagnostic: print loud-block transcripts. Opt-in only (--echo)."""
    if enabled:
        print("heard: %s" % text)
    return text


def route(utterance):
    """Route one utterance. Returns (kind, payload); kind machine|lab.

    machine payloads: (verb, args...). Everything else is lab business
    for the voice loop (lab orders, chat, notes, motions).
    """
    text = utterance.strip()
    low = text.lower()
    if low in ("shut down", "shut it down", "over and out", "goodbye", "quit", "exit"):
        return ("quit", None)
    if low in ("stand down", "back to sleep", "go back to sleep"):
        return ("standby", None)
    if low in ("full brief", "refresh everything", "systems brief", "refresh the systems"):
        return ("machine", ("brief",))
    m = re.match(r"^open\s+(.+)$", low)
    if m:
        return ("machine", ("open", m.group(1)))
    m = re.match(r"^read\s+(.+)$", text.strip(), re.I)
    if m:
        return ("machine", ("read", m.group(1).strip()))
    if any(k in low for k in ("disk space", "memory", "system status", "how is the system",
                              "how's the system")):
        return ("machine", ("status",))
    m = re.match(r"^(run|check)\s+(.+?)\s+tests?$", low)
    if m:
        return ("machine", ("check", m.group(2)))
    m = re.match(r"^(delete|remove)\s+(.+)$", text.strip(), re.I)
    if m:
        return ("machine", ("delete", m.group(2).strip()))
    m = re.match(r"^(look up|search)( for)?\s+(.+)$", low)
    if m:
        return ("machine", ("lookup", m.group(3)))
    m = re.match(r"^write\s+(?:this\s+)?to\s+(\S+)$", low)
    if m:
        return ("machine", ("write", m.group(1)))
    return ("lab", utterance)


class Operator:
    def __init__(self, hear=None, say=None):
        self.vloop = voice_loop.VoiceLoop(mic=hear, speaker=(say or (lambda t: None)))
        self.hear = hear or self._hear_block_utterance
        self.say = say or self._speak
        self.pending_write = None
        self.idle_limit = machine.scope().get("idle_seconds", 90)
        print("Taking the full systems brief...")
        self.vloop.extra = machine.full_brief()

    def _speak(self, text):
        ok, msg = voice_mod.status()
        if not ok:
            print("(voice off: %s)" % msg)
            return
        voice_mod.speak(text, FLOOR)

    def _hear_block_utterance(self, seconds=60):
        audio = voice_mod.listen(max_seconds=seconds)
        ok, text = voice_mod.transcribe(audio)
        return text if ok else ""

    def hear_block(self, seconds=1.5):
        """One short standby block. Returns audio (no STT here).

        MIC_DEVICE env picks the input (index or name fragment);
        bad values fall back to the system default with a notice.
        """
        import sounddevice as sd
        dev = os.environ.get("MIC_DEVICE") or None
        try:
            stream = sd.InputStream(samplerate=voice_mod.SAMPLE_RATE, channels=1,
                                    dtype="float32", device=dev)
        except Exception as e:
            print("mic device %r failed (%s); using default" % (dev, e))
            stream = sd.InputStream(samplerate=voice_mod.SAMPLE_RATE, channels=1,
                                    dtype="float32")
        with stream:
            chunk, _ = stream.read(int(voice_mod.SAMPLE_RATE * seconds))
        return chunk.copy()

    @staticmethod
    def loud_enough(audio, thresh=None, window=0.2, rate=16000):
        """Peak window energy: a short word in a 3s block still trips it.

        Whole-block RMS dilutes a 0.5s utterance ~6x; the max over 0.2s
        windows does not. Empty audio is quiet, never an error.
        """
        import numpy as np
        if thresh is None:
            try:
                thresh = float(os.environ.get("ENERGY_THRESH", "0.02"))
            except ValueError:
                thresh = 0.02
        x = audio.astype("float64").flatten()
        n = max(1, int(window * rate))
        if x.size == 0:
            return False
        peak = max(float(np.sqrt(np.mean(w ** 2)))
                   for w in (x[i:i + n] for i in range(0, x.size, n)) if w.size)
        return peak > thresh

    def confirm_voice(self, preview):
        self.say("This will %s. Say yes to proceed." % preview)
        answer = (self.hear(8) or "").lower()
        return "yes" in answer

    def do_machine(self, verb, args):
        if verb == "open":
            ok, out = machine.open_app(args[0])
        elif verb == "read":
            ok, out = machine.read_file(args[0])
        elif verb == "status":
            ok, out = machine.system_status()
        elif verb == "check":
            ok, out = machine.project_check(args[0])
        elif verb == "delete":
            if not self.confirm_voice("delete %s" % args[0]):
                return "Stood down."
            ok, out = machine.delete_file(args[0], confirmed=True)
        elif verb == "lookup":
            ok, out = machine.lookup(args[0])
        elif verb == "write":
            self.pending_write = args[0]
            return "Say the content for %s." % args[0]
        elif verb == "brief":
            self.vloop.extra = machine.full_brief()
            self.vloop.reports, self.vloop.motions = voice_loop.floor_mod.opening_brief(
                self.vloop.board)
            return True, "Full brief rebuilt: %d seats, %d motion(s)." % (
                len(self.vloop.reports), len(self.vloop.motions))
        else:
            return "I don't have that verb."
        machine.ledger("operator", "verb-ok" if ok else "verb-fail", verb)
        psi.remember(machine.HOME, "did %s %s" % (verb, " ".join(args)[:120]),
                     "voice order", ("ok: " if ok else "fail: ") + out[:150])
        return machine.redact(("%s " % ("Done." if ok else "Failed.")) + out[:400])

    def handle(self, utterance):
        if self.pending_write:
            path = self.pending_write
            self.pending_write = None
            if machine.os.path.exists(path) and not self.confirm_voice(
                    "overwrite %s" % path):
                return "Stood down. The old file is untouched."
            ok, out = machine.write_file(path, utterance, confirmed=True)
            return out
        kind, payload = route(utterance)
        if kind == "quit":
            return "QUIT"
        if kind == "standby":
            return "STANDBY"
        if kind == "machine":
            verb = payload[0]
            if machine.is_irreversible(utterance) and verb not in ("delete",):
                if not self.confirm_voice(utterance[:150]):
                    return "Stood down."
            return self.do_machine(verb, payload[1:])
        return self.vloop.handle(utterance)

    def standby(self):
        wake = wake_word()
        try:
            cooldown = float(os.environ.get("STT_COOLDOWN", "5"))
        except ValueError:
            cooldown = 5.0
        print("Say '%s' ..." % wake)
        tail, last_stt = "", 0.0
        while True:
            try:
                audio = self.hear_block()
            except Exception as e:
                print("mic error: %s" % e)
                return "QUIT"
            if not self.loud_enough(audio):
                continue
            now = time.time()
            if now - last_stt < cooldown:
                continue
            last_stt = now
            ok, text = voice_mod.transcribe(audio, timeout=25)
            if not ok:
                continue
            echo_heard(text)
            if wake_in(text, tail, wake):
                machine.ledger("operator", "wake", wake)
                return "AWAKE"
            tail = " ".join(text.split()[-2:])

    def command(self):
        self.say("Yolegion awake. Orders?")
        last = time.time()
        while True:
            heard = (self.hear() or "").strip()
            if not heard:
                if time.time() - last > self.idle_limit:
                    self.say("Standing down.")
                    return "STANDBY"
                continue
            last = time.time()
            print("You: %s" % heard)
            try:
                out = self.handle(heard)
            except Exception as e:
                out = "Floor error, kept going: %s." % e
            if out in ("QUIT", "STANDBY"):
                if out == "QUIT":
                    self.say("Yolegion off.")
                return out
            print("Yolegion: %s" % out)
            self.say(out)

    def ptt(self):
        """Zero-idle mode: ENTER to talk, no standby STT spend at all."""
        print("Press ENTER to talk, Ctrl-C to quit.")
        while True:
            try:
                input("press ENTER, then speak... ")
            except (EOFError, KeyboardInterrupt):
                return 0
            heard = self._ptt_turn()
            if heard is None:
                return 0
            if heard:
                print("Yolegion: %s" % heard)
                self.say(heard)

    def _ptt_turn(self):
        heard = (self.hear() or "").strip()
        if not heard:
            return ""
        print("You: %s" % heard)
        try:
            out = self.handle(heard)
        except Exception as e:
            out = "Floor error, kept going: %s." % e
        if out == "QUIT":
            self.say("Yolegion off.")
            return None
        if out == "STANDBY":
            return ""
        return out

    def run(self):
        if "--ptt" in sys.argv:
            return self.ptt()
        ok, msg = voice_mod.status()
        if not ok:
            print("No voice: %s" % msg)
            return 2
        try:
            import sounddevice as sd
            print("mic: %s" % sd.query_devices(kind="input")["name"])
        except Exception as e:
            print("mic query failed: %s" % e)
        while True:
            if self.standby() == "QUIT":
                return 0
            if self.command() == "QUIT":
                return 0


def main():
    return Operator().run()


if __name__ == "__main__":
    sys.exit(main())
