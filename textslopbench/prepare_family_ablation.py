#!/usr/bin/env python3
"""Emit per-arm host payloads for the feature-family ablation (Iteration 2, point 3).

Reads a frozen normalized subset and, for each record, builds the nine ablation-arm
payloads. Every arm carries the identical pragmatic profile, hard-anchor policy, source
text, and instruction block; only the exposed humanstats feature family varies. A host
runner sends each payload to the pinned model with identical settings, saving the
returned rewrite next to the payload. This script makes no model calls.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from family_ablation import FAMILY_ARMS, build_family_arm
from pipeline import prepare_rewrite_context

INSTRUCTION = (
    "Revise the SOURCE using the pragmatics block below. Preserve every hard anchor exactly and keep the "
    "source's certainty, causal relationships, quotations, commands, and labels faithful. Improve the prose "
    "in the inferred register. Use the humanstats_evidence, if any, only as diagnostic guidance; do not infer "
    "new facts. Return only the revision."
)


def load_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subset", type=Path, required=True, help="frozen normalized jsonl (record_id + source_text)")
    parser.add_argument("--output", type=Path, required=True, help="jsonl of {record_id, arm, host payload} to hand to the host runner")
    parser.add_argument("--host-model", default="gpt-5.6-terra")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    records = load_jsonl(args.subset)
    if args.limit:
        records = records[: args.limit]

    rows: list[dict[str, object]] = []
    for record in records:
        source = str(record["source_text"])
        context = prepare_rewrite_context(source, "auto")
        for arm in FAMILY_ARMS:
            payload = build_family_arm(context, arm)
            rows.append({
                "record_id": record["record_id"],
                "stratum": record.get("stratum", record.get("split", "unspecified")),
                "arm": arm,
                "source": source,
                "human_reference": (record.get("human_references") or [""])[0],
                "instruction": INSTRUCTION,
                "pragmatics": payload["pragmatics"],
                "humanstats_evidence": payload["humanstats_evidence"],
                "host": {
                    "model": args.host_model,
                    "reasoning_effort": "medium",
                    "service_tier": "priority",
                    "temperature": "default/inherited",
                    "condition": arm,
                    "note": "rewrite to be filled by the host runner; identical settings across arms",
                },
            })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
    print(json.dumps({"subset": str(args.subset), "records": len(records), "arms": len(FAMILY_ARMS), "payloads": len(rows), "output": str(args.output)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
