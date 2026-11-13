"""Tests for the common Tavily sidecar. Stdlib only; no network."""
import importlib.util
import json
import os
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location(
    "common_tavily",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tavily.py"))
tavily = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tavily)

FAKE_OUT = {"results": [
    {"title": "T1", "url": "https://example.com/1", "content": "c1 " * 200},
    {"title": "T2", "url": "https://example.com/2", "content": "c2"},
]}


class Lookup(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.pedia = os.path.join(self.tmp.name, "pulls.jsonl")
        os.environ.pop("TAVILY_API_KEY", None)

    def test_missing_key(self):
        ok, msg = tavily.search("x", post=lambda p: FAKE_OUT, pedia=self.pedia)
        self.assertFalse(ok)
        self.assertIn("TAVILY_API_KEY", msg)
        self.assertFalse(os.path.exists(self.pedia))

    def test_search_deposits_before_reporting(self):
        os.environ["TAVILY_API_KEY"] = "tvly-test"
        self.addCleanup(os.environ.pop, "TAVILY_API_KEY")
        seen = {}

        def post(payload):
            seen.update(payload)
            return FAKE_OUT

        ok, text = tavily.search("lab licenses", note="scholar", post=post, pedia=self.pedia)
        self.assertTrue(ok)
        self.assertIn("T1", text)
        self.assertNotIn("tvly-test", text)
        self.assertEqual(seen["query"], "lab licenses")
        with open(self.pedia, encoding="utf-8") as f:
            rows = [json.loads(l) for l in f.read().splitlines()]
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["q"], "lab licenses")
        self.assertLessEqual(len(rows[0]["snippet"]), 280)
        blob = open(self.pedia, encoding="utf-8").read()
        self.assertNotIn("tvly-test", blob)

    def test_empty_results(self):
        os.environ["TAVILY_API_KEY"] = "tvly-test"
        self.addCleanup(os.environ.pop, "TAVILY_API_KEY")
        ok, text = tavily.search("zzz", post=lambda p: {"results": []}, pedia=self.pedia)
        self.assertTrue(ok)
        self.assertIn("No results", text)

    def test_transport_failure(self):
        os.environ["TAVILY_API_KEY"] = "tvly-test"
        self.addCleanup(os.environ.pop, "TAVILY_API_KEY")

        def boom(payload):
            raise ConnectionError("down")

        ok, text = tavily.search("x", post=boom, pedia=self.pedia)
        self.assertFalse(ok)
        self.assertIn("down", text)


if __name__ == "__main__":
    unittest.main()
