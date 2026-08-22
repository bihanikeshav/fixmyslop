#!/usr/bin/env python3
"""Run and score the owned TextSlopBench v0.1 fixture set.

The runner scores candidate text independently of the system that produced it. This
keeps the checker fair when candidates come from a host-model run of either
FixMySlop:Humanizer or the existing $humanizer skill.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL_SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SKILL_SCRIPTS))

from fidelity import audit
from humanize import rewrite as local_rewrite
from humanstats import analyze
from pipeline import finish_rewrite_context, prepare_rewrite_context


BENCHMARK = "TextSlopBench"
SNAPSHOT = "0.1.0"


def load_fixtures(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def score_candidate(item: dict[str, object], candidate: str, system: str, debug: bool = False) -> dict[str, object]:
    source = str(item["source"])
    context = prepare_rewrite_context(source, "auto", item.get("protected", []))
    genre = str(context["genre_inference"]["genre"])
    before = context["original_humanstats"]
    after = analyze(candidate, genre)
    fidelity = audit(source, candidate, item.get("protected", []), context["source_content_map"])
    context = finish_rewrite_context(context, candidate, fidelity)
    return {
        "id": item["id"],
        "system": system,
        "condition": item.get("condition", "unknown"),
        "requested_genre": item.get("genre", "auto"),
        "genre": genre,
        "genre_confidence": context["genre_inference"]["confidence"],
        "source": source,
        "rewrite": candidate,
        "protected": item.get("protected", []),
        "metrics": {
            "before_formulaic_risk": before["formulaic_risk"],
            "after_formulaic_risk": after["formulaic_risk"],
            "risk_delta": round(after["formulaic_risk"] - before["formulaic_risk"], 2),
            "before_findings": len(before["findings"]),
            "after_findings": len(after["findings"]),
            "finding_delta": len(after["findings"]) - len(before["findings"]),
            "source_words": before["token_count"],
            "rewrite_words": after["token_count"],
            "word_delta": after["token_count"] - before["token_count"],
            "fidelity_exact_score": fidelity["exact_check_score"],
            "fidelity_pass": fidelity["passed"],
            "content_word_jaccard": fidelity["content_word_jaccard"],
            "drift_flags": fidelity["drift_flags"],
        },
        "audit_trace": context if debug else {
            "pipeline_version": context["pipeline_version"],
            "stage_order": context["stage_order"],
            "genre_inference": context["genre_inference"],
            "pragmatic_profile": context["pragmatic_profile"],
            "model_summary": context["model_summary"],
            "rewrite_humanstats": context["rewrite_humanstats"],
            "targeted_correction": context["targeted_correction"],
            "fidelity": context["fidelity"],
        },
    }


def write_jsonl(path: Path, records: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def run_local(fixtures: list[dict[str, object]], output: Path, debug: bool = False) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for item in fixtures:
        report = local_rewrite(str(item["source"]), "auto", debug=debug, protected_values=list(item.get("protected", [])))
        records.append(score_candidate(item, str(report["rewrite"]), "FixMySlop:Humanizer/local-cli", debug=debug))
    write_jsonl(output, records)
    return records


def load_candidate_records(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def rescore_records(records: list[dict[str, object]], fixture_by_id: dict[str, dict[str, object]]) -> list[dict[str, object]]:
    scored = []
    for record in records:
        item = fixture_by_id.get(str(record["id"]))
        if not item:
            raise ValueError(f"Unknown fixture id: {record['id']}")
        scored_row = score_candidate(item, str(record["rewrite"]), str(record.get("system", "external")))
        for field in ("host", "ablation_condition", "source_manifest"):
            if field in record:
                scored_row[field] = record[field]
        scored.append(scored_row)
    return scored


def summary(records: list[dict[str, object]]) -> dict[str, object]:
    by_system: dict[str, list[dict[str, object]]] = defaultdict(list)
    for record in records:
        by_system[str(record["system"])].append(record)
    output: dict[str, object] = {
        "benchmark": BENCHMARK,
        "snapshot": SNAPSHOT,
        "items": len(records),
        "systems": {},
    }
    for system, rows in sorted(by_system.items()):
        metrics = [row["metrics"] for row in rows]
        human = [row for row in rows if row["condition"] == "human"]
        output["systems"][system] = {
            "items": len(rows),
            "avg_before_to_after_risk_delta": round(sum(float(m["risk_delta"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "avg_finding_delta": round(sum(float(m["finding_delta"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "fidelity_pass_rate": round(sum(bool(m["fidelity_pass"]) for m in metrics) / len(metrics), 4) if metrics else 0.0,
            "avg_fidelity_exact_score": round(sum(float(m["fidelity_exact_score"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "avg_content_word_jaccard": round(sum(float(m["content_word_jaccard"]) for m in metrics) / len(metrics), 4) if metrics else 0.0,
            "avg_word_delta": round(sum(float(m["word_delta"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "avg_rewrite_to_source_word_ratio": round(sum(float(m["rewrite_words"]) / max(float(m["source_words"]), 1) for m in metrics) / len(metrics), 4) if metrics else 0.0,
            "human_control_items": len(human),
            "human_control_fidelity_pass_rate": round(sum(bool(row["metrics"]["fidelity_pass"]) for row in human) / len(human), 4) if human else None,
            "human_control_avg_content_word_jaccard": round(sum(float(row["metrics"]["content_word_jaccard"]) for row in human) / len(human), 4) if human else None,
            "by_genre": {
                genre: {
                    "items": len(genre_rows),
                    "avg_risk_delta": round(sum(float(row["metrics"]["risk_delta"]) for row in genre_rows) / len(genre_rows), 2),
                    "fidelity_pass_rate": round(sum(bool(row["metrics"]["fidelity_pass"]) for row in genre_rows) / len(genre_rows), 4),
                }
                for genre in sorted({str(row["genre"]) for row in rows})
                for genre_rows in [[row for row in rows if row["genre"] == genre]]
            },
        }
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Run or score TextSlopBench.")
    parser.add_argument("--fixtures", type=Path, default=ROOT / "textslopbench" / "fixtures.jsonl")
    parser.add_argument("--local", action="store_true", help="Run the local FixMySlop CLI")
    parser.add_argument("--score", type=Path, help="Score an external JSONL with id, rewrite, and system fields")
    parser.add_argument("--debug", action="store_true", help="Include complete per-example pipeline contexts")
    parser.add_argument("--output", type=Path, default=ROOT / "textslopbench" / "results" / "latest.jsonl")
    parser.add_argument("--summary", type=Path, default=ROOT / "textslopbench" / "results" / "latest-summary.json")
    args = parser.parse_args()
    fixtures = load_fixtures(args.fixtures)
    fixture_by_id = {str(item["id"]): item for item in fixtures}
    if args.local:
        records = run_local(fixtures, args.output, debug=args.debug)
    elif args.score:
        records = rescore_records(load_candidate_records(args.score), fixture_by_id)
        write_jsonl(args.output, records)
    else:
        parser.error("choose --local or --score")
    report = summary(records)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    args.summary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
