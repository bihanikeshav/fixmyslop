"""Audit fix (textslopbench item 14): known-answer unit tests for bootstrap.py,
make_blinded_pairs.py, and compare_systems.py's core helper functions, using tiny fixed
samples and fixed seeds so the expected numbers are exact and reviewable."""
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from bootstrap import paired_bootstrap, paired_cluster_bootstrap
import make_blinded_pairs
from compare_systems import _mean, consensus_from_deltas


# Fixed 5-item fixture reused by every bootstrap KAT below.
A_VALS = [10.0, 12.0, 8.0, 14.0, 9.0]
B_VALS = [8.0, 11.0, 9.0, 10.0, 9.0]


class PairedBootstrapKATTests(unittest.TestCase):
    def test_known_answer_seed_42(self):
        result = paired_bootstrap(A_VALS, B_VALS, iters=200, seed=42)
        self.assertEqual(result, {
            "delta": 1.2, "ci_low": -0.2, "ci_high": 2.8,
            "n": 5, "wins": 3, "losses": 1, "ties": 1, "significant": False,
        })

    def test_none_pairs_dropped(self):
        a = [1.0, None, 3.0]
        b = [None, 2.0, 1.0]
        result = paired_bootstrap(a, b, iters=50, seed=1)
        self.assertEqual(result["n"], 1)  # only index 2 has both values

    def test_empty_returns_none(self):
        self.assertIsNone(paired_bootstrap([], [], iters=10, seed=1))


class PairedClusterBootstrapKATTests(unittest.TestCase):
    def test_known_answer_with_groups_seed_42(self):
        clusters = ["c1", "c1", "c2", "c2", "c3"]
        result = paired_cluster_bootstrap(A_VALS, B_VALS, clusters, iters=200, seed=42,
                                           cluster_source="writer")
        self.assertEqual(result, {
            "delta": 1.2, "ci_low": 0.0, "ci_high": 1.5,
            "n": 5, "clusters": 3, "wins": 3, "losses": 1, "ties": 1, "significant": False,
            "resampling_unit": "cluster", "cluster_source": "writer",
            "cluster_fallback": False, "inference_valid": True, "inference_reason": None,
        })

    def test_inference_invalid_without_explicit_groups(self):
        # No groups given at all -> per-item fallback clusters -> inference_valid False.
        result = paired_cluster_bootstrap(A_VALS, B_VALS, [None] * 5, iters=200, seed=42)
        self.assertFalse(result["inference_valid"])
        self.assertEqual(result["inference_reason"], "missing_explicit_grouping")
        self.assertEqual(result["cluster_source"], "item_fallback")
        self.assertTrue(result["cluster_fallback"])
        self.assertEqual(result["clusters"], 5)  # one cluster per item

    def test_resamples_clusters_not_items_when_groups_given(self):
        # With 2 items per cluster, cluster resampling must draw items in pairs: result n
        # stays 5 (all real pairs kept), but only `clusters` distinct groups are resampled.
        clusters = ["c1", "c1", "c2", "c2", "c3"]
        result = paired_cluster_bootstrap(A_VALS, B_VALS, clusters, iters=200, seed=42)
        self.assertEqual(result["clusters"], 3)
        self.assertEqual(result["n"], 5)
        self.assertTrue(result["inference_valid"])  # >= 2 clusters, no fallback

    def test_fewer_than_two_clusters_is_invalid(self):
        clusters = ["only_one"] * 5
        result = paired_cluster_bootstrap(A_VALS, B_VALS, clusters, iters=50, seed=1)
        self.assertFalse(result["inference_valid"])
        self.assertEqual(result["inference_reason"], "fewer_than_two_clusters")


