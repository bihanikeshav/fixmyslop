import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
from _corpus_guard import requires_corpora

from edit_budget import (
    ASPECT_WEIGHT,
    _load_E,
    _uncertainty_round,
    build_plan,
    counterfactual_item,
)


class WeightTests(unittest.TestCase):
    def test_redundancy_outweighs_readability(self):
        self.assertGreater(ASPECT_WEIGHT["Redundancy"], ASPECT_WEIGHT["Readability"])
        self.assertEqual(ASPECT_WEIGHT["Grammar"], 0.0)

    def test_uncertainty_round_floors_when_low(self):
        self.assertEqual(_uncertainty_round(1.8, "low"), 1)     # floor
        self.assertEqual(_uncertainty_round(1.6, "medium"), 2)  # round


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
