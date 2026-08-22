#!/usr/bin/env python3
"""Prepare bounded host-model prompts and complete audit contexts.

The generated JSONL is the handoff between the local architecture and benchmark
subagents.  It makes the exact context visible without putting raw analyzer output
into the host prompt.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from pipeline import host_rewrite_prompt, prepare_rewrite_context


CONDITIONS = (
    "base_heuristic",
    "humanstats_only",
    "pragmatic_profile_only",
    "humanstats_plus_pragmatic",
    "humanstats_plus_pragmatic_plus_second_scan",
)


def load_fixtures(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def condition_summary(context: dict[str, object], condition: str) -> dict[str, object]:
    summary = context["model_summary"]
    if condition == "base_heuristic":
        return {
            "condition": condition,
            "hard_anchor_policy": summary["hard_anchor_policy"],
            "instruction": "Use the pre-iteration heuristic skill; do not use humanstats or a pragmatic profile.",
        }
    if condition == "humanstats_only":
        return {
            "condition": condition,
            "actionable_findings": summary["actionable_findings"],
            "measured_signals": summary["measured_signals"],
            "hard_anchor_policy": summary["hard_anchor_policy"],
            "instruction": "Use the analyzer findings as evidence, but do not use genre-specific pragmatic objectives.",
        }
    if condition == "pragmatic_profile_only":
        return {
            "condition": condition,
            "genre": summary["genre"],
            "purpose": summary["purpose"],
            "objectives": summary["objectives"],
            "preserve": summary["preserve"],
            "avoid": summary["avoid"],
            "hard_anchor_policy": summary["hard_anchor_policy"],
            "instruction": "Use genre/register purpose, but do not use humanstats findings or raw metrics.",
        }
    return {
        "condition": condition,
        **summary,
        "instruction": "Use the structured summary. In the second-scan condition, perform the targeted correction pass before returning.",
    }


def render_prompt(source: str, summary: dict[str, object]) -> str:
    second_scan = "second_scan" in str(summary.get("condition", ""))
    return "\n".join([
        "You are revising the source below, not regenerating it.",
        "Use only the structured context provided for this ablation condition.",
        "STRUCTURED CONTEXT:",
        json.dumps(summary, ensure_ascii=False, sort_keys=True),
        "SOURCE:",
        source,
        "CONTRACT:",
        "Preserve every listed hard anchor exactly. Revise soft expression when the context supports it. Do not invent facts, evidence, sentiment, timing, serving details, rights, or causal force.",
        "Before returning, compare the draft against the source and the listed anchors. Restore any missing or changed anchor and keep the source's qualifications and causal relationships.",
        "Run the targeted second-scan correction pass before returning." if second_scan else "Return only the revised text after the anchor check.",
    ])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixtures", type=Path, default=ROOT / "textslopbench" / "fixtures.jsonl")
    parser.add_argument("--output", type=Path, default=ROOT / "textslopbench" / "results" / "rewrite-contexts-v2.jsonl")
    parser.add_argument("--conditions", nargs="*", choices=CONDITIONS, default=list(CONDITIONS))
    args = parser.parse_args()
    rows: list[dict[str, object]] = []
    for fixture in load_fixtures(args.fixtures):
        source = str(fixture["source"])
        context = prepare_rewrite_context(source, "auto", fixture.get("protected", []))
        for condition in args.conditions:
            summary = condition_summary(context, condition)
            rows.append({
                "id": fixture["id"],
                "condition": condition,
                "source": source,
                "inferred_genre": context["genre_inference"],
                "structured_context": summary,
                "host_prompt": render_prompt(source, summary),
                "full_debug_context": context if condition == "humanstats_plus_pragmatic_plus_second_scan" else None,
            })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "fixtures": len(load_fixtures(args.fixtures)), "conditions": list(args.conditions), "rows": len(rows)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
