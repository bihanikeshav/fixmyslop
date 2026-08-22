import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
from _corpus_guard import requires_corpora

from chea import (
    COMPONENTS,
    COMPONENT_KEYS,
    PopulationModel,
    _pop_detail,
    _ref_agree,
    build_conditional_model,
    build_population_model,
    chea_all,
    population_chea,
    reference_chea,
    reference_decomposition,
)


class RefAgreeTests(unittest.TestCase):
    def test_scores_only_reference_moved_features(self):
        dH = {"a": 1.0, "b": -1.0}
        dS = {"a": 1.0, "b": 1.0}
        self.assertEqual(_ref_agree(dS, dH, ["a", "b"]), 0.5)

    def test_none_when_reference_moved_nothing(self):
        self.assertIsNone(_ref_agree({"a": 1.0}, {"a": 0.0}, ["a"]))


class PopDetailTests(unittest.TestCase):
    def test_split_feature_is_always_plausible(self):
        dH, dS = {"a": 1.0, "b": -1.0}, {"a": -5.0, "b": 5.0}
        score, conly, fb, scored = _pop_detail(dS, dH, ["a", "b"], {"a": "split", "b": "split"})
        self.assertEqual(score, 1.0)
        self.assertIsNone(conly)          # no consensus features scored
        self.assertEqual((fb, scored), (0, 2))

    def test_consensus_feature_requires_dominant_direction(self):
        dH = {"a": 1.0}
        self.assertEqual(_pop_detail({"a": -1.0}, dH, ["a"], {"a": "pos"})[0], 0.0)
        self.assertEqual(_pop_detail({"a": 1.0}, dH, ["a"], {"a": "pos"})[1], 1.0)  # consensus-only

    def test_low_support_falls_back_to_reference_and_counts(self):
        score, conly, fb, scored = _pop_detail({"a": 1.0}, {"a": 1.0}, ["a"], {"a": None})
        self.assertEqual((score, fb, scored), (1.0, 1, 1))


class PopulationModelTests(unittest.TestCase):
    def test_coverage_and_support_metadata(self):
        cons = {"a": "pos", "b": "neg", "c": "split", "d": "split", "e": None}
        m = PopulationModel(cons, n_edits=50, corpus="LAMP")
        self.assertEqual(m.coverage(), round(2 / 4, 3))     # 2 consensus / 4 scorable
        s = m.support(fallback_total=1, scored_total=9)
        self.assertEqual(s["mode"], "corpus_proxy")
        self.assertEqual(s["n_human_edits"], 50)
        self.assertEqual((s["consensus_features"], s["split_features"]), (2, 2))
        self.assertEqual(s["consensus_threshold"], 0.70)

    @requires_corpora
    def test_build_population_model_is_corpus_proxy(self):
        m = build_population_model("LAMP")
        self.assertEqual(m.mode, "corpus_proxy")
        self.assertEqual(m.corpus, "LAMP")
        self.assertGreater(m.n_edits, 0)


class CheaAllTests(unittest.TestCase):
    def test_unavailable_when_no_model(self):
        b = chea_all("The bustling market hummed.", "The market hummed.", "The busy market hummed.", None)
        self.assertEqual(b["mode"], "unavailable")
        self.assertIsNone(b["conditional_population"])
        self.assertIn("overall", b["reference"])

    @requires_corpora
    def test_block_shape_with_conditional_model(self):
        m = build_conditional_model("LAMP")
        b = chea_all("The bustling market hummed with life.", "The market hummed.",
                     "The busy market hummed.", m, rid="__nonexistent__")
        self.assertEqual(b["mode"], "corpus_proxy")
        for key in ("reference", "move_coverage", "conditional_direction_agreement",
                    "conditional_population", "conditional_consensus_only"):
            for c in COMPONENT_KEYS:
                self.assertIn(c, b[key])
        self.assertEqual(b["corpus"], "LAMP")
        self.assertIsInstance(b["unavailable_features"], int)


@requires_corpora
class ConditionalModelTests(unittest.TestCase):
    def test_conditional_model_improves_coverage(self):
        m = build_conditional_model("LAMP")
        cs = m.coverage_summary()
        self.assertEqual(cs["mode"], "corpus_proxy")
        self.assertGreater(cs["discriminative_coverage"], 0.30)   # conditional >> unconditional 0.156

    def test_leave_one_out_excludes_own_reference(self):
        m = build_conditional_model("LAMP")
        # consensus call with a real rid excluded should still return a label or unavailable, never error
        feat = next(iter(m.glob))
        c, level = m.consensus(feat, 0.0, exclude_rid="__nonexistent__")
        self.assertIn(level, ("bin", "global", "unavailable"))


class DecompositionTests(unittest.TestCase):
    def test_coverage_and_direction_split(self):
        dz = {"a": 1e-9, "b": 1e-9, "c": 1e-9}
        dH = {"a": 1.0, "b": -1.0, "c": 1.0}   # human moved all three
        dS = {"a": 1.0, "b": 1.0, "c": 0.0}    # system moved a,b (b wrong dir), left c
        cov, cdir = reference_decomposition(dS, dH, ["a", "b", "c"], dz)
        self.assertEqual(cov, round(2 / 3, 3))     # moved 2 of 3 human-moved
        self.assertEqual(cdir, 0.5)                # of the 2 co-moved, 1 agrees


class BootstrapTests(unittest.TestCase):
    def test_paired_bootstrap_detects_consistent_advantage(self):
        from bootstrap import paired_bootstrap
        a = [1.0] * 20
        b = [0.0] * 20
        r = paired_bootstrap(a, b, iters=500)
        self.assertEqual(r["delta"], 1.0)
        self.assertEqual((r["wins"], r["losses"]), (20, 0))
        self.assertTrue(r["significant"])

    def test_paired_bootstrap_drops_none_pairs(self):
        from bootstrap import paired_bootstrap
        r = paired_bootstrap([1.0, None, 2.0], [0.0, 0.0, None], iters=200)
        self.assertEqual(r["n"], 1)


class PublicShapeTests(unittest.TestCase):
    def test_reference_and_population_return_overall_and_components(self):
        src, rw, ref = "The bustling market hummed with life.", "The market hummed.", "The busy market hummed."
        for d in (reference_chea(src, rw, ref), population_chea(src, rw, ref, {})):
            self.assertIn("overall", d)
            for c in COMPONENTS:
                self.assertIn(c, d)


if __name__ == "__main__":
    unittest.main()
