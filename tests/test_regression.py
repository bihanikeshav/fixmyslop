import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from regression import regression_preservation


class RegressionPreservationTests(unittest.TestCase):
    def test_pass2_dropping_a_kept_anchor_is_a_regression(self):
        src = "Order #123 shipped on 5 May for $40."
        p1 = "Your order #123 shipped on 5 May for $40, all set."
        p2 = "Your order shipped on 5 May for $40."  # drops #123
        res = regression_preservation(src, p1, p2, ["#123", "5 May", "$40"])
        self.assertIn("#123", res["anchor_regressions"])
        self.assertFalse(res["clean"])

    def test_pass2_reintroducing_slop_is_flagged(self):
        src = "We delve into a rich tapestry of updates for order #7."
        p1 = "Here are the updates for order #7."
        p2 = "We delve into a rich tapestry of updates for order #7."  # slop back
        res = regression_preservation(src, p1, p2, ["#7"])
        self.assertTrue(res["reintroduced_findings"])
        self.assertFalse(res["clean"])

    def test_identical_passes_are_clean(self):
        src = "Order #9 on 3 June."
        p = "Your order #9 shipped on 3 June."
        res = regression_preservation(src, p, p, ["#9", "3 June"])
        self.assertTrue(res["clean"])
        self.assertEqual(res["anchor_regression_count"], 0)

    def test_pass2_recovering_a_lost_anchor_is_not_a_regression(self):
        src = "Order #55 on 1 May."
        p1 = "Your order shipped on 1 May."   # dropped #55
        p2 = "Your order #55 shipped on 1 May."  # restored
        res = regression_preservation(src, p1, p2, ["#55", "1 May"])
        self.assertIn("#55", res["anchor_recoveries"])
        self.assertEqual(res["anchor_regression_count"], 0)


if __name__ == "__main__":
    unittest.main()
