"""Audit fixes (textslopbench items 11, 12):
- dataset_eval.ADAPTERS must be derived from adapters.ADAPTERS (single registry), so it
  includes every registered adapter, including the 'tetra' scaffold.
- prepare_prompts() must require an explicit host_model rather than silently defaulting to
  a hard-coded model name, so provenance can't be mislabelled."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from adapters import ADAPTERS as REGISTRY_ADAPTERS
from dataset_eval import ADAPTERS as DATASET_EVAL_ADAPTERS, prepare_prompts


class AdapterRegistryTests(unittest.TestCase):
    def test_dataset_eval_adapters_matches_registry(self):
        self.assertEqual(set(DATASET_EVAL_ADAPTERS), set(REGISTRY_ADAPTERS))

    def test_tetra_is_present(self):
        self.assertIn("tetra", DATASET_EVAL_ADAPTERS)


class HostModelProvenanceTests(unittest.TestCase):
    def test_missing_host_model_raises(self):
        with self.assertRaises(ValueError):
            prepare_prompts([], Path("unused.jsonl"), host_model="")

    def test_none_host_model_raises(self):
        with self.assertRaises((ValueError, TypeError)):
            prepare_prompts([], Path("unused.jsonl"), host_model=None)


if __name__ == "__main__":
    unittest.main()
