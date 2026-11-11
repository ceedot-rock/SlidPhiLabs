"""Unit tests for common acn + psi sidecars. Stdlib only."""
import importlib.util
import json
import os
import tempfile
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))


def _load(name):
    spec = importlib.util.spec_from_file_location(
        "common_" + name, os.path.join(_HERE, "..", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


acn = _load("acn")
psi = _load("psi")


def seat(home, **kw):
    s = {"seat": "test", "allows": ["spl_catalog"], "cap_usd": 0}
    s.update(kw)
    with open(os.path.join(home, "seat.json"), "w", encoding="utf-8") as f:
        json.dump(s, f)
    return s


class Acn(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        os.environ.pop("SPL_ACN_KEY", None)

    def test_warrant_allows_and_denies(self):
        s = seat(self.tmp.name)
        self.assertTrue(acn.allowed(s, "spl_catalog")[0])
        ok, reason = acn.allowed(s, "spl_compress")
        self.assertFalse(ok)
        self.assertIn("warrant", reason)

    def test_cap_zero_closes_paid(self):
        s = seat(self.tmp.name)
        ok, reason = acn.spendable(s, 5)
        self.assertFalse(ok)
        self.assertIn("cap", reason)

    def test_free_calls_always_ok(self):
        s = seat(self.tmp.name)
        self.assertTrue(acn.spendable(s, 0)[0])

    def test_cap_needs_key(self):
        s = seat(self.tmp.name, cap_usd=10)
        ok, reason = acn.spendable(s, 5)
        self.assertFalse(ok)
        self.assertIn("SPL_ACN_KEY", reason)
        os.environ["SPL_ACN_KEY"] = "spl1.test"
        self.addCleanup(os.environ.pop, "SPL_ACN_KEY")
        self.assertTrue(acn.spendable(s, 5)[0])

    def test_status_and_receipt(self):
        s = seat(self.tmp.name)
        text = acn.status(self.tmp.name)
        self.assertIn("cap_usd: 0", text)
        self.assertIn("absent", text)
        acn.receipt(self.tmp.name, "test", "spl_catalog", True, "card ok")
        with open(os.path.join(self.tmp.name, "ledger.jsonl"), encoding="utf-8") as f:
            row = json.loads(f.read().splitlines()[-1])
        self.assertEqual(row["action"], "acn-ok")


class Psi(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def test_remember_needs_all_fields(self):
        self.assertFalse(psi.remember(self.tmp.name, "", "c", "o")[0])
        self.assertTrue(psi.remember(self.tmp.name, "d", "c", "o")[0])

    def test_recall_order_and_cap(self):
        for i in range(7):
            psi.remember(self.tmp.name, "d%d" % i, "c", "o")
        rows = psi.recall(self.tmp.name, 5)
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[-1]["d"], "d6")

    def test_empty_memory(self):
        self.assertEqual(psi.recall(self.tmp.name), [])
        self.assertIn("no lessons", psi.formatted(self.tmp.name))


if __name__ == "__main__":
    unittest.main()
