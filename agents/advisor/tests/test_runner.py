"""Tests for the lab advisor runner. Stdlib only."""
import json
import os
import sys
import tempfile
import unittest

import importlib.util
_spec = importlib.util.spec_from_file_location(
    "advisor_runner",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runner.py"))
runner = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(runner)


class Gates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["ADVISOR_HOME"] = self.tmp.name
        runner.HOME = self.tmp.name
        with open(os.path.join(self.tmp.name, "scope.json"), "w", encoding="utf-8") as f:
            json.dump({"repos": [self.tmp.name],
                       "deploys": {"teachaid": {"cmd": "fly deploy", "cwd": self.tmp.name}},
                       "doors": {"money": "lab-ledger/", "deploys": "scope maps",
                                 "products": "site", "docs": "docs", "agents": "agents/"}}, f)

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("ADVISOR_HOME", None)

    def test_deploy_refuses_outside_allow_list(self):
        ok, msg = runner.deploy("production-everything", "Corey", True,
                                run=lambda c, d: (True, "ok"))
        self.assertFalse(ok)
        self.assertIn("allow-list", msg)

    def test_deploy_refuses_without_confirm(self):
        ok, msg = runner.deploy("teachaid", "Corey", False,
                                run=lambda c, d: (True, "ok"))
        self.assertFalse(ok)
        self.assertIn("--confirm", msg)

    def test_deploy_passes_chain_and_ledgers(self):
        ok, _ = runner.deploy("teachaid", "Corey", True,
                              run=lambda c, d: (True, "deployed"))
        self.assertTrue(ok)
        with open(os.path.join(self.tmp.name, "ledger.jsonl"), encoding="utf-8") as f:
            self.assertIn("deploy", f.read())

    def test_advise_money_names_ledger_and_spend_gate(self):
        msg = runner.advise("stripe money question")
        self.assertIn("lab-ledger", msg)
        self.assertIn("cannot spend", msg)

    def test_triage_survives_unreadable_repo(self):
        with open(os.path.join(self.tmp.name, "scope.json"), "w", encoding="utf-8") as f:
            json.dump({"repos": ["C:/no/such/dir"], "deploys": {},
                       "doors": {"money": "m", "deploys": "d", "products": "p",
                                 "docs": "o", "agents": "a"}}, f)
        out = runner.triage(run=lambda c, d: (False, "cannot find path"))
        self.assertIn("unreadable", out)


if __name__ == "__main__":
    unittest.main()
