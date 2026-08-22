import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from expendable_bridge import expendable_findings, CATS
from anchors import extract_source_content_map
from pipeline import prepare_rewrite_context


def _cm(t):
    return extract_source_content_map(t, [])


class ExpendableTests(unittest.TestCase):
    def test_framing_detected(self):
        t = "Sure, here is a summary: The market grew last year and demand stayed strong."
        found, _ = expendable_findings(t, _cm(t), ("ai_framing",))
        self.assertTrue(any(f["category"] == "ai_framing" for f in found))

    def test_pleasantry_closing_only(self):
        # a substantive opener must NOT be flagged as a pleasantry
        t = "I am writing to inform you that the shipment of 400 units will be delayed by two days."
        found, _ = expendable_findings(t, _cm(t), ("pleasantry",))
        self.assertEqual(found, [])
        # a genuine closing pleasantry is flagged
        t2 = "The order shipped today. Thank you for your patience."
        f2, _ = expendable_findings(t2, _cm(t2), ("pleasantry",))
        self.assertTrue(any(f["category"] == "pleasantry" for f in f2))

    def test_anchor_overlap_blocks(self):
        # framing sentence carrying a hard number anchor must be gated out
        t = "Here is the result: 42 units failed inspection."
        found, _ = expendable_findings(t, _cm(t), ("ai_framing",))
        self.assertFalse(any(f["evidence"].strip().lower().startswith("here is the result") for f in found))

    def test_cap_and_priority(self):
        t = ("Sure, here's an overview: Thank you for reaching out. According to the text, the plan is "
             "very ambitious and truly remarkable.")
        found, _ = expendable_findings(t, _cm(t), tuple(CATS), max_total=2)
        self.assertLessEqual(len(found), 2)
        self.assertEqual(found[0]["category"], "ai_framing")   # priority order

    def test_not_requested_category_skipped(self):
        t = "The plan is very ambitious."
        found, audit = expendable_findings(t, _cm(t), ("ai_framing",))  # ornamental present but not requested
        self.assertEqual([f for f in found if f["category"] == "ornamental_detail"], [])


class PipelineDefaultTests(unittest.TestCase):
    def test_v1_default_no_expendable(self):
        ctx = prepare_rewrite_context("Sure, here is a summary: the market grew.", "auto", [])
        self.assertIsNone(ctx["expendable_audit"])
        self.assertTrue(all(not f.get("expendable") for f in ctx["model_summary"]["actionable_findings"]))


if __name__ == "__main__":
    unittest.main()
