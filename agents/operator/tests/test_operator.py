"""Tests for the Yolegion operator. Stdlib only; audio/brain faked."""
import importlib.util
import json
import os
import tempfile
import unittest
from unittest import mock

_HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load(name, modname):
    spec = importlib.util.spec_from_file_location(
        modname, os.path.join(_HERE, name))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


machine = _load("machine.py", "op_machine")
import sys as _sys
# Single instance: yolegion's `import machine` must bind this same module,
# or HOME overrides in setUp silently miss the code under test.
_sys.modules.setdefault("machine", machine)
operator = _load("yolegion.py", "op_operator")


class FakeLoop:
    def __init__(self, *a, **k):
        self.heard = []

    def handle(self, utterance):
        self.heard.append(utterance)
        return "lab reply"


def make(heard="yes"):
    with mock.patch.object(operator.voice_loop, "VoiceLoop", FakeLoop):
        op = operator.Operator(hear=lambda s=60: heard, say=lambda t: None)
    return op


class Route(unittest.TestCase):
    def test_machine_verbs(self):
        self.assertEqual(operator.route("open calculator"), ("machine", ("open", "calculator")))
        self.assertEqual(operator.route("read notes/a.md"), ("machine", ("read", "notes/a.md")))
        self.assertEqual(operator.route("disk space"), ("machine", ("status",)))
        self.assertEqual(operator.route("run compression tests"), ("machine", ("check", "compression")))
        self.assertEqual(operator.route("delete old.txt"), ("machine", ("delete", "old.txt")))
        self.assertEqual(operator.route("look up fly volumes"), ("machine", ("lookup", "fly volumes")))
        self.assertEqual(operator.route("write to a.txt"), ("machine", ("write", "a.txt")))

    def test_quit_standby(self):
        self.assertEqual(operator.route("shut down")[0], "quit")
        self.assertEqual(operator.route("stand down")[0], "standby")

    def test_lab_fallback(self):
        kind, payload = operator.route("ask advisor to triage")
        self.assertEqual(kind, "lab")


class Wake(unittest.TestCase):
    def test_heard_variants(self):
        self.assertTrue(operator.heard_wake("yolegion", "yolegion"))
        self.assertTrue(operator.heard_wake("yo legion", "yolegion"))
        self.assertTrue(operator.heard_wake("YO LEGION!", "yolegion"))
        self.assertTrue(operator.heard_wake("hey yolegion wake up", "yolegion"))
        self.assertFalse(operator.heard_wake("hello there", "yolegion"))
        self.assertFalse(operator.heard_wake("", "yolegion"))

    def test_peak_window_catches_short_burst(self):
        import numpy as np
        block = np.zeros(3 * 16000, dtype="float32")
        block[16000:16000 + 2400] = 0.08  # 0.15s word in 3s of silence
        self.assertTrue(operator.Operator.loud_enough(block, thresh=0.02))
        self.assertFalse(operator.Operator.loud_enough(
            np.zeros(3 * 16000, dtype="float32"), thresh=0.02))
        self.assertFalse(operator.Operator.loud_enough(
            np.zeros(0, dtype="float32"), thresh=0.02))

    def test_full_brief_never_leaks_values(self):
        os.environ["TAVILY_API_KEY"] = "tvly-secret-xyz"
        self.addCleanup(os.environ.pop, "TAVILY_API_KEY")
        text = machine.full_brief()
        for section in ("=== MACHINE", "system:", "keys:", "ollama:",
                        "agents:", "proposals waiting:"):
            self.assertIn(section, text)
        self.assertNotIn("tvly-secret-xyz", text)
        for var in ("CARTESIA_API_KEY", "TAVILY_API_KEY", "FLOOR_TOKEN"):
            val = os.environ.get(var, "").strip()
            if val:
                self.assertNotIn(val, text)

    def test_extra_reaches_system_prompt(self):
        vl = operator.voice_loop
        with mock.patch.object(vl.floor_mod, "opening_brief", return_value=({}, [])):
            loop = vl.VoiceLoop(mic=lambda s=60: "", speaker=lambda t: None)
        loop.cards = {"advisor": {"identity": "id", "allows": []}}
        loop.history = {"advisor": []}
        loop.extra = "MACHINE.INTEL"
        with mock.patch.object(vl.psi, "recall", return_value=[]):
            sys_text = loop.system_for("advisor")
        self.assertIn("MACHINE.INTEL", sys_text)

    def test_ptt_turn_routes_and_quits(self):
        heard = {"n": 0}

        def hear(s=60):
            heard["n"] += 1
            return "ask advisor to triage" if heard["n"] == 1 else "shut down"

        spoken = []
        with mock.patch.object(operator.voice_loop, "VoiceLoop", FakeLoop):
            op = operator.Operator(hear=hear, say=spoken.append)
        with mock.patch.object(operator.machine, "ledger", lambda *a: None):
            self.assertIn("lab reply", op._ptt_turn())
            self.assertIsNone(op._ptt_turn())
        self.assertEqual(spoken, ["Yolegion off."])

    def test_echo_passthrough(self):
        self.assertEqual(operator.echo_heard("hi", True), "hi")
        self.assertEqual(operator.echo_heard("hi", False), "hi")

    def test_carryover_split(self):
        self.assertTrue(operator.wake_in("legion", "yo", "yolegion"))
        self.assertTrue(operator.wake_in("yo legion", "", "yolegion"))
        self.assertFalse(operator.wake_in("legion of doom", "", "yolegion"))
        self.assertFalse(operator.wake_in("legion", "hello", "yolegion"))


