#!/usr/bin/env python3
"""Score preservation and judge-preference artifacts for human-original inputs."""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "textslopbench"))
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from dataset_eval import load_jsonl, score_one  # noqa: E402
from score_dataset_outputs import read_candidates  # noqa: E402
from anchors import audit_anchor_coverage, extract_source_content_map  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--normalized", type=Path, required=True)
    parser.add_argument("--candidate", action="append", nargs=2, metavar=("SYSTEM", "JSONL"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source_rows = load_jsonl(args.normalized)
    candidate_maps = {system: read_candidates(Path(path)) for system, path in args.candidate}
    per_example = {}
    aggregates = {}
    for system, rows in candidate_maps.items():
        metrics_rows = []
        for source_row in source_rows:
            record_id = str(source_row["record_id"])
            rewrite = str(rows[record_id]["rewrite"])
            source = str(source_row["source_text"])
            metrics = score_one(source, rewrite, source)
            coverage = audit_anchor_coverage(extract_source_content_map(source), rewrite)
            metrics["exact_text_preserved"] = rewrite == source
            metrics["anchor_coverage"] = coverage
            metrics_rows.append(metrics)
            per_example.setdefault(record_id, {})[system] = metrics
        aggregates[system] = {
            "records": len(metrics_rows),
            "exact_text_preservation_rate": round(sum(row["exact_text_preserved"] for row in metrics_rows) / max(len(metrics_rows), 1), 4),
            "anchor_pass_rate": round(sum(row["anchor_coverage"]["passed"] for row in metrics_rows) / max(len(metrics_rows), 1), 4),
            "mean_word_edit_distance": round(statistics.fmean(row["candidate_word_edit_distance"] for row in metrics_rows), 4),
            "mean_normalized_edit": round(statistics.fmean(row["candidate_normalized_edit"] for row in metrics_rows), 4),
            "mean_content_jaccard_to_original": round(statistics.fmean(row["content_jaccard_to_source"] for row in metrics_rows), 4),
        }
    payload = {
        "schema_version": "textslopbench.donoharm.v1",
        "normalized_input": str(args.normalized),
        "human_original": True,
        "aggregates": aggregates,
        "per_example": per_example,
        "preference_artifact": "judge output is stored separately; no preference claim is made from these automatic metrics",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "systems": sorted(aggregates), "records": len(source_rows)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
