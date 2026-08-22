import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(ROOT / "textslopbench"))

from fidelity import audit
from humanize import rewrite
from humanstats import analyze, protected_spans
from pipeline import prepare_rewrite_context
from run_textslopbench import load_fixtures, score_candidate, summary


class HumanizerTests(unittest.TestCase):
    def test_analyzer_reports_behavior_families(self):
        text = "Great question! This is a pivotal moment, highlighting a vibrant landscape."
        report = analyze(text, "essay_opinion")
        families = {finding["family"] for finding in report["findings"]}
        self.assertIn("interface_artifact", families)
        self.assertIn("inflation", families)
        self.assertIn("participial_tail", families)
        self.assertGreater(report["formulaic_risk"], 0)

    def test_protected_quote_survives_typography_pass(self):
        text = 'The issue was not merely a delay—it was a failure. The engineer said “keep 19 minutes—exactly.”'
        result = rewrite(text, "postmortem")
        self.assertIn('“keep 19 minutes—exactly.”', result["rewrite"])
        self.assertNotIn("delay—", result["rewrite"])
        self.assertTrue(result["fidelity"]["passed"])

    def test_exact_fidelity_flags_dropped_number(self):
        result = audit("The budget is $1,200 for 48 hours.", "The budget is $900 for two days.", ["$1,200", "48 hours"])
        self.assertFalse(result["passed"])
        self.assertTrue(result["checks"][0]["missing"])

    def test_human_control_is_not_forced_to_grow(self):
        text = "I liked the ginger tea, but the app logged me out twice. Rating: 3/5."
        result = rewrite(text, "customer review")
        self.assertLessEqual(abs(result["fidelity"]["word_delta"]), 3)
        self.assertIn("3/5", result["rewrite"])

    def test_owned_benchmark_is_complete_and_scoreable(self):
        fixtures = load_fixtures(ROOT / "textslopbench" / "fixtures.jsonl")
        self.assertEqual(len(fixtures), 12)
        records = [score_candidate(item, rewrite(str(item["source"]), "auto", protected_values=list(item.get("protected", [])))["rewrite"], "test") for item in fixtures]
        report = summary(records)
        self.assertEqual(report["items"], 12)
        self.assertIn("test", report["systems"])

    def test_auto_genre_and_pragmatic_context_are_real(self):
        context = prepare_rewrite_context(
            "Interviewer: What changed?\nRavi: Honestly, we cut the dashboard from 14 widgets to 5.",
            "auto",
            ["Interviewer:", "Ravi:", "14 widgets to 5"],
        )
        self.assertEqual(context["genre_inference"]["genre"], "interview transcript")
        self.assertIn("spoken", context["pragmatic_profile"]["purpose"])
        self.assertIn("actionable_findings", context["model_summary"])
        self.assertIn("hard_anchor_policy", context["model_summary"])
        self.assertNotIn("lexical", context["model_summary"])

    def test_auto_genre_prefers_ui_controls_over_ambiguous_sample_language(self):
        context = prepare_rewrite_context(
            "Welcome. Add up to 3 sample rewrites, then select Continue or Skip for now at /settings/profile.",
            "auto",
        )
        self.assertEqual(context["genre_inference"]["genre"], "product onboarding UI")

    def test_hard_anchor_map_catches_modified_claim(self):
        context = prepare_rewrite_context("The study found 38% fewer failures, but the result may be preliminary.", "auto")
        result = audit("The study found 38% fewer failures, but the result may be preliminary.", "The study found 18% fewer failures.", content_map=context["source_content_map"])
        self.assertFalse(result["passed"])
        self.assertFalse(result["hard_anchor_coverage"]["passed"])

    def test_dash_is_reframed_structurally(self):
        result = rewrite("The problem is not speed—it is consistency.", "auto")
        self.assertNotIn("—", result["rewrite"])
        self.assertIn(";", result["rewrite"])

    def test_editable_curly_quotes_are_normalized_but_protected_quotes_survive(self):
        result = rewrite("The writer’s draft was ready. She said “keep it simple.”", "auto")
        self.assertIn('“keep it simple.”', result["rewrite"])
        self.assertIn("writer's", result["rewrite"])
        self.assertNotIn("writer’s", result["rewrite"])


if __name__ == "__main__":
    unittest.main()
