import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from annotation_priority import counterfactual, quadrants


def _row(pattern, family, rho, smoothed_E, occ=50, conf="high"):
    return {"pattern": pattern, "family": family, "rho": rho, "smoothed_E": smoothed_E,
            "occurrences": occ, "confidence": conf}


class QuadrantTests(unittest.TestCase):
    def test_quadrant_assignment(self):
        rows = [
            _row("tapestry", "slop", 15, 0.8),   # high rho / high E
            _row("bustling", "slop", 9, 0.3),    # high rho / low E
            _row("elevate", "slop", 5, 0.6),     # low rho / high E
            _row("landscape", "slop", 4, 0.2),   # low rho / low E
            _row("rare", "slop", 8, 0.5, conf="low"),  # uncertain
        ]
        q = quadrants(rows)
        self.assertIn("tapestry", q["high_rho_high_E"])
        self.assertIn("bustling", q["high_rho_low_E"])
        self.assertIn("elevate", q["low_rho_high_E"])
        self.assertIn("landscape", q["low_rho_low_E"])
        self.assertIn("rare", q["low_support_uncertain"])


class CounterfactualTests(unittest.TestCase):
    def test_gating_buckets_by_smoothed_E(self):
        rows = [
            _row("keep_me", "slop", 9, 0.6, occ=10),      # >= E_hi -> kept
            _row("weaken_me", "slop", 6, 0.30, occ=10),   # between -> weakened
            _row("suppress_me", "slop", 5, 0.10, occ=10),  # < E_lo -> suppressed
        ]
        cf = counterfactual(rows)
        self.assertEqual(cf["slop_edit_occurrences_current_policy"], 30)
        self.assertEqual(cf["suppressed"], 10)
        self.assertEqual(cf["weakened"], 10)
        self.assertEqual(cf["kept"], 10)
        self.assertTrue(any(s["E_lo"] == 0.25 for s in cf["threshold_sweep"]))


if __name__ == "__main__":
    unittest.main()
