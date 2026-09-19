#!/usr/bin/env python3
"""Aggregate anonymized pairwise judgments without exposing system labels to judges."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import resolve_system_for_text


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
    excluded_ambiguous = 0
    for path in args.judgments:
        for judgment in (json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()):
            pair = pairs[judgment["id"]]
            group = outputs[judgment["id"]]
            # If A and B are byte-identical text, or either text doesn't map to exactly one
            # system, exact-text attribution is ambiguous: exclude the pair instead of
            # silently misattributing it via `next()`'s first match.
            same_text = pair["A"] == pair["B"]
            a_system = None if same_text else resolve_system_for_text(group, pair["A"])
            b_system = None if same_text else resolve_system_for_text(group, pair["B"])
            if same_text or a_system is None or b_system is None:
                excluded_ambiguous += 1
                counts["excluded_ambiguous"] += 1
                records.append({**judgment, "a_system": a_system, "b_system": b_system,
                                 "winner": None, "excluded_ambiguous": True})
                continue
            choice = judgment["choice"]
            winner = None if choice == "Tie" else (a_system if choice == "A" else b_system)
            loser = None if winner is None else next(system for system in systems if system != winner)
            if winner:
                counts[f"wins::{winner}"] += 1
                counts[f"losses::{loser}"] += 1
            else:
                counts["ties"] += 1
            records.append({**judgment, "a_system": a_system, "b_system": b_system, "winner": winner,
                             "excluded_ambiguous": False})
    summary = {
        "benchmark": "TextSlopBench",
        "judgment_type": "independent agent pairwise proxy, not human panel data",
        "comparisons": len(records) - excluded_ambiguous,
        "excluded_ambiguous_pairs": excluded_ambiguous,
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
