"""Tests for the biz-scholar runner. Stdlib only; no network."""
import importlib.util
import json
import os
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location(
    "biz_runner",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runner.py"))
runner = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(runner)

FAKE_POST = lambda p: {"results": [
    {"title": "Rival Meter", "url": "https://example.com/r", "content": "$0.30/GB"}]}


class Scholar(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        os.environ["BIZ_HOME"] = self.tmp.name
        runner.HOME = self.tmp.name
        with open(os.path.join(self.tmp.name, "scope.json"), "w", encoding="utf-8") as f:
            json.dump({"owns": ["briefs/"]}, f)

    def tearDown(self):
        os.environ.pop("BIZ_HOME", None)

    def test_lookup_no_key(self):
        os.environ.pop("TAVILY_API_KEY", None)
        ok, msg = runner.lookup("rival pricing")
        self.assertFalse(ok)
        self.assertIn("TAVILY_API_KEY", msg)

    def test_brief_writes_cited_draft(self):
        os.environ["TAVILY_API_KEY"] = "tvly-test"
        self.addCleanup(os.environ.pop, "TAVILY_API_KEY")
        ok, path = runner.brief("rival meters", post=FAKE_POST)
        self.assertTrue(ok)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        self.assertIn("DRAFT", text)
        self.assertIn("Rival Meter", text)

    def test_status_lists_briefs(self):
        os.makedirs(os.path.join(self.tmp.name, "briefs"))
        with open(os.path.join(self.tmp.name, "briefs", "m.md"), "w") as f:
            f.write("x")
        out = runner.status(run=lambda c, d: (True, "clean"))
        self.assertIn("m.md", out)


if __name__ == "__main__":
    unittest.main()
