import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from slop_overrepresentation import resolve_profile
from human_edit_propensity import _pearson, pattern_counts, rho_of


class PropensityMechanicsTests(unittest.TestCase):
    def setUp(self):
        self.profile = resolve_profile(genre=None, source_model=None)

    def test_pattern_counts_uses_stable_ids(self):
        c = pattern_counts("We delve into a rich tapestry and a rich tapestry again.", self.profile)
        self.assertEqual(c[("slop", "delve")], 1)
        self.assertEqual(c[("slop", "rich tapestry")], 2)  # counted by pattern_id, twice

    def test_removed_vs_preserved_classification(self):
        # S has 'delve'; H1 removes it (0), H2 keeps it (>=1).
        s = pattern_counts("We delve into it.", self.profile)[("slop", "delve")]
        h_removed = pattern_counts("We look into it.", self.profile).get(("slop", "delve"), 0)
        h_kept = pattern_counts("We delve into it.", self.profile).get(("slop", "delve"), 0)
        self.assertEqual(s, 1)
        self.assertEqual(h_removed, 0)        # -> REMOVED
        self.assertGreaterEqual(h_kept, s)    # -> PRESERVED

    def test_rho_lookup_known_and_unknown(self):
        self.assertGreater(rho_of(("slop", "tapestry"), self.profile), 1.0)
        self.assertIsNone(rho_of(("rhet", "participial_tail"), self.profile))

    def test_pearson_basic(self):
        self.assertAlmostEqual(_pearson([1, 2, 3], [2, 4, 6]), 1.0, places=3)
        self.assertIsNone(_pearson([1, 2], [1, 2]))  # needs >=3


if __name__ == "__main__":
    unittest.main()
