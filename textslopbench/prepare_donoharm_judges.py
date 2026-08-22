#!/usr/bin/env python3
"""Create blinded original-vs-rewrite preference prompts for do-no-harm."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load(path: Path) -> dict[str, dict[str, object]]:
    return {str(row["record_id"]): row for row in (json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip())}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--normalized", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--fix", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    base = load(args.baseline)
    fix = load(args.fix)
    rows = []
    for source_row in (json.loads(line) for line in args.normalized.read_text(encoding="utf-8").splitlines() if line.strip()):
        record_id = str(source_row["record_id"])
        rows.append({
            "id": record_id,
            "source": source_row["source_text"],
            "baseline": base[record_id]["rewrite"],
            "fixmyslop": fix[record_id]["rewrite"],
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "records": len(rows)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
