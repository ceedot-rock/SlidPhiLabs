"""Tests for the compression agent runner. Stdlib only."""
import json
import os
import sys
import tempfile
import unittest

import importlib.util
_spec = importlib.util.spec_from_file_location(
    "compression_runner",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "runner.py"))
runner = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(runner)


class Gates(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["COMPRESSION_HOME"] = self.tmp.name
        runner.HOME = self.tmp.name
        with open(os.path.join(self.tmp.name, "scope.json"), "w", encoding="utf-8") as f:
            json.dump({"owns": ["src/", "packages/"],
                       "meter": {"free_gb": 1, "usd_per_gb": 0.25,
                                 "bulk_usd_per_gb": 0.2},
                       "verify": ["node --test test/pccz.test.mjs"]}, f)

    def tearDown(self):
        self.tmp.cleanup()
        os.environ.pop("COMPRESSION_HOME", None)

    def test_guard_allows_owned(self):
        ok, _ = runner.guard_path("src/pccz.mjs")
        self.assertTrue(ok)

    def test_guard_refuses_outside(self):
        ok, msg = runner.guard_path("site/index.html")
        self.assertFalse(ok)
        self.assertIn("warrant denies", msg)

    def test_verify_fail_ledgers(self):
        ok, _ = runner.verify(run=lambda c, d: (False, "boom"))
        self.assertFalse(ok)
        with open(os.path.join(self.tmp.name, "ledger.jsonl"), encoding="utf-8") as f:
            self.assertIn("verify-fail", f.read())

    def test_price_check_clean(self):
        lab = tempfile.TemporaryDirectory()
        self.addCleanup(lab.cleanup)
        with open(os.path.join(lab.name, "package.json"), "w", encoding="utf-8") as f:
            json.dump({"agentic": {"suite_pricing": {"free_cap_gb": 1,
                                                     "usd_per_gb_after_free": 0.25}}}, f)
        with open(os.path.join(lab.name, "README.md"), "w", encoding="utf-8") as f:
            f.write("$0.25/GB after first 1 GB free once per IP")
        os.makedirs(os.path.join(lab.name, "docs", "site"))
        with open(os.path.join(lab.name, "docs", "site", "pricing.json"), "w",
                  encoding="utf-8") as f:
            f.write('{"usd_per_gb": 0.25}')
        self.assertEqual(runner.price_check(lab=lab.name), [])

    def test_price_check_flags_drift(self):
        lab = tempfile.TemporaryDirectory()
        self.addCleanup(lab.cleanup)
        with open(os.path.join(lab.name, "package.json"), "w", encoding="utf-8") as f:
            f.write("{}")
        with open(os.path.join(lab.name, "README.md"), "w", encoding="utf-8") as f:
            f.write("free compression for everyone")
        findings = runner.price_check(lab=lab.name)
        self.assertTrue(any("package.json" in x or "README" in x for x in findings))


if __name__ == "__main__":
    unittest.main()
