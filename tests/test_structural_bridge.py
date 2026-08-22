import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from _corpus_guard import requires_corpora
from structural_bridge import structural_findings, _subseq, _top_repeated_4gram, _sentences, SUPPORTED_CORPORA
from chea import build_conditional_model
from pipeline import prepare_rewrite_context, extract_source_content_map


class BoundarySafeTests(unittest.TestCase):
    def test_subseq_is_boundary_safe(self):
        self.assertTrue(_subseq(["pin", "the", "end", "now"], ["the", "end"]))
        self.assertFalse(_subseq(["pinthe", "end"], ["pin", "the"]))  # no false substring hit

    def test_top_repeated_4gram_skips_anchor_phrase(self):
        text = ("Acme Global Trading Corp shipped it. Later, Acme Global Trading Corp shipped it again.")
        # if the repeated 4-gram IS the anchor, it must be skipped
        anchors = [["acme", "global", "trading", "corp"]]
        phrase, hits = _top_repeated_4gram(_sentences(text), anchors)
        self.assertNotEqual(phrase, "acme global trading corp")


@requires_corpora
class GatingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.beemo = build_conditional_model("Beemo")

    def test_no_model(self):
        found, audit = structural_findings("a and b and c.", None, None, {}, ("repetition",))
        self.assertEqual(found, [])
        self.assertEqual(audit["skipped"][0]["reason"], "no_model")

    def test_genre_gate_blocks_unsupported_corpus(self):
        lamp = build_conditional_model("LAMP")
        self.assertNotIn("LAMP", SUPPORTED_CORPORA)
        found, audit = structural_findings("unlock the secret to growth; unlock the secret to scale here.",
                                           None, lamp, {}, ("repetition",))
        self.assertEqual(found, [])
        self.assertTrue(audit["skipped"][0]["reason"].startswith("genre_not_supported"))

    def test_anchor_guard_suppresses_or_reselects(self):
        # a repeated 4-gram where BOTH occurrences sit in sentences containing the hedge anchor "may"
        text = ("The plan may unlock the secret to success. The plan may unlock the secret to success.")
        cm = extract_source_content_map(text, [])
        found, audit = structural_findings(text, "__x__", self.beemo, cm, ("repetition",))
        # never emit a finding whose rework span still contains an anchor
        for f in found:
            sents = _sentences(text)
            self.assertNotIn("may", sents[f["spans"][0]].lower().split())

    def test_only_reduce_direction_and_leave_one_out(self):
        # smoke: runs with exclude_rid without error and only ever emits reduce-direction findings
        found, _ = structural_findings("unlock the secret to X. later, unlock the secret to Y here now.",
                                       "__nonexistent__", self.beemo, {"hard_anchors": []}, ("repetition",))
        for f in found:
            self.assertEqual(f["predicted_direction"], "neg")


@requires_corpora
class PipelineDefaultUnchangedTests(unittest.TestCase):
    def test_v1_default_has_no_structural(self):
        ctx = prepare_rewrite_context("The bustling market and busy streets and loud vendors filled the air.", "auto", [])
        self.assertIsNone(ctx["structural_audit"])
        self.assertTrue(all(not f.get("structural") for f in ctx["model_summary"]["actionable_findings"]))

    def test_clause_and_formulaic_removed(self):
        beemo = build_conditional_model("Beemo")
        found, audit = structural_findings("He ran and jumped and fell.", "_", beemo, {"hard_anchors": []},
                                           ("clause", "formulaic"))
        self.assertEqual(found, [])  # only repetition is supported now
        self.assertEqual(audit["skipped"][0]["reason"], "not_requested")


if __name__ == "__main__":
    unittest.main()
