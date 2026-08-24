import sys
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "textslopbench"))

from bootstrap import paired_cluster_bootstrap
from claimflip_bench import run as run_claimflip
from intervention_bench import run as run_intervention
from local_benchmark_suite import run as run_suite
from run_textslopbench import rescore_records
from export_web_summary import build_summary, render_js
from v2_confirmed_baseline import noninferiority_pass


class LocalBenchmarkTests(unittest.TestCase):
    def test_claimflip_owned_pack_has_no_missed_cases(self):
        report = run_claimflip()
        self.assertEqual(report["items"], 40)
        self.assertEqual(report["valid_items"], 15)
        self.assertEqual(report["corruption_items"], 25)
        self.assertEqual(report["corruption_recall"], 1.0)
        self.assertEqual(report["valid_paraphrase_specificity"], 1.0)
        self.assertFalse(report["failures"])

    def test_intervention_pack_balances_edit_and_do_no_harm(self):
        report = run_intervention()
        self.assertEqual(report["items"], 36)
        self.assertEqual(report["defect_intervention_recall"], 1.0)
        self.assertEqual(report["clean_preservation_specificity"], 1.0)
        self.assertEqual(report["idempotence_rate"], 1.0)
        self.assertFalse(report["failures"])

    def test_suite_always_reports_identity_baseline(self):
        report = run_suite()
        systems = report["owned_rewrite_benchmark"]["systems"]
        self.assertIn("identity/no-op", systems)
        self.assertIn("FixMySlop:Humanizer/local-cli@0.2.0", systems)
        self.assertEqual(report["owned_rewrite_benchmark"]["items"], 12)
        self.assertEqual(report["owned_rewrite_benchmark"]["records"], 24)
        self.assertFalse(report["owned_gates"]["failures"])
        self.assertGreater(report["owned_gates"]["ai_intervention_items"], 0)
        self.assertEqual(report["owned_gates"]["human_controls_changed"], 0)

    def test_landing_ledger_is_generated_from_the_suite(self):
        expected = build_summary(run_suite())
        ledger = ROOT / "apps" / "web" / "demo" / "textslop-summary.js"
        text = ledger.read_text(encoding="utf-8")
        match = re.search(r"Object\.freeze\((\{.*\})\);", text, re.DOTALL)
        self.assertIsNotNone(match)
        self.assertEqual(json.loads(match.group(1)), expected)
        self.assertEqual(text, render_js(expected))

    def test_external_scoring_rejects_duplicates_and_incomplete_runs(self):
        fixtures = [
            {"id": "a", "source": "Alpha.", "genre": "general prose"},
            {"id": "b", "source": "Beta.", "genre": "general prose"},
        ]
        fixture_by_id = {item["id"]: item for item in fixtures}
        with self.assertRaisesRegex(ValueError, "Duplicate candidate"):
            rescore_records([
                {"id": "a", "rewrite": "Alpha.", "system": "x"},
                {"id": "a", "rewrite": "Alpha.", "system": "x"},
            ], fixture_by_id)
        with self.assertRaisesRegex(ValueError, "Incomplete run"):
            rescore_records([
                {"id": "a", "rewrite": "Alpha.", "system": "x"},
            ], fixture_by_id)

    def test_cluster_bootstrap_resamples_groups_not_only_items(self):
        result = paired_cluster_bootstrap(
            [1.0, 1.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 1.0],
            ["writer-a", "writer-a", "writer-b", "writer-b"],
            iters=200,
        )
        self.assertEqual(result["clusters"], 2)
        self.assertEqual(result["resampling_unit"], "cluster")
        self.assertEqual(result["delta"], 0.0)
        self.assertTrue(result["inference_valid"])

    def test_cluster_bootstrap_does_not_claim_significance_for_one_cluster(self):
        result = paired_cluster_bootstrap(
            [1.0, 1.0, 1.0],
            [0.0, 0.0, 0.0],
            ["writer-a", "writer-a", "writer-a"],
            iters=100,
            cluster_source="writer_id",
        )
        self.assertEqual(result["ci_low"], 1.0)
        self.assertFalse(result["significant"])
        self.assertFalse(result["inference_valid"])
        self.assertEqual(result["inference_reason"], "fewer_than_two_clusters")

    def test_cluster_bootstrap_marks_item_fallback_as_descriptive(self):
        result = paired_cluster_bootstrap(
            [1.0, 1.0, 1.0],
            [0.0, 0.0, 0.0],
            ["item-1", "item-2", "item-3"],
            iters=100,
            cluster_source="record_id",
            grouping_fallback=True,
        )
        self.assertFalse(result["significant"])
        self.assertTrue(result["cluster_fallback"])
        self.assertFalse(result["inference_valid"])
        self.assertEqual(result["inference_reason"], "missing_explicit_grouping")

    def test_noninferiority_uses_lower_bound_against_negative_margin(self):
        self.assertTrue(noninferiority_pass(-0.04, -0.05))
        self.assertTrue(noninferiority_pass(-0.05, -0.05))
        self.assertFalse(noninferiority_pass(-0.06, -0.05))
        self.assertFalse(noninferiority_pass(None, -0.05))
        self.assertFalse(noninferiority_pass(0.1, -0.05, inference_valid=False))


if __name__ == "__main__":
    unittest.main()
