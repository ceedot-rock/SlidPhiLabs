"""Tests for the TeachAid agent runner. Stdlib only."""
import json
import os
import sys
import tempfile
import unittest

import importlib.util
_spec = importlib.util.spec_from_file_location(
    "teachaid_runner",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runner.py"))
runner = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(runner)


class Gates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["TEACHAID_HOME"] = self.tmp.name
        runner.HOME = self.tmp.name
        with open(os.path.join(self.tmp.name, "scope.json"), "w", encoding="utf-8") as f:
            json.dump({"live": "https://teachaid.fly.dev", "plan": "TeachAid Pro $9/mo",
                       "repo_dir": self.tmp.name, "verify": ["npm test"],
                       "audit": ["node scripts/curriculum-audit.js"],
                       "deploy": {"teachaid": "fly deploy"}}, f)

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("TEACHAID_HOME", None)

    def test_deploy_refuses_without_by(self):
        ok, msg = runner.deploy("", True, run=lambda c, d: (True, "ok"))
        self.assertFalse(ok)
        self.assertIn("--by", msg)

    def test_deploy_refuses_without_confirm(self):
        ok, msg = runner.deploy("Corey", False, run=lambda c, d: (True, "ok"))
        self.assertFalse(ok)
        self.assertIn("--confirm", msg)

    def test_deploy_refuses_red_tests(self):
        ok, msg = runner.deploy("Corey", True, run=lambda c, d: (False, "boom"))
        self.assertFalse(ok)
        self.assertIn("red", msg)

    def test_deploy_passes_chain_and_ledgers(self):
        ok, msg = runner.deploy("Corey", True, run=lambda c, d: (True, "deployed"))
        self.assertTrue(ok)
        with open(os.path.join(self.tmp.name, "ledger.jsonl"), encoding="utf-8") as f:
            lines = f.read()
        self.assertIn("verify-pass", lines)
        self.assertIn("deploy", lines)

    def test_verify_fail_ledgers(self):
        ok, _ = runner.verify(run=lambda c, d: (False, "boom"))
        self.assertFalse(ok)
        with open(os.path.join(self.tmp.name, "ledger.jsonl"), encoding="utf-8") as f:
            self.assertIn("verify-fail", f.read())


if __name__ == "__main__":
    unittest.main()
