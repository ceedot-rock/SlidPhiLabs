"""AdSwarm gate tests. The publish gate is a safety boundary: prove it."""
import json
import os
import sys
import tempfile
import unittest

TMP = tempfile.mkdtemp(prefix="adswarm-test-")
os.environ["ADSWARM_HOME"] = TMP
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import runner

CAMP = "t"
CAMPAIGN = {"campaign": CAMP,
            "claims": ["ships free tier", "runs offline"],
            "banned": ["best"],
            "channels": ["x", "lab-blog"],
            "limits": {"x": 280, "lab-blog": 20000},
            "cadence": []}


def draft(draft_id, channel="x", refs="[0]", body="Ships free tier and runs offline."):
    runner.write_draft(draft_id, {"id": draft_id, "channel": channel,
                                  "claim_refs": refs, "status": "draft"}, body + "\n")


class GateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.makedirs(os.path.join(TMP, "campaigns"), exist_ok=True)
        os.makedirs(os.path.join(TMP, "warrants"), exist_ok=True)
        os.makedirs(os.path.join(TMP, "drafts"), exist_ok=True)
        with open(os.path.join(TMP, "campaigns", CAMP + ".json"), "w") as f:
            json.dump(CAMPAIGN, f)
        with open(os.path.join(TMP, "warrants", CAMP + ".json"), "w") as f:
            json.dump({"campaign": CAMP, "allows": ["draft", "schedule", "publish-with-approval"],
                       "denies": ["spend"]}, f)

    def test_publish_refuses_without_approval(self):
        draft("d-no-appr")
        ok, msg = runner.publish(CAMP, "d-no-appr")
        self.assertFalse(ok)
        self.assertIn("approval", msg)

    def test_warrant_deny_beats_approval(self):
        with open(os.path.join(TMP, "warrants", CAMP + ".json")) as f:
            w = json.load(f)
        w["allows"] = ["draft"]
        with open(os.path.join(TMP, "warrants", CAMP + ".json"), "w") as f:
            json.dump(w, f)
        try:
            draft("d-warrant")
            os.makedirs(os.path.join(TMP, "approvals"), exist_ok=True)
            with open(os.path.join(TMP, "approvals", "d-warrant.json"), "w") as f:
                json.dump({"draft": "d-warrant", "by": "Corey"}, f)
            ok, msg = runner.publish(CAMP, "d-warrant")
            self.assertFalse(ok)
            self.assertIn("warrant", msg)
        finally:
            w["allows"] = ["draft", "schedule", "publish-with-approval"]
            with open(os.path.join(TMP, "warrants", CAMP + ".json"), "w") as f:
                json.dump(w, f)

    def test_critic_catches_banned_badref_overlimit_placeholder(self):
        meta = {"channel": "x", "claim_refs": "[9]"}
        flags = runner.critic(CAMPAIGN, meta, "The best thing TODO [fix] " + "x" * 300)
        joined = " ".join(flags)
        self.assertIn("bad claim_ref", joined)
        self.assertIn("banned word", joined)
        self.assertIn("over channel limit", joined)
        self.assertIn("placeholder", joined)

    def test_approve_refuses_flagged_then_full_cycle(self):
        draft("d-cycle", body="The best offline app.")
        ok, msg = runner.approve(CAMP, "d-cycle", "Corey")
        self.assertFalse(ok)
        self.assertIn("banned", msg)
        runner.write_draft("d-cycle", {"id": "d-cycle", "channel": "x",
                                       "claim_refs": "[1]", "status": "draft"},
                           "Runs offline, free tier included.\n")
        ok, msg = runner.approve(CAMP, "d-cycle", "Corey")
        self.assertTrue(ok)
        ok, receipt = runner.publish(CAMP, "d-cycle")
        self.assertTrue(ok)
        self.assertTrue(receipt["dry_run"])
        self.assertTrue(os.path.exists(os.path.join(TMP, "outbox", "d-cycle.x.md")))
        with open(os.path.join(TMP, "ledger.jsonl")) as f:
            acts = [json.loads(line)["action"] for line in f]
        for expected in ("approve", "publish"):
            self.assertIn(expected, acts)

    def test_draft_without_claims_flagged(self):
        meta = {"channel": "lab-blog", "claim_refs": ""}
        flags = runner.critic(CAMPAIGN, meta, "A plain honest paragraph.")
        self.assertTrue(any("claim_refs" in f for f in flags))


if __name__ == "__main__":
    unittest.main(verbosity=2)
