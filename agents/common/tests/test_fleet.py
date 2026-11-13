"""Fleet test: every lab agent ships a valid seat + identity + memory."""
import importlib.util
import json
import os
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
AGENTS = os.path.dirname(os.path.dirname(_HERE))
RUNNERS = {"adswarm": "runner.py", "advisor": "runner.py",
           "autopilot": "sweep.py", "board": "board.py",
           "compression": "runner.py", "teachaid": "runner.py",
           "github-webdev": "employee.py", "github-engineer": "employee.py",
           "law-scholar": "runner.py", "biz-scholar": "runner.py",
           "slidphi-agent": None}


def _load_common(name):
    spec = importlib.util.spec_from_file_location(
        "fleet_" + name, os.path.join(AGENTS, "common", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


acn = _load_common("acn")


class Fleet(unittest.TestCase):
    def test_seats_valid_and_spend_closed(self):
        for agent in RUNNERS:
            with self.subTest(agent=agent):
                home = os.path.join(AGENTS, agent)
                seat = acn.load(home)
                self.assertEqual(seat.get("cap_usd"), 0, agent)
                self.assertTrue(seat.get("allows"), agent)
                self.assertFalse(acn.spendable(seat, 1)[0], agent)

    def test_identity_and_memory_present(self):
        for agent in RUNNERS:
            with self.subTest(agent=agent):
                home = os.path.join(AGENTS, agent)
                with open(os.path.join(home, "identity.md"), encoding="utf-8") as f:
                    self.assertIn(agent, f.read())
                with open(os.path.join(home, "observatory.jsonl"), encoding="utf-8") as f:
                    rows = [json.loads(l) for l in f.read().splitlines() if l.strip()]
                self.assertTrue(rows, agent)
                for r in rows:
                    self.assertTrue(r["d"] and r["c"] and r["o"], agent)


if __name__ == "__main__":
    unittest.main()
