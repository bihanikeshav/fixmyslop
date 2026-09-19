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
MONTH_PATTERN = (
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)"
)
# Month names are intentionally case-sensitive. This recognizes conventional
# dates, including day-first dates, without treating the lowercase modal "may"
# as a month.
DATE_RE = re.compile(
    rf"\b(?:19|20)\d{{2}}(?:[-/]\d{{1,2}}(?:[-/]\d{{1,2}})?)?\b|"
    rf"\b{MONTH_PATTERN}\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+(?:19|20)\d{{2}})?\b|"
    rf"\b\d{{1,2}}(?:st|nd|rd|th)?\s+{MONTH_PATTERN}(?:\s+(?:19|20)\d{{2}})?\b"
)
NEGATION_RE = re.compile(r"(?i)\b(?:not|never|no|neither|nor|without|cannot|can't|won't|didn't|doesn't|isn't|aren't|wasn't|weren't)\b")
CAUSALITY_RE = re.compile(r"(?i)\b(?:because|due to|caused|led to|resulted in|contributed to|as a result of)\b")
RANGE_NUMBER = r"(?:[$€£₹]\s*)?\d[\d,]*(?:\.\d+)?(?:\s*(?:%|[A-Za-z]+))?"
FROM_TO_RANGE_RE = re.compile(
    rf"(?i)\bfrom\s+(?P<start>{RANGE_NUMBER})\s+to\s+(?P<end>{RANGE_NUMBER})"
)
DASH_RANGE_RE = re.compile(
    rf"(?<![\w/])(?P<start>{RANGE_NUMBER})\s*[–—-]\s*(?P<end>{RANGE_NUMBER})(?![\w/])"
)
POLARITY_GROUPS = {
    "increase": {"increase", "increased", "increasing", "rise", "rose", "rising", "grow", "grew", "growth", "gain", "gained", "higher"},
    "decrease": {"decrease", "decreased", "decreasing", "fall", "fell", "falling", "drop", "dropped", "decline", "declined", "collapse", "collapsed", "lower"},
    "approve": {"approve", "approved", "accept", "accepted", "allow", "allowed", "permit", "permitted", "pass", "passed"},
    "reject": {"reject", "rejected", "deny", "denied", "forbid", "forbidden", "fail", "failed", "block", "blocked"},
    "success": {"success", "successful", "succeed", "succeeded", "working", "resolved"},
    "failure": {"failure", "failed", "failing", "broken", "unresolved", "error"},
    "before": {"before", "earlier", "prior"},
    "after": {"after", "later", "following"},
    "include": {"include", "includes", "included", "including", "enable", "enabled", "allow", "allowed"},
    "exclude": {"exclude", "excludes", "excluded", "excluding", "disable", "disabled", "omit", "omitted"},
    "more": {"more", "most", "higher", "above", "over"},
    "less": {"less", "least", "lower", "below", "under", "fewer"},
}
OPPOSITES = {
    "increase": "decrease", "decrease": "increase",
    "approve": "reject", "reject": "approve",
    "success": "failure", "failure": "success",
    "before": "after", "after": "before",
    "include": "exclude", "exclude": "include",
    "more": "less", "less": "more",
}
MODALITY_GROUPS = {
    "uncertain": {"may", "might", "could", "possibly", "probably", "likely"},
    "certain": {"will", "definitely", "certainly", "always"},
    "required": {"must", "shall", "required", "mandatory", "need", "needs", "needed"},
    "optional": {"optional", "optionally", "can", "ability"},
}

GREATER_COMPARATIVES = {"more", "higher", "greater", "above", "better", "faster", "larger", "longer", "earlier"}
LESSER_COMPARATIVES = {"less", "fewer", "lower", "smaller", "below", "worse", "slower", "shorter", "later"}
CLAUSE_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "because", "been", "being",
    "by", "did", "do", "does", "due", "for", "from", "had", "has", "have",
    "in", "into", "is", "it", "of", "on", "result", "that", "the", "this",
    "to", "was", "were", "with",
}


def _presence_check(name: str, values: Iterable[str], revised: str) -> dict[str, object]:
    values = [value for value in values if value.strip()]
    required_counts = Counter(values)
    actual_counts = {value: revised.count(value) for value in required_counts}
    missing = [value for value, count in required_counts.items() if actual_counts[value] == 0 and count > 0]
    underrepresented = [
        {"text": value, "required_count": count, "actual_count": actual_counts[value]}
        for value, count in required_counts.items()
        if 0 < actual_counts[value] < count
    ]
    return {
        "name": name,
        "required": list(required_counts),
        "required_counts": dict(required_counts),
        "missing": missing,
        "modified_or_underrepresented": underrepresented,
        "passed": not missing and not underrepresented,
    }


def _content_jaccard(original: str, revised: str) -> float:
    left = {lemma(token) for token in words(original) if len(token) > 2}
    right = {lemma(token) for token in words(revised) if len(token) > 2}
    union = left | right
    return round(len(left & right) / len(union), 4) if union else 1.0


