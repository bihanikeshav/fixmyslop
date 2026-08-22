import json
import tempfile
import unittest
from pathlib import Path

from textslopbench.adapters.baumler import BaumlerAdapter
from textslopbench.adapters.beemo import BeemoAdapter
from textslopbench.adapters.lamp import LAMPAdapter
from textslopbench.adapters.wq import WQAdapter


class AdapterTests(unittest.TestCase):
    def write_json(self, directory: Path, name: str, value: object) -> Path:
        path = directory / name
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def test_lamp_adapter(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "lamp.json", [{"id": "x", "response": "AI text", "human_edit": "Human text", "split": "test"}])
            rows = LAMPAdapter().adapt(path, split="test")
            self.assertEqual(rows[0]["source_text"], "AI text")
            self.assertEqual(rows[0]["human_references"], ["Human text"])

    def test_baumler_nested_logs(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "participant.json", {"user_info": {"id": "p1"}, "responses": {"task1": {"model_generation": "Draft", "final_version": "Edited", "model_generation_shown": 1}}})
            rows = BaumlerAdapter().adapt(path)
            self.assertEqual(rows[0]["record_id"], "p1:task1")
            self.assertEqual(rows[0]["metadata"]["model_generation_shown"], True)

    def test_beemo_adapter(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "beemo.json", [{"id": "b", "machine": "Machine", "expert_edit": "Expert", "human": "Human"}])
            rows = BeemoAdapter().adapt(path)
            self.assertEqual({candidate["label"] for candidate in rows[0]["candidates"]}, {"human", "expert_edit"})

    def test_wq_adapter(self):
        with tempfile.TemporaryDirectory() as temp:
            path = self.write_json(Path(temp), "wq.json", [{"id": "w", "prompt": "Prompt", "chosen": "Good", "rejected": "Bad"}])
            rows = WQAdapter().adapt(path)
            self.assertEqual(rows[0]["metadata"]["preference"], "chosen")
            self.assertEqual(len(rows[0]["candidates"]), 2)


if __name__ == "__main__":
    unittest.main()
