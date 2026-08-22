import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
from _corpus_guard import requires_corpora

from residual_estimator import ResidualEstimator, _pav


class PavTests(unittest.TestCase):
    def test_pav_is_non_decreasing(self):
        out = _pav([1, 2, 3, 4], [0.0, 5.0, 2.0, 9.0])
        self.assertEqual(out, sorted(out))  # monotone non-decreasing

    def test_pav_pools_violation(self):
        out = _pav([1, 2], [4.0, 2.0])
        self.assertEqual(out, [3.0, 3.0])  # averaged


@requires_corpora
class EstimatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.est = ResidualEstimator()

    def test_prediction_has_required_fields(self):
        p = self.est.predict(50.0, "LAMP")
        for k in ("source_SED", "predicted_human_SED_median", "predicted_human_SED_p25",
                  "predicted_human_SED_p75", "support_n", "confidence", "fallback_level"):
            self.assertIn(k, p)
        self.assertLessEqual(p["predicted_human_SED_p25"], p["predicted_human_SED_p75"])

    def test_median_tracks_source_sed_monotonically(self):
        meds = [self.est.predict(s, "LAMP")["predicted_human_SED_median"] for s in (5, 20, 40, 70, 100)]
        self.assertEqual(meds, sorted(meds))  # non-decreasing in source SED

    def test_does_not_cap_at_source(self):
        # low source SED must still be allowed a (possibly higher) residual estimate; the model
        # never imposes target <= source. A tiny-source prediction should not error or force 0 cap.
        p = self.est.predict(1.0, "LAMP")
        self.assertGreaterEqual(p["predicted_human_SED_p75"], 0.0)


if __name__ == "__main__":
    unittest.main()
