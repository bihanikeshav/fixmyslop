#!/usr/bin/env python3
"""Source-content mapping and hard-anchor coverage checks.

The map separates information that must survive a rewrite from expression that the
host model may reorganize.  It is intentionally heuristic and auditable rather than
pretending to solve full semantic entailment locally.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Iterable

from humanstats import protected_spans


ANCHOR_VERSION = "0.2.0"

URL_RE = re.compile(r"https?://[^\s)]+|www\.[^\s)]+", re.I)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.\w+\b")
DATE_RE = re.compile(
    r"\b(?:19|20)\d{2}(?:[-/]\d{1,2}(?:[-/]\d{1,2})?)?\b|"
    r"\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)\s+\d{1,2}(?:,?\s+(?:19|20)\d{2})?\b",
    re.I,
)
NUMBER_RE = re.compile(
    r"(?<![A-Za-z])(?:[$€£₹]\s*)?\d[\d,]*(?:\.\d+)?(?:\s*%|-[A-Za-z]+)?(?![A-Za-z])"
)
CITATION_RE = re.compile(r"\[[0-9]{1,3}(?:\s*,\s*[0-9]{1,3})*\]|\([A-Z][^()\n]{0,80}\b(?:19|20)\d{2}[a-z]?\)")
QUOTE_RE = re.compile(r'"[^"\n]+"|(?<![A-Za-z])\'[^\'\n]+\'(?![A-Za-z])|“[^”\n]+”|‘[^’\n]+’')
QUALIFIER_RE = re.compile(
    r"(?i)\b(?:may|might|could|likely|unlikely|possibly|probably|approximately|"
    r"at least|up to|more than|fewer than|unless|according to|no evidence|"
    r"not necessarily)\b"
)
CAUSAL_RE = re.compile(
    r"(?i)\b(?:because|due to|led to|caused|resulted in|contributed to|"
    r"after receiving|following|associated with|correlated with|as a result)\b"
)
UI_RE = re.compile(
    r"`[^`\n]+`|--[A-Za-z0-9_-]+|\b(?:GET|POST|PUT|PATCH|DELETE)\s+/[^\s,.;]+|"
    r"\b[A-Z][A-Z0-9_]{2,}\b|@[A-Za-z0-9_]+|#[A-Za-z0-9_-]+"
)
CAP_RUN_RE = re.compile(r"\b[A-Z][A-Za-z0-9&-]*(?:\.[A-Za-z0-9&-]+)*(?:\s+[A-Z][A-Za-z0-9&-]*(?:\.[A-Za-z0-9&-]+)*){0,3}")

COMMON_CAPITALIZED = {
    "The", "This", "That", "These", "Those", "Your", "Our", "My", "In", "At", "As", "If", "While",
    "And", "But", "For", "From", "Overall", "Getting Started", "Welcome", "Great",
    "Honestly", "Certainly", "Anyway", "Rating", "Section", "Monday", "Tuesday",
    "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
}


def _find(text: str, regex: re.Pattern[str]) -> list[dict[str, object]]:
    return [{"text": match.group(0), "start": match.start(), "end": match.end()} for match in regex.finditer(text)]


def _unique_anchor(anchors: list[dict[str, object]], seen: set[str], kind: str, item: dict[str, object], reason: str, required: bool = True) -> None:
    value = str(item["text"])
    key = value
    if not value.strip() or key in seen:
        return
    seen.add(key)
    anchors.append({
        "kind": kind,
        "text": value,
        "start": int(item.get("start", -1)),
        "end": int(item.get("end", -1)),
        "required": required,
        "reason": reason,
    })


def _explicit_items(text: str, values: Iterable[str] | None) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    for value in values or []:
        value = str(value)
        start = text.find(value)
        if value and start >= 0:
            items.append({"text": value, "start": start, "end": start + len(value)})
    return items


def extract_source_content_map(text: str, explicit_protected: Iterable[str] | None = None) -> dict[str, object]:
    """Extract hard anchors and editable target regions from source text."""
    spans = protected_spans(text)
    anchors: list[dict[str, object]] = []
    seen: set[str] = set()

    for item in _explicit_items(text, explicit_protected):
        _unique_anchor(anchors, seen, "explicit_protected", item, "fixture or caller-declared protected content")
    for start, end in spans:
        _unique_anchor(anchors, seen, "protected_span", {"text": text[start:end], "start": start, "end": end}, "code, URL, identifier, or quotation protection")
    for kind, regex, reason in (
        ("url", URL_RE, "URL must remain reachable"),
        ("email", EMAIL_RE, "contact address must remain reachable"),
        ("date", DATE_RE, "date or versioned time anchor"),
        ("number", NUMBER_RE, "numeric or measured-result anchor"),
        ("citation", CITATION_RE, "citation marker or author-year reference"),
        ("quotation", QUOTE_RE, "quotation content should remain exact"),
        ("qualification", QUALIFIER_RE, "qualification changes claim strength"),
        ("causal_relationship", CAUSAL_RE, "causal or correlational relation changes meaning"),
        ("ui_or_command", UI_RE, "UI label, command, route, mention, or structured identifier"),
    ):
        for item in _find(text, regex):
            _unique_anchor(anchors, seen, kind, item, reason)

    sentence_starts = {match.start() for match in re.finditer(r"(?:^|[.!?\n])\s*", text)}
    for item in _find(text, CAP_RUN_RE):
        value = str(item["text"])
        if value in COMMON_CAPITALIZED or len(value.split()) == 1 and value in COMMON_CAPITALIZED:
            continue
        if value.split()[0] in {"The", "This", "That", "These", "Those", "Your", "Our", "My"}:
            continue
        if int(item["start"]) in sentence_starts and len(value.split()) == 1:
            continue
        if len(value) >= 3 and (len(value.split()) >= 2 or any(char.isdigit() for char in value)):
            _unique_anchor(anchors, seen, "named_entity", item, "named entity or product name")

    for anchor in anchors:
        anchor["occurrence_count"] = text.count(str(anchor["text"]))
    anchors.sort(key=lambda item: (int(item["start"]), str(item["kind"]), str(item["text"])))

    editable: list[dict[str, object]] = []
    cursor = 0
    for start, end in spans:
        if cursor < start and text[cursor:start].strip():
            editable.append({"start": cursor, "end": start, "text": text[cursor:start], "editable": True})
        cursor = max(cursor, end)
    if cursor < len(text) and text[cursor:].strip():
        editable.append({"start": cursor, "end": len(text), "text": text[cursor:], "editable": True})

    kinds = Counter(str(anchor["kind"]) for anchor in anchors)
    return {
        "anchor_version": ANCHOR_VERSION,
        "hard_anchor_count": len(anchors),
        "hard_anchors": anchors,
        "hard_anchor_kinds": dict(kinds),
        "protected_span_count": len(spans),
        "protected_spans": [{"start": start, "end": end, "text": text[start:end]} for start, end in spans],
        "editable_target_count": len(editable),
        "editable_targets": editable,
        "soft_expression": {
            "editable": ["wording", "ordering", "sentence structure", "rhetorical framing", "tone", "paragraph boundaries"],
            "instruction": "The host model may revise these when the pragmatic profile supports it, while preserving hard anchors and source certainty.",
        },
    }


def audit_anchor_coverage(content_map: dict[str, object], revised: str) -> dict[str, object]:
    """Check exact presence and occurrence counts for every hard anchor."""
    missing: list[dict[str, object]] = []
    modified: list[dict[str, object]] = []
    covered: list[dict[str, object]] = []
    for anchor in content_map.get("hard_anchors", []):
        value = str(anchor["text"])
        required_count = int(anchor.get("occurrence_count", 1))
        actual_count = revised.count(value)
        row = {"kind": anchor["kind"], "text": value, "required_count": required_count, "actual_count": actual_count}
        if actual_count == 0:
            missing.append(row)
        elif actual_count < required_count:
            modified.append(row)
        else:
            covered.append(row)
    return {
        "anchor_version": ANCHOR_VERSION,
        "passed": not missing and not modified,
        "required_count": len(content_map.get("hard_anchors", [])),
        "covered_count": len(covered),
        "missing": missing,
        "modified_or_underrepresented": modified,
    }
