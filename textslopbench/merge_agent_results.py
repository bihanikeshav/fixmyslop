#!/usr/bin/env python3
"""Merge fresh black-box skill outputs and score them with the frozen checker."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from run_textslopbench import load_candidate_records, load_fixtures, rescore_records, summary, write_jsonl


def main() -> int:
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Merge agent-produced TextSlopBench JSONL files.")
    parser.add_argument("--inputs", nargs="+", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=root / "results" / "agent-merged.jsonl")
    parser.add_argument("--summary", type=Path, default=root / "results" / "agent-merged-summary.json")
    args = parser.parse_args()
    fixtures = load_fixtures(root / "fixtures.jsonl")
    fixture_by_id = {str(item["id"]): item for item in fixtures}
    raw = []
    for path in args.inputs:
        raw.extend(load_candidate_records(path))
    scored = rescore_records(raw, fixture_by_id)
    write_jsonl(args.output, scored)
    report = summary(scored)
    args.summary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
