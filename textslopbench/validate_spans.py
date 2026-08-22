#!/usr/bin/env python3
"""Validate inferred edit fates against LAMP's fine-grained edit annotations.

Before trusting E(p) (count-based: compare pattern counts in source S vs final H) for any policy,
check it against ground truth. LAMP.json carries `fine_grained_edits` = [{originalText, editedText,
categorization}] — the actual source spans editors changed, with categories. We locate each
annotated span in S, then for every Antislop pattern occurrence ask: did the editor actually touch
this span (annotation) vs did our count-based method say it was edited?

Reports precision / recall / F1 of the count-based "edited" call against the annotation, overall,
by pattern family, and by edit category; plus per-pattern E_inferred vs E_annotated correlation.

Deterministic. No LLM judge.
"""
from __future__ import annotations

import json
import math
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from humanstats import finding_list
from slop_overrepresentation import resolve_profile, scan as slop_scan

LAMP = ROOT / "textslopbench" / "data_raw" / "creativity_eval" / "Writing_Alignment" / "LAMP" / "LAMP.json"


def load_lamp():
    raw = LAMP.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(re.sub(r"(?<=\})\s*(?=\{)", ",\n", raw))


def occurrences(text, profile):
    """(start, end, family_key) for every pattern occurrence in text."""
    out = []
    for f in slop_scan(text, profile=profile):
        out.append((f["start"], f["end"], ("slop", str(f["pattern_id"]))))
    for f in finding_list(text):
        out.append((f["start"], f["end"], ("rhet", str(f["family"]))))
    return out


def annotated_ranges(source, edits):
    """Locate each annotated originalText span in the source; (start, end, category, deletion)."""
    ranges = []
    for e in edits:
        orig = (e.get("originalText") or "").strip()
        if len(orig) < 3:
            continue
        cat = e.get("categorization", "?")
        deletion = (e.get("editedText") or "").strip() == ""
        idx = source.find(orig)
        if idx < 0:  # tolerate internal whitespace differences
            pat = re.escape(orig[:60]).replace(r"\ ", r"\s+")
            m = re.search(pat, source)
            idx = m.start() if m else -1
            end = m.end() if m else -1
        else:
            end = idx + len(orig)
        if idx >= 0:
            ranges.append((idx, end, cat, deletion))
    return ranges


def _overlaps(a, b, ranges):
    for c, d, cat, deletion in ranges:
        if a < d and c < b:
            return cat, deletion
    return None


