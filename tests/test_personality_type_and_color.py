"""Audit fix: skills/personality/reference/type-and-color.json must not recommend a
HEADING font in its `directions` block that the same file's `avoidFonts` list (or
SKILL.md's hard type gate / slop-manifest's condensed-reflex ban) forbids. See
skills/personality/SKILL.md's "Hard gates -> Type gate" and
reference/slop-manifest.md's "Bold-by-condensed reflex" entry."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "skills" / "personality" / "reference"

# SKILL.md's hard type gate names these explicitly, beyond what avoidFonts.json tracks
# empirically (saturation-based). Keep in sync with SKILL.md "## Hard gates -> Type gate".
SKILL_GATE_HEADING_BANS = {
    "playfair display", "cormorant garamond", "fraunces", "instrument serif",
    "clash display", "inter", "geist", "space grotesk", "outfit",
    "cabinet grotesk", "general sans", "sentient",
}

# slop-manifest.md's "Bold-by-condensed reflex" entry bans these as a heading reflex.
CONDENSED_REFLEX_BANS = {"big shoulders display", "bebas neue", "barlow condensed"}


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


class TypeAndColorDirectionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((REF / "type-and-color.json").read_text(encoding="utf-8"))

    def test_no_direction_heading_font_in_avoid_fonts(self):
        avoid = {_norm(f["family"]) for f in self.data["avoidFonts"]}
        banned = avoid | SKILL_GATE_HEADING_BANS | CONDENSED_REFLEX_BANS
        violations = []
        for direction in self.data["directions"]:
            for option in direction["options"]:
                heading = _norm(option["heading"])
                if heading in banned:
                    violations.append((direction["intent"], option["heading"]))
        self.assertEqual(violations, [], f"banned heading fonts in directions: {violations}")

    def test_md_mirror_matches_json(self):
        md = (REF / "type-and-color.md").read_text(encoding="utf-8")
        for direction in self.data["directions"]:
            for option in direction["options"]:
                line = f"{option['heading']} / {option['body']} · {option['accent']} · {option['move']}"
                self.assertIn(line, md, f"json/md drift for intent={direction['intent']!r}")


if __name__ == "__main__":
    unittest.main()
