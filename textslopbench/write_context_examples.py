#!/usr/bin/env python3
"""Extract two exact host contexts for the audit report."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "textslopbench" / "results" / "rewrite-contexts-v2.jsonl"


def main() -> int:
    wanted = {"support_email_refund", "release_notes_hype"}
    selected = {}
    for line in INPUT.read_text(encoding="utf-8").splitlines():
        row = json.loads(line)
        if row.get("id") in wanted and row.get("condition") == "humanstats_plus_pragmatic_plus_second_scan":
            selected[row["id"]] = row
    lines = [
        "# Exact structured rewrite contexts",
        "",
        "These are the exact pre-rewrite prompts recorded for one prior proxy loss and one prior proxy win. The source and prompt are preserved here for the owned fixtures; the full 60-row context file is `textslopbench/results/rewrite-contexts-v2.jsonl`.",
        "",
    ]
    for fixture_id in ("support_email_refund", "release_notes_hype"):
        row = selected[fixture_id]
        lines.extend([
            f"## {fixture_id}",
            "",
            f"Inferred genre: `{row['inferred_genre']['genre']}`; register: `{row['inferred_genre']['register']}`; confidence: `{row['inferred_genre']['confidence']}`.",
            "",
            "### Exact source",
            "",
            "```text",
            row["source"],
            "```",
            "",
            "### Exact host prompt",
            "",
            "```text",
            row["host_prompt"],
            "```",
            "",
        ])
    (ROOT / "REWRITE_CONTEXT_EXAMPLES.md").write_text("\n".join(lines), encoding="utf-8")
    print(ROOT / "REWRITE_CONTEXT_EXAMPLES.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
