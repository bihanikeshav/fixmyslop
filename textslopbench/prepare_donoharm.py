#!/usr/bin/env python3
"""Create a human-original do-no-harm slice from normalized Beemo records."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = []
    for line in args.input.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        human = next((candidate.get("text") for candidate in record.get("candidates", []) if candidate.get("label") == "human"), None)
        if not isinstance(human, str) or not human.strip():
            continue
        rows.append({
            "record_id": f"{record['record_id']}:human-original",
            "dataset": "Beemo-human-original",
            "split": record.get("split", "unspecified"),
            "source_text": human,
            "human_references": [human],
            "candidates": [],
            "metadata": {
                "source_record_id": record["record_id"],
                "source_dataset": record.get("dataset"),
                "category": record.get("metadata", {}).get("use_case"),
                "human_original": True,
            },
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "records": len(rows), "human_original": True}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
