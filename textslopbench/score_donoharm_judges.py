#!/usr/bin/env python3
"""Aggregate counterbalanced do-no-harm preference judgments."""

from __future__ import annotations

import argparse
import json
import random
import statistics
from collections import Counter
from pathlib import Path


def read(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def bootstrap_rate(values: list[bool], seed: int, samples: int = 5000) -> dict[str, float]:
    rng = random.Random(seed)
    rates = [sum(rng.choices(values, k=len(values))) / max(len(values), 1) for _ in range(samples)]
    return {
        "rate_excluding_ties": round(sum(values) / max(len(values), 1), 4),
        "lower_95": round(sorted(rates)[int(samples * 0.025)], 4),
        "upper_95": round(sorted(rates)[int(samples * 0.975)], 4),
    }


def choice(row: dict[str, object], system: str) -> str:
    value = row.get(f"{system}_choice")
    if value is None and system == "fixmyslop":
        value = row.get("fix_choice")
    if value is None:
        raise ValueError(f"Missing normalized choice for {system}: {row}")
    value = str(value).lower()
    if value in {"original", "rewrite", "tie"}:
        return value
    raise ValueError(f"Invalid choice {value!r}")


def rating(row: dict[str, object], system: str, side: str) -> float | None:
    keys = [f"{system}_{side}_rating", f"{side}_{system}_rating"]
    for key in keys:
        if isinstance(row.get(key), (int, float)):
            return float(row[key])
    nested = row.get("original_ratings" if side == "original" else ("baseline_ratings" if system == "baseline" else "fix_ratings"))
    if isinstance(nested, dict):
        values = [value for value in nested.values() if isinstance(value, (int, float))]
        if values:
            return float(statistics.fmean(values))
    ratings = row.get("ratings")
    if isinstance(ratings, dict):
        value = ratings.get(f"{system}_{side}")
        if isinstance(value, (int, float)):
            return float(value)
    return None


def agreement(values: list[str]) -> float:
    if not values:
        return 0.0
    pairs = [(left, right) for index, left in enumerate(values) for right in values[index + 1 :]]
    return round(sum(left == right for left, right in pairs) / max(len(pairs), 1), 4)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--judge", action="append", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--markdown", type=Path, required=True)
    args = parser.parse_args()
    input_rows = read(args.input)
    judge_rows = [read(path) for path in args.judge]
    expected = {str(row["id"]) for row in input_rows}
    by_system: dict[str, dict[str, list[dict[str, object]]]] = {"baseline": {}, "fixmyslop": {}}
    for judge_index, rows in enumerate(judge_rows):
        ids = {str(row["id"]) for row in rows}
        if ids != expected:
            raise ValueError(f"Judge {judge_index} does not cover exactly the input IDs")
        for row in rows:
            record_id = str(row["id"])
            for system in by_system:
                by_system[system].setdefault(record_id, []).append(row)

    aggregate: dict[str, object] = {}
    per_example: dict[str, object] = {}
    for system, records in by_system.items():
        all_choices = [choice(row, system) for rows in records.values() for row in rows]
        rewrite_wins = [value == "rewrite" for value in all_choices if value != "tie"]
        original_wins = sum(value == "original" for value in all_choices)
        ties = sum(value == "tie" for value in all_choices)
        original_ratings = [value for rows in records.values() for row in rows if (value := rating(row, system, "original")) is not None]
        rewrite_ratings = [value for rows in records.values() for row in rows if (value := rating(row, system, "rewrite")) is not None]
        aggregate[system] = {
            "judgments": len(all_choices),
            "rewrite_preferred": sum(rewrite_wins),
            "original_preferred": original_wins,
            "ties": ties,
            "rewrite_preference_bootstrap_95": bootstrap_rate(rewrite_wins, 700 + len(system)),
            "mean_original_rating": round(statistics.fmean(original_ratings), 4) if original_ratings else None,
            "mean_rewrite_rating": round(statistics.fmean(rewrite_ratings), 4) if rewrite_ratings else None,
            "inter_judge_choice_agreement": round(statistics.fmean(agreement([choice(row, system) for row in rows]) for rows in records.values()), 4),
        }
        for record_id, rows in records.items():
            per_example.setdefault(record_id, {})[system] = {
                "choices": [choice(row, system) for row in rows],
                "reasons": [
                    (row.get("reasons", {}).get("baseline" if system == "baseline" else "fixmyslop", "") if isinstance(row.get("reasons"), dict) else row.get(f"{system}_reason", row.get("reason", "")))
                    for row in rows
                ],
            }

    payload = {
        "schema_version": "textslopbench.donoharm-judges.v1",
        "input": str(args.input),
        "judge_files": [str(path) for path in args.judge],
        "judge_count": len(args.judge),
        "aggregate": aggregate,
        "per_example": per_example,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Do-no-harm preference evaluation",
        "",
        "Three pinned model judges compared each untouched human original with the baseline and iteration-1 rewrite. Ties were allowed; ratings are diagnostic, not a human-panel result.",
        "",
        "| System | Original preferred | Rewrite preferred | Ties | Rewrite preference (95% bootstrap) | Original rating | Rewrite rating | Inter-judge agreement |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for system in ("baseline", "fixmyslop"):
        row = aggregate[system]
        ci = row["rewrite_preference_bootstrap_95"]
        lines.append(f"| {system} | {row['original_preferred']} | {row['rewrite_preferred']} | {row['ties']} | {ci['rate_excluding_ties']:.3f} [{ci['lower_95']:.3f}, {ci['upper_95']:.3f}] | {row['mean_original_rating']} | {row['mean_rewrite_rating']} | {row['inter_judge_choice_agreement']:.3f} |")
    lines.extend(["", "Automatic preservation metrics are in `donoharm-eval-24.json`; machine-readable judgments are in the JSON beside this report."])
    args.markdown.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "markdown": str(args.markdown), "judges": len(args.judge)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
