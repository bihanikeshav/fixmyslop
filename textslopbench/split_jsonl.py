#!/usr/bin/env python3
"""Split a JSONL file into two deterministic contiguous parts."""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--first", type=Path, required=True)
    parser.add_argument("--second", type=Path, required=True)
    args = parser.parse_args()
    lines = [line for line in args.input.read_text(encoding="utf-8").splitlines() if line.strip()]
    midpoint = len(lines) // 2
    for path, chunk in ((args.first, lines[:midpoint]), (args.second, lines[midpoint:])):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(chunk) + "\n", encoding="utf-8")
    print({"first": len(lines[:midpoint]), "second": len(lines[midpoint:])})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