class MakeBlindedPairsKATTests(unittest.TestCase):
    def _write_inputs(self, td):
        inputs_path = td / "inputs.jsonl"
        rows = [
            {"id": "f1", "system": "sysA", "genre": "g", "condition": "c", "source": "S1", "rewrite": "R1a"},
            {"id": "f1", "system": "sysB", "genre": "g", "condition": "c", "source": "S1", "rewrite": "R1b"},
            {"id": "f2", "system": "sysA", "genre": "g", "condition": "c", "source": "S2", "rewrite": "R2a"},
            {"id": "f2", "system": "sysB", "genre": "g", "condition": "c", "source": "S2", "rewrite": "R2b"},
        ]
        inputs_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
        return inputs_path

    def test_deterministic_ab_assignment(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            inputs_path = self._write_inputs(td)
            output_path = td / "pairs.jsonl"
            argv = ["make_blinded_pairs.py", "--inputs", str(inputs_path), "--output", str(output_path)]
            with mock.patch.object(sys, "argv", argv):
                make_blinded_pairs.main()
            pairs = [json.loads(l) for l in output_path.read_text(encoding="utf-8").splitlines()]
            # Deterministic: running it again must give byte-identical A/B assignment.
            output_path2 = td / "pairs2.jsonl"
            argv2 = ["make_blinded_pairs.py", "--inputs", str(inputs_path), "--output", str(output_path2)]
            with mock.patch.object(sys, "argv", argv2):
                make_blinded_pairs.main()
            pairs2 = [json.loads(l) for l in output_path2.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(pairs, pairs2)
            for p in pairs:
                self.assertIn(p["A"], ("R1a", "R1b", "R2a", "R2b"))
                self.assertIn(p["orientation"], ("original",))

    def test_reverse_flips_ab(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            inputs_path = self._write_inputs(td)
            fwd_path = td / "fwd.jsonl"
            rev_path = td / "rev.jsonl"
            with mock.patch.object(sys, "argv", ["x", "--inputs", str(inputs_path), "--output", str(fwd_path)]):
                make_blinded_pairs.main()
            with mock.patch.object(sys, "argv", ["x", "--inputs", str(inputs_path), "--output", str(rev_path), "--reverse"]):
                make_blinded_pairs.main()
            fwd = {r["id"]: r for r in (json.loads(l) for l in fwd_path.read_text(encoding="utf-8").splitlines())}
            rev = {r["id"]: r for r in (json.loads(l) for l in rev_path.read_text(encoding="utf-8").splitlines())}
            for fixture_id in fwd:
                self.assertEqual(fwd[fixture_id]["A"], rev[fixture_id]["B"])
                self.assertEqual(fwd[fixture_id]["B"], rev[fixture_id]["A"])
                self.assertEqual(rev[fixture_id]["orientation"], "reversed")

    def test_rejects_wrong_system_count(self):
        import tempfile
        with tempfile.TemporaryDirectory() as td:
            td = Path(td)
            inputs_path = td / "inputs.jsonl"
            rows = [{"id": "f1", "system": "onlyOne", "genre": "g", "condition": "c",
                     "source": "S1", "rewrite": "R1"}]
            inputs_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
            output_path = td / "pairs.jsonl"
            argv = ["x", "--inputs", str(inputs_path), "--output", str(output_path)]
            with mock.patch.object(sys, "argv", argv):
                with self.assertRaises(SystemExit):
                    make_blinded_pairs.main()


class CompareSystemsHelperKATTests(unittest.TestCase):
    def test_mean_drops_none_and_rounds(self):
        self.assertEqual(_mean([1.0, 2.0, None, 3.0]), 2.0)
        self.assertIsNone(_mean([None, None]))
        self.assertEqual(_mean([1.0/3, 1.0/3, 1.0/3]), round(1.0 / 3, 3))

    def test_consensus_from_deltas_known_answer(self):
        # 10 human deltas: 8 positive, 2 negative for "f1" (>=0.70 dominant -> "pos");
        # "f2" is a 5/5 split (-> "split"); "f3" has < MIN_SUPPORT=8 non-zero values (-> None).
        deltas = []
        for i in range(8):
            deltas.append({"f1": 1.0, "f2": 1.0 if i < 5 else -1.0, "f3": 1.0 if i < 3 else 0.0})
        for i in range(2):
            deltas.append({"f1": -1.0, "f2": -1.0, "f3": 0.0})
        cons = consensus_from_deltas(deltas)
        self.assertEqual(cons["f1"], "pos")
        self.assertEqual(cons["f2"], "split")
        self.assertIsNone(cons["f3"])  # only 3 non-zero entries, below MIN_SUPPORT=8


if __name__ == "__main__":
    unittest.main()
