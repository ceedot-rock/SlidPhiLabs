"""Tests for the board convenor. Stdlib only."""
import importlib.util
import json
import os
import tempfile
import unittest

_spec = importlib.util.spec_from_file_location(
    "board_convenor",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "board.py"))
board = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(board)


class Motions(unittest.TestCase):
    def test_drift_becomes_motion(self):
        reports = {"compression": "clean line\nDRIFT: README missing $0.25/GB meter line"}
        motions = board.detect_motions(reports, agents_dir="/none")
        self.assertEqual(len(motions), 1)
        self.assertIn("Meter drift", motions[0]["title"])

    def test_quiet_reports_no_motions(self):
        reports = {"compression": "clean: meter matches everywhere",
                   "adswarm": "t1 [blog] draft approved=True"}
        self.assertEqual(board.detect_motions(reports, agents_dir="/none"), [])

    def test_failures_capped(self):
        reports = {"teachaid": "\n".join("$ FAIL x%d" % i for i in range(30))}
        motions = board.detect_motions(reports, agents_dir="/none")
        self.assertEqual(len(motions), 1)
        self.assertLessEqual(len(motions[0]["detail"].splitlines()), 12)

    def test_unapproved_drafts(self):
        reports = {"adswarm": "t1 [blog] draft approved=False\nt2 [x] post approved=True"}
        motions = board.detect_motions(reports, agents_dir="/none")
        self.assertTrue(any("Unapproved" in m["title"] for m in motions))
        self.assertIn("t1", motions[0]["detail"])
        self.assertNotIn("t2", motions[0]["detail"])

    def test_customer_feedback(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        os.makedirs(os.path.join(tmp.name, "slidphi-agent"))
        rows = [{"kind": "praise", "summary": "love it"},
                {"kind": "criticism", "summary": "rider docs confusing"}]
        with open(os.path.join(tmp.name, "slidphi-agent", "issues.jsonl"), "w",
                  encoding="utf-8") as f:
            f.write("\n".join(json.dumps(r) for r in rows))
        motions = board.detect_motions({}, agents_dir=tmp.name)
        self.assertEqual(len(motions), 1)
        self.assertIn("rider docs", motions[0]["detail"])


class Minutes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        board.HOME = os.path.join(self.tmp.name, "board")

    def test_write_and_record(self):
        reports = {"advisor": "pulse ok"}
        motions = [{"title": "Meter drift", "detail": "x"}]
        path = board.write_minutes(reports, motions, [], "readout", "filed")
        self.assertTrue(os.path.exists(path))
        ok, msg = board.record(path, "Meter drift", "deferred", "check friday")
        self.assertTrue(ok)
        with open(path, encoding="utf-8") as f:
            text = f.read()
        self.assertIn("deferred", text)
        self.assertIn("check friday", text)

    def test_record_refuses_bad_ruling(self):
        path = board.write_minutes({}, [], [], "readout", "filed")
        ok, msg = board.record(path, "M", "maybe")
        self.assertFalse(ok)

    def test_record_refuses_outside_file(self):
        ok, msg = board.record(os.path.join(self.tmp.name, "evil.md"), "M", "approved")
        self.assertFalse(ok)

    def test_collect_missing_seats(self):
        reports = board.collect(run=lambda c, d: (True, "ok"), agents_dir=self.tmp.name)
        self.assertEqual(len(reports), 9)
        self.assertIn("not installed", reports["advisor"])
        self.assertIn("not installed", reports["law-scholar"])


class Chair(unittest.TestCase):
    def test_approve_and_defer(self):
        motions = [{"title": "M1", "detail": "d1"}, {"title": "M2", "detail": "d2"}]
        answers = iter(["a", "d"])
        import builtins
        old = builtins.input
        builtins.input = lambda *a: next(answers)
        try:
            rulings, adj = board.chair(motions)
        finally:
            builtins.input = old
        self.assertEqual([(r["motion"], r["ruling"]) for r in rulings],
                         [("M1", "approved"), ("M2", "deferred")])
        self.assertIn("all motions heard", adj)

    def test_raise_note_end_and_eof(self):
        import builtins
        old = builtins.input
        builtins.input = lambda *a: (_ for _ in ()).throw(EOFError)
        try:
            rulings, adj = board.chair([{"title": "M1", "detail": "d"}])
        finally:
            builtins.input = old
        self.assertEqual(rulings, [])
        self.assertIn("early", adj)

        answers = iter(["raise Buy cake", "s", "a extra choc"])
        builtins.input = lambda *a: next(answers)
        try:
            rulings, adj = board.chair([{"title": "M1", "detail": "d"}])
        finally:
            builtins.input = old
        self.assertEqual(rulings[0]["motion"], "Buy cake")
        self.assertEqual(rulings[0]["ruling"], "approved")
        self.assertEqual(rulings[0]["note"], "extra choc")
        self.assertIn("all motions heard", adj)


if __name__ == "__main__":
    unittest.main()