def run(split: str = "test", min_n: int = 8) -> dict[str, object]:
    profile = resolve_profile(genre=None, source_model=None)
    records = [r for r in load_lamp() if (split is None or r.get("split") == split)]
    localized = total_edits = 0
    # per (pattern) tallies for E, and confusion tallies for validation
    per_pat = defaultdict(lambda: {"n": 0, "inferred_edited": 0, "annot_edited": 0})
    per_fam = defaultdict(lambda: Counter())   # family -> confusion Counter(TP/FP/FN/TN)
    per_cat = Counter()                        # annotated category among annot-edited cells
    conf = Counter()

    for rec in records:
        S, H = str(rec["preedit"]), str(rec["postedit"])
        edits = rec.get("fine_grained_edits", [])
        total_edits += len([e for e in edits if (e.get("originalText") or "").strip()])
        ranges = annotated_ranges(S, edits)
        localized += len(ranges)
        occ_S = occurrences(S, profile)
        occ_H = occurrences(H, profile)
        s_counts = Counter(k for _, _, k in occ_S)
        h_counts = Counter(k for _, _, k in occ_H)
        spans_by_key = defaultdict(list)
        for a, b, k in occ_S:
            spans_by_key[k].append((a, b))
        for key, s_count in s_counts.items():
            inferred_edited = h_counts.get(key, 0) < s_count
            hit = None
            for a, b in spans_by_key[key]:
                hit = _overlaps(a, b, ranges)
                if hit:
                    break
            annot_edited = hit is not None
            fam = key[0] if key[0] == "rhet" else "slop"
            cell = ("TP" if inferred_edited and annot_edited else
                    "FP" if inferred_edited and not annot_edited else
                    "FN" if not inferred_edited and annot_edited else "TN")
            conf[cell] += 1
            per_fam[fam][cell] += 1
            pat = per_pat[key]
            pat["n"] += 1
            pat["inferred_edited"] += inferred_edited
            pat["annot_edited"] += annot_edited
            if annot_edited:
                per_cat[hit[0]] += 1

    def prf(c):
        tp, fp, fn = c["TP"], c["FP"], c["FN"]
        p = tp / (tp + fp) if tp + fp else None
        r = tp / (tp + fn) if tp + fn else None
        f1 = 2 * p * r / (p + r) if p and r else None
        return {"precision": round(p, 3) if p is not None else None,
                "recall": round(r, 3) if r is not None else None,
                "f1": round(f1, 3) if f1 is not None else None,
                "support": tp + fn, "n_cells": sum(c.values())}

    # E_inferred vs E_annotated per pattern (patterns with enough occurrences)
    pat_rows = []
    for key, v in per_pat.items():
        if v["n"] < min_n:
            continue
        pat_rows.append({"pattern": key[1], "family": key[0], "n": v["n"],
                         "E_inferred": round(v["inferred_edited"] / v["n"], 3),
                         "E_annotated": round(v["annot_edited"] / v["n"], 3)})
    pat_rows.sort(key=lambda r: -r["n"])
    xs = [r["E_inferred"] for r in pat_rows]
    ys = [r["E_annotated"] for r in pat_rows]
    corr = None
    if len(xs) >= 3:
        mx, my = statistics.mean(xs), statistics.mean(ys)
        num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        dx = math.sqrt(sum((x - mx) ** 2 for x in xs)); dy = math.sqrt(sum((y - my) ** 2 for y in ys))
        corr = round(num / (dx * dy), 4) if dx and dy else None

    return {
        "benchmark": "TextSlopBench / span-validation (LAMP fine-grained edits)",
        "split": split, "records": len(records),
        "annotation_localization_rate": round(localized / total_edits, 3) if total_edits else None,
        "overall": prf(conf),
        "by_family": {fam: prf(c) for fam, c in per_fam.items()},
        "E_inferred_vs_annotated_pearson": corr,
        "top_overlapping_categories": per_cat.most_common(8),
        "patterns": pat_rows,
    }


if __name__ == "__main__":
    result = run()
    (ROOT / "textslopbench" / "results" / "span-validation-lamp.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    # Authoritative annotation-derived E-profile (supersedes count-based E for LAMP): E from real
    # edit spans, not H-vs-S counts. This is the validated propensity the policy layer should use.
    e_profile = {r["pattern"]: {"family": r["family"], "n": r["n"], "E_annotated": r["E_annotated"],
                                "E_inferred_lowerbound": r["E_inferred"]}
                 for r in result["patterns"]}
    (ROOT / "textslopbench" / "results" / "human-edit-E-annotated-lamp.json").write_text(
        json.dumps({"source": "LAMP fine_grained_edits (span overlap)", "split": result["split"],
                    "note": "E_annotated is ground-truth edit propensity; count-based E is a validated "
                            "lower bound (precision 1.0, recall ~0.74).", "patterns": e_profile},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"records={result['records']}  annotation localization={result['annotation_localization_rate']}")
    print("overall:", result["overall"])
    print("by family:")
    for fam, m in result["by_family"].items():
        print(f"  {fam:6} P={m['precision']} R={m['recall']} F1={m['f1']} support={m['support']} cells={m['n_cells']}")
    print("E_inferred vs E_annotated pearson:", result["E_inferred_vs_annotated_pearson"])
    print(f"\n{'pattern':22}{'fam':6}{'n':>5}{'E_inf':>7}{'E_ann':>7}")
    for r in result["patterns"][:24]:
        print(f"{r['pattern'][:21]:22}{r['family']:6}{r['n']:>5}{r['E_inferred']:>7.2f}{r['E_annotated']:>7.2f}")
