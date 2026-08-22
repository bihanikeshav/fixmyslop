#!/usr/bin/env python3
"""Aggregate anonymized pairwise judgments without exposing system labels to judges."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--pairs", type=Path, default=root / "results" / "blinded-pairs.jsonl")
    parser.add_argument("--outputs", type=Path, default=root / "results" / "agent-merged.jsonl")
    parser.add_argument("--judgments", nargs="+", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=root / "results" / "judgment-summary.json")
    args = parser.parse_args()
    pairs = {row["id"]: row for row in (json.loads(line) for line in args.pairs.read_text(encoding="utf-8").splitlines() if line.strip())}
    outputs = {}
    for row in (json.loads(line) for line in args.outputs.read_text(encoding="utf-8").splitlines() if line.strip()):
        outputs.setdefault(row["id"], {})[row["system"]] = row["rewrite"]
    systems = sorted({system for group in outputs.values() for system in group})
    if len(systems) != 2:
        raise SystemExit(f"expected two systems, got {systems}")
    counts = Counter()
    records = []
    for path in args.judgments:
        for judgment in (json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()):
            pair = pairs[judgment["id"]]
            group = outputs[judgment["id"]]
            a_system = next(system for system, text in group.items() if text == pair["A"])
            b_system = next(system for system, text in group.items() if text == pair["B"])
            choice = judgment["choice"]
            winner = None if choice == "Tie" else (a_system if choice == "A" else b_system)
            loser = None if winner is None else next(system for system in systems if system != winner)
            if winner:
                counts[f"wins::{winner}"] += 1
                counts[f"losses::{loser}"] += 1
            else:
                counts["ties"] += 1
            records.append({**judgment, "a_system": a_system, "b_system": b_system, "winner": winner})
    summary = {
        "benchmark": "TextSlopBench",
        "judgment_type": "independent agent pairwise proxy, not human panel data",
        "comparisons": len(records),
        "systems": {
            system: {
                "wins": counts[f"wins::{system}"],
                "losses": counts[f"losses::{system}"],
                "ties": counts["ties"],
                "win_rate_excluding_ties": round(counts[f"wins::{system}"] / max(counts[f"wins::{system}"] + counts[f"losses::{system}"], 1), 4),
            }
            for system in systems
        },
        "raw_judgments": records,
    }
    args.output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key != "raw_judgments"}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
