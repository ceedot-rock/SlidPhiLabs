"""Gate tests for the GitHub Engineer employee. Stdlib only."""
import json
import os
import sys
import tempfile
import unittest

import importlib.util
_AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)
_spec = importlib.util.spec_from_file_location(
    "engineer_employee",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "employee.py"))
employee = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(employee)


class Gates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["GH_EMP_HOME"] = self.tmp.name
        employee.HOME = self.tmp.name
        with open(os.path.join(self.tmp.name, "repos.json"), "w", encoding="utf-8") as f:
            json.dump({"repo": "Slid-Phi-Labs/gitdepot-hub"}, f)

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("GH_EMP_HOME", None)

    def test_warrant_refuses_other_repo(self):
        ok, msg = employee._guard_repo("someone-else/other")
        self.assertFalse(ok)
        self.assertIn("warrant denies", msg)

    def test_merge_refuses_without_approval(self):
        ok, msg = employee.merge("7", "Corey", True,
                                 checks_text="all checks passing",
                                 merge_text="merged")
        self.assertFalse(ok)
        self.assertIn("no human approval", msg)

    def test_merge_refuses_without_confirm(self):
        employee.approve("8", "Corey")
        ok, msg = employee.merge("8", "Corey", False,
                                 checks_text="all checks passing",
                                 merge_text="merged")
        self.assertFalse(ok)
        self.assertIn("--confirm", msg)

    def test_merge_refuses_red_checks(self):
        employee.approve("9", "Corey")
        ok, msg = employee.merge("9", "Corey", True,
                                 checks_text="1 failing, 0 pending",
                                 merge_text="merged")
        self.assertFalse(ok)
        self.assertIn("not green", msg)

    def test_merge_passes_full_chain_and_ledgers(self):
        employee.approve("10", "Corey")
        ok, msg = employee.merge("10", "Corey", True,
                                 checks_text="all checks passing",
                                 merge_text="merged #10")
        self.assertTrue(ok)
        with open(os.path.join(self.tmp.name, "ledger.jsonl"), encoding="utf-8") as f:
            lines = f.read()
        self.assertIn("approve", lines)
        self.assertIn("merge", lines)


if __name__ == "__main__":
    unittest.main()
