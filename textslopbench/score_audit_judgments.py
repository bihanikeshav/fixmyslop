#!/usr/bin/env python3
"""Score counterbalanced multi-judge TextSlopBench audit outputs."""

from __future__ import annotations

import json
import random
import statistics
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
MODELS = {"1": "gpt-5.4", "2": "gpt-5.6-luna", "3": "gpt-5.6-terra"}
METRICS = ("naturalness", "quality", "fidelity", "voice")
SYSTEMS = ("FixMySlop:Humanizer/host-agent", "humanizer/host-agent")


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = (len(ordered) - 1) * p
    left = int(index)
    right = min(left + 1, len(ordered) - 1)
    fraction = index - left
    return ordered[left] + (ordered[right] - ordered[left]) * fraction


def bootstrap_mean(values: list[float], seed: int, samples: int = 5000) -> dict[str, float | None]:
    if not values:
        return {"mean": None, "lower_95": None, "upper_95": None}
    rng = random.Random(seed)
    means = [statistics.mean(rng.choices(values, k=len(values))) for _ in range(samples)]
    return {"mean": round(statistics.mean(values), 4), "lower_95": round(percentile(means, 0.025), 4), "upper_95": round(percentile(means, 0.975), 4)}


def load_system_outputs() -> dict[str, dict[str, str]]:
    output_rows = read_jsonl(RESULTS / "agent-merged.jsonl")
    outputs: dict[str, dict[str, str]] = defaultdict(dict)
    for row in output_rows:
        outputs[str(row["id"])][str(row["system"])] = str(row["rewrite"])
    return outputs


