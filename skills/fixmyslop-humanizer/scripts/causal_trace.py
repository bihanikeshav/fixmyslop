#!/usr/bin/env python3
"""Causal traces: which analyzer findings the host actually acted on, and whether
the change survived the second pass.

This module is deterministic. It does not judge naturalness; it records, per finding
handed to the model, the source span, whether the flagged text still survives after
the first and second host passes, and whether a first-pass change persisted. The
aggregate answers Iteration 2's research question: which feature families produce
edits the model keeps, versus findings it correlates with but never uses.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Iterable


def _contains(haystack: str, needle: str) -> bool:
    return bool(needle) and needle.casefold() in haystack.casefold()


def _find(haystack: str, needle: str) -> int | None:
    if not needle:
        return None
    idx = haystack.casefold().find(needle.casefold())
    return idx if idx != -1 else None


def trace_finding(
    finding: dict[str, object],
    rewrite: str,
    second_rewrite: str | None = None,
) -> dict[str, object]:
    """Trace one source-scan finding through the rewrite (and optional second pass)."""
    evidence = str(finding.get("evidence", ""))
    present_after_first = _contains(rewrite, evidence)
    acted_first = not present_after_first
    present_after_second: bool | None = None
    change_survived: bool | None = None
    if second_rewrite is not None:
        present_after_second = _contains(second_rewrite, evidence)
        if acted_first:
            # A first-pass removal "survives" if the phrase was not reintroduced.
            change_survived = not present_after_second
        else:
            # Not acted in pass 1; the second pass may still remove it.
            change_survived = not present_after_second
    return {
        "family": finding.get("family"),
        "severity": finding.get("severity"),
        "evidence": evidence,
        "source_span": {"start": finding.get("start"), "end": finding.get("end")},
        "acted_in_first_pass": acted_first,
        "present_after_first_pass": present_after_first,
        "rewrite_span_if_unacted": _find(rewrite, evidence) if present_after_first else None,
        "present_after_second_pass": present_after_second,
        "first_pass_change_survived_second_pass": change_survived,
    }


def trace_findings(
    findings: Iterable[dict[str, object]],
    rewrite: str,
    second_rewrite: str | None = None,
) -> list[dict[str, object]]:
    return [trace_finding(finding, rewrite, second_rewrite) for finding in findings]


def summarize_traces(traces: Iterable[dict[str, object]]) -> dict[str, dict[str, object]]:
    """Aggregate traces by feature family for the ranked-family analysis."""
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"findings": 0, "acted": 0, "survived": 0, "scored_survival": 0})
    for trace in traces:
        family = str(trace.get("family", "unknown"))
        bucket = buckets[family]
        bucket["findings"] += 1
        if trace.get("acted_in_first_pass"):
            bucket["acted"] += 1
        survived = trace.get("first_pass_change_survived_second_pass")
        if survived is not None:
            bucket["scored_survival"] += 1
            if survived:
                bucket["survived"] += 1
    summary: dict[str, dict[str, object]] = {}
    for family, bucket in buckets.items():
        findings = bucket["findings"]
        scored = bucket["scored_survival"]
        summary[family] = {
            "findings": findings,
            "acted": bucket["acted"],
            "action_rate": round(bucket["acted"] / findings, 4) if findings else 0.0,
            "survived": bucket["survived"],
            "survival_rate": round(bucket["survived"] / scored, 4) if scored else None,
        }
    return summary
