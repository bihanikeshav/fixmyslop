#!/usr/bin/env python3
"""Empirical slop-overrepresentation scanning (Antislop-style).

Antislop (Oct 2025) identifies words / bigrams / trigrams / rhetorical constructions that
are statistically overrepresented in a model's writing versus a human baseline, via
rho(p) = f_LLM(p) / f_human(p). This module ports the *pattern-profile + scoring* portion
only: it flags overrepresented constructions weighted by rho, as `review_in_context`
evidence -- never bans. Blunt token banning caused the collateral damage the paper warns
about; a post-generation rewriter should flag statistically suspicious spans, then rewrite
contextually.

Not ported: their backtracking sampler and FTPO (both need logit/weight access and heavy
inference overhead; this skill runs on arbitrary host models).

The profile is genre- and model-aware and is meant to be replaced by a slop-forensics-derived,
genre-conditioned table. See slop_profile.json for provenance.
"""

from __future__ import annotations

import json
import math
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from humanstats import STOPWORDS, WORD_RE, in_spans, lemma, protected_spans, words

PROFILE_PATH = Path(__file__).with_name("slop_profile.json")

# confidence -> severity, so high-confidence slop can reach the gated second scan.
_CONFIDENCE_SEVERITY = {"high": 2, "medium": 1, "low": 1}


@lru_cache(maxsize=4)
def load_profile(path: str | None = None) -> dict[str, object]:
    return json.loads(Path(path or PROFILE_PATH).read_text(encoding="utf-8"))


def resolve_profile(
    genre: str | None = None,
    source_model: str | None = None,
    path: str | None = None,
) -> dict[str, object]:
    """Effective profile: cross-model consensus by default, with genre exemptions applied
    and (when known) a source-model/family overlay."""
    base = load_profile(path)
    unigrams = dict(base.get("unigrams", {}))
    override = (base.get("genre_overrides", {}) or {}).get(str(genre), {}) if genre else {}
    for word in override.get("exempt_unigrams", []):
        unigrams.pop(word, None)
    model_families = ((base.get("model_profiles", {}) or {}).get("families", {}) or {})
    model_overlay = model_families.get(str(source_model), {}) if source_model else {}
    for word, rho in (model_overlay.get("unigrams", {}) or {}).items():
        unigrams[word] = float(rho)
    return {
        "profile_version": base.get("profile_version"),
        "profile_id": f"{base.get('profile_version')}|genre={genre or 'none'}|model={source_model or 'consensus'}",
        "unigrams": unigrams,
        "bigrams": dict(base.get("bigrams", {})),
        "trigrams": dict(base.get("trigrams", {})),
        "templates": list(base.get("templates", [])),
        "default_action": base.get("default_action", "review_in_context"),
    }


def _weight(rho: float) -> float:
    return round(math.log2(rho), 4) if rho > 1 else 0.0


def _content_tokens(text: str) -> list[tuple[str, int, int]]:
    """Non-stopword, non-digit tokens as (lemma, start, end), for n-gram matching."""
    out: list[tuple[str, int, int]] = []
    for match in WORD_RE.finditer(text):
        token = match.group(0)
        lem = lemma(token)
        if lem in STOPWORDS or token.isdigit():
            continue
        out.append((lem, match.start(), match.end()))
    return out


def _finding(subtype, evidence, start, end, rho, confidence, action, profile_id, pattern_id=None):
    return {
        "family": "slop_overrepresentation",
        "subtype": subtype,
        "pattern_id": pattern_id if pattern_id is not None else str(evidence).lower(),
        "severity": _CONFIDENCE_SEVERITY.get(confidence, 1),
        "start": start,
        "end": end,
        "evidence": evidence,
        "overrepresentation": round(float(rho), 4),
        "weight": _weight(float(rho)),
        "confidence": confidence,
        "action": action,
        "message": f"{subtype} overrepresented ~{float(rho):.1f}x vs human baseline; rewrite in context if it does not serve the genre",
        "profile_id": profile_id,
    }


