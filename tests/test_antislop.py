import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from humanstats import analyze
from slop_overrepresentation import (
    actionable_slop,
    resolve_profile,
    scan,
    slop_pattern_suppression,
    weighted_density,
)


class SlopScanTests(unittest.TestCase):
    def test_detects_unigram_bigram_template_with_weights(self):
        text = "We delve into a rich tapestry of ideas; it is not cheap but it is worth it."
        findings = scan(text)
        subtypes = {f["subtype"] for f in findings}
        self.assertIn("unigram", subtypes)
        self.assertIn("2gram", subtypes)
        self.assertIn("rhetorical_template", subtypes)
        for f in findings:
            self.assertEqual(f["family"], "slop_overrepresentation")
            self.assertEqual(f["action"], "review_in_context")  # flagged, never banned
            self.assertGreaterEqual(f["overrepresentation"], 1.0)

    def test_protected_span_is_skipped(self):
        # 'delve' inside a quotation must not be flagged.
        text = 'The author wrote "delve into the tapestry" verbatim.'
        evidences = {f["evidence"].lower() for f in scan(text)}
        self.assertNotIn("delve", evidences)

    def test_genre_exemption_applies(self):
        text = "This is a crucial and profound result."
        general = {f["evidence"].lower() for f in scan(text, genre=None)}
        abstract = {f["evidence"].lower() for f in scan(text, genre="academic abstract")}
        self.assertIn("crucial", general)
        self.assertNotIn("crucial", abstract)

    def test_weighted_density_zero_for_clean_text(self):
        self.assertEqual(weighted_density("The cat sat on the mat by the door."), 0.0)
        self.assertGreater(weighted_density("A vibrant, seamless, multifaceted tapestry."), 0.0)

    def test_actionable_slop_is_high_confidence_only(self):
        # 'delve' (unigram, medium) + 'rich tapestry' (bigram, high) + template (high).
        findings = scan("We delve into a rich tapestry; it is not cheap but it is worth it.")
        actionable = actionable_slop(findings)
        self.assertTrue(actionable)
        self.assertTrue(all(f["confidence"] == "high" for f in actionable))
        self.assertTrue(any(f["subtype"] == "unigram" for f in findings))  # unigram present...
        self.assertFalse(any(f["subtype"] == "unigram" for f in actionable))  # ...but not actionable

    def test_profile_id_records_baseline_and_model(self):
        profile = resolve_profile(genre="recipe", source_model=None)
        self.assertIn("model=consensus", profile["profile_id"])


class SlopSuppressionTests(unittest.TestCase):
    def test_relative_reduction_positive_when_slop_removed(self):
        source = "We delve into a rich tapestry that stands as a testament to seamless design."
        rewrite = "We explain the design and why it works."
        sps = slop_pattern_suppression(source, rewrite)
        self.assertGreater(sps["relative_reduction"], 0.5)
        self.assertGreater(sps["source_pattern_count"], sps["rewrite_pattern_count"])

    def test_introduced_patterns_are_tracked(self):
        source = "The design works well."
        rewrite = "The design is a seamless, vibrant tapestry."
        sps = slop_pattern_suppression(source, rewrite)
        self.assertLess(sps["absolute_reduction"], 0.0)  # density went up: slop increased
        self.assertTrue(sps["introduced_patterns"])


class AnalyzeIntegrationTests(unittest.TestCase):
    def test_slop_family_present_but_excluded_from_formulaic_risk(self):
        # 'myriad' is a slop unigram but matches no legacy PATTERN family.
        report = analyze("The myriad options are ready.", "auto")
        self.assertEqual(report["formulaic_risk"], 0)  # slop does not inflate legacy risk
        self.assertGreaterEqual(report["slop"]["pattern_count"], 1)
        families = {f["family"] for f in report["findings"]}
        self.assertIn("slop_overrepresentation", families)
        self.assertIn("slop_overrepresentation", report["finding_counts"])

    def test_diversity_metrics_present_and_bounded(self):
        report = analyze("The quick brown fox jumped over the lazy dog again and again.", "auto")
        lexical = report["lexical"]
        for key in ("hdd", "distinct_1", "distinct_2", "distinct_3", "mattr_500"):
            self.assertIn(key, lexical)
            self.assertGreaterEqual(lexical[key], 0.0)
            self.assertLessEqual(lexical[key], 1.0)


if __name__ == "__main__":
    unittest.main()
