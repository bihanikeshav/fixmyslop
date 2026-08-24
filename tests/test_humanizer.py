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

    def test_soft_vocabulary_is_diagnostic_not_host_actionable(self):
        context = prepare_rewrite_context(
            "This is a crucial detail in the method.",
            "academic abstract",
        )
        actionable = {row["family"] for row in context["model_summary"]["actionable_findings"]}
        diagnostic = {row["family"] for row in context["model_summary"]["contextual_signals"]}
        self.assertNotIn("ai_vocabulary", actionable)
        self.assertIn("ai_vocabulary", diagnostic)

    def test_explicit_custom_genre_is_not_silently_overridden(self):
        context = prepare_rewrite_context("The parties agree to the following terms.", "legal contract")
        self.assertEqual(context["genre_inference"]["genre"], "legal contract")
        self.assertEqual(context["genre_inference"]["method"], "explicit_custom_genre")

    def test_hard_anchor_map_catches_modified_claim(self):
        context = prepare_rewrite_context("The study found 38% fewer failures, but the result may be preliminary.", "auto")
        result = audit("The study found 38% fewer failures, but the result may be preliminary.", "The study found 18% fewer failures.", content_map=context["source_content_map"])
        self.assertFalse(result["passed"])
        self.assertFalse(result["hard_anchor_coverage"]["passed"])

    def test_dash_is_reframed_structurally(self):
        result = rewrite("The problem is not speed—it is consistency.", "auto")
        self.assertNotIn("—", result["rewrite"])
        self.assertIn(";", result["rewrite"])

    def test_contextual_pass_preserves_intentional_typography_and_voice(self):
        text = "The tool—despite its flaws—works. I kept the 🔥 because it is the whole joke."
        result = rewrite(text, "personal social post")
        self.assertEqual(result["rewrite"], text)

    def test_plain_typography_reframes_paired_dash_as_an_aside(self):
        result = rewrite("The tool—despite its flaws—works.", "general prose", typography="plain")
        self.assertEqual(result["rewrite"], "The tool (despite its flaws) works.")

    def test_ambiguous_words_and_parallel_syntax_are_not_broken(self):
        cases = [
            "These features are intentional.",
            "Jordan boasts about the result.",
            "She is, of course, ready.",
            "Not only did Maya ship the fix, but she also wrote the tests.",
        ]
        for text in cases:
            with self.subTest(text=text):
                self.assertEqual(rewrite(text, "general prose")["rewrite"], text)

    def test_soft_reporting_verb_is_not_a_banned_word(self):
        text = "This release showcases faster exports."
        self.assertEqual(rewrite(text, "software release notes")["rewrite"], text)

    def test_layout_is_preserved_when_there_is_no_greeting(self):
        text = "\n  - first item\n\n    nested note\n"
        self.assertEqual(rewrite(text, "general prose")["rewrite"], text)

    def test_fidelity_blocks_actor_loss_and_claim_flip(self):
        actor = audit("Ravi reviewed the release.", "The team approved it unanimously.")
        flip = audit(
            "Acme revenue increased to 5 million dollars in 2025 because demand rose.",
            "Acme revenue decreased to 5 million dollars in 2025 because demand collapsed.",
        )
        self.assertFalse(actor["passed"])
        self.assertFalse(flip["passed"])
        self.assertTrue(flip["claim_drift_flags"])

    def test_fidelity_recognizes_day_first_dates_without_treating_may_as_modal(self):
        changed_date = audit("The launch is 4 May 2026.", "The launch is 4 June 2026.")
        same_date = audit("May approved it on 4 May 2026.", "On 4 May 2026, May approved it.")
        self.assertFalse(changed_date["passed"])
        self.assertIn("4 May 2026", changed_date["checks"][2]["missing"])
        self.assertTrue(same_date["passed"])
        self.assertNotIn("modality_changed", same_date["claim_drift_flags"])

    def test_fidelity_blocks_explicit_numeric_range_reversal(self):
        result = audit(
            "Latency fell from 400ms to 250ms.",
            "Latency fell from 250ms to 400ms.",
        )
        self.assertFalse(result["passed"])
        self.assertIn("numeric_range_reversed", result["claim_drift_flags"])

    def test_fidelity_blocks_causal_direction_reversal(self):
        result = audit(
            "The queue failed because the token expired.",
            "The token expired because the queue failed.",
        )
        self.assertFalse(result["passed"])
        self.assertIn("causal_direction_reversed", result["claim_drift_flags"])

    def test_fidelity_accepts_equivalent_comparative_inversion(self):
        valid = audit(
            "Maya processed more orders than Ravi.",
            "Ravi processed fewer orders than Maya.",
        )
        flipped = audit(
            "Maya processed more orders than Ravi.",
            "Ravi processed more orders than Maya.",
        )
        self.assertTrue(valid["passed"])
        self.assertFalse(flipped["passed"])
        self.assertIn("comparative_direction_reversed", flipped["claim_drift_flags"])

    def test_duplicate_protected_occurrences_are_counted(self):
        result = audit("Keep TOKEN twice: TOKEN.", "Keep TOKEN once.", ["TOKEN", "TOKEN"])
        self.assertFalse(result["passed"])
        self.assertTrue(result["checks"][0]["modified_or_underrepresented"])

    def test_editable_curly_quotes_are_normalized_but_protected_quotes_survive(self):
        result = rewrite("The writer’s draft was ready. She said “keep it simple.”", "auto", typography="plain")
        self.assertIn('“keep it simple.”', result["rewrite"])
        self.assertIn("writer's", result["rewrite"])
        self.assertNotIn("writer’s", result["rewrite"])

    def test_contextual_typography_preserves_curly_apostrophe(self):
        text = "The writer’s draft was ready."
        self.assertEqual(rewrite(text, "auto")["rewrite"], text)


if __name__ == "__main__":
    unittest.main()
