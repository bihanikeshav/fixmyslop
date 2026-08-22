#!/usr/bin/env python3
"""Score held-out dataset outputs against human-edit deltas.

The report deliberately stores derived metrics rather than reproducing licensed
corpora.  Candidate JSONL files contain ``record_id`` and ``rewrite``.
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset_eval import load_jsonl, score_one  # noqa: E402


def read_candidates(path: Path) -> dict[str, dict[str, object]]:
    rows = load_jsonl(path)
    result: dict[str, dict[str, object]] = {}
    for row in rows:
        record_id = str(row.get("record_id", ""))
        rewrite = row.get("rewrite")
        if not record_id or not isinstance(rewrite, str) or not rewrite.strip():
            raise ValueError(f"Invalid candidate row in {path}: {row!r}")
        if record_id in result:
            raise ValueError(f"Duplicate candidate record_id {record_id!r} in {path}")
        result[record_id] = row
    return result


def mean(values: list[float]) -> float:
    return round(statistics.fmean(values), 4) if values else 0.0


def aggregate(rows: list[dict[str, object]]) -> dict[str, object]:
    def vals(path: tuple[str, ...]) -> list[float]:
        result = []
        for row in rows:
            value: object = row
            for key in path:
                if not isinstance(value, dict):
                    break
                value = value.get(key)
            if isinstance(value, (int, float)):
                result.append(float(value))
        return result

    return {
        "records": len(rows),
        "candidate_word_edit_distance": mean(vals(("candidate_word_edit_distance",))),
        "human_word_edit_distance": mean(vals(("human_word_edit_distance",))),
        "candidate_normalized_edit": mean(vals(("candidate_normalized_edit",))),
        "human_normalized_edit": mean(vals(("human_normalized_edit",))),
        "content_jaccard_to_source": mean(vals(("content_jaccard_to_source",))),
        "content_jaccard_to_human_reference": mean(vals(("content_jaccard_to_human_reference",))),
        "2_gram_change_overlap": mean(vals(("phrase_reuse", "2_gram_change_overlap"))),
        "3_gram_change_overlap": mean(vals(("phrase_reuse", "3_gram_change_overlap"))),
        "4_gram_change_overlap": mean(vals(("phrase_reuse", "4_gram_change_overlap"))),
        "lexical_change_set_overlap": mean(vals(("lexical_change", "change_set_overlap"))),
        "human_delta_cosine": mean(vals(("human_edit_delta_alignment", "cosine"))),
        "human_delta_direction_agreement": mean(vals(("human_edit_delta_alignment", "direction_agreement"))),
        "slop_suppression_relative": mean(vals(("slop_pattern_suppression", "relative_reduction"))),
        "slop_source_density": mean(vals(("slop_pattern_suppression", "source_weighted_density"))),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--normalized", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--markdown", type=Path, required=True)
    parser.add_argument("--candidate", action="append", nargs=2, metavar=("SYSTEM", "JSONL"), default=[])
    args = parser.parse_args()

    records = load_jsonl(args.normalized)
    record_ids = [str(row["record_id"]) for row in records]
    if len(record_ids) != len(set(record_ids)):
        raise ValueError("Normalized evaluation subset has duplicate record IDs")

    candidates: dict[str, dict[str, dict[str, object]]] = {
        "source_ai": {record_id: {"rewrite": str(row["source_text"]), "host": {"kind": "identity"}} for record_id, row in zip(record_ids, records)},
        "professional_human_edit": {record_id: {"rewrite": str(row["human_references"][0]), "host": {"kind": "reference"}} for record_id, row in zip(record_ids, records)},
    }
    embedded_systems: set[str] = set()
    for record in records:
        record_id = str(record["record_id"])
        for candidate in record.get("candidates", []):
            if not isinstance(candidate, dict) or not candidate.get("label") or not isinstance(candidate.get("text"), str):
                continue
            system = f"embedded_{candidate['label']}"
            embedded_systems.add(system)
            candidates.setdefault(system, {})[record_id] = {"rewrite": candidate["text"], "host": {"kind": "embedded_reference", "label": candidate["label"]}}
    host_metadata: dict[str, object] = {}
    for system, path_text in args.candidate:
        path = Path(path_text)
        candidates[system] = read_candidates(path)
        host_metadata[system] = {
            "path": str(path),
            "host_metadata_examples": [row.get("host") for row in candidates[system].values() if row.get("host")][:1],
        }

    per_example: dict[str, dict[str, object]] = {}
    aggregate_by_system: dict[str, object] = {}
    for system, rows in candidates.items():
        missing = sorted(set(record_ids) - set(rows))
        extra = sorted(set(rows) - set(record_ids))
        if (missing and system not in embedded_systems) or extra:
            raise ValueError(f"{system}: missing={missing[:3]} extra={extra[:3]}")
        scored = []
        for record in records:
            record_id = str(record["record_id"])
            if record_id not in rows:
                continue
            metrics = score_one(str(record["source_text"]), str(rows[record_id]["rewrite"]), str(record["human_references"][0]))
            scored.append({"record_id": record_id, "metrics": metrics})
            per_example.setdefault(record_id, {})[system] = metrics
        aggregate_by_system[system] = aggregate([row["metrics"] for row in scored])

    report = {
        "schema_version": "textslopbench.dataset-eval.v1",
        "normalized_input": str(args.normalized),
        "selection_is_held_out": True,
        "raw_text_included": False,
        "systems": sorted(candidates),
        "host_metadata": host_metadata,
        "aggregate": aggregate_by_system,
        "per_example": per_example,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# TextSlopBench held-out dataset evaluation",
        "",
        f"Subset: `{args.normalized}`. Raw corpus text is not reproduced in this report.",
        "",
        "Metric names follow [METRICS_GLOSSARY.md](../METRICS_GLOSSARY.md): none of the columns below are fidelity, which is tracked separately as hard-anchor/claim preservation.",
        "",
        "| System | N | Normalized edit magnitude | Human-edit overlap | 3-gram delta alignment | Lexical delta alignment | Delta cosine (alignment) | Direction agreement | Slop suppression (secondary) |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for system in sorted(aggregate_by_system):
        row = aggregate_by_system[system]
        lines.append(
            f"| {system} | {row['records']} | {row['candidate_normalized_edit']:.4f} | "
            f"{row['content_jaccard_to_human_reference']:.4f} | {row['3_gram_change_overlap']:.4f} | "
            f"{row['lexical_change_set_overlap']:.4f} | {row['human_delta_cosine']:.4f} | "
            f"{row['human_delta_direction_agreement']:.4f} | {row['slop_suppression_relative']:.4f} |"
        )
    lines.extend([
        "",
        "Interpretation: human-edit delta alignment measures whether a system makes changes similar to the participant edit; it is neither a naturalness judgment nor a fidelity measure. Slop suppression (Antislop-style weighted overrepresented-pattern reduction) is a **secondary** signal and must never rank systems on its own -- a system can suppress slop while damaging quality or diversity. `source_ai` is the unedited draft and `professional_human_edit` is the reference ceiling for this comparison.",
    ])
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"json": str(args.output), "markdown": str(args.markdown), "systems": sorted(candidates), "records": len(records)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