def _masked_dates(text: str) -> str:
    """Blank dates while retaining offsets for token-level checks."""
    chars = list(text)
    for match in DATE_RE.finditer(text):
        chars[match.start():match.end()] = " " * (match.end() - match.start())
    return "".join(chars)


def _modality_groups(text: str) -> set[str]:
    """Return modality groups, excluding dates and the proper name ``May``."""
    tokens = words(_masked_dates(text))
    normalized = {
        token.lower() for token in tokens
        if token != "May"  # month outside a full date, or a person's name
    }
    return {
        name for name, values in MODALITY_GROUPS.items()
        if normalized & values
    }


def _normalized_range_value(value: str) -> str:
    match = re.search(r"\d[\d,]*(?:\.\d+)?", value)
    return match.group(0).replace(",", "") if match else ""


def _numeric_ranges(text: str) -> list[tuple[str, str]]:
    """Extract explicitly ordered numeric ranges, skipping ISO-like dates."""
    date_spans = [(match.start(), match.end()) for match in DATE_RE.finditer(text)]
    ranges: list[tuple[str, str]] = []
    for regex in (FROM_TO_RANGE_RE, DASH_RANGE_RE):
        for match in regex.finditer(text):
            if any(match.start() < end and match.end() > start for start, end in date_spans):
                continue
            start = _normalized_range_value(match.group("start"))
            end = _normalized_range_value(match.group("end"))
            if start != end:
                ranges.append((start, end))
    return ranges


def _numeric_range_reversed(original: str, revised: str) -> bool:
    original_ranges = Counter(_numeric_ranges(original))
    revised_ranges = Counter(_numeric_ranges(revised))
    return any(
        revised_ranges[(end, start)] > original_ranges[(end, start)]
        and revised_ranges[(start, end)] < required
        for (start, end), required in original_ranges.items()
    )


def _claim_terms(clause: str) -> set[str]:
    return {
        lemma(token) for token in words(clause)
        if len(token) > 2 and lemma(token) not in CLAUSE_STOPWORDS
    }


def _causal_relations(text: str) -> list[tuple[set[str], set[str]]]:
    """Extract cause/effect roles from a small set of explicit clause frames."""
    relations: list[tuple[set[str], set[str]]] = []
    for sentence in re.split(r"(?<=[.!?;])\s+|\n+", text):
        sentence = sentence.strip().strip(".!?;")
        if not sentence:
            continue
        leading = re.match(r"(?is)^\s*(?:because|due to)\s+(.+?),\s*(.+)$", sentence)
        if leading:
            cause, effect = leading.group(1), leading.group(2)
        else:
            infix = re.match(r"(?is)^(.+?)\s+(?:because|due to)\s+(.+)$", sentence)
            if infix:
                effect, cause = infix.group(1), infix.group(2)
            else:
                active = re.match(
                    r"(?is)^(.+?)\s+(?:caused|led to|resulted in|contributed to)\s+(.+)$",
                    sentence,
                )
                if not active:
                    continue
                cause, effect = active.group(1), active.group(2)
        cause_terms = _claim_terms(cause)
        effect_terms = _claim_terms(effect)
        if cause_terms and effect_terms:
            relations.append((cause_terms, effect_terms))
    return relations


def _term_coverage(left: set[str], right: set[str]) -> float:
    return len(left & right) / min(len(left), len(right)) if left and right else 0.0


def _causal_direction_reversed(original: str, revised: str) -> bool:
    for source_cause, source_effect in _causal_relations(original):
        for revised_cause, revised_effect in _causal_relations(revised):
            reversed_cause = _term_coverage(source_cause, revised_effect)
            reversed_effect = _term_coverage(source_effect, revised_cause)
            preserved_cause = _term_coverage(source_cause, revised_cause)
            preserved_effect = _term_coverage(source_effect, revised_effect)
            if (
                reversed_cause >= 0.75
                and reversed_effect >= 0.75
                and (preserved_cause < 0.75 or preserved_effect < 0.75)
            ):
                return True
    return False


def _comparative_signature(
    text: str,
    source_map: dict[str, object],
) -> tuple[tuple[str, str], str] | None:
    if not re.search(r"(?i)\bthan\b", text):
        return None
    source_entities = []
    for anchor in source_map.get("hard_anchors", []):
        if anchor.get("kind") == "named_entity":
            value = str(anchor.get("text", ""))
            if value and value.casefold() not in {item.casefold() for item in source_entities}:
                source_entities.append(value)
    positions = []
    for entity in source_entities:
        match = re.search(re.escape(entity), text, flags=re.IGNORECASE)
        if match:
            positions.append((match.start(), entity.casefold()))
    if len(positions) != 2:
        return None
    tokens = {token.lower() for token in words(text)}
    greater = tokens & GREATER_COMPARATIVES
    lesser = tokens & LESSER_COMPARATIVES
    if bool(greater) == bool(lesser):
        return None
    positions.sort()
    direction = "greater" if greater else "less"
    return (positions[0][1], positions[1][1]), direction


