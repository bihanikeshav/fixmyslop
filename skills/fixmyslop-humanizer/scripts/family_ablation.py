#!/usr/bin/env python3
"""Feature-family rewrite-ablation harness (Iteration 2, review point 3).

Given a prepared rewrite context, this builds one payload per ablation arm. Every
arm shares the identical pragmatic profile and hard-anchor policy; the only thing
that varies is which humanstats feature family is exposed to the host as rewrite
guidance. A host runner sends each payload to the pinned model, keeping all other
prompt text and settings constant, so a family's marginal effect is isolated.

This module contains no text generation and makes no model calls.
"""

from __future__ import annotations

from typing import Iterable

# humanstats section name -> analyze() key. "rhetorical" is the pattern-based
# findings list rather than a metrics section.
FEATURE_SECTIONS = {
    "lexical": "lexical",
    "phrase": "phrasal",
    "syntax": "syntax",
    "rhythm": "rhythm",
    "document": "document",
    "semantic": "semantic",
}

# Ordered arms exactly as the Iteration 2 review specifies.
FAMILY_ARMS: dict[str, list[str]] = {
    "pragmatics_only": [],
    "pragmatics_plus_lexical": ["lexical"],
    "pragmatics_plus_phrase": ["phrase"],
    "pragmatics_plus_syntax": ["syntax"],
    "pragmatics_plus_rhythm": ["rhythm"],
    "pragmatics_plus_document": ["document"],
    "pragmatics_plus_semantic": ["semantic"],
    "pragmatics_plus_rhetorical": ["rhetorical"],
    "pragmatics_plus_all_humanstats": [
        "lexical", "phrase", "syntax", "rhythm", "document", "semantic", "rhetorical",
    ],
}


def pragmatics_base(context: dict[str, object]) -> dict[str, object]:
    """The invariant pragmatics + hard-anchor context shared by every arm."""
    summary = context["model_summary"]
    return {
        "genre": summary["genre"],
        "purpose": summary["purpose"],
        "objectives": summary["objectives"],
        "preserve": summary["preserve"],
        "avoid": summary["avoid"],
        "hard_anchor_policy": summary["hard_anchor_policy"],
    }


def family_evidence(context: dict[str, object], families: Iterable[str]) -> dict[str, object]:
    """Select only the requested feature families from the original humanstats scan."""
    stats = context["original_humanstats"]
    evidence: dict[str, object] = {}
    for family in families:
        if family == "rhetorical":
            evidence["rhetorical_findings"] = list(stats.get("findings", []))
        elif family in FEATURE_SECTIONS:
            evidence[family] = stats.get(FEATURE_SECTIONS[family])
    return evidence


def build_family_arm(context: dict[str, object], arm: str) -> dict[str, object]:
    if arm not in FAMILY_ARMS:
        raise KeyError(f"unknown ablation arm: {arm}")
    families = FAMILY_ARMS[arm]
    return {
        "arm": arm,
        "families": list(families),
        "pragmatics": pragmatics_base(context),
        "humanstats_evidence": family_evidence(context, families),
    }


def family_arm_plan(context: dict[str, object]) -> dict[str, dict[str, object]]:
    """Every arm payload for one source example, ready for a host runner."""
    return {arm: build_family_arm(context, arm) for arm in FAMILY_ARMS}