class Gates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        os.environ["OPERATOR_HOME"] = self.tmp.name
        machine.HOME = self.tmp.name
        # yolegion holds its own `machine` module reference: point it at tmp too.
        operator.machine.HOME = self.tmp.name
        with open(os.path.join(self.tmp.name, "scope.json"), "w") as f:
            f.write('{"apps": {"calculator": "calc.exe"}, "blocklist": ["vault", "token"],'
                    ' "irreversible": ["\\\\bdel(ete)?\\\\b", "\\\\bdeploy\\\\b"]}')

    def tearDown(self):
        os.environ.pop("OPERATOR_HOME", None)
        machine.HOME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    def test_redact(self):
        self.assertNotIn("sk_car_abc123",
                         machine.redact("CARTESIA_API_KEY=sk_car_abc123"))
        self.assertNotIn("spl1.xyz", machine.redact("claim spl1.xyz done"))
        self.assertIn("hello", machine.redact("hello"))

    def test_blocklist(self):
        ok, _ = machine.read_file(os.path.join("x", "vault", "k"))
        self.assertFalse(ok)

    def test_delete_needs_confirm(self):
        ok, _ = machine.delete_file("whatever.txt")
        self.assertFalse(ok)

    def test_write_flow_confirms_overwrite(self):
        op = make("no")
        old = os.getcwd()
        os.chdir(self.tmp.name)
        self.addCleanup(os.chdir, old)
        self.assertIn("Say the content", op.handle("write to notes.txt"))
        self.assertIn("Wrote", op.handle("hello content"))
        with open("notes.txt", encoding="utf-8") as f:
            self.assertEqual(f.read(), "hello content")
        self.assertIn("Say the content", op.handle("write to notes.txt"))
        self.assertIn("Stood down", op.handle("other"))
        with open("notes.txt", encoding="utf-8") as f:
            self.assertEqual(f.read(), "hello content")

    def test_acted_orders_remembered(self):
        op = make("x")
        op.handle("disk space")
        with open(os.path.join(self.tmp.name, "observatory.jsonl"), encoding="utf-8") as f:
            rows = [json.loads(l) for l in f.read().splitlines() if l.strip()]
        self.assertTrue(any("status" in r["d"] for r in rows))

    def test_lab_delegates(self):
        op = make()
        self.assertEqual(op.handle("ask advisor to triage"), "lab reply")
        self.assertIn("ask advisor to triage", op.vloop.heard)


if __name__ == "__main__":
    unittest.main()
