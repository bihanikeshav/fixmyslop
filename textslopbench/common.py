#!/usr/bin/env python3
"""Shared helpers extracted from duplicated copies across textslopbench scripts (audit fix).

Consolidates:
  - `parse_human_references`: the `human_references` field parser that was copy-pasted,
    byte-identical, into chea.py, human_edit_grounded.py, human_edit_propensity.py,
    multiref_check.py, residual_estimator.py, and voice_drift.py (and already existed,
    separately, as `_refs` in policy_smoke.py, which is left as-is since it was not part
    of the audited duplicate set).
  - `jaccard`: the token-set Jaccard similarity duplicated in edit_operations.py,
    delete_scorer.py, and delete_decomposition.py. Takes a `tokenize` callable so it has
    no dependency on any single script's tokenizer.

Scripts here are run as flat scripts (`python textslopbench/x.py`) and imported by tests
with `textslopbench/` on `sys.path` — `import common` works in both cases because it sits
in the same directory.
"""
from __future__ import annotations

import ast
import json


def parse_human_references(raw):
    """Parse a `human_references` field that may already be a list, a JSON-encoded list,
    a Python-literal-encoded list, or a bare string. Returns a list (possibly empty)."""
    if isinstance(raw, list):
        return raw
    for parser in (json.loads, ast.literal_eval):
        try:
            val = parser(raw)
            if isinstance(val, list):
                return val
        except Exception:
            pass
    return [raw] if isinstance(raw, str) and raw.strip() else []


def resolve_system_for_text(group: dict, text: str):
    """Return the single system in `group` (a system-name -> output-text mapping) whose
    output text exactly equals `text`, or None if zero or MORE THAN ONE system match.

    Recovering "which system produced the A/B text" by exact string match silently
    misattributes when two systems emit identical text (audit fix, textslopbench item 10)
    — this makes that ambiguity explicit instead of picking `next()`'s first match."""
    matches = [system for system, candidate in group.items() if candidate == text]
    return matches[0] if len(matches) == 1 else None


def jaccard(a: str, b: str, tokenize) -> float:
    """Token-set Jaccard similarity between strings `a` and `b`, using the caller-supplied
    `tokenize(str) -> Iterable[str]` function so this has no dependency on any one script's
    tokenizer/stopword choices."""
    sa, sb = set(tokenize(a)), set(tokenize(b))
    return len(sa & sb) / len(sa | sb) if (sa or sb) else 0.0
