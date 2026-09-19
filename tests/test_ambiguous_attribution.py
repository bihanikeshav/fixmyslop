"""Audit fix (textslopbench item 10): score_judgments.py / score_audit_judgments.py must not
misattribute a system by exact-text A/B match when two systems emit identical text — such
pairs must be detected as ambiguous and excluded/counted, not silently attributed via the
first match."""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
TSB = ROOT / "textslopbench"
sys.path.insert(0, str(TSB))

from common import resolve_system_for_text
import score_judgments
import score_audit_judgments


class ResolveSystemForTextTests(unittest.TestCase):
    def test_unique_match(self):
        group = {"sysA": "Alpha text", "sysB": "Beta text"}
        self.assertEqual(resolve_system_for_text(group, "Alpha text"), "sysA")

    def test_no_match_is_none(self):
        group = {"sysA": "Alpha text", "sysB": "Beta text"}
        self.assertIsNone(resolve_system_for_text(group, "nowhere"))

    def test_duplicate_text_is_ambiguous_none(self):
        group = {"sysA": "same text", "sysB": "same text"}
        self.assertIsNone(resolve_system_for_text(group, "same text"))


class ScoreJudgmentsAmbiguityTests(unittest.TestCase):
    def test_identical_ab_text_excluded_not_misattributed(self, tmp_dir=None):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            outputs_path = td / "outputs.jsonl"
            pairs_path = td / "pairs.jsonl"
            judgments_path = td / "judgments.jsonl"
            output_path = td / "summary.json"

            # Two systems; f1 both emit identical text (ambiguous); f2 distinct text (clean).
            outputs_path.write_text(
                "\n".join(json.dumps(r) for r in [
                    {"id": "f1", "system": "sysA", "rewrite": "same text"},
                    {"id": "f1", "system": "sysB", "rewrite": "same text"},
                    {"id": "f2", "system": "sysA", "rewrite": "Alpha text"},
                    {"id": "f2", "system": "sysB", "rewrite": "Beta text"},
                ]) + "\n", encoding="utf-8")
            pairs_path.write_text(
                "\n".join(json.dumps(r) for r in [
                    {"id": "f1", "A": "same text", "B": "same text"},
                    {"id": "f2", "A": "Alpha text", "B": "Beta text"},
                ]) + "\n", encoding="utf-8")
            judgments_path.write_text(
                "\n".join(json.dumps(r) for r in [
                    {"id": "f1", "choice": "A"},
                    {"id": "f2", "choice": "A"},
                ]) + "\n", encoding="utf-8")

            argv = ["score_judgments.py", "--pairs", str(pairs_path), "--outputs", str(outputs_path),
                    "--judgments", str(judgments_path), "--output", str(output_path)]
            with mock.patch.object(sys, "argv", argv):
                score_judgments.main()

            summary = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertEqual(summary["excluded_ambiguous_pairs"], 1)
            self.assertEqual(summary["comparisons"], 1)
            # f1's ambiguous record carries no attribution.
            f1_record = next(r for r in summary["raw_judgments"] if r["id"] == "f1")
            self.assertTrue(f1_record["excluded_ambiguous"])
            self.assertIsNone(f1_record["winner"])
            # f2 resolved normally, sysA wins since choice A -> Alpha text -> sysA.
            f2_record = next(r for r in summary["raw_judgments"] if r["id"] == "f2")
            self.assertFalse(f2_record["excluded_ambiguous"])
            self.assertEqual(f2_record["winner"], "sysA")
            self.assertEqual(summary["systems"]["sysA"]["wins"], 1)


class ScoreAuditJudgmentsAmbiguityTests(unittest.TestCase):
    def test_load_pairs_marks_identical_text_as_none(self):
        outputs = {"f1": {"sysA": "same text", "sysB": "same text"},
                   "f2": {"sysA": "Alpha text", "sysB": "Beta text"}}
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "pairs.jsonl"
            path.write_text("\n".join(json.dumps(r) for r in [
                {"id": "f1", "A": "same text", "B": "same text", "orientation": "orig"},
                {"id": "f2", "A": "Alpha text", "B": "Beta text", "orientation": "orig"},
            ]) + "\n", encoding="utf-8")
            pairs = score_audit_judgments.load_pairs(path, outputs)
        self.assertIsNone(pairs["f1"]["A"])
        self.assertIsNone(pairs["f1"]["B"])
        self.assertEqual(pairs["f2"]["A"], "sysA")
        self.assertEqual(pairs["f2"]["B"], "sysB")

    def test_load_judgments_excludes_ambiguous_rows(self):
        outputs = {"f1": {"sysA": "same text", "sysB": "same text"}}
        pairs = {"orig": {"f1": {"A": None, "B": None, "orientation": "orig"}}}
        with mock.patch.object(score_audit_judgments, "RESULTS") as results_mock:
            import tempfile
            with tempfile.TemporaryDirectory() as td:
                td = Path(td)
                results_mock.glob.return_value = [td / "audit2_orig_1.jsonl"]
                (td / "audit2_orig_1.jsonl").write_text(json.dumps({
                    "id": "f1", "choice": "A",
                    "A_naturalness": 3, "A_quality": 3, "A_fidelity": 3, "A_voice": 3,
                    "B_naturalness": 3, "B_quality": 3, "B_fidelity": 3, "B_voice": 3,
                    "confidence": 0.8, "reason": "n/a",
                }) + "\n", encoding="utf-8")
                rows = score_audit_judgments.load_judgments(outputs, pairs)
        self.assertEqual(len(rows), 1)
        self.assertTrue(rows[0]["excluded_ambiguous"])
        self.assertIsNone(rows[0]["winner"])
        self.assertEqual(rows[0]["scores"], {})


if __name__ == "__main__":
    unittest.main()
