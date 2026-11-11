"""Tests for the voice loop. Stdlib only; mic/speaker/brain/notes faked."""
import importlib.util
import os
import unittest
from unittest import mock

_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load(name):
    spec = importlib.util.spec_from_file_location(
        "vloop_" + name, os.path.join(_HERE, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


floor_mod = _load("floor")
voice_loop = _load("voice_loop")


class Parse(unittest.TestCase):
    def test_switch(self):
        self.assertEqual(voice_loop.parse("talk to compression"), ("switch", "compression"))
        self.assertEqual(voice_loop.parse("switch to law scholar"), ("switch", "law-scholar"))
        self.assertEqual(voice_loop.parse("go to webdev"), ("switch", "github-webdev"))

    def test_unknown_desk_falls_back_to_chat(self):
        kind, _ = voice_loop.parse("talk to nobody here")
        self.assertEqual(kind, "chat")

    def test_commands(self):
        self.assertEqual(voice_loop.parse("refresh the brief")[0], "refresh")
        self.assertEqual(voice_loop.parse("any motions?")[0], "motions")
        self.assertEqual(voice_loop.parse("take a note: call corey"),
                         ("note", "call corey"))
        self.assertEqual(voice_loop.parse("goodbye")[0], "quit")

    def test_ask_action(self):
        self.assertEqual(voice_loop.parse("ask teachaid to verify"),
                         ("act", ("teachaid", "verify", [])))
        self.assertEqual(voice_loop.parse("ask advisor to deploy teachaid"),
                         ("act", ("advisor", "deploy", ["teachaid"])))


class Loop(unittest.TestCase):
    def make(self, heard):
        spoken = []
        with mock.patch.object(voice_loop.floor_mod, "opening_brief", return_value=({}, [])):
            loop = voice_loop.VoiceLoop(mic=lambda s=60: heard, speaker=spoken.append)
        loop.reports = {s: "brief" for s in floor_mod.SEATS}
        loop.motions = []
        loop.cards = {s: {"identity": s, "allows": []} for s in floor_mod.SEATS}
        loop.history = {s: [] for s in floor_mod.SEATS}
        return loop, spoken

    def test_switch_and_chat(self):
        loop, _ = self.make("hi")
        with mock.patch.object(voice_loop.brain, "chat", return_value=(True, "hey")), \
             mock.patch.object(voice_loop.notes, "log"):
            self.assertEqual(loop.handle("talk to biz scholar"), "You're with @biz-scholar.")
            self.assertEqual(loop.active, "biz-scholar")
            self.assertEqual(loop.handle("hello"), "hey")

    def test_destructive_needs_spoken_yes(self):
        loop, _ = self.make("no way")
        with mock.patch.object(voice_loop.notes, "log"):
            out = loop.handle("ask teachaid to deploy")
        self.assertIn("Stood down", out)

    def test_destructive_yes_runs(self):
        loop, _ = self.make("yes do it")
        with mock.patch.object(voice_loop.notes, "log"), \
             mock.patch.object(voice_loop.actions, "run", return_value=(True, "shipped")):
            out = loop.handle("ask teachaid to verify")
        self.assertIn("Done", out)

    def test_out_of_scope_refused(self):
        loop, _ = self.make("x")
        out = loop.handle("ask compression to merge")
        self.assertIn("cannot merge", out)

    def test_note_and_motions(self):
        loop, _ = self.make("x")
        loop.motions = [{"title": "M1", "detail": "d"}]
        self.assertIn("M1", loop.handle("any motions"))
        with mock.patch.object(voice_loop.notes, "note", return_value="p"):
            self.assertEqual(loop.handle("take a note: ship friday"), "Noted.")


if __name__ == "__main__":
    unittest.main()
