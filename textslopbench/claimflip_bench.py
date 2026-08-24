#!/usr/bin/env python3
"""Owned mutation benchmark for conservative rewrite-safety checks.

ClaimFlipBench does not claim to solve semantic equivalence. It measures whether a
detector rejects known minimal corruptions while accepting hand-written valid
paraphrases. Every case is first-party and deterministic.
"""
from __future__ import annotations

import json
import math
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from fidelity import audit


CASES = [
    # Independently phrased valid rewrites. These exercise the same phenomena as
    # the corruptions without being a mirrored one-token control for each case.
    ("valid_wording", True, "Acme revenue increased by 12% in 2025.", "In 2025, Acme revenue rose by 12%."),
    ("valid_date", True, "Maya approved the release on 4 May 2026.", "On 4 May 2026, Maya approved the release."),
    ("valid_date", True, "The review happened on May 4, 2026.", "On May 4, 2026, the review happened."),
    ("valid_may_name", True, "May approved the release.", "The release was approved by May."),
    ("valid_modality", True, "The patch may reduce retries.", "The patch might reduce retries."),
    ("valid_causality", True, "The queue failed because the token expired.", "Because the token expired, the queue failed."),
    ("valid_causality", True, "The expired token caused the queue failure.", "The queue failure happened because the token expired."),
    ("valid_comparative", True, "Maya processed more orders than Ravi.", "Ravi processed fewer orders than Maya."),
    ("valid_comparative", True, "Orchid latency was lower than Cedar latency.", "Cedar latency was higher than Orchid latency."),
    ("valid_range", True, "The window runs from 5 to 9 minutes.", "From 5 to 9 minutes, the window runs."),
    ("valid_range", True, "Pick a value between 5 and 9.", "Pick a value between 9 and 5."),
    ("valid_wording", True, "The plan includes SSO and SCIM.", "SSO and SCIM are included in the plan."),
    ("valid_wording", True, "Orders over 50 units need review.", "Review is required for orders over 50 units."),
    ("valid_wording", True, "Ravi said \"ship it Friday.\"", "Ravi said \"ship it Friday.\""),
    ("valid_wording", True, "Use https://example.test/a before 2026-09-01.", "Before 2026-09-01, use https://example.test/a."),
    # Known corruptions: the detector should reject these.
    ("number", False, "Acme revenue increased by 12% in 2025.", "Acme revenue increased by 21% in 2025."),
    ("date_day_first", False, "The launch is 4 May 2026.", "The launch is 4 June 2026."),
    ("date_month_first", False, "The launch is May 4, 2026.", "The launch is June 4, 2026."),
    ("entity", False, "Ravi reviewed the release.", "Maya reviewed the release."),
    ("entity_role", False, "Maya approved Ravi for access.", "Ravi approved Maya for access."),
    ("negation", False, "The patch is safe for production.", "The patch is not safe for production."),
    ("negation", False, "The patch is not safe for production.", "The patch is safe for production."),
    ("polarity", False, "Revenue increased because demand rose.", "Revenue decreased because demand collapsed."),
    ("polarity", False, "The board approved the plan.", "The board rejected the plan."),
    ("polarity", False, "The migration succeeded.", "The migration failed."),
    ("temporal", False, "Archive the file before deployment.", "Archive the file after deployment."),
    ("membership", False, "The plan includes SSO.", "The plan excludes SSO."),
    ("quantity_scope", False, "Orders over 50 units need review.", "Orders under 50 units need review."),
    ("modality", False, "The update may reduce failures.", "The update will reduce failures."),
    ("modality", False, "Customers must verify the address.", "Customers may verify the address."),
    ("causality", False, "The queue failed because the token expired.", "The queue failed after the token expired."),
    ("causal_direction", False, "The queue failed because the token expired.", "The token expired because the queue failed."),
    ("causal_direction", False, "A network fault caused the deployment delay.", "The deployment delay caused a network fault."),
    ("numeric_range", False, "Latency fell from 400ms to 250ms.", "Latency fell from 250ms to 400ms."),
    ("numeric_range", False, "The safe band is 5–9 volts.", "The safe band is 9–5 volts."),
    ("comparative_direction", False, "Maya processed more orders than Ravi.", "Ravi processed more orders than Maya."),
    ("comparative_direction", False, "Orchid latency was lower than Cedar latency.", "Orchid latency was higher than Cedar latency."),
    ("quotation", False, "Ravi said \"ship it Friday.\"", "Ravi said \"ship it Monday.\""),
    ("url", False, "Use https://example.test/a for details.", "Use https://example.test/b for details."),
    ("occurrence", False, "Keep TOKEN in TOKEN mode.", "Keep TOKEN in standard mode."),
]


def wilson(successes: int, total: int, z: float = 1.96) -> list[float]:
    if total == 0:
        return [0.0, 0.0]
    p = successes / total
    denom = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denom
    radius = z * math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denom
    return [round(max(0.0, center - radius), 4), round(min(1.0, center + radius), 4)]


def run() -> dict[str, object]:
    rows = []
    by_category: dict[str, list[bool]] = defaultdict(list)
    for index, (category, should_pass, source, candidate) in enumerate(CASES, 1):
        result = audit(source, candidate)
        correct = bool(result["passed"]) == should_pass
        by_category[category].append(correct)
        rows.append({
            "id": f"cfb-{index:03d}",
            "category": category,
            "should_pass": should_pass,
            "detector_passed": result["passed"],
            "correct": correct,
            "blocking_flags": result.get("blocking_drift_flags", []),
            "failed_checks": [c["name"] for c in result["checks"] if not c["passed"]],
        })
    valid = [row for row in rows if row["should_pass"]]
    corrupt = [row for row in rows if not row["should_pass"]]
    valid_ok = sum(row["correct"] for row in valid)
    corrupt_ok = sum(row["correct"] for row in corrupt)
    return {
        "benchmark": "ClaimFlipBench",
        "version": "0.2.0",
        "items": len(rows),
        "valid_items": len(valid),
        "corruption_items": len(corrupt),
        "valid_paraphrase_specificity": round(valid_ok / len(valid), 4),
        "valid_paraphrase_specificity_wilson95": wilson(valid_ok, len(valid)),
        "corruption_recall": round(corrupt_ok / len(corrupt), 4),
        "corruption_recall_wilson95": wilson(corrupt_ok, len(corrupt)),
        "by_category": {
            key: {"correct": sum(values), "items": len(values), "accuracy": round(sum(values) / len(values), 4)}
            for key, values in sorted(by_category.items())
        },
        "failures": [row for row in rows if not row["correct"]],
        "rows": rows,
        "scope_note": (
            "First-party deterministic regression pack only. A 100% score means every listed "
            "owned case passed; it is not evidence of general semantic equivalence, natural-text "
            "coverage, or production false-positive rates."
        ),
        "perfect_score_interpretation": (
            "100% is complete performance on this expanded owned pack, bounded by the reported "
            "item counts and Wilson intervals."
        ),
    }


def main() -> int:
    report = run()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not report["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
