#!/usr/bin/env python3
"""Annotation-derived edit-priority table + counterfactual E-gating simulation (LAMP).

Uses the VALIDATED ground truth (LAMP fine_grained_edits spans, precision 1.0 vs our detector) to
build, per Antislop/rhetorical pattern:

    pattern, family, genre, occurrences, annotated_edit_count, raw_E (occurrence),
    smoothed_E (Beta), confidence, rho, edit_priority_v0

Then classifies patterns into quadrants (high/low rho x high/low E) and runs a counterfactual:
under an E-gating policy, which slop edits the current "detect -> edit" policy would trigger get
SUPPRESSED / WEAKENED / KEPT — with NO rewriting and no model calls.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from slop_overrepresentation import resolve_profile
from validate_spans import _overlaps, annotated_ranges, load_lamp, occurrences
from human_edit_propensity import rho_of

SMOOTH_KAPPA = 5.0
RHO_HI, E_HI, E_LO = 7.0, 0.40, 0.25  # v0 thresholds (documented, not tuned)
MIN_SUPPORT = 12


def build(split: str = "test") -> dict[str, object]:
    profile = resolve_profile(genre=None, source_model=None)
    records = [r for r in load_lamp() if split is None or r.get("split") == split]
    genres = Counter(str(r.get("type")) for r in records)

    tally = defaultdict(lambda: {"occ": 0, "edited": 0, "items": 0})
    for rec in records:
        S = str(rec["preedit"])
        ranges = annotated_ranges(S, rec.get("fine_grained_edits", []))
        occ = occurrences(S, profile)
        seen = set()
        for a, b, key in occ:
            t = tally[key]
            t["occ"] += 1
            if _overlaps(a, b, ranges):
                t["edited"] += 1
            if key not in seen:
                t["items"] += 1
                seen.add(key)

    # backoff rates for Beta smoothing (occurrence-level), by family then global
    pooled = defaultdict(lambda: [0, 0])
    for key, t in tally.items():
        pooled[key[0]][0] += t["edited"]; pooled[key[0]][1] += t["occ"]
        pooled["__all__"][0] += t["edited"]; pooled["__all__"][1] += t["occ"]
    g = pooled["__all__"]
    global_rate = g[0] / g[1] if g[1] else 0.3

    def backoff(kind):
        e, n = pooled.get(kind, [0, 0])
        return e / n if n >= 40 else global_rate

    rows = []
    for key, t in tally.items():
        if t["occ"] < MIN_SUPPORT:
            continue
        raw_E = round(t["edited"] / t["occ"], 3)
        smoothed_E = round((t["edited"] + SMOOTH_KAPPA * backoff(key[0])) / (t["occ"] + SMOOTH_KAPPA), 3)
        confidence = "high" if t["occ"] >= 40 else "medium" if t["occ"] >= 15 else "low"
        rho = rho_of(key, profile)
        repetition = round(t["occ"] / t["items"], 2) if t["items"] else 1.0
        priority = (round(math.log2(rho) * smoothed_E * (1 + 0.25 * (repetition - 1)), 3)
                    if rho and rho > 1 else None)
        rows.append({
            "pattern": key[1], "family": key[0], "genre": genres.most_common(1)[0][0],
            "occurrences": t["occ"], "annotated_edit_count": t["edited"],
            "raw_E": raw_E, "smoothed_E": smoothed_E, "confidence": confidence,
            "rho": rho, "repetition": repetition, "edit_priority_v0": priority,
        })
    rows.sort(key=lambda r: (-(r["edit_priority_v0"] or -1), -r["occurrences"]))
    return {"split": split, "records": len(records), "genres": dict(genres),
            "thresholds": {"rho_hi": RHO_HI, "E_hi": E_HI, "E_lo": E_LO, "min_support": MIN_SUPPORT},
            "patterns": rows}


def quadrants(rows):
    scored = [r for r in rows if r["rho"] is not None]
    def q(r):
        hi_rho, hi_E = (r["rho"] >= RHO_HI), (r["smoothed_E"] >= E_HI)
        if r["confidence"] == "low":
            return "low_support_uncertain"
        return {(True, True): "high_rho_high_E", (True, False): "high_rho_low_E",
                (False, True): "low_rho_high_E", (False, False): "low_rho_low_E"}[(hi_rho, hi_E)]
    out = defaultdict(list)
    for r in scored:
        out[q(r)].append(r["pattern"])
    return {k: out[k] for k in ("high_rho_high_E", "high_rho_low_E", "low_rho_high_E",
                                "low_rho_low_E", "low_support_uncertain") if out[k]}


def counterfactual(rows):
    """Over the annotated occurrence population, how would an E-gating policy reclassify the slop
    edits the current 'detect -> edit' policy triggers?"""
    by_pat = {r["pattern"]: r for r in rows if r["family"] == "slop"}
    total = supp = weak = keep = 0
    supp_pats, keep_pats = Counter(), Counter()
    for r in by_pat.values():
        occ = r["occurrences"]
        total += occ
        if r["smoothed_E"] < E_LO:
            supp += occ; supp_pats[r["pattern"]] += occ
        elif r["smoothed_E"] < E_HI:
            weak += occ
        else:
            keep += occ; keep_pats[r["pattern"]] += occ
    # Sweep the suppression threshold to see when an E-gate would actually bite.
    sweep = []
    for t_lo in (0.20, 0.25, 0.30, 0.35, 0.40, 0.45):
        s = sum(r["occurrences"] for r in by_pat.values() if r["smoothed_E"] < t_lo)
        sweep.append({"E_lo": t_lo, "suppressed_pct": round(s / total, 3) if total else 0.0,
                      "patterns_below": sorted(r["pattern"] for r in by_pat.values() if r["smoothed_E"] < t_lo)})
    return {
        "slop_edit_occurrences_current_policy": total,
        "suppressed": supp, "weakened": weak, "kept": keep,
        "suppressed_pct": round(supp / total, 3) if total else 0.0,
        "weakened_pct": round(weak / total, 3) if total else 0.0,
        "kept_pct": round(keep / total, 3) if total else 0.0,
        "min_annotation_E_among_slop": round(min((r["smoothed_E"] for r in by_pat.values()), default=0.0), 3),
        "threshold_sweep": sweep,
        "top_suppressed_patterns": supp_pats.most_common(10),
        "top_kept_patterns": keep_pats.most_common(10),
    }


if __name__ == "__main__":
    result = build()
    result["quadrants"] = quadrants(result["patterns"])
    result["counterfactual_e_gating"] = counterfactual(result["patterns"])
    (ROOT / "textslopbench" / "results" / "annotation-priority-lamp.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"records={result['records']} genres={result['genres']}")
    print(f"\n{'pattern':22}{'fam':6}{'occ':>5}{'ed':>5}{'rawE':>6}{'smE':>6}{'conf':>7}{'rho':>5}{'prio':>7}")
    for r in result["patterns"][:28]:
        rho = f"{r['rho']:.0f}" if r["rho"] is not None else "-"
        prio = f"{r['edit_priority_v0']:.2f}" if r["edit_priority_v0"] is not None else "-"
        print(f"{r['pattern'][:21]:22}{r['family']:6}{r['occurrences']:>5}{r['annotated_edit_count']:>5}"
              f"{r['raw_E']:>6.2f}{r['smoothed_E']:>6.2f}{r['confidence']:>7}{rho:>5}{prio:>7}")
    print("\n== quadrants ==")
    for k, v in result["quadrants"].items():
        print(f"  {k}: {', '.join(v)}")
    cf = result["counterfactual_e_gating"]
    print(f"\n== counterfactual E-gating (thresholds E_lo={E_LO} E_hi={E_HI}) ==")
    print(f"  current slop-edit occurrences: {cf['slop_edit_occurrences_current_policy']}")
    print(f"  suppressed {cf['suppressed_pct']:.0%}  weakened {cf['weakened_pct']:.0%}  kept {cf['kept_pct']:.0%}")
    print(f"  top suppressed (AI fingerprint, humans leave alone): {cf['top_suppressed_patterns']}")
    print(f"  top kept (humans do fix): {cf['top_kept_patterns']}")
