#!/usr/bin/env python3
"""Create anonymized pairwise prompts for independent naturalness judges."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", type=Path, default=root / "results" / "agent-merged.jsonl")
    parser.add_argument("--output", type=Path, default=root / "results" / "blinded-pairs.jsonl")
    parser.add_argument("--reverse", action="store_true", help="Swap A/B positions relative to the deterministic original")
    args = parser.parse_args()
    rows = [json.loads(line) for line in args.inputs.read_text(encoding="utf-8").splitlines() if line.strip()]
    grouped = {}
    for row in rows:
        grouped.setdefault(row["id"], {})[row["system"]] = row
    systems = sorted({row["system"] for row in rows})
    if len(systems) != 2:
        raise SystemExit(f"expected exactly two systems, got {systems}")
    pairs = []
    for fixture_id in sorted(grouped):
        group = grouped[fixture_id]
        left, right = group[systems[0]], group[systems[1]]
        flip = int(hashlib.sha256(fixture_id.encode("utf-8")).hexdigest()[:2], 16) % 2
        pair = {
            "id": fixture_id,
            "genre": left["genre"],
            "condition": left["condition"],
            "source": left["source"],
            "A": right["rewrite"] if flip else left["rewrite"],
            "B": left["rewrite"] if flip else right["rewrite"],
            "orientation": "reversed" if args.reverse else "original",
        }
        if args.reverse:
            pair["A"], pair["B"] = pair["B"], pair["A"]
        pairs.append(pair)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("".join(json.dumps(pair, ensure_ascii=False) + "\n" for pair in pairs), encoding="utf-8")
    print(f"wrote {len(pairs)} blinded pairs to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
