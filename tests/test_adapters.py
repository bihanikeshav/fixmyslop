import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from textslopbench.adapters.baumler import BaumlerAdapter
from textslopbench.adapters.beemo import BeemoAdapter
from textslopbench.adapters.lamp import LAMPAdapter
from textslopbench.adapters.wq import WQAdapter
from textslopbench import v2_confirmed_baseline


class AdapterTests(unittest.TestCase):
    def write_json(self, directory: Path, name: str, value: object) -> Path:
        path = directory / name
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def write_jsonl(self, directory: Path, name: str, rows: list[dict[str, object]]) -> Path:
        path = directory / name
        path.write_text("\n".join(json.dumps(row) for row in rows) + "\n", encoding="utf-8")
        return path

    def test_lamp_adapter(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "lamp.json", [{"id": "x", "writer_id": "writer-7", "response": "AI text", "human_edit": "Human text", "split": "test"}])
            rows = LAMPAdapter().adapt(path, split="test")
            self.assertEqual(rows[0]["source_text"], "AI text")
            self.assertEqual(rows[0]["human_references"], ["Human text"])
            self.assertEqual(rows[0]["metadata"]["group_id"], "writer-7")
            self.assertEqual(rows[0]["metadata"]["group_source"], "writer_id")

            self.write_jsonl(Path(temp), "normalized.jsonl", rows)
            with mock.patch.object(v2_confirmed_baseline, "RESULTS", Path(temp)):
                loaded = v2_confirmed_baseline.load_items("normalized.jsonl", "LAMP")
            self.assertEqual(loaded[0]["cluster_id"], "writer-7")
            self.assertEqual(loaded[0]["cluster"], "writer_id\x1fwriter-7")
            self.assertEqual(loaded[0]["cluster_source"], "writer_id")
            self.assertFalse(loaded[0]["cluster_fallback"])

    def test_baumler_nested_logs(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "participant.json", {"user_info": {"id": "p1"}, "responses": {"task1": {"model_generation": "Draft", "final_version": "Edited", "model_generation_shown": 1}}})
            rows = BaumlerAdapter().adapt(path)
            self.assertEqual(rows[0]["record_id"], "p1:task1")
            self.assertEqual(rows[0]["metadata"]["model_generation_shown"], True)

    def test_beemo_adapter(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "beemo.json", [{"id": "b", "prompt": "Explain the moon landing", "machine": "Machine", "expert_edit": "Expert", "human": "Human"}])
            rows = BeemoAdapter().adapt(path)
            self.assertEqual({candidate["label"] for candidate in rows[0]["candidates"]}, {"human", "expert_edit"})
            self.assertEqual(rows[0]["metadata"]["group_id"], "Explain the moon landing")
            self.assertEqual(rows[0]["metadata"]["group_source"], "prompt")

            self.write_jsonl(Path(temp), "normalized.jsonl", rows)
            with mock.patch.object(v2_confirmed_baseline, "RESULTS", Path(temp)):
                loaded = v2_confirmed_baseline.load_items("normalized.jsonl", "Beemo")
            self.assertEqual(loaded[0]["cluster_id"], "Explain the moon landing")
            self.assertEqual(loaded[0]["cluster"], "prompt\x1fExplain the moon landing")
            self.assertEqual(loaded[0]["cluster_source"], "prompt")
            self.assertFalse(loaded[0]["cluster_fallback"])

    def test_runner_records_missing_grouping_as_record_id_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(
                Path(temp),
                "beemo.json",
                [{"id": "ungrouped", "machine": "Machine", "expert_edit": "Expert"}],
            )
            rows = BeemoAdapter().adapt(path)
            self.write_jsonl(Path(temp), "normalized.jsonl", rows)
            with mock.patch.object(v2_confirmed_baseline, "RESULTS", Path(temp)):
                loaded = v2_confirmed_baseline.load_items("normalized.jsonl", "Beemo")
            self.assertEqual(loaded[0]["cluster_id"], "ungrouped")
            self.assertEqual(loaded[0]["cluster_source"], "record_id")
            self.assertTrue(loaded[0]["cluster_fallback"])

    def test_wq_adapter(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "wq.json", [{"id": "w", "prompt": "Prompt", "chosen": "Good", "rejected": "Bad"}])
            rows = WQAdapter().adapt(path)
            self.assertEqual(rows[0]["metadata"]["preference"], "chosen")
            self.assertEqual(len(rows[0]["candidates"]), 2)


if __name__ == "__main__":
    unittest.main()
