"""Tests for the autopilot sweep. Stdlib only."""
import importlib.util
import json
import os
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location(
    "autopilot_sweep",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sweep.py"))
sweep = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sweep)


def lab_with(pricing=None, pkg=None, readme=None):
    lab = tempfile.TemporaryDirectory()
    if pricing is not None:
        os.makedirs(os.path.join(lab.name, "docs", "site"))
        with open(os.path.join(lab.name, "docs", "site", "pricing.json"), "w",
                  encoding="utf-8") as f:
            json.dump(pricing, f)
    if pkg is not None:
        with open(os.path.join(lab.name, "package.json"), "w", encoding="utf-8") as f:
            json.dump(pkg, f)
    if readme is not None:
        with open(os.path.join(lab.name, "README.md"), "w", encoding="utf-8") as f:
            f.write(readme)
    return lab


PRICING = {"suite": {"free_cap_gb": 1, "usd_per_gb_after_free": 0.25, "plain": "x"},
           "math": {"pcc_meter_gb": 0.25}}
PKG = {"agentic": {"suite_pricing": {"free_cap_gb": 1, "usd_per_gb_after_free": 0.25}}}
README = "first 1 GB free once per IP at $0.25/GB"


class Consensus(unittest.TestCase):
    def test_agreement_is_sure(self):
        lab = lab_with(PRICING, PKG, README)
        self.addCleanup(lab.cleanup)
        canonical, _ = sweep.meter_votes(lab.name)
        self.assertEqual(canonical, {"free_gb": 1, "usd_per_gb": 0.25})

    def test_all_disagree_is_unsure(self):
        bad = {"suite": {"free_cap_gb": 2, "usd_per_gb_after_free": 0.5, "plain": "x"},
               "math": {"pcc_meter_gb": 0.5}}
        lab = lab_with(bad, PKG, "something else entirely")
        self.addCleanup(lab.cleanup)
        canonical, _ = sweep.meter_votes(lab.name)
        self.assertIsNone(canonical)

    def test_autofix_patches_only_pricing(self):
        drifted = {"suite": {"free_cap_gb": 2, "usd_per_gb_after_free": 0.5, "plain": "stale"},
                   "math": {"pcc_meter_gb": 0.5}}
        lab = lab_with(drifted, PKG, README)
        self.addCleanup(lab.cleanup)
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        sweep.HOME = home.name
        changed = sweep.autofix_meter({"free_gb": 1, "usd_per_gb": 0.25}, lab.name)
        self.assertIn("free_cap_gb", changed)
        self.assertNotIn("plain", changed)
        fixed = sweep.read_json(os.path.join(lab.name, "docs", "site", "pricing.json"))
        self.assertEqual(fixed["suite"]["free_cap_gb"], 1)
        self.assertEqual(fixed["math"]["pcc_meter_gb"], 0.25)
        self.assertEqual(fixed["suite"]["plain"], "stale")
        self.assertTrue(os.path.exists(
            os.path.join(lab.name, "docs", "site", "pricing.json.bak")))
        with open(os.path.join(lab.name, "package.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f), PKG)
        with open(os.path.join(lab.name, "README.md"), encoding="utf-8") as f:
            self.assertEqual(f.read(), README)

    def test_autofix_clean_is_noop(self):
        lab = lab_with(dict(PRICING), PKG, README)
        self.addCleanup(lab.cleanup)
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        sweep.HOME = home.name
        self.assertEqual(sweep.autofix_meter({"free_gb": 1, "usd_per_gb": 0.25}, lab.name), [])
        self.assertFalse(os.path.exists(
            os.path.join(lab.name, "docs", "site", "pricing.json.bak")))


class SweepOnce(unittest.TestCase):
    def test_proposals_for_motions_no_autofix_without_drift(self):
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        sweep.HOME = home.name
        lab = lab_with(dict(PRICING), PKG, README)
        self.addCleanup(lab.cleanup)

        class FakeBoard:
            @staticmethod
            def collect():
                return {"adswarm": "t1 [blog] draft approved=False"}
            @staticmethod
            def detect_motions(reports):
                return [{"title": "Unapproved ad drafts", "detail": "t1"}]

        out = sweep.sweep_once(board_mod=FakeBoard, lab=lab.name)
        self.assertEqual(out["motions"], ["Unapproved ad drafts"])
        self.assertEqual(out["autofixed"], [])
        self.assertEqual(len(out["proposals"]), 1)
        self.assertTrue(os.path.exists(out["proposals"][0]))

    def test_drift_autofixed_and_cleared(self):
        home = tempfile.TemporaryDirectory()
        self.addCleanup(home.cleanup)
        sweep.HOME = home.name
        drifted = {"suite": {"free_cap_gb": 9, "usd_per_gb_after_free": 9.0, "plain": "stale"},
                   "math": {"pcc_meter_gb": 9.0}}
        lab = lab_with(drifted, PKG, README)
        self.addCleanup(lab.cleanup)

        class FakeBoard:
            @staticmethod
            def collect():
                return {"compression": "DRIFT: pricing off"}
            @staticmethod
            def detect_motions(reports):
                return [{"title": "Meter drift across pricing surfaces", "detail": "x"}]

        out = sweep.sweep_once(board_mod=FakeBoard, lab=lab.name)
        self.assertTrue(out["autofixed"])
        self.assertEqual(out["motions"], [])
        self.assertEqual(out["proposals"], [])


if __name__ == "__main__":
    unittest.main()
