import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from human_edit_grounded import (
    build_conditional_model,
    edit_delta,
    feature_vector,
    human_edit_alignment,
    sed_target,
)


class FeatureVectorTests(unittest.TestCase):
    def test_deterministic_and_has_core_keys(self):
        text = "We delve into a rich tapestry of ideas. It works well enough."
        a, b = feature_vector(text), feature_vector(text)
        self.assertEqual(a, b)
        for k in ("formulaic_risk", "sed_total", "mattr", "hdd", "rhet_slop_overrepresentation"):
            self.assertIn(k, a)

    def test_edit_delta_drops_slop_density(self):
        src = "We delve into a rich tapestry that stands as a testament to seamless design."
        tgt = "We explain the design and why it works."
        d = edit_delta(src, tgt)
        self.assertLess(d["sed_total"], 0.0)  # slop density fell


class AlignmentTests(unittest.TestCase):
    def test_identical_deltas_align_perfectly(self):
        dH = [{"a": 2.0, "b": -1.0}, {"a": -3.0, "b": 1.0}]
        std = {"a": 1.0, "b": 1.0}
        res = human_edit_alignment(dH, dH, std)
        self.assertAlmostEqual(res["mean_cosine"], 1.0, places=3)
        self.assertAlmostEqual(res["mean_direction_agreement"], 1.0, places=3)

    def test_opposite_deltas_disagree(self):
        dH = [{"a": 2.0, "b": -1.0}]
        dSys = [{"a": -2.0, "b": 1.0}]
        std = {"a": 1.0, "b": 1.0}
        res = human_edit_alignment(dSys, dH, std)
        self.assertLess(res["mean_cosine"], 0.0)
        self.assertEqual(res["mean_direction_agreement"], 0.0)


class ConditionalTests(unittest.TestCase):
    def test_learns_source_conditioned_direction(self):
        # feature 'cv': low-source items -> humans RAISE it; high-source -> humans LOWER it.
        src_vecs, human_deltas = [], []
        for i in range(9):
            low = i < 3
            high = i >= 6
            src_vecs.append({"cv": (0.1 if low else 0.9 if high else 0.5)})
            human_deltas.append({"cv": (0.2 if low else -0.2 if high else 0.0)})
        score, model = build_conditional_model(src_vecs, human_deltas, min_bucket=3)
        self.assertEqual(model["cv"][0], 1)   # low bucket -> raise
        self.assertEqual(model["cv"][2], -1)  # high bucket -> lower
        # a system that raises cv on a low-source item agrees with humans
        good = score({"cv": 0.1}, {"cv": 0.3})
        self.assertEqual(good["rate"], 1.0)
        bad = score({"cv": 0.1}, {"cv": -0.3})
        self.assertEqual(bad["rate"], 0.0)


class SedTargetTests(unittest.TestCase):
    def test_gap_to_human_is_reported(self):
        items = [{"S": "a rich tapestry and seamless delve", "H": "a plain sentence", "F": "a plain sentence"}]
        res = sed_target(items, "F")
        self.assertIn("mean_abs_gap_to_human", res)
        self.assertGreaterEqual(res["mean_sed_source"], res["mean_sed_human"])


if __name__ == "__main__":
    unittest.main()
