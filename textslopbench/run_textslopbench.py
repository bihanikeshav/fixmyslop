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
SNAPSHOT = "0.2.0"


def load_fixtures(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def score_candidate(item: dict[str, object], candidate: str, system: str, debug: bool = False) -> dict[str, object]:
    source = str(item["source"])
    requested_genre = str(item.get("genre", "auto"))
    context = prepare_rewrite_context(source, requested_genre, item.get("protected", []))
    genre = str(context["genre_inference"]["genre"])
    before = context["original_humanstats"]
    after = analyze(candidate, genre)
    fidelity = audit(source, candidate, item.get("protected", []), context["source_content_map"])
    context = finish_rewrite_context(context, candidate, fidelity)
    return {
        "id": item["id"],
        "system": system,
        "condition": item.get("condition", "unknown"),
        "requested_genre": requested_genre,
        "genre_mode": "declared" if requested_genre != "auto" else "inferred",
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
            "anchor_exact_score": fidelity["exact_check_score"],
            "anchor_mutation_safety_pass": fidelity["passed"],
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
        report = local_rewrite(str(item["source"]), str(item.get("genre", "auto")), debug=debug, protected_values=list(item.get("protected", [])))
        records.append(score_candidate(item, str(report["rewrite"]), "FixMySlop:Humanizer/local-cli", debug=debug))
    write_jsonl(output, records)
    return records


def load_candidate_records(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def validate_candidate_records(
    records: list[dict[str, object]],
    fixture_by_id: dict[str, dict[str, object]],
    *,
    require_complete: bool = True,
) -> None:
    expected = set(fixture_by_id)
    seen: set[tuple[str, str]] = set()
    ids_by_system: dict[str, set[str]] = defaultdict(set)
    config_by_system: dict[str, set[tuple[object, ...]]] = defaultdict(set)
    for index, record in enumerate(records, 1):
        if "id" not in record or "rewrite" not in record or "system" not in record:
            raise ValueError(f"Candidate row {index} must contain id, rewrite, and system")
        record_id = str(record["id"])
        system = str(record["system"])
        if record_id not in expected:
            raise ValueError(f"Unknown fixture id: {record_id}")
        key = (system, record_id)
        if key in seen:
            raise ValueError(f"Duplicate candidate for system={system!r}, id={record_id!r}")
        seen.add(key)
        ids_by_system[system].add(record_id)
        config_by_system[system].add(tuple(record.get(field) for field in ("host", "ablation_condition", "source_manifest", "run_id")))
    for system, configs in config_by_system.items():
        if len(configs) > 1:
            raise ValueError(f"System {system!r} mixes host/configuration metadata; use distinct system labels or one run manifest")
    if require_complete:
        for system, ids in ids_by_system.items():
            missing = sorted(expected - ids)
            extra = sorted(ids - expected)
            if missing or extra:
                raise ValueError(f"Incomplete run for {system!r}: missing={missing}, extra={extra}")


def rescore_records(
    records: list[dict[str, object]],
    fixture_by_id: dict[str, dict[str, object]],
    *,
    require_complete: bool = True,
) -> list[dict[str, object]]:
    validate_candidate_records(records, fixture_by_id, require_complete=require_complete)
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
        "metric_schema": "0.2.0",
        "metric_note": "Anchor + mutation safety is not full semantic fidelity.",
        "items": len({str(record["id"]) for record in records}),
        "records": len(records),
        "systems": {},
    }
    for system, rows in sorted(by_system.items()):
        metrics = [row["metrics"] for row in rows]
        human = [row for row in rows if row["condition"] == "human"]
        output["systems"][system] = {
            "items": len(rows),
            "avg_before_to_after_risk_delta": round(sum(float(m["risk_delta"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "avg_finding_delta": round(sum(float(m["finding_delta"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "anchor_mutation_safety_pass_rate": round(sum(bool(m["anchor_mutation_safety_pass"]) for m in metrics) / len(metrics), 4) if metrics else 0.0,
            "avg_anchor_exact_score": round(sum(float(m["anchor_exact_score"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "avg_content_word_jaccard": round(sum(float(m["content_word_jaccard"]) for m in metrics) / len(metrics), 4) if metrics else 0.0,
            "avg_word_delta": round(sum(float(m["word_delta"]) for m in metrics) / len(metrics), 2) if metrics else 0.0,
            "avg_rewrite_to_source_word_ratio": round(sum(float(m["rewrite_words"]) / max(float(m["source_words"]), 1) for m in metrics) / len(metrics), 4) if metrics else 0.0,
            "human_control_items": len(human),
            "human_control_anchor_mutation_safety_pass_rate": round(sum(bool(row["metrics"]["anchor_mutation_safety_pass"]) for row in human) / len(human), 4) if human else None,
            "human_control_avg_content_word_jaccard": round(sum(float(row["metrics"]["content_word_jaccard"]) for row in human) / len(human), 4) if human else None,
            "by_genre": {
                genre: {
                    "items": len(genre_rows),
                    "avg_risk_delta": round(sum(float(row["metrics"]["risk_delta"]) for row in genre_rows) / len(genre_rows), 2),
                    "anchor_mutation_safety_pass_rate": round(sum(bool(row["metrics"]["anchor_mutation_safety_pass"]) for row in genre_rows) / len(genre_rows), 4),
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