def _comparative_change(
    original: str,
    revised: str,
    source_map: dict[str, object],
) -> str | None:
    source = _comparative_signature(original, source_map)
    candidate = _comparative_signature(revised, source_map)
    if source is None or candidate is None:
        return None
    source_order, source_direction = source
    revised_order, revised_direction = candidate
    order_reversed = source_order == tuple(reversed(revised_order))
    direction_reversed = source_direction != revised_direction
    if order_reversed and direction_reversed:
        return "equivalent_inversion"
    if order_reversed != direction_reversed:
        return "reversed"
    return "unchanged"


def _claim_drift_flags(
    original: str,
    revised: str,
    source_map: dict[str, object],
) -> tuple[list[str], str | None]:
    """Catch high-precision minimal claim flips without pretending to be NLI."""
    flags: list[str] = []
    original_negation = len(NEGATION_RE.findall(original))
    revised_negation = len(NEGATION_RE.findall(revised))
    if original_negation != revised_negation:
        flags.append("negation_count_changed")
    if CAUSALITY_RE.search(original) and not CAUSALITY_RE.search(revised):
        flags.append("causal_relation_dropped_or_changed")

    comparative_change = _comparative_change(original, revised, source_map)
    if comparative_change == "reversed":
        flags.append("comparative_direction_reversed")
    if _numeric_range_reversed(original, revised):
        flags.append("numeric_range_reversed")
    if _causal_direction_reversed(original, revised):
        flags.append("causal_direction_reversed")

    original_words = {token.lower() for token in words(original)}
    revised_words = {token.lower() for token in words(revised)}
    original_groups = {name for name, values in POLARITY_GROUPS.items() if original_words & values}
    revised_groups = {name for name, values in POLARITY_GROUPS.items() if revised_words & values}
    for group in original_groups:
        opposite = OPPOSITES[group]
        if comparative_change in {"equivalent_inversion", "reversed"} and group in {"increase", "decrease", "more", "less"}:
            continue
        if opposite in revised_groups and opposite not in original_groups:
            flags.append(f"claim_polarity_flip:{group}_to_{opposite}")
    original_modalities = _modality_groups(original)
    revised_modalities = _modality_groups(revised)
    if original_modalities != revised_modalities and (original_modalities or revised_modalities):
        flags.append("modality_changed")
    return flags, comparative_change


def _entity_order_changed(source_map: dict[str, object], revised: str) -> bool:
    entities = []
    for anchor in source_map.get("hard_anchors", []):
        if anchor.get("kind") == "named_entity":
            value = str(anchor.get("text", ""))
            if value and value not in entities:
                entities.append(value)
    if len(entities) < 2 or any(revised.count(value) == 0 for value in entities):
        return False
    source_order = [value for value in entities]
    revised_order = sorted(entities, key=lambda value: revised.find(value))
    return revised_order != source_order


def audit(
    original: str,
    revised: str,
    protected: Iterable[str] | None = None,
    content_map: dict[str, object] | None = None,
    allow_low_overlap: bool = False,
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
    exact_passed = sum(bool(check["passed"]) for check in checks)
    exact_score = round(100 * exact_passed / len(checks), 2) if checks else 100.0
    char_delta = len(revised) - len(original)
    word_delta = len(words(revised)) - len(words(original))
    content_overlap = _content_jaccard(original, revised)
    drift_flags = [
        flag for flag, condition in (
            ("large_length_increase", len(original) > 0 and len(revised) > len(original) * 1.75),
            ("large_length_decrease", len(original) > 0 and len(revised) < len(original) * 0.45),
            ("low_content_overlap", content_overlap < 0.55),
        ) if condition
    ]
    # Low overlap is a conservative local proxy for claim/actor loss. Length is
    # reported but not blocking by itself because concise rewrites can be valid.
    claim_drift_flags, comparative_change = _claim_drift_flags(original, revised, source_map)
    if comparative_change is None and _entity_order_changed(source_map, revised):
        claim_drift_flags.append("named_entity_order_changed")
    blocking_drift_flags = [
        flag for flag in drift_flags
        if flag == "low_content_overlap" and not allow_low_overlap
    ] + claim_drift_flags
    return {
        "fidelity_version": "0.3.0",
        "passed": all(bool(check["passed"]) for check in checks) and not blocking_drift_flags,
        "exact_check_score": exact_score,
        "checks": checks,
        "hard_anchor_coverage": anchor_result,
        "content_word_jaccard": content_overlap,
        "char_delta": char_delta,
        "word_delta": word_delta,
        "rewrite_ratio": round(len(revised) / len(original), 4) if original else 1.0,
        "drift_flags": drift_flags,
        "blocking_drift_flags": blocking_drift_flags,
        "claim_drift_flags": claim_drift_flags,
    }
