#!/usr/bin/env python3
"""Run the owned, dependency-free TextSlopBench safety suite."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
for path in (ROOT, ROOT / "textslopbench", SCRIPTS):
    sys.path.insert(0, str(path))

from claimflip_bench import run as run_claimflip
from humanize import rewrite
from intervention_bench import run as run_intervention
from run_textslopbench import load_fixtures, score_candidate, summary


def run() -> dict[str, object]:
    fixtures = load_fixtures(ROOT / "textslopbench" / "fixtures.jsonl")
    records = []
    for item in fixtures:
        source = str(item["source"])
        records.append(score_candidate(item, source, "identity/no-op"))
        candidate = str(rewrite(source, "auto", protected_values=list(item.get("protected", [])))["rewrite"])
        records.append(score_candidate(item, candidate, "FixMySlop:Humanizer/local-cli@0.2.0"))
    owned_summary = summary(records)
    candidate_rows = [row for row in records if row["system"] != "identity/no-op"]
    ai_rows = [row for row in candidate_rows if row["condition"] == "ai"]
    human_rows = [row for row in candidate_rows if row["condition"] == "human"]
    owned_failures = []
    if not any(row["rewrite"] != row["source"] for row in ai_rows):
        owned_failures.append("candidate made no intervention on any declared AI fixture")
    if any(row["rewrite"] != row["source"] for row in human_rows):
        owned_failures.append("candidate changed at least one human control")
    if any(not row["metrics"]["anchor_mutation_safety_pass"] for row in candidate_rows):
        owned_failures.append("candidate failed anchor + mutation safety")
    return {
        "suite": "TextSlopBench/local-safety-suite",
        "version": "0.2.0",
        "owned_rewrite_benchmark": owned_summary,
        "owned_gates": {
            "ai_intervention_items": sum(row["rewrite"] != row["source"] for row in ai_rows),
            "human_controls_changed": sum(row["rewrite"] != row["source"] for row in human_rows),
            "failures": owned_failures,
        },
        "claimflip": run_claimflip(),
        "intervention": run_intervention(),
        "comparison_policy": "Identity is always reported. No composite score and no superiority claim.",
    }


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    report = run()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    failures = report["owned_gates"]["failures"] or report["claimflip"]["failures"] or report["intervention"]["failures"]
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
