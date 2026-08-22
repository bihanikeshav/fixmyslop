import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

import v2_pipeline as vp


class PromptDriftTests(unittest.TestCase):
    """The production module must stay byte-identical to the confirmed baseline (tag v2-confirmed-baseline)."""

    def test_stage1_matches_confirmed_humanizer_sys(self):
        from humanizer_vs_current import HUMANIZER_SYS
        self.assertEqual(vp.STAGE1_V2_SYS, HUMANIZER_SYS)

    def test_repair_matches_confirmed_correction_sys(self):
        import v2_confirmed_baseline as base
        self.assertEqual(vp.REPAIR_SYS, base.CORRECTION_SYS)

    def test_aggressive_alias_is_confirmed_stage1(self):
        # STAGE1_V2_SYS is the back-compat alias for the renamed champion constant; same bytes.
        self.assertIs(vp.STAGE1_V2_SYS, vp.STAGE1_AGGRESSIVE_SYS)

    def test_rules_variant_prompt_frozen(self):
        # First-party rules Stage-1: freeze bytes (benchmark numbers in V2_1_FINDINGS.md are tied to them).
        self.assertEqual(hashlib.sha256(vp.STAGE1_RULES_SYS.encode()).hexdigest(),
                         "33cfd3f181ec9f6f993ff0b738efec406055f67e0e44fb3fb911dd7ce25eae43")
        self.assertTrue(vp.STAGE1_RULES_SYS.endswith('Return ONLY JSON {"id": "revised text", ...}.'))


class ModeSwitchTests(unittest.TestCase):
    def test_v2_stage1_uses_aggressive_generator(self):
        msgs = vp.stage1_messages("The market grew 12% in 2020.", "v2")
        self.assertEqual(msgs[0]["role"], "system")
        self.assertEqual(msgs[0]["content"], vp.STAGE1_V2_SYS)

    def test_v1_stage1_uses_host_prompt_no_humanizer_sys(self):
        msgs = vp.stage1_messages("The market grew 12% in 2020.", "v1")
        blob = json.dumps(msgs)
        self.assertNotIn(vp.STAGE1_V2_SYS, blob)
        self.assertIn("The market grew 12% in 2020.", blob)

    def test_unknown_mode_raises(self):
        with self.assertRaises(ValueError):
            vp.stage1_messages("x", "v3")

    def test_v2_default_variant_is_aggressive_champion(self):
        msgs = vp.stage1_messages("The market grew 12% in 2020.", "v2")
        self.assertEqual(msgs[0]["content"], vp.STAGE1_AGGRESSIVE_SYS)

    def test_v2_rules_variant_uses_first_party_prompt(self):
        msgs = vp.stage1_messages("The market grew 12% in 2020.", "v2", variant="rules")
        self.assertEqual(msgs[0]["content"], vp.STAGE1_RULES_SYS)
        self.assertIn("The market grew 12% in 2020.", json.dumps(msgs))

    def test_unknown_variant_raises(self):
        with self.assertRaises(ValueError):
            vp.stage1_messages("x", "v2", variant="bogus")

    def test_run_rules_variant_routes_to_rules_stage1(self):
        seen = {}

        def generate(messages):
            seen["stage1_sys"] = messages[0]["content"]
            return json.dumps({"doc": "The team shipped 3 features in Q2 2021."})

        vp.run("The team shipped 3 features in Q2 2021.", generate, mode="v2", rounds=1, variant="rules")
        self.assertEqual(seen["stage1_sys"], vp.STAGE1_RULES_SYS)


class ParseTests(unittest.TestCase):
    def test_parse_json_map(self):
        self.assertEqual(vp._parse_one('{"doc": "hello"}'), "hello")

    def test_parse_single_value_dict_any_key(self):
        self.assertEqual(vp._parse_one('{"anything": "hi there"}'), "hi there")

    def test_parse_plain_prose_fallback(self):
        self.assertEqual(vp._parse_one("just prose, no json"), "just prose, no json")

    def test_parse_code_fence(self):
        self.assertEqual(vp._parse_one('```json\n{"doc": "x"}\n```'), "x")


class RepairLoopTests(unittest.TestCase):
    def test_run_restores_dropped_anchor_and_stops_early(self):
        source = "The project raised 42 million dollars in 2019 to expand operations."
        draft = "The project raised a large sum of money to expand its operations."   # drops 42 and 2019
        restored = "The project raised 42 million dollars in 2019 to expand operations."
        calls = []

        def generate(messages):
            calls.append(messages)
            sysmsg = messages[0]["content"]
            if sysmsg == vp.STAGE1_V2_SYS:
                return json.dumps({"doc": draft})
            if sysmsg == vp.REPAIR_SYS:
                return json.dumps({"doc": restored})
            raise AssertionError("unexpected system prompt")

        out = vp.run(source, generate, mode="v2", rounds=2)
        self.assertIn("42", out)
        self.assertIn("2019", out)
        # stage-1 + at least one repair; must stop early once anchors are clean (not the full 1+rounds=3)
        self.assertGreaterEqual(len(calls), 2)
        self.assertLess(len(calls), 3)

    def test_run_no_repair_when_draft_faithful(self):
        source = "The team shipped 3 features in Q2 2021."
        calls = []

        def generate(messages):
            calls.append(messages)
            return json.dumps({"doc": source})   # faithful draft == source

        out = vp.run(source, generate, mode="v2", rounds=2)
        self.assertEqual(len(calls), 1)   # only stage-1; repair not needed
        self.assertIn("2021", out)


if __name__ == "__main__":
    unittest.main()
