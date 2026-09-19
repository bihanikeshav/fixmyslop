#!/usr/bin/env python3
"""Owned clean-vs-defective intervention and idempotence benchmark."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from humanize import rewrite


DEFECTS = [
    ("filler", "In order to ship, run the tests.", "To ship, run the tests.", "general prose", "contextual"),
    ("filler", "Due to the fact that it rained, we left.", "Because it rained, we left.", "general prose", "contextual"),
    ("filler", "At this point in time, the queue is stable.", "Now, the queue is stable.", "general prose", "contextual"),
    ("filler", "In the event that the job fails, retry once.", "If the job fails, retry once.", "general prose", "contextual"),
    ("filler", "The worker has the ability to retry.", "The worker can retry.", "general prose", "contextual"),
    ("hedging", "It could potentially possibly reduce errors.", "It may reduce errors.", "general prose", "contextual"),
    ("chat_wrapper", "Great question! The build failed on Friday.", "The build failed on Friday.", "general prose", "contextual"),
    ("chat_wrapper", "The build failed on Friday. I hope this helps!", "The build failed on Friday.", "general prose", "contextual"),
    ("generic_close", "The build shipped.\nThe future looks bright.", "The build shipped.\n", "general prose", "contextual"),
    ("decorative_emoji", "🚀 v2.4.0 fixes export retries.", "v2.4.0 fixes export retries.", "software release notes", "contextual"),
    ("dash_contrast", "The problem is not speed—it is consistency.", "The problem is not speed; it is consistency.", "general prose", "contextual"),
    ("plain_typography", "The writer’s note—kept outside the quote—was ready.", "The writer's note (kept outside the quote) was ready.", "general prose", "plain"),
    ("filler_variant", "In order to publish the changelog, run pnpm docs.", "To publish the changelog, run pnpm docs.", "developer README", "contextual"),
    ("hedging_variant", "It might possibly reduce timeout errors.", "It might reduce timeout errors.", "general prose", "contextual"),
    ("chat_close_variant", "The migration completed on Friday. Let me know if you'd like anything else.", "The migration completed on Friday.", "engineering update", "contextual"),
    ("generic_close_variant", "The migration completed.\nThe future looks bright.", "The migration completed.\n", "engineering update", "contextual"),
    ("decorative_emoji_variant", "🚀 v3.1.0 fixes retry loops.", "v3.1.0 fixes retry loops.", "software release notes", "contextual"),
]

CLEAN = [
    ("noun_ambiguity", "These features are intentional.", "general prose"),
    ("verb_ambiguity", "Jordan boasts about the result.", "general prose"),
    ("discourse", "She is, of course, ready.", "general prose"),
    ("parallel_voice", "Not only did Maya ship the fix, but she also wrote the tests.", "general prose"),
    ("soft_vocabulary", "This release showcases faster exports.", "software release notes"),
    ("soft_vocabulary", "Additionally, the appendix lists the exclusions.", "academic abstract"),
    ("typography", "The tool—despite its flaws—works.", "general prose"),
    ("emoji_voice", "I kept the 🔥 because it is the whole joke.", "personal social post"),
    ("markdown", "\n  - first item\n\n    nested note\n", "developer README"),
    ("protected_quote", "Ravi said \"Great question!\" and left.", "interview transcript"),
    ("code_switching", "Thik hai for the price, but I would not commute with it.", "customer review"),
    ("curly_type", "The writer’s draft was ready.", "general prose"),
    ("medical_uncertainty", "The treatment may reduce symptoms, but the evidence is preliminary.", "medical guidance"),
    ("legal_obligation", "The tenant must respond within 14 days.", "legal notice"),
    ("fiction_typography", "“Don’t,” she said—then laughed.", "fiction"),
    ("intentional_marketing", "Built for two-person teams. Start free today.", "marketing copy"),
    ("cli_identifier", "Use the --dry-run flag before deployment.", "developer README"),
    ("code_switching_variant", "Yeh thoda slow hai, but the export still works.", "customer review"),
    ("passive_attribution", "Ravi was denied access by Maya.", "incident report"),
]


def run() -> dict[str, object]:
    rows = []
    for index, (family, source, target, genre, typography) in enumerate(DEFECTS, 1):
        first = rewrite(source, genre, typography=typography)
        second = rewrite(str(first["rewrite"]), genre, typography=typography)
        rows.append({
            "id": f"defect-{index:02d}", "condition": "defect", "family": family,
            "changed": first["rewrite"] != source,
            "exact_recovery": first["rewrite"] == target,
            "idempotent": second["rewrite"] == first["rewrite"],
            "safety_pass": first["fidelity"]["passed"],
            "source": source, "target": target, "rewrite": first["rewrite"],
        })
    for index, (family, source, genre) in enumerate(CLEAN, 1):
        first = rewrite(source, genre)
        second = rewrite(str(first["rewrite"]), genre)
        rows.append({
            "id": f"clean-{index:02d}", "condition": "clean", "family": family,
            "changed": first["rewrite"] != source,
            "exact_recovery": first["rewrite"] == source,
            "idempotent": second["rewrite"] == first["rewrite"],
            "safety_pass": first["fidelity"]["passed"],
            "source": source, "target": source, "rewrite": first["rewrite"],
        })
    defects = [row for row in rows if row["condition"] == "defect"]
    clean = [row for row in rows if row["condition"] == "clean"]
    rate = lambda values: round(sum(values) / len(values), 4) if values else 0.0
    report = {
        "benchmark": "InterventionBench",
        "version": "0.2.0",
        "items": len(rows),
        "defect_intervention_recall": rate([row["changed"] for row in defects]),
        "exact_recovery_rate": rate([row["exact_recovery"] for row in defects]),
        "clean_preservation_specificity": rate([not row["changed"] for row in clean]),
        "idempotence_rate": rate([row["idempotent"] for row in rows]),
        "anchor_mutation_safety_pass_rate": rate([row["safety_pass"] for row in rows]),
        "failures": [
            row for row in rows
            if (row["condition"] == "defect" and not row["exact_recovery"])
            or (row["condition"] == "clean" and row["changed"])
            or not row["idempotent"] or not row["safety_pass"]
        ],
        "scope_note": (
            "First-party deterministic intervention and preservation regressions. "
            "The pack includes register-sensitive clean controls, but is not a blinded "
            "human naturalness study or evidence of broad generalization."
        ),
        "rows": rows,
    }
    return report


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    report = run()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not report["failures"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
