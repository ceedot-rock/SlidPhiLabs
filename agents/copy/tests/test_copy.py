import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import runner


class Draft(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ["COPY_HOME"] = self.tmp.name
        runner.HOME = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_states_the_offer(self):
        text = runner.draft(
            "A team shipping a port",
            "the Python and the Go must print the same result",
            "check runs the seats and refuses on a mismatch",
            "You get a pass or a refuse before the port ships",
            "$0.05 a check, first 100 a month free",
            "Run check",
        )
        self.assertIn("$0.05", text)
        self.assertIsNone(runner.lint(text))

    def test_refuses_a_defense_of_the_price(self):
        with self.assertRaises(ValueError):
            runner.draft(
                "A buyer",
                "pay the meter",
                "compress",
                "smaller files",
                "Nothing on this page is a surprise fee",
                "Buy",
            )


if __name__ == "__main__":
    unittest.main()
