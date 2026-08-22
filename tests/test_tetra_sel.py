import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "textslopbench"))

from adapters.tetra import TETRAAdapter, aspects_for
from slop_specific_lift import _shares

SAMPLE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<doc id="X01-1" editor="A" format="Conf" position="NS" region="N">
  <abstract>
    <text>We present a method.</text>
    <edit type="redundancy;clarity" crr="a clear method" comments="cut redundancy">a method that is redundant</edit>
    <text>It works.</text>
  </abstract>
</doc>"""


class AspectMapTests(unittest.TestCase):
    def test_multi_type_maps_to_shared_aspects(self):
        self.assertEqual(aspects_for("redundancy;clarity"), ["Clarity", "Redundancy"])
        self.assertEqual(aspects_for("word choice"), ["WordChoice"])
        self.assertEqual(aspects_for(""), ["Other"])

    def test_shares_sum_to_one(self):
        from collections import Counter
        s = _shares(Counter({"a": 3, "b": 1}))
        self.assertAlmostEqual(sum(s.values()), 1.0, places=6)
        self.assertAlmostEqual(s["a"], 0.75, places=6)


class TetraAdapterTests(unittest.TestCase):
    def test_reconstructs_pre_and_post_and_edits(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "_tmp_tetra_sample.xml"
            p.write_text(SAMPLE_XML, encoding="utf-8")
            recs = TETRAAdapter().adapt(p)
        self.assertEqual(len(recs), 1)
        r = recs[0]
        self.assertIn("a method that is redundant", r["source_text"])   # pre-edit body
        self.assertIn("a clear method", r["human_references"][0])       # crr in revised
        self.assertNotIn("a method that is redundant", r["human_references"][0])
        edits = r["metadata"]["edits"]
        self.assertEqual(len(edits), 1)
        self.assertEqual(edits[0]["aspects"], ["Clarity", "Redundancy"])


if __name__ == "__main__":
    unittest.main()
