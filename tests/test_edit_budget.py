import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
from _corpus_guard import requires_corpora

from edit_budget import (
    ASPECT_WEIGHT,
    MIN_TOKENS_FOR_SLOP_CAP,
    _load_E,
    _uncertainty_round,
    build_plan,
    counterfactual_item,
    slop_cap_for_floor,
    slop_cap_for_floor_detail,
)


class WeightTests(unittest.TestCase):
    def test_redundancy_outweighs_readability(self):
        self.assertGreater(ASPECT_WEIGHT["Redundancy"], ASPECT_WEIGHT["Readability"])
        self.assertEqual(ASPECT_WEIGHT["Grammar"], 0.0)

    def test_uncertainty_round_floors_when_low(self):
        self.assertEqual(_uncertainty_round(1.8, "low"), 1)     # floor
        self.assertEqual(_uncertainty_round(1.6, "medium"), 2)  # round


class SlopCapForFloorReasonTests(unittest.TestCase):
    """Audit fix (item 13): a cap of 0 must be distinguishable — short document vs. a genuine
    zero budget vs. no occurrences at all — not collapsed into a bare, ambiguous int."""

    def test_no_occurrences_is_trivially_zero(self):
        cap, reason = slop_cap_for_floor_detail([], 200, 10.0)
        self.assertEqual((cap, reason), (0, "no_occurrences"))

    def test_short_document_flagged_distinctly(self):
        occs = [{"weight": 5.0}]
        cap, reason = slop_cap_for_floor_detail(occs, MIN_TOKENS_FOR_SLOP_CAP - 1, 0.0)
        self.assertEqual((cap, reason), (0, "short_document"))

    def test_already_at_floor_is_a_genuine_zero_budget(self):
        # High floor relative to weight/tokens: even removing nothing is already below it.
        occs = [{"weight": 1.0}]
        cap, reason = slop_cap_for_floor_detail(occs, 1000, 1_000_000.0)
        self.assertEqual((cap, reason), (0, "already_at_floor"))

    def test_ok_reason_when_cap_is_computed_normally(self):
        occs = [{"weight": 5.0}, {"weight": 3.0}]
        cap, reason = slop_cap_for_floor_detail(occs, 1000, 0.5)
        self.assertEqual(reason, "ok")
        self.assertGreaterEqual(cap, 0)

    def test_wrapper_returns_same_cap_as_detail(self):
        occs = [{"weight": 5.0}, {"weight": 3.0}]
        cap, _ = slop_cap_for_floor_detail(occs, 1000, 0.5)
        self.assertEqual(slop_cap_for_floor(occs, 1000, 0.5), cap)


@requires_corpora
class PlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.E = _load_E()

    def test_budget_never_exceeds_occurrences_and_ranks_high_E_first(self):
        text = ("We delve into a rich tapestry and a vibrant tapestry, a bustling tapestry, "
                "a seamless tapestry, and a whimsical tapestry of ideas.")
        plan = build_plan(text, "LAMP", self.E)
        fam = next(p for p in plan["families"] if p["family"] == "slop_overrepresentation")
        self.assertLessEqual(fam["edit_budget"], fam["occurrences"])
        self.assertEqual(len(fam["priority_spans"]), fam["edit_budget"])
        # decisions assigned to every occurrence
        decs = {o["decision"] for o in fam["_occs"]}
        self.assertTrue(decs <= {"MUST_EDIT", "SHOULD_EDIT", "OPTIONAL", "PRESERVE"})

    def test_counterfactual_preserves_residual_slop(self):
        text = "We delve into a rich tapestry, a bustling landscape, a vibrant realm of intricate ideas."
        cf = counterfactual_item(text, "LAMP", sed_h=30.0, E=self.E, pragmatic_families=frozenset())
        # budget should request fewer edits than detect-all, leaving some residual SED
        self.assertLessEqual(cf["budget_requests"], cf["current_requests"])
        self.assertGreaterEqual(cf["predicted_residual_SED_budget"], 0.0)


if __name__ == "__main__":
    unittest.main()
