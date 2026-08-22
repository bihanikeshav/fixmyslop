#!/usr/bin/env python3
"""Regression Preservation — did a later pass break what an earlier pass got right?

From DELEGATE-52 (2026): over long delegated editing, even frontier models accumulate corruption
(~25% of content by the end of long workflows). FixMySlop's answer is extract-anchors → rewrite →
compare → targeted correction rather than repeated unconstrained rewrite cycles. This metric
guards the SECOND SCAN: when pass 2 fixes issue B, did it silently drop an anchor pass 1 kept, or
reintroduce a finding pass 1 removed?

Deterministic, no LLM judge.
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable

from fidelity import audit
from humanstats import analyze


def _missing_anchors(result: dict) -> set[str]:
    miss: set[str] = set()
    for check in result.get("checks", []):
        for m in check.get("missing", []):
            miss.add(str(m))
    hac = result.get("hard_anchor_coverage", {}) or {}
    for m in hac.get("missing", []):
        miss.add(str(m.get("value", m)) if isinstance(m, dict) else str(m))
    return miss


def _finding_families(text: str) -> Counter:
    return Counter(f["family"] for f in analyze(text, "auto").get("findings", []))


def regression_preservation(source: str, pass1: str, pass2: str,
                            protected: Iterable[str] | None = None) -> dict[str, object]:
    """Compare pass2 against pass1 (both rewrites of source).

    - anchor_regressions: anchors preserved in pass1 but missing in pass2 (corruption).
    - anchor_recoveries: anchors missing in pass1 but restored in pass2 (legitimate fix).
    - reintroduced_findings: finding families pass2 has more of than pass1 (undone cleanup).
    """
    protected = list(protected or [])
    m1 = _missing_anchors(audit(source, pass1, protected))
    m2 = _missing_anchors(audit(source, pass2, protected))
    anchor_regressions = sorted(m2 - m1)
    anchor_recoveries = sorted(m1 - m2)

    f1 = _finding_families(pass1)
    f2 = _finding_families(pass2)
    reintroduced = {fam: f2[fam] - f1.get(fam, 0) for fam in f2 if f2[fam] > f1.get(fam, 0)}

    return {
        "anchor_regressions": anchor_regressions,
        "anchor_regression_count": len(anchor_regressions),
        "anchor_recoveries": anchor_recoveries,
        "reintroduced_findings": reintroduced,
        "clean": not anchor_regressions and not reintroduced,
    }


if __name__ == "__main__":  # tiny manual check
    import json

    src = "Order #123 shipped on 5 May. We delve into a rich tapestry of updates."
    p1 = "Order #123 shipped on 5 May. Here are the updates."
    p2 = "Your order shipped. We delve into a rich tapestry of updates."
    print(json.dumps(regression_preservation(src, p1, p2, ["#123", "5 May"]), indent=2))
