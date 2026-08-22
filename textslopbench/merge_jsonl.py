#!/usr/bin/env python3
"""Merge deterministic JSONL parts while rejecting duplicate IDs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("inputs", nargs="+", type=Path)
    args = parser.parse_args()
    rows = []
    seen = set()
    for path in args.inputs:
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("record_id") in seen:
                raise ValueError(f"Duplicate record_id: {row['record_id']}")
            seen.add(row["record_id"])
            rows.append(row)
    args.output.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    print({"output": str(args.output), "records": len(rows)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