def load_pairs(path: Path, outputs: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    result = {}
    for row in read_jsonl(path):
        group = outputs[str(row["id"])]
        result[str(row["id"])] = {
            "A": next(system for system, text in group.items() if text == row["A"]),
            "B": next(system for system, text in group.items() if text == row["B"]),
            "orientation": str(row.get("orientation", "unknown")),
        }
    return result


def load_judgments(outputs: dict[str, dict[str, str]], pairs: dict[str, dict[str, dict[str, str]]]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for path in sorted(RESULTS.glob("audit2_*.jsonl")):
        parts = path.stem.split("_")
        orientation = parts[1]
        number = parts[2]
        model = MODELS[number]
        pair_map = pairs[orientation]
        for row in read_jsonl(path):
            fixture_id = str(row["id"])
            mapping = pair_map[fixture_id]
            choice = str(row["choice"])
            winner = None if choice == "Tie" else (mapping["A"] if choice == "A" else mapping["B"])
            scores = {}
            for metric in METRICS:
                scores[mapping["A"]] = {**scores.get(mapping["A"], {}), metric: float(row[f"A_{metric}"])}
                scores[mapping["B"]] = {**scores.get(mapping["B"], {}), metric: float(row[f"B_{metric}"])}
            rows.append({
                "fixture_id": fixture_id,
                "orientation": orientation,
                "model": model,
                "source_file": path.name,
                "choice": choice,
                "winner": winner,
                "a_system": mapping["A"],
                "b_system": mapping["B"],
                "confidence": float(row.get("confidence", 0)),
                "reason": row.get("reason", ""),
                "scores": scores,
            })
    return rows


def pairwise_agreement(rows: list[dict[str, object]]) -> float | None:
    grouped: dict[str, list[object]] = defaultdict(list)
    for row in rows:
        grouped[str(row["fixture_id"])].append(row["winner"])
    agreements = []
    for values in grouped.values():
        for left in range(len(values)):
            for right in range(left + 1, len(values)):
                agreements.append(values[left] == values[right])
    return round(sum(agreements) / len(agreements), 4) if agreements else None


def fleiss_kappa(rows: list[dict[str, object]]) -> float | None:
    grouped: dict[str, list[object]] = defaultdict(list)
    for row in rows:
        grouped[str(row["fixture_id"])].append(row["winner"] or "Tie")
    if not grouped:
        return None
    categories = list(SYSTEMS) + ["Tie"]
    proportions = []
    total_counts = Counter()
    for values in grouped.values():
        counts = Counter(values)
        total_counts.update(counts)
        proportions.append(sum(count * (count - 1) for count in counts.values()) / max(len(values) * (len(values) - 1), 1))
    p_bar = statistics.mean(proportions)
    total = sum(total_counts.values())
    p_e = sum((total_counts[category] / total) ** 2 for category in categories)
    return round((p_bar - p_e) / (1 - p_e), 4) if p_e < 1 else None


def main() -> int:
    outputs = load_system_outputs()
    pairs = {
        "orig": load_pairs(RESULTS / "blinded-pairs.jsonl", outputs),
        "rev": load_pairs(RESULTS / "blinded-pairs-reversed.jsonl", outputs),
    }
    rows = load_judgments(outputs, pairs)
    score_summary = {}
    for system_index, system in enumerate(SYSTEMS):
        score_summary[system] = {
            metric: bootstrap_mean([float(row["scores"][system][metric]) for row in rows], 1000 + system_index * 100 + metric_index)
            for metric_index, metric in enumerate(METRICS)
        }
        wins = sum(row["winner"] == system for row in rows)
        losses = sum(row["winner"] is not None and row["winner"] != system for row in rows)
        ties = sum(row["winner"] is None for row in rows)
        score_summary[system]["pairwise"] = {
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "win_rate_excluding_ties": round(wins / max(wins + losses, 1), 4),
        }
    by_orientation = {}
    for orientation in ("orig", "rev"):
        subset = [row for row in rows if row["orientation"] == orientation]
        by_orientation[orientation] = {
            "comparisons": len(subset),
            "A_choice_rate": round(sum(row["choice"] == "A" for row in subset) / max(len(subset), 1), 4),
            "B_choice_rate": round(sum(row["choice"] == "B" for row in subset) / max(len(subset), 1), 4),
            "tie_rate": round(sum(row["choice"] == "Tie" for row in subset) / max(len(subset), 1), 4),
        }
    position_pairs = []
    by_fixture_model = defaultdict(dict)
    for row in rows:
        by_fixture_model[(row["fixture_id"], row["model"])][row["orientation"]] = row
    for key, pair in by_fixture_model.items():
        if "orig" in pair and "rev" in pair:
            original_winner = pair["orig"]["winner"]
            reversed_winner = pair["rev"]["winner"]
            if original_winner is None and reversed_winner is None:
                classification = "stable_tie"
            elif original_winner == reversed_winner and original_winner == pair["orig"].get("a_system"):
                classification = "stable_A"
            elif original_winner == reversed_winner and original_winner == pair["orig"].get("b_system"):
                classification = "stable_B"
            else:
                classification = "orientation_unstable"
            position_pairs.append({
                "fixture_id": key[0],
                "model": key[1],
                "original_winner": original_winner,
                "reversed_winner": reversed_winner,
                "classification": classification,
                "same_system_winner": original_winner == reversed_winner if original_winner is not None and reversed_winner is not None else None,
            })
    valid_position = [row for row in position_pairs if row["same_system_winner"] is not None]
    audit = {
        "benchmark": "TextSlopBench",
        "snapshot": "0.1.0",
        "comparisons": len(rows),
        "passes": {
            "judge_models": list(MODELS.values()),
            "model_assignments": {f"audit2_orig_{key}.jsonl": value for key, value in MODELS.items()} | {f"audit2_rev_{key}.jsonl": value for key, value in MODELS.items()},
            "reasoning_effort": "medium",
            "service_tier": "not explicitly set; inherited default",
            "rewrite_host_model_in_original_smoke_test": "not recorded; inherited parent default",
        },
        "position_audit": {
            "by_orientation": by_orientation,
            "paired_original_vs_reversed": len(position_pairs),
            "valid_non_tie_pairs": len(valid_position),
            "same_system_winner_rate": round(sum(bool(row["same_system_winner"]) for row in valid_position) / max(len(valid_position), 1), 4),
            "position_flip_rate": round(sum(not bool(row["same_system_winner"]) for row in valid_position) / max(len(valid_position), 1), 4),
            "classification_counts": dict(Counter(row["classification"] for row in position_pairs)),
            "orientation_instability_rate": round(sum(row["classification"] == "orientation_unstable" for row in position_pairs) / max(len(position_pairs), 1), 4),
            "pairs": position_pairs,
        },
        "agreement": {
            "pairwise_winner_agreement": pairwise_agreement(rows),
            "fleiss_kappa_over_winner_or_tie": fleiss_kappa(rows),
        },
        "per_system": score_summary,
        "raw_judgments": rows,
    }
    (RESULTS / "benchmark-audit-v2.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in audit.items() if key != "raw_judgments"}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
