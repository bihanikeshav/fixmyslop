import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))
sys.path.insert(0, str(ROOT / "textslopbench"))

from causal_trace import summarize_traces, trace_findings
from family_ablation import FAMILY_ARMS, build_family_arm, family_arm_plan
from human_input_track import score_human_input_track
from humanstats import analyze
from pipeline import (
    classify_second_scan_finding,
    finish_rewrite_context,
    prepare_rewrite_context,
    targeted_correction_plan,
)


class SecondScanGateTests(unittest.TestCase):
    def _finding(self, **kw):
        base = {"family": "promotional", "severity": 2, "start": 5, "end": 15, "evidence": "world-class"}
        base.update(kw)
        return base

    def test_actionable_when_all_gates_pass(self):
        keep, reason = classify_second_scan_finding(self._finding(), anchor_spans=[], intentional_families=set())
        self.assertTrue(keep)
        self.assertEqual(reason, "actionable")

    def test_low_confidence_is_diagnostic_only(self):
        keep, reason = classify_second_scan_finding(self._finding(severity=1), [], set())
        self.assertFalse(keep)
        self.assertEqual(reason, "low_confidence")

    def test_finding_overlapping_anchor_is_diagnostic_only(self):
        keep, reason = classify_second_scan_finding(self._finding(), anchor_spans=[(10, 20)], intentional_families=set())
        self.assertFalse(keep)
        self.assertEqual(reason, "would_threaten_anchor")

    def test_pragmatically_intentional_family_is_diagnostic_only(self):
        keep, reason = classify_second_scan_finding(self._finding(), [], {"promotional"})
        self.assertFalse(keep)
        self.assertEqual(reason, "pragmatically_intentional")

    def test_missing_span_is_diagnostic_only(self):
        keep, reason = classify_second_scan_finding(self._finding(start=None, end=None), [], set())
        self.assertFalse(keep)
        self.assertEqual(reason, "no_concrete_span")

    def test_plan_does_not_trigger_on_clean_anchor_safe_rewrite(self):
        context = prepare_rewrite_context("The refund of $42 will arrive in 3 business days.", "auto")
        clean = "Your $42 refund will arrive within 3 business days."
        plan = targeted_correction_plan(context, clean, analyze(clean, context["genre_inference"]["genre"]))
        self.assertFalse(plan["needed"])
        self.assertEqual(plan["actionable_findings"], [])

    def test_plan_triggers_and_separates_diagnostic_from_actionable(self):
        source = "The refund of $42 will arrive in 3 business days."
        context = prepare_rewrite_context(source, "auto")
        # A rewrite that reintroduces a high-severity slop phrase with no anchor risk.
        dirty = "Great question! Your $42 refund will arrive within 3 business days."
        plan = targeted_correction_plan(context, dirty, analyze(dirty, context["genre_inference"]["genre"]))
        self.assertTrue(plan["needed"])
        families = {f["family"] for f in plan["actionable_findings"]}
        self.assertIn("interface_artifact", families)
        # Anchors are still present, so anchor coverage should not be the trigger.
        self.assertTrue(plan["anchor_coverage"]["passed"])


class CausalTraceTests(unittest.TestCase):
    def test_acted_and_survival_flags(self):
        findings = [
            {"family": "promotional", "severity": 1, "start": 0, "end": 6, "evidence": "vibrant"},
            {"family": "filler", "severity": 1, "start": 10, "end": 26, "evidence": "in order to"},
        ]
        rewrite = "a plain sentence in order to keep the second phrase"  # 'vibrant' removed, filler kept
        second = "a plain sentence to keep the second phrase"  # filler removed on pass 2
        traces = trace_findings(findings, rewrite, second)
        by_family = {t["family"]: t for t in traces}
        self.assertTrue(by_family["promotional"]["acted_in_first_pass"])
        self.assertFalse(by_family["filler"]["acted_in_first_pass"])
        self.assertTrue(by_family["filler"]["first_pass_change_survived_second_pass"])  # removed by pass 2

    def test_summary_rates(self):
        traces = [
            {"family": "promotional", "acted_in_first_pass": True, "first_pass_change_survived_second_pass": True},
            {"family": "promotional", "acted_in_first_pass": False, "first_pass_change_survived_second_pass": False},
        ]
        summary = summarize_traces(traces)
        self.assertEqual(summary["promotional"]["findings"], 2)
        self.assertEqual(summary["promotional"]["acted"], 1)
        self.assertEqual(summary["promotional"]["action_rate"], 0.5)
        self.assertEqual(summary["promotional"]["survival_rate"], 0.5)


