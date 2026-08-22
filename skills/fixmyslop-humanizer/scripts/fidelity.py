#!/usr/bin/env python3
"""Conservative, exact-preservation checks for rewrite candidates."""

from __future__ import annotations

import re
from collections import Counter
from typing import Iterable

from anchors import audit_anchor_coverage, extract_source_content_map
from humanstats import protected_spans, words, lemma


URL_RE = re.compile(r"https?://[^\s)]+|www\.[^\s)]+", re.I)
NUMBER_RE = re.compile(r"(?<![A-Za-z])\d+(?:[.,]\d+)*(?:%|[A-Za-z]+)?")
DATE_RE = re.compile(r"\b(?:19|20)\d{2}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+(?:19|20)\d{2}\b", re.I)
CAP_RUN_RE = re.compile(r"\b[A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,3}")


def _unique(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _presence_check(name: str, values: Iterable[str], revised: str) -> dict[str, object]:
    values = _unique(value for value in values if value.strip())
    missing = [value for value in values if value not in revised]
    return {"name": name, "required": values, "missing": missing, "passed": not missing}


def _content_jaccard(original: str, revised: str) -> float:
    left = {lemma(token) for token in words(original) if len(token) > 2}
    right = {lemma(token) for token in words(revised) if len(token) > 2}
    union = left | right
    return round(len(left & right) / len(union), 4) if union else 1.0


def audit(
    original: str,
    revised: str,
    protected: Iterable[str] | None = None,
    content_map: dict[str, object] | None = None,
) -> dict[str, object]:
    """Return exact-preservation checks and conservative drift indicators."""
    supplied_protected = protected is not None
    protected_values = list(protected or [])
    if not protected_values:
        protected_values = [original[start:end] for start, end in protected_spans(original)]
    source_map = content_map or extract_source_content_map(original, protected_values if supplied_protected else None)
    anchor_result = audit_anchor_coverage(source_map, revised)
    checks = [
        _presence_check("protected_spans", protected_values, revised),
        _presence_check("urls", URL_RE.findall(original), revised),
        _presence_check("dates", DATE_RE.findall(original), revised),
        _presence_check("numbers", NUMBER_RE.findall(original), revised),
        {
            "name": "hard_anchors",
            "required": [str(anchor["text"]) for anchor in source_map.get("hard_anchors", [])],
            "missing": [str(row["text"]) for row in anchor_result["missing"]],
            "modified_or_underrepresented": anchor_result["modified_or_underrepresented"],
            "passed": bool(anchor_result["passed"]),
        },
    ]
    # A benchmark fixture may supply an explicit entity list. In that mode, avoid
    # treating sentence-initial words such as "Great" or "Welcome" as entities.
    if not supplied_protected:
        checks.append(_presence_check("capitalized_entities", (match.group(0) for match in CAP_RUN_RE.finditer(original) if len(match.group(0)) > 1), revised))
    passed = sum(bool(check["passed"]) for check in checks)
    exact_score = round(100 * passed / len(checks), 2) if checks else 100.0
    char_delta = len(revised) - len(original)
    word_delta = len(words(revised)) - len(words(original))
    return {
        "fidelity_version": "0.1.0",
        "passed": all(bool(check["passed"]) for check in checks),
        "exact_check_score": exact_score,
        "checks": checks,
        "hard_anchor_coverage": anchor_result,
        "content_word_jaccard": _content_jaccard(original, revised),
        "char_delta": char_delta,
        "word_delta": word_delta,
        "rewrite_ratio": round(len(revised) / len(original), 4) if original else 1.0,
        "drift_flags": [
            flag for flag, condition in (
                ("large_length_increase", len(original) > 0 and len(revised) > len(original) * 1.75),
                ("large_length_decrease", len(original) > 0 and len(revised) < len(original) * 0.45),
                ("low_content_overlap", _content_jaccard(original, revised) < 0.55),
            ) if condition
        ],
    }
