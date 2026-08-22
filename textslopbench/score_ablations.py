#!/usr/bin/env python3
"""Aggregate the five pinned-host ablation conditions without proxy tuning."""

from __future__ import annotations

import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "textslopbench" / "results"
CONDITIONS = (
    "base_heuristic",
    "humanstats_only",
    "pragmatic_profile_only",
    "humanstats_plus_pragmatic",
    "humanstats_plus_pragmatic_plus_second_scan",
)


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def mean(rows: list[dict[str, object]], key: str) -> float:
    return round(statistics.mean(float(row["metrics"][key]) for row in rows), 4) if rows else 0.0


def main() -> int:
    all_rows: dict[str, list[dict[str, object]]] = {}
    for condition in CONDITIONS:
        path = RESULTS / f"ablation_{condition}_scored.jsonl"
        rows = read_jsonl(path)
        all_rows[condition] = rows
    systems: dict[str, object] = {}
    for condition, rows in all_rows.items():
        human = [row for row in rows if row.get("condition") == "human"]
        systems[condition] = {
            "items": len(rows),
            "host_configurations": sorted({json.dumps(row.get("host", {}), sort_keys=True) for row in rows}),
            "avg_risk_delta": mean(rows, "risk_delta"),
            "avg_finding_delta": mean(rows, "finding_delta"),
            "fidelity_pass_rate": round(sum(bool(row["metrics"]["fidelity_pass"]) for row in rows) / max(len(rows), 1), 4),
            "avg_exact_fidelity": mean(rows, "fidelity_exact_score"),
            "avg_content_jaccard": mean(rows, "content_word_jaccard"),
            "avg_word_delta": mean(rows, "word_delta"),
            "human_control_fidelity_pass_rate": round(sum(bool(row["metrics"]["fidelity_pass"]) for row in human) / max(len(human), 1), 4) if human else None,
            "human_control_avg_content_jaccard": mean(human, "content_word_jaccard") if human else None,
        }
    per_fixture: dict[str, object] = {}
    ids = sorted({str(row["id"]) for rows in all_rows.values() for row in rows})
    for fixture_id in ids:
        per_fixture[fixture_id] = {}
        for condition, rows in all_rows.items():
            row = next(row for row in rows if str(row["id"]) == fixture_id)
            per_fixture[fixture_id][condition] = {
                "rewrite": row["rewrite"],
                "metrics": row["metrics"],
                "genre": row.get("genre"),
                "host": row.get("host"),
            }
    payload = {
        "benchmark": "TextSlopBench",
        "snapshot": "0.1.0",
        "purpose": "Ablation diagnostics; not a proxy-judge optimization target.",
        "conditions": list(CONDITIONS),
        "systems": systems,
        "per_fixture": per_fixture,
    }
    json_path = RESULTS / "ablation-summary.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# FixMySlop iteration 1 ablation",
        "",
        "These are pinned-host automatic diagnostics, not an optimization target for the LLM proxy judge.",
        "",
        "| Condition | Risk delta | Finding delta | Anchor/claim fidelity pass | Exact-anchor fidelity | Lexical retention | Word-delta (edit magnitude) | Human-input anchor fidelity |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for condition in CONDITIONS:
        row = systems[condition]
        lines.append(f"| {condition} | {row['avg_risk_delta']:.2f} | {row['avg_finding_delta']:.2f} | {row['fidelity_pass_rate']:.1%} | {row['avg_exact_fidelity']:.2f} | {row['avg_content_jaccard']:.4f} | {row['avg_word_delta']:.2f} | {row['human_control_fidelity_pass_rate'] if row['human_control_fidelity_pass_rate'] is not None else 'n/a'} |")
    lines.extend([
        "",
        "Full exact source/output/trace material is in `ablation-summary.json` and the five scored JSONL files. No naturalness conclusion is drawn from these automatic metrics.",
    ])
    (ROOT / "ABLATION_RESULTS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(ROOT / "ABLATION_RESULTS.md"), "conditions": list(CONDITIONS)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
