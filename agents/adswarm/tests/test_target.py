"""Reverse-search tests. All offline; live-provider checks stay opt-in."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import target


class TargetTest(unittest.TestCase):
    def setUp(self):
        self.conn = target.open_array()
        target.stock(self.conn, {"id": "a1", "advertiser": "teachaid",
                                 "title": "Chapter-locked study teacher",
                                 "body": "Pass-gated chapters and cited answers.",
                                 "subjects": ["study", "textbook", "chapter", "grades"],
                                 "claim_refs": [0, 1]})
        target.stock(self.conn, {"id": "a2", "advertiser": "teachaid",
                                 "title": "Campus pizza night",
                                 "body": "Two blocks from campus, Friday only.",
                                 "subjects": ["pizza", "campus", "food"],
                                 "lat": 41.88, "lon": -87.63, "radius_km": 3})
        target.stock(self.conn, {"id": "a3", "advertiser": "other",
                                 "title": "Study lamp sale",
                                 "body": "Desk lamps for late chapters.",
                                 "subjects": ["study", "lamp"],
                                 "sched_start": "2020-01-01", "sched_end": "2020-02-01"})

    def test_subject_match_retrieves(self):
        res = target.search(self.conn, "textbook chapter grades")
        self.assertEqual([r["id"] for r in res], ["a1"])
        self.assertIn("textbook", res[0]["why"])

    def test_geo_fence_filters(self):
        near = target.search(self.conn, "pizza campus", lat=41.88, lon=-87.62)
        self.assertEqual([r["id"] for r in near], ["a2"])
        self.assertAlmostEqual(near[0]["distance_km"], 0.8, delta=0.5)
        far = target.search(self.conn, "pizza campus", lat=40.0, lon=-80.0)
        self.assertEqual(far, [])

    def test_expired_and_blocked_never_serve(self):
        res = target.search(self.conn, "lamp desk")
        self.assertEqual(res, [])
        res = target.search(self.conn, "study textbook", blocked=["teachaid"])
        self.assertTrue(all(r["advertiser"] != "teachaid" for r in res))

    def test_stock_validates(self):
        bad, err = target.stock(self.conn, {"id": "x", "advertiser": "a", "title": "t"})
        self.assertIsNone(bad)
        self.assertIn("subject", err)
        bad, err = target.stock(self.conn, {"id": "x", "advertiser": "a", "title": "t",
                                            "subjects": ["s"], "radius_km": -2})
        self.assertIn("radius", err)

    def test_receipt_lists_served(self):
        res = target.search(self.conn, "textbook chapter")
        r = target.receipt("textbook chapter", res, array="teachaid")
        self.assertEqual(r["served"], ["a1"])
        self.assertEqual(r["array"], "teachaid")


if __name__ == "__main__":
    unittest.main(verbosity=2)