def scan(text: str, genre: str | None = None, source_model: str | None = None, profile: dict | None = None) -> list[dict[str, object]]:
    """Return overrepresentation findings, skipping protected spans (code/URL/quotes)."""
    profile = profile or resolve_profile(genre, source_model)
    pid = str(profile.get("profile_id"))
    protected = protected_spans(text)
    action = str(profile.get("default_action", "review_in_context"))
    findings: list[dict[str, object]] = []

    unigrams = profile.get("unigrams", {})
    for match in WORD_RE.finditer(text):
        token = match.group(0)
        if in_spans(match.start(), match.end(), protected):
            continue
        key = token.lower() if token.lower() in unigrams else (lemma(token) if lemma(token) in unigrams else None)
        if key is not None:
            findings.append(_finding("unigram", token, match.start(), match.end(), unigrams[key], "medium", action, pid, pattern_id=key))

    content = _content_tokens(text)
    for size, table in ((2, profile.get("bigrams", {})), (3, profile.get("trigrams", {}))):
        if not table:
            continue
        for i in range(len(content) - size + 1):
            window = content[i : i + size]
            phrase = " ".join(tok for tok, _, _ in window)
            if phrase in table:
                start, end = window[0][1], window[-1][2]
                if in_spans(start, end, protected):
                    continue
                findings.append(_finding(f"{size}gram", text[start:end], start, end, table[phrase], "high", action, pid, pattern_id=phrase))

    for template in profile.get("templates", []):
        regex = template.get("regex")
        if not regex:
            continue
        for match in re.finditer(regex, text):
            if in_spans(match.start(), match.end(), protected):
                continue
            findings.append(_finding(
                template.get("type", "rhetorical_template"),
                match.group(0), match.start(), match.end(),
                template.get("overrepresentation", 2.0),
                str(template.get("confidence", "medium")),
                str(template.get("action", action)), pid,
                pattern_id=str(template.get("id", template.get("pattern", "template"))),
            ))

    findings.sort(key=lambda f: (f["start"], -float(f["weight"])))
    return findings


def actionable_slop(findings: Iterable[dict[str, object]]) -> list[dict[str, object]]:
    """High-confidence slop only (n-grams / templates), for host-facing rewrite guidance.

    The judged smoke (ANTISLOP_SMOKE.md) showed that surfacing medium-confidence single-word
    flags to the host induces unnecessary edits that hurt naturalness on already-clean,
    register-sensitive genres. Medium-confidence unigrams stay diagnostic; only high-confidence
    constructions drive edits -- consistent with Antislop's collateral-damage warning.
    """
    return [f for f in findings if f.get("confidence") == "high"]


def weighted_density(text: str, findings: Iterable[dict[str, object]] | None = None, genre: str | None = None, source_model: str | None = None) -> float:
    """Weighted overrepresented-pattern density per 1,000 tokens."""
    findings = list(findings) if findings is not None else scan(text, genre, source_model)
    tokens = max(len(words(text)), 1)
    return round(sum(float(f["weight"]) for f in findings) / tokens * 1000, 4)


def slop_pattern_suppression(source: str, rewrite: str, genre: str | None = None, source_model: str | None = None) -> dict[str, object]:
    """Slop Pattern Suppression (SPS): weighted reduction in overrepresented-pattern density.

    Secondary metric only. A system can suppress slop while damaging quality/diversity, so
    SPS must never rank systems on its own.
    """
    src = scan(source, genre, source_model)
    rw = scan(rewrite, genre, source_model)
    src_density = weighted_density(source, src)
    rw_density = weighted_density(rewrite, rw)
    src_keys = _pattern_multiset(src)
    rw_keys = _pattern_multiset(rw)
    removed = sorted((src_keys - rw_keys).keys())
    residual = sorted((src_keys & rw_keys).keys()) if hasattr(src_keys, "__and__") else []
    introduced = sorted((rw_keys - src_keys).keys())
    return {
        "source_weighted_density": src_density,
        "rewrite_weighted_density": rw_density,
        "absolute_reduction": round(src_density - rw_density, 4),
        "relative_reduction": round((src_density - rw_density) / src_density, 4) if src_density > 0 else 0.0,
        "source_pattern_count": len(src),
        "rewrite_pattern_count": len(rw),
        "removed_patterns": removed[:40],
        "residual_patterns": residual[:40],
        "introduced_patterns": introduced[:40],
    }


def _pattern_multiset(findings: Iterable[dict[str, object]]):
    from collections import Counter

    return Counter(str(f.get("evidence", "")).lower() for f in findings)
