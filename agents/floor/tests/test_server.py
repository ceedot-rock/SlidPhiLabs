"""Tests for the floor phone server. Stdlib only; no Ollama needed."""
import importlib.util
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

TMP = tempfile.TemporaryDirectory()
os.environ["FLOOR_TOKEN"] = "test-token-123"
os.environ["FLOOR_HOME"] = TMP.name

_spec = importlib.util.spec_from_file_location(
    "floor_server",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server.py"))
server = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(server)


def call(port, method, path, body=None, token="test-token-123"):
    req = urllib.request.Request(
        "http://127.0.0.1:%d%s" % (port, path),
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json",
                 "X-Floor-Token": token} if token else {},
        method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


class Phone(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import time as _time
        server.load_cards()
        # Seed the brief cache: keeps tests off live runners (no bg collect).
        server.BRIEF.update({"at": _time.time(),
                             "reports": {"advisor": "seeded test brief"},
                             "motions": []})
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls._chat = server.brain.chat
        server.brain.chat = lambda *a, **k: (True, "test reply")

    @classmethod
    def tearDownClass(cls):
        server.brain.chat = cls._chat
        cls.httpd.shutdown()

    def test_health_public_shell_public(self):
        code, raw = call(self.port, "GET", "/api/health", token=None)
        self.assertEqual(code, 200)
        self.assertFalse(json.loads(raw)["authed"])
        code, raw = call(self.port, "GET", "/")
        self.assertEqual(code, 200)
        self.assertIn(b"SlidPhiFloor", raw)

    def test_auth_gate(self):
        code, _ = call(self.port, "GET", "/api/seats", token=None)
        self.assertEqual(code, 401)
        code, _ = call(self.port, "GET", "/api/seats", token="wrong")
        self.assertEqual(code, 401)
        code, raw = call(self.port, "GET", "/api/seats")
        self.assertEqual(code, 200)
        self.assertIn("advisor", json.loads(raw))

    def test_chat_roundtrip(self):
        code, raw = call(self.port, "POST", "/api/chat",
                         {"seat": "advisor", "message": "hello"})
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(raw)["reply"], "test reply")
        code, _ = call(self.port, "POST", "/api/chat", {"seat": "nope", "message": "x"})
        self.assertEqual(code, 400)

    def test_act_read_and_confirm_flow(self):
        code, raw = call(self.port, "POST", "/api/act",
                         {"seat": "compression", "cmd": "seat", "args": []})
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(raw)["ok"])
        code, raw = call(self.port, "POST", "/api/act",
                         {"seat": "advisor", "cmd": "deploy", "args": []})
        body = json.loads(raw)
        self.assertTrue(body.get("need_confirm"))
        code, raw = call(self.port, "POST", "/api/act/confirm",
                         {"ticket": body["ticket"]})
        self.assertEqual(code, 200)  # runs gates, fails honestly without --by
        code, raw = call(self.port, "POST", "/api/act/confirm",
                         {"ticket": body["ticket"]})
        self.assertEqual(code, 400)  # single-use
        code, _ = call(self.port, "POST", "/api/act",
                       {"seat": "compression", "cmd": "merge", "args": []})
        self.assertEqual(code, 400)  # out of scope

    def test_notes_roundtrip(self):
        code, raw = call(self.port, "POST", "/api/notes", {"text": "call corey"})
        self.assertEqual(code, 200)
        self.assertTrue(json.loads(raw)["saved"])
        code, raw = call(self.port, "GET", "/api/notes")
        self.assertTrue(json.loads(raw)["notes"])


if __name__ == "__main__":
    unittest.main()
