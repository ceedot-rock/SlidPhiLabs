"""Tests for the floor app. Stdlib only; Ollama and runners faked."""
import importlib.util
import json
import os
import tempfile
import unittest

_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load(name):
    spec = importlib.util.spec_from_file_location(
        "floor_" + name, os.path.join(_HERE, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


brain = _load("brain")
actions = _load("actions")
notes = _load("notes")


class Brain(unittest.TestCase):
    def test_system_trims_brief(self):
        long_brief = "\n".join("line %d" % i for i in range(50))
        sys_text = brain.build_system("x", "id", [], long_brief, [], [], brief_lines=10)
        self.assertIn("line 9", sys_text)
        self.assertNotIn("line 30", sys_text)

    def test_system_carries_fresh_brief(self):
        sys_text = brain.build_system(
            "compression", "owner of codecs", ["spl_compress"],
            "METER: clean", [{"d": "drift", "o": "fixed"}], ["M1"])
        self.assertIn("METER: clean", sys_text)
        self.assertIn("drift", sys_text)
        self.assertIn("M1", sys_text)
        self.assertIn("spl_compress", sys_text)

    def test_chat_success_and_shape(self):
        ok, reply = brain.chat("sys", [], "hi",
                               post=lambda p, b, **k: (True, {"message": {"content": "yo"}}))
        self.assertTrue(ok)
        self.assertEqual(reply, "yo")

    def test_chat_unreachable(self):
        ok, reply = brain.chat("sys", [], "hi",
                               post=lambda p, b, **k: (False, "down"))
        self.assertFalse(ok)
        self.assertIn("down", reply)

    def test_chat_bad_shape(self):
        ok, reply = brain.chat("sys", [], "hi",
                               post=lambda p, b, **k: (True, {"nope": 1}))
        self.assertFalse(ok)


class Actions(unittest.TestCase):
    def test_palettes_cover_all_seats(self):
        for seat in ("adswarm", "advisor", "autopilot", "board", "compression",
                     "teachaid", "github-webdev", "github-engineer", "slidphi-agent",
                     "law-scholar", "biz-scholar"):
            self.assertTrue(actions.palette(seat), seat)

    def test_scope_refuses(self):
        ok, msg = actions.run("compression", "merge", [])
        self.assertFalse(ok)
        self.assertIn("in scope", msg)
        ok, msg = actions.run("nobody", "status", [])
        self.assertFalse(ok)

    def test_confirm_set(self):
        for cmd in ("approve", "merge", "deploy", "publish", "draft", "sweep"):
            self.assertTrue(actions.needs_confirm(cmd), cmd)
        self.assertFalse(actions.needs_confirm("status"))
        self.assertFalse(actions.needs_confirm("record"))

    def test_feedback_validation(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        os.makedirs(os.path.join(tmp.name, "slidphi-agent"))
        ok, _ = actions.feedback(tmp.name, ["criticism", "slow docs"])
        self.assertTrue(ok)
        ok, msg = actions.feedback(tmp.name, ["meh"])
        self.assertFalse(ok)
        ok, msg = actions.feedback(tmp.name, ["fine", "x"])
        self.assertFalse(ok)
        self.assertIn("kind must be", msg)


class Notes(unittest.TestCase):
    def test_roundtrip(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        notes.log(tmp.name, "Corey", "hello", session="t")
        p = notes.note(tmp.name, "follow up", session="t")
        self.assertTrue(os.path.exists(p))
        self.assertIn("t.md", notes.list_notes(tmp.name))
        with open(notes.transcript_path(tmp.name, "t"), encoding="utf-8") as f:
            self.assertIn("hello", f.read())


if __name__ == "__main__":
    unittest.main()
