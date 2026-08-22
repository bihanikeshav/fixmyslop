import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from slop_overrepresentation import resolve_profile
from validate_spans import _overlaps, annotated_ranges, occurrences


class SpanMechanicsTests(unittest.TestCase):
    def setUp(self):
        self.profile = resolve_profile(genre=None, source_model=None)

    def test_annotated_ranges_locate_edit_spans(self):
        src = "We delve into a rich tapestry of things. The bustling city sleeps."
        edits = [{"originalText": "a rich tapestry of things", "editedText": "", "categorization": "Cliche"}]
        ranges = annotated_ranges(src, edits)
        self.assertEqual(len(ranges), 1)
        start, end, cat, deletion = ranges[0]
        self.assertEqual(src[start:end], "a rich tapestry of things")
        self.assertTrue(deletion)  # editedText == ""
        self.assertEqual(cat, "Cliche")

    def test_occurrence_overlap_detects_edited_pattern(self):
        src = "We delve into a rich tapestry of things. The bustling city sleeps."
        edits = [{"originalText": "a rich tapestry of things", "editedText": "", "categorization": "Cliche"}]
        ranges = annotated_ranges(src, edits)
        occ = occurrences(src, self.profile)
        # 'tapestry' occurrence should overlap the annotated edit; 'bustling' should not.
        tap = [(a, b) for a, b, k in occ if k[1] == "tapestry"][0]
        bus = [(a, b) for a, b, k in occ if k[1] == "bustling"]
        self.assertIsNotNone(_overlaps(tap[0], tap[1], ranges))
        if bus:
            self.assertIsNone(_overlaps(bus[0][0], bus[0][1], ranges))

    def test_overlaps_helper(self):
        ranges = [(10, 20, "Cliche", False)]
        self.assertIsNotNone(_overlaps(15, 18, ranges))  # inside
        self.assertIsNone(_overlaps(0, 5, ranges))       # before
        self.assertIsNone(_overlaps(20, 25, ranges))     # touching end = no overlap


if __name__ == "__main__":
    unittest.main()
