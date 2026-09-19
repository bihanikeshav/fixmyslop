"""Audit fix: structural_bridge.py / expendable_bridge.py must import cleanly in-repo
(with textslopbench/ present) and must never be pulled in by the default (bridges off)
pipeline.py/humanize.py rewrite path — see skills/fixmyslop-humanizer/SKILL.md."""
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"


class BridgeLazyImportTests(unittest.TestCase):
    def test_bridges_import_without_error_in_repo(self):
        sys.path.insert(0, str(SCRIPTS))
        sys.path.insert(0, str(ROOT / "textslopbench"))
        try:
            import structural_bridge  # noqa: F401
            import expendable_bridge  # noqa: F401
        finally:
            sys.path.remove(str(SCRIPTS))
            sys.path.remove(str(ROOT / "textslopbench"))

    def test_default_pipeline_import_does_not_pull_in_bridges(self):
        # Run in a fresh subprocess so we see the real module-load graph, not whatever
        # earlier tests already put in sys.modules.
        code = (
            "import sys\n"
            f"sys.path.insert(0, r{str(SCRIPTS)!r})\n"
            "import pipeline\n"
            "import humanize\n"
            "bad = [m for m in ('structural_bridge', 'expendable_bridge') if m in sys.modules]\n"
            "assert not bad, bad\n"
            "print('OK')\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", code], capture_output=True, text=True, cwd=str(SCRIPTS)
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("OK", result.stdout)


if __name__ == "__main__":
    unittest.main()
