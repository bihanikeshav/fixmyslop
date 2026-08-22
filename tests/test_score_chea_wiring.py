import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
from _corpus_guard import requires_corpora

from chea import COMPONENT_KEYS
from policy_smoke import score, aggregate

ITEM = {"rid": "t1", "corpus": "LAMP", "sed_s": 40.0, "sed_h": 10.0,
        "S": "The bustling market was alive with a vibrant tapestry of intricate colour.",
        "H": "The market was alive with colour."}


@requires_corpora
class ScoreWiringTests(unittest.TestCase):
    def test_score_emits_chea_block_and_hcsr_hygiene(self):
        per = score([ITEM], {"t1": "The busy market was alive with colour."})
        self.assertEqual(len(per), 1)
        cb = per[0]["chea"]
        self.assertEqual(cb["mode"], "corpus_proxy")
        self.assertIn("overall", cb["reference"])
        self.assertIn("overall", cb["conditional_population"])
        self.assertEqual(per[0]["dir_overall"], cb["reference"]["overall"])
        # HCSR hygiene present + shared-instrument flagged
        for k in ("normalized_hcsr", "residual_interval_hit", "hcsr_shared_instrument"):
            self.assertIn(k, per[0])

    def test_population_unavailable_when_disabled(self):
        per = score([ITEM], {"t1": "The busy market was alive with colour."}, population=False)
        self.assertEqual(per[0]["chea"]["mode"], "unavailable")
        self.assertIsNone(per[0]["chea"]["conditional_population"])

    def test_aggregate_emits_conditional_chea_and_coverage(self):
        per = score([ITEM], {"t1": "The busy market was alive with colour."})
        chea = aggregate(per)["chea"]
        self.assertEqual(chea["mode"], "corpus_proxy")
        for key in ("reference", "move_coverage", "conditional_direction_agreement",
                    "conditional_population", "conditional_consensus_only"):
            for c in COMPONENT_KEYS:
                self.assertIn(c, chea[key])
        cs = chea["coverage_summary"]
        for k in ("corpus", "mode", "n_human_edits", "consensus_cells", "split_cells",
                  "consensus_threshold", "discriminative_coverage", "move_dead_frac"):
            self.assertIn(k, cs)
        self.assertNotIn("combined", chea)   # Reference and Population never collapsed


if __name__ == "__main__":
    unittest.main()
