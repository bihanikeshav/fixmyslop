#!/usr/bin/env python3
"""High-precision expendable-content deletion bridge (experimental).

Emits at most two SPAN-LOCAL deletion findings, only for four validated-safe categories
(ai_framing, pleasantry, attribution_filler, ornamental_detail), never for propositions, anchors,
certainty, or ambiguous content. Reuses the corrected deletion-scorer detectors. Preservation
philosophy, anchor/claim/certainty protection are untouched. Default-off in the pipeline.
"""
from __future__ import annotations

import re

from edit_operations import _sents, _toks

# reuse the corrected scorer's framing regex so detection == classification
try:
    from delete_scorer import FRAMING_RE  # type: ignore
except Exception:
    FRAMING_RE = re.compile(r"^\s*(?:sure|certainly|of course)[.!,:]?|^\s*here(?:'s| is| are)\b"
                            r"|^\s*here's a (?:quick )?(?:summary|overview|breakdown|list)\b"
                            r"|^\s*the following (?:tips|steps|points)\b|^\s*below (?:is|are)\b", re.I)
# CLOSING pleasantries only — openers like "I am writing to" prefix substantive content and are excluded.
PLEASANTRY = ("thank you", "thanks", "i look forward", "i appreciate", "greatly appreciate",
              "best regards", "sincerely", "warm regards", "kind regards", "feel free",
              "don't hesitate", "i eagerly await", "hope this helps", "i hope this helps")

CATS = ["ai_framing", "pleasantry", "attribution_filler", "ornamental_detail"]  # confidence order
ORNAMENTAL = {"very", "really", "truly", "quite", "incredibly", "remarkably", "extremely", "highly",
              "absolutely", "completely", "utterly", "deeply", "simply", "literally", "totally",
              "entirely", "thoroughly", "exceptionally", "immensely", "tremendously"}
ATTR_RE = re.compile(r"\b(?:according to (?:the )?(?:text|passage|article|excerpt|document|author)|"
                     r"based on (?:the )?(?:text|passage|provided text))\b", re.I)
INSTR = {
    "ai_framing": "Remove this AI framing/preamble and begin directly with the substantive content. Change nothing else.",
    "pleasantry": "Remove this closing pleasantry; it carries no substantive content. Change nothing else.",
    "attribution_filler": "Remove this attribution filler and state the fact directly. Change nothing else.",
    "ornamental_detail": "Remove this ornamental intensifier; it adds no information. Change nothing else.",
}


def _anchor_texts(content_map):
    return [str(a.get("text", "")) for a in (content_map or {}).get("hard_anchors", []) if a.get("text")]


def _subseq(hay, needle):
    n = len(needle)
    return n > 0 and n <= len(hay) and any(hay[i:i + n] == needle for i in range(len(hay) - n + 1))


def _overlaps_anchor(span, anchor_texts):
    st = _toks(span)
    return any(_subseq(st, _toks(a)) for a in anchor_texts if a.strip())


def _candidates(source, anchors):
    """Yield (category, span_text, sentence_index) in priority order, gated against anchors."""
    sents = _sents(source)
    out = []
    # ai_framing: short preamble sentence, no hard anchor
    for i, s in enumerate(sents):
        if FRAMING_RE.search(s) and (s.rstrip().endswith(":") or len(_toks(s)) <= 15) and not _overlaps_anchor(s, anchors):
            out.append(("ai_framing", s[:160], i)); break
    # pleasantry: closing sentence dominated by the pleasantry (little residual content), no hard anchor
    for i, s in enumerate(sents):
        sl = s.lower()
        hit = next((p for p in PLEASANTRY if p in sl), None)
        if hit and len(_toks(s)) <= 20 and not _overlaps_anchor(s, anchors):
            residual = [w for w in _toks(sl.replace(hit, " ")) if len(w) > 3]
            if len(residual) <= 4:                    # sentence is mostly the pleasantry, not substantive
                out.append(("pleasantry", s[:160], i)); break
    # attribution_filler: an attributive phrase (span = the phrase only)
    m = ATTR_RE.search(source)
    if m and not _overlaps_anchor(m.group(0), anchors):
        out.append(("attribution_filler", m.group(0), -1))
    # ornamental_detail: a standalone intensifier adverb, not part of an anchor
    for i, s in enumerate(sents):
        toks = _toks(s)
        for t in toks:
            if t in ORNAMENTAL and not _overlaps_anchor(t, anchors):
                out.append(("ornamental_detail", t, i)); break
        if out and out[-1][0] == "ornamental_detail":
            break
    return out


def expendable_findings(source, content_map, families=("ai_framing", "pleasantry", "attribution_filler",
                                                       "ornamental_detail"), max_total=2):
    """Return up to max_total span-local expendable-deletion findings (+ audit). Gate: category allowed,
    no anchor overlap (checked in _candidates), non-propositional, no certainty change (categories are
    inherently non-factual/non-epistemic)."""
    anchors = _anchor_texts(content_map)
    fired, skipped, out = [], [], []
    picked = set()
    for cat, span, idx in _candidates(source, anchors):
        if cat not in families:
            skipped.append({"category": cat, "reason": "not_requested"}); continue
        if cat in picked:
            continue
        if len(out) >= max_total:
            skipped.append({"category": cat, "reason": "cap_reached"}); continue
        out.append({"family": f"expendable_{cat}", "severity": 1, "evidence": span,
                    "action": INSTR[cat], "expendable": True, "category": cat, "span_sentence": idx})
        fired.append({"category": cat, "span": span[:80], "sentence": idx})
        picked.add(cat)
    return out, {"fired": fired, "skipped": skipped}
