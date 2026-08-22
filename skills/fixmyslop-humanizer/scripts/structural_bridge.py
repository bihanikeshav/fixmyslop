#!/usr/bin/env python3
"""Repetition-only structural-findings bridge (hardened; experimental).

Scope reduced to ONE evidenced target — lexical/phrasal repetition (4-gram) — for the preregistered
Beemo holdout. Clause and formulaic channels and the unvalidated positive-direction template are
removed. Correctness guards: it fires only for the validated corpus (Beemo), only when the
source-state-conditioned model (leave-one-out) predicts a confident reduce direction, only when a
repeated 4-gram is found by boundary-safe token matching, and only when a rework span free of protected
anchors (numbers, names, AND qualification/hedge tokens like "may") exists — otherwise it selects
another occurrence or suppresses. Default-off in the pipeline: absent an explicit request the output is
byte-identical v1.
"""
from __future__ import annotations

import re
from collections import Counter

from human_edit_grounded import feature_vector

_WORD = re.compile(r"[A-Za-z0-9']+")
_SENT = re.compile(r"[^.!?]*[.!?]+|\S[^.!?]*$")

# Only corpora where the repetition bridge is validated may fire. Genre INFERENCE cannot distinguish
# Beemo from LAMP (both infer "general prose"), so we gate on the fitted model's corpus tag instead.
SUPPORTED_CORPORA = {"Beemo"}

REPETITION = {
    "family": "lexical_phrasal_repetition", "feature": "4_gram_repetition",
    "reduce": ("Two passages repeat the four-word phrasing \"{ev}\". Rework the instance in the marked "
               "sentence to remove the echo; preserve the underlying claim and any protected terms "
               "(names, numbers, hedges such as \"may\")."),
}


def _tok(s):
    return _WORD.findall(s.lower())


def _subseq(hay, needle):
    """Boundary-safe: is token list `needle` a contiguous run inside token list `hay`?"""
    n = len(needle)
    if not n or n > len(hay):
        return False
    return any(hay[i:i + n] == needle for i in range(len(hay) - n + 1))


def _sentences(text):
    return [s.strip() for s in _SENT.findall(text) if s.strip()]


def _anchor_token_lists(content_map):
    out = []
    for a in (content_map or {}).get("hard_anchors", []):
        toks = _tok(str(a.get("text", "")))
        if toks:
            out.append(toks)
    return out


def _sentence_has_anchor(sent, anchor_tok_lists):
    st = _tok(sent)
    return any(_subseq(st, at) for at in anchor_tok_lists)


def _top_repeated_4gram(sents, anchor_tok_lists):
    """Most frequent repeated 4-gram (boundary-safe) that is not itself part of a protected anchor.
    Returns (phrase, occurrence_sentence_indices) or (None, None)."""
    per_sent = [_tok(s) for s in sents]
    all_tokens = [t for st in per_sent for t in st]
    grams = Counter(tuple(all_tokens[i:i + 4]) for i in range(len(all_tokens) - 3))
    for gram, c in grams.most_common():
        if c < 2:
            break
        glist = list(gram)
        if any(_subseq(at, glist) or _subseq(glist, at) for at in anchor_tok_lists):
            continue  # the repeated phrase overlaps an anchor — don't touch it
        hits = [i for i, st in enumerate(per_sent) if _subseq(st, glist)]
        if len(hits) >= 2:
            return " ".join(glist), hits
    return None, None


def structural_findings(source, rid, model, content_map, families=("repetition",), max_total=1):
    """Return up to `max_total` repetition findings (source-state-gated, anchor-guarded) plus an audit
    dict recording every decision. `rid` is excluded from the population model (leave-one-out)."""
    if model is None:
        return [], {"fired": [], "skipped": [{"family": "repetition", "reason": "no_model"}]}
    if "repetition" not in families:
        return [], {"fired": [], "skipped": [{"family": "repetition", "reason": "not_requested"}]}
    corpus = getattr(model, "corpus", None)
    if corpus not in SUPPORTED_CORPORA:
        return [], {"fired": [], "skipped": [{"family": "repetition", "reason": f"genre_not_supported:{corpus}"}]}

    feat = REPETITION["feature"]
    fv = feature_vector(source)
    label, level = model.consensus(feat, fv.get(feat, 0.0), exclude_rid=rid)
    if label != "neg":   # only the evidenced reduce direction
        return [], {"fired": [], "skipped": [{"family": "repetition", "feature": feat,
                                              "reason": f"direction_not_reduce:{label}"}]}
    sents = _sentences(source)
    anchors = _anchor_token_lists(content_map)
    phrase, hits = _top_repeated_4gram(sents, anchors)
    if not phrase:
        return [], {"fired": [], "skipped": [{"family": "repetition", "feature": feat,
                                              "reason": "no_clean_repeated_4gram"}]}
    # anchor-overlap guard: rework only a sentence free of protected anchors; else suppress
    clean = [i for i in hits if not _sentence_has_anchor(sents[i], anchors)]
    if not clean:
        return [], {"fired": [], "skipped": [{"family": "repetition", "feature": feat, "spans": hits,
                                              "reason": "all_occurrences_anchor_overlap"}]}
    rework = clean[-1]
    finding = {"family": REPETITION["family"], "severity": 1, "evidence": phrase,
               "action": REPETITION["reduce"].format(ev=phrase), "structural": True,
               "target_feature": feat, "predicted_direction": "neg", "confidence_level": level,
               "spans": [rework], "repeated_at": hits}
    audit = {"fired": [{"family": "repetition", "feature": feat, "direction": "neg", "level": level,
                        "rework_span": rework, "repeated_at": hits, "evidence": phrase[:80],
                        "anchor_guarded": len(clean) < len(hits)}], "skipped": []}
    return [finding][:max_total], audit