class FamilyAblationTests(unittest.TestCase):
    def test_nine_arms_and_pragmatics_invariant(self):
        self.assertEqual(len(FAMILY_ARMS), 9)
        context = prepare_rewrite_context("Great question! This vibrant, world-class tool serves as a testament to progress.", "auto")
        plan = family_arm_plan(context)
        self.assertEqual(set(plan), set(FAMILY_ARMS))
        base = plan["pragmatics_only"]["pragmatics"]
        for arm in plan.values():
            self.assertEqual(arm["pragmatics"], base)  # identical pragmatics across arms
        self.assertEqual(plan["pragmatics_only"]["humanstats_evidence"], {})
        self.assertIn("rhetorical_findings", plan["pragmatics_plus_rhetorical"]["humanstats_evidence"])
        self.assertIn("lexical", plan["pragmatics_plus_lexical"]["humanstats_evidence"])

    def test_unknown_arm_raises(self):
        context = prepare_rewrite_context("hello world", "auto")
        with self.assertRaises(KeyError):
            build_family_arm(context, "pragmatics_plus_unknown")


class HumanInputTrackTests(unittest.TestCase):
    def test_zero_intervention_is_reported_not_rewarded(self):
        source_by_id = {"a": "The order #TSB-1042 shipped on 14 August.", "b": "Rating: 3/5. The app logged me out."}
        # System that never edits: identical outputs.
        identical = dict(source_by_id)
        choices = ["tie", "tie", "tie", "tie"]
        result = score_human_input_track(source_by_id, identical, choices)
        self.assertEqual(result["human_intervention_rate"], 0.0)
        self.assertEqual(result["tie_rate"], 1.0)
        self.assertEqual(result["anchor_claim_fidelity_pass_rate"], 1.0)

    def test_heavy_intervention_and_preference_are_separate(self):
        source_by_id = {"a": "The order #TSB-1042 shipped on 14 August."}
        edited = {"a": "Your parcel is on its way and should arrive soon."}  # drops the anchor
        choices = ["rewrite", "rewrite", "original"]
        result = score_human_input_track(source_by_id, edited, choices)
        self.assertEqual(result["human_intervention_rate"], 1.0)
        self.assertLess(result["anchor_claim_fidelity_pass_rate"], 1.0)
        self.assertEqual(result["human_rewrite_preference"], 2)
        self.assertEqual(result["original_preference"], 1)


class StratifiedSelectionTests(unittest.TestCase):
    def _corpus(self):
        records = []
        for i in range(30):
            genre = ["a", "b", "c"][i % 3]
            records.append({"record_id": f"r{i}", "metadata": {"genre": genre}})
        return records

    def test_deterministic_and_stratum_coverage(self):
        from dataset_eval import stratified_select

        first = stratified_select(self._corpus(), 9, "genre")
        second = stratified_select(self._corpus(), 9, "genre")
        self.assertEqual([r["record_id"] for r in first], [r["record_id"] for r in second])
        strata = {r["stratum"] for r in first}
        self.assertEqual(strata, {"a", "b", "c"})
        # Round-robin gives balanced coverage: 3 per stratum for a target of 9.
        counts = {s: sum(r["stratum"] == s for r in first) for s in strata}
        self.assertEqual(set(counts.values()), {3})

    def test_caps_at_corpus_size(self):
        from dataset_eval import stratified_select

        selected = stratified_select(self._corpus(), 500, "genre")
        self.assertEqual(len(selected), 30)


if __name__ == "__main__":
    unittest.main()
