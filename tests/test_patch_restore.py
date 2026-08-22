import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
from _corpus_guard import requires_corpora

from patch_restore import accept_restore, _word_idx, pass2_diff, _load_E


class AcceptGateTests(unittest.TestCase):
    def test_accepts_single_word_substitution(self):
        self.assertTrue(accept_restore("the busy market hummed", "the bustling market hummed", "bustling"))

    def test_accepts_pure_insertion_of_word(self):
        self.assertTrue(accept_restore("a market hummed", "a bustling market hummed", "bustling"))

    def test_rejects_broad_rewording(self):
        self.assertFalse(accept_restore(
            "the busy market hummed", "a bustling vibrant plaza teemed with life", "bustling"))

    def test_rejects_if_word_absent(self):
        self.assertFalse(accept_restore("the busy market", "the lively market", "bustling"))


class WordIdxTests(unittest.TestCase):
    def test_finds_word_ignoring_punct(self):
        self.assertEqual(_word_idx(["A", "bright,", "lively", "drink"], "lively"), 2)
        self.assertEqual(_word_idx(["no", "match", "here"], "vibrant"), -1)


@requires_corpora
class Pass2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.E = _load_E()

    def test_removed_low_E_singleton_is_restore_candidate(self):
        src = "The bustling market was alive with a vibrant tapestry of colour."
        rw = "The busy market was alive with colour."   # removed bustling/vibrant/tapestry
        diffs = pass2_diff(src, rw, self.E)
        removed = [d for d in diffs if d["status"] == "removed"]
        self.assertTrue(removed)
        # a low-E, single-occurrence removed word should be flagged for restoration
        cands = [d for d in diffs if d["restore_candidate"]]
        for c in cands:
            self.assertLess(c["E"], 0.45)
            self.assertEqual(len(c["evidence"].split()), 1)

    def test_preserved_word_not_removed(self):
        src = "A vibrant market."
        diffs = pass2_diff(src, "A vibrant market.", self.E)
        self.assertTrue(all(d["status"] == "preserved" for d in diffs))


if __name__ == "__main__":
    unittest.main()
