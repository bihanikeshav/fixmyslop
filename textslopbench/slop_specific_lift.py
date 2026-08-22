#!/usr/bin/env python3
"""Slop-Specific Edit Lift (SEL) — separate AI-slop cleanup from ordinary editing.

LAMP gives AI -> human-editor edits; TETRA gives human-draft -> human-editor edits. If humans make
the same correction to human prose as to AI prose, it is ordinary editing, not slop removal.

    SEL(aspect) = P(aspect | AI->editor)  -  P(aspect | human->editor)

High positive SEL = editors disproportionately do this to AI prose (a humanization signal).
Near zero = general editing. Both corpora's edit taxonomies are mapped to a shared aspect space.

Deterministic. No LLM judge.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "textslopbench"))

from adapters import TETRAAdapter
from validate_spans import load_lamp

TETRA_DIR = ROOT / "textslopbench" / "data_raw" / "tetra" / "original"

# LAMP categorization -> shared aspect (TETRA has no cliche/specificity categories; see caveat).
LAMP_ASPECT = {
    "Awkward Word Choice and Phrasing": "WordChoice",
    "Poor Sentence Structure": "Readability",
    "Unnecessary/Redundant Exposition": "Redundancy",
    "Cliche": "Cliche/Ornament",
    "Purple Prose (Unnecessary ornamental and overly verbose)": "Cliche/Ornament",
    "Lack of Specificity and Detail": "Specificity",
    "Tense Inconsistency": "Grammar",
    "Punctuation": "Readability",
    "Capitalization": "Grammar",
    "Factuality": "Grammar",
    "Lacks personality": "Style",
}
# aspects each taxonomy can express at all (absence => can't be tagged, not a true zero)
LAMP_TAXONOMY = set(LAMP_ASPECT.values())
TETRA_TAXONOMY = {"Grammar", "WordChoice", "Clarity", "Style", "Readability", "Redundancy", "Consistency"}


def lamp_aspect_counts(split="test") -> Counter:
    c = Counter()
    for rec in load_lamp():
        if split and rec.get("split") != split:
            continue
        for e in rec.get("fine_grained_edits", []):
            if (e.get("originalText") or "").strip() or (e.get("editedText") or "").strip():
                c[LAMP_ASPECT.get(e.get("categorization", "?"), "Other")] += 1
    return c


def tetra_aspect_counts() -> Counter:
    c = Counter()
    for rec in TETRAAdapter().adapt(TETRA_DIR):
        for e in rec["metadata"]["edits"]:
            for a in e["aspects"]:
                c[a] += 1
    return c


def _shares(counts: Counter) -> dict[str, float]:
    total = sum(counts.values()) or 1
    return {k: v / total for k, v in counts.items()}


def run() -> dict[str, object]:
    lamp, tetra = lamp_aspect_counts(), tetra_aspect_counts()
    ls, ts = _shares(lamp), _shares(tetra)
    aspects = sorted(set(ls) | set(ts))
    rows = []
    for a in aspects:
        sel = round(ls.get(a, 0.0) - ts.get(a, 0.0), 4)
        both_taxonomies = a in LAMP_TAXONOMY and a in TETRA_TAXONOMY
        if abs(sel) <= 0.05:
            klass = "general_editing"
        elif sel > 0.05:
            klass = "AI_specific" if both_taxonomies else "AI_specific_taxonomy_gap"
        else:
            klass = "draft_specific" if both_taxonomies else "draft_specific_taxonomy_gap"
        rows.append({"aspect": a, "lamp_share": round(ls.get(a, 0.0), 4),
                     "tetra_share": round(ts.get(a, 0.0), 4), "SEL": sel,
                     "in_both_taxonomies": both_taxonomies, "class": klass})
    rows.sort(key=lambda r: -r["SEL"])
    return {
        "benchmark": "TextSlopBench / slop-specific-edit-lift",
        "lamp": "AI->human editor (LAMP fine_grained_edits, test)",
        "tetra": "human draft->human editor (TETRA ACL papers)",
        "lamp_total_edits": sum(lamp.values()), "tetra_total_edits": sum(tetra.values()),
        "note": "SEL = lamp_share - tetra_share. High +SEL = AI-specific edit; ~0 = general editing. "
                "Caveat: LAMP=fiction, TETRA=academic (genre confound); aspects absent from a "
                "taxonomy (Cliche/Specificity in TETRA; Clarity/Consistency in LAMP) are taxonomy "
                "gaps, so trust the +SEL classes (present in LAMP) more than the -SEL ones.",
        "aspects": rows,
    }


if __name__ == "__main__":
    result = run()
    (ROOT / "textslopbench" / "results" / "slop-specific-edit-lift.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"LAMP edits={result['lamp_total_edits']}  TETRA edits={result['tetra_total_edits']}")
    print(f"\n{'aspect':16}{'LAMP%':>8}{'TETRA%':>8}{'SEL':>8}  class")
    for r in result["aspects"]:
        print(f"{r['aspect']:16}{r['lamp_share']*100:>7.1f}%{r['tetra_share']*100:>7.1f}%{r['SEL']*100:>+7.1f}%  {r['class']}")
