#!/usr/bin/env python3
"""Write a readable exact source/old/new trace for the owned fixtures."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "textslopbench" / "results"
OLD = RESULTS / "ablation_base_heuristic_scored.jsonl"
NEW = RESULTS / "ablation_humanstats_plus_pragmatic_plus_second_scan_scored.jsonl"


def rows(path: Path) -> dict[str, dict[str, object]]:
    return {row["id"]: row for row in (json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())}


def compact_trace(row: dict[str, object]) -> dict[str, object]:
    trace = row.get("audit_trace", {})
    inference = trace.get("genre_inference", {}) if isinstance(trace, dict) else {}
    correction = trace.get("targeted_correction", {}) if isinstance(trace, dict) else {}
    fidelity = trace.get("fidelity", {}) if isinstance(trace, dict) else {}
    return {
        "genre": row.get("genre"),
        "genre_confidence": row.get("genre_confidence"),
        "formulaic_risk_before_after": [row.get("metrics", {}).get("before_formulaic_risk"), row.get("metrics", {}).get("after_formulaic_risk")],
        "finding_count_before_after": [row.get("metrics", {}).get("before_findings"), row.get("metrics", {}).get("after_findings")],
        "fidelity": fidelity.get("hard_anchor_coverage", fidelity.get("passed")),
        "correction_needed": correction.get("needed"),
        "inference_method": inference.get("method"),
        "host": row.get("host"),
    }


def main() -> int:
    old = rows(OLD)
    new = rows(NEW)
    ids = sorted(set(old) | set(new))
    lines = [
        "# FixMySlop iteration 1 fixture traces",
        "",
        "`old` is the base heuristic host condition; `new` is the combined humanstats + pragmatic-profile + second-scan condition. Exact machine-readable traces, including full analyzer outputs and prompts, remain in the two scored JSONL files.",
        "",
    ]
    for fixture_id in ids:
        before = old[fixture_id]
        after = new[fixture_id]
        lines.extend([
            f"## {fixture_id}",
            "",
            "### Exact source",
            "",
            "```text",
            str(after.get("source", before.get("source", ""))),
            "```",
            "",
            "### Exact old output",
            "",
            "```text",
            str(before.get("rewrite", "")),
            "```",
            "",
            "Old trace:",
            "",
            "```json",
            json.dumps(compact_trace(before), ensure_ascii=False, indent=2),
            "```",
            "",
            "### Exact new output",
            "",
            "```text",
            str(after.get("rewrite", "")),
            "```",
            "",
            "New trace:",
            "",
            "```json",
            json.dumps(compact_trace(after), ensure_ascii=False, indent=2),
            "```",
            "",
        ])
    (ROOT / "FIXTURE_TRACES_ITERATION1.md").write_text("\n".join(lines), encoding="utf-8")
    print(ROOT / "FIXTURE_TRACES_ITERATION1.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
