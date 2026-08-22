#!/usr/bin/env python3
"""Normalize a user-supplied dataset file without downloading or redistributing it."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from . import ADAPTERS
except ImportError:  # direct `py adapters/cli.py` execution
    from adapters import ADAPTERS


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize a local TextSlopBench dataset source.")
    parser.add_argument("dataset", choices=sorted(ADAPTERS))
    parser.add_argument("path", type=Path)
    parser.add_argument("--split")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    adapter = ADAPTERS[args.dataset]()
    records = adapter.adapt(args.path, args.split, args.limit)
    for record in records:
        print(json.dumps(record, ensure_ascii=False))
    if args.manifest:
        args.manifest.write_text(json.dumps({"dataset": args.dataset, "source_path": str(args.path), "records": len(records), "split": args.split, "raw_copied": False}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
