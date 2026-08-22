import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from voice_drift import style_vector, style_delta, voice_drift, LLM_DIRECTION


class StyleVectorTests(unittest.TestCase):
    def test_markers_present_and_detect_contractions_and_first_person(self):
        v = style_vector("I can't believe we're doing this, honestly.")
        for k in LLM_DIRECTION:
            self.assertIn(k, v)
        self.assertGreater(v["first_person_rate"], 0)
        self.assertGreater(v["contraction_rate"], 0)

    def test_no_change_is_zero_delta(self):
        text = "We didn't plan for this, but it's fine."
        self.assertTrue(all(abs(x) < 1e-9 for x in style_delta(text, text).values()))


class DriftSignatureTests(unittest.TestCase):
    def test_llm_direction_edit_scores_high_signature(self):
        # source: contractions + first person; rewrite: formalized (LLM-characteristic drift)
        source = "I can't wait, we're so excited and I think it's great."
        rewrite = "The team anticipates the event with considerable enthusiasm and optimism."
        d = style_delta(source, rewrite)
        std = {k: 1.0 for k in d}
        res = voice_drift([d], std)
        self.assertGreater(res["mean_voice_drift"], 0.0)
        self.assertGreater(res["mean_drift_signature"], 0.5)  # mostly LLM-direction movement
        self.assertLess(d["contraction_rate"], 0)   # contractions removed
        self.assertLess(d["first_person_rate"], 0)  # first person removed

    def test_identity_edit_has_zero_drift(self):
        d = {k: 0.0 for k in LLM_DIRECTION}
        d["emotion_word_rate"] = 0.0
        res = voice_drift([d], {k: 1.0 for k in d})
        self.assertEqual(res["mean_voice_drift"], 0.0)


if __name__ == "__main__":
    unittest.main()
