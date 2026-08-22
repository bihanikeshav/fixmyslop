#!/usr/bin/env python3
"""Human Edit Propensity — do real editors actually fix each AI-associated pattern?

For every Antislop pattern occurrence (plus key rhetorical constructs) in an LLM source S, look
at the professional human edit H and classify deterministically:

    REMOVED    pattern gone in H            (H_count == 0)
    MODIFIED   fewer but not gone in H      (0 < H_count < S_count)
    PRESERVED  kept at least as often       (H_count >= S_count)

Then E(p, genre) = P(human edits p | p occurs). This is NOT the same as Antislop's
overrepresentation ρ(p) = f_LLM/f_human. A phrase can be 40x AI-overrepresented yet edited only
35% of the time — an AI fingerprint that is not bad prose in context. Contrasting ρ (fingerprint)
with E (what editors bother to fix) is the missing bridge from "detect" to "prioritize."

Deterministic. No LLM judge, no rewrite calls. Count-based per-item classification (presence /
reduction), stated plainly — not span alignment.
"""
from __future__ import annotations

import ast
import json
import math
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

SMOOTH_KAPPA = 5.0  # Beta-prior strength for shrinking sparse E toward a backoff rate

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from humanstats import finding_list
from slop_overrepresentation import resolve_profile, scan as slop_scan

EM_DASH_RE = re.compile(r"—|(?<=\s)--(?=\s)")
TRICOLON_RE = re.compile(r"\b\w+,\s+\w+,\s+(?:and|or)\s+\w+\b")
HELDOUT = {"LAMP": "lamp-heldout-{n}.jsonl", "Beemo": "beemo-heldout-{n}.jsonl"}


def _parse_refs(raw):
    if isinstance(raw, list):
        return raw
    for parser in (json.loads, ast.literal_eval):
        try:
            v = parser(raw)
            if isinstance(v, list):
                return v
        except Exception:
            pass
    return [raw] if isinstance(raw, str) and raw.strip() else []


def pattern_counts(text: str, profile: dict) -> Counter:
    c: Counter = Counter()
    for f in slop_scan(text, profile=profile):
        c[("slop", str(f["pattern_id"]))] += 1
    for f in finding_list(text):
        c[("rhet", str(f["family"]))] += 1
    em = len(EM_DASH_RE.findall(text))
    if em:
        c[("extra", "em_dash")] += em
    tri = len(TRICOLON_RE.findall(text))
    if tri:
        c[("extra", "rule_of_three")] += tri
    return c


def rho_of(key, profile) -> float | None:
    kind, pid = key
    if kind != "slop":
        return None
    for tbl in ("unigrams", "bigrams", "trigrams"):
        if pid in profile.get(tbl, {}):
            return float(profile[tbl][pid])
    for t in profile.get("templates", []):
        if str(t.get("id")) == pid:
            return float(t.get("overrepresentation", 0.0))
    return None


def _pearson(xs, ys) -> float | None:
    if len(xs) < 3:
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return round(num / (dx * dy), 4) if dx and dy else None


def run(dataset: str = "LAMP", n: int = 24, min_items: int = 3) -> dict[str, object]:
    profile = resolve_profile(genre=None, source_model=None)
    path = ROOT / "textslopbench" / "results" / HELDOUT[dataset].format(n=n)
    rows = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]

    agg: dict = {}  # key -> {"occ":int, "removed":int, "modified":int, "preserved":int}
    for row in rows:
        refs = _parse_refs(row.get("human_references"))
        if not refs:
            continue
        cs = pattern_counts(str(row["source_text"]), profile)
        ch = pattern_counts(str(refs[0]), profile)
        for key, s_count in cs.items():
            rec = agg.setdefault(key, {"occ": 0, "removed": 0, "modified": 0, "preserved": 0})
            rec["occ"] += s_count
            h_count = ch.get(key, 0)
            if h_count == 0:
                rec["removed"] += 1
            elif h_count >= s_count:
                rec["preserved"] += 1
            else:
                rec["modified"] += 1

    # Backoff rates for Beta smoothing: shrink sparse E toward its kind rate, then global rate.
    pooled = defaultdict(lambda: [0, 0])  # kind -> [edited_items, total_items]
    for key, rec in agg.items():
        it = rec["removed"] + rec["modified"] + rec["preserved"]
        ed = rec["removed"] + rec["modified"]
        pooled[key[0]][0] += ed; pooled[key[0]][1] += it
        pooled["__all__"][0] += ed; pooled["__all__"][1] += it
    g_ed, g_it = pooled["__all__"]
    global_rate = g_ed / g_it if g_it else 0.3

    def backoff(kind):
        e, t = pooled.get(kind, [0, 0])
        return e / t if t >= 20 else global_rate

    table = []
    for key, rec in agg.items():
        items = rec["removed"] + rec["modified"] + rec["preserved"]
        if items < min_items:
            continue
        edited = rec["removed"] + rec["modified"]
        edit_pct = round(edited / items, 3)  # raw E (biased low vs annotations; see span validation)
        prior = backoff(key[0])
        smoothed_E = round((edited + SMOOTH_KAPPA * prior) / (items + SMOOTH_KAPPA), 3)
        confidence = "high" if items >= 20 else "medium" if items >= 8 else "low"
        rho = rho_of(key, profile)
        repetition = round(rec["occ"] / items, 2)
        # edit_priority_v0: EXPLICITLY a v0 heuristic, not research truth. AI-overrepresentation
        # weight (log2 rho) modulated by SMOOTHED human edit propensity + a small repetition nudge.
        priority_v0 = (round(math.log2(rho) * smoothed_E * (1 + 0.25 * (repetition - 1)), 3)
                       if rho and rho > 1 else None)
        table.append({
            "pattern": key[1], "kind": key[0], "rho": rho,
            "occurrences": rec["occ"], "items": items, "repetition": repetition,
            "raw_E": edit_pct, "smoothed_E": smoothed_E, "confidence": confidence,
            "remove_pct": round(rec["removed"] / items, 3),
            "modify_pct": round(rec["modified"] / items, 3),
            "preserve_pct": round(rec["preserved"] / items, 3),
            "edit_priority_v0": priority_v0,
        })
    table.sort(key=lambda r: (-r["occurrences"], -r["raw_E"]))

    # Learned E-profile the rewrite policy can consume: slop patterns with known rho, keyed by id.
    # NOTE: count-based E is a validated LOWER BOUND (precision 1.0, recall ~0.74 vs LAMP spans).
    # Prefer human-edit-E-annotated-lamp.json where span annotations exist.
    learned = {r["pattern"]: {"rho": r["rho"], "raw_E": r["raw_E"], "smoothed_E": r["smoothed_E"],
                              "confidence": r["confidence"], "items": r["items"],
                              "edit_priority_v0": r["edit_priority_v0"]}
               for r in table if r["kind"] == "slop" and r["rho"] is not None}
    (ROOT / "textslopbench" / "results" / f"human-edit-propensity-profile-{dataset.lower()}-{n}.json").write_text(
        json.dumps({"dataset": f"{dataset}-{n}", "note": "E(p) per pattern; policy modulates Antislop rho by this.",
                    "patterns": learned}, ensure_ascii=False, indent=2), encoding="utf-8")

    scored = [r for r in table if r["rho"] is not None]
    corr = _pearson([r["rho"] for r in scored], [r["raw_E"] for r in scored])
    return {
        "benchmark": "TextSlopBench / human-edit-propensity", "dataset": f"{dataset}-{n}",
        "items": len(rows), "note": "E(p)=P(human edits p | p occurs). rho=Antislop overrepresentation. "
        "They are different quantities; a high-rho pattern can have low edit-propensity.",
        "rho_vs_editpct_pearson": corr,
        "patterns": table,
    }


if __name__ == "__main__":
    dataset = sys.argv[1] if len(sys.argv) > 1 else "LAMP"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    result = run(dataset, n)
    (ROOT / "textslopbench" / "results" / f"human-edit-propensity-{dataset.lower()}-{n}.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    # compact table to stdout
    print(f"# {result['dataset']}  (rho vs edit% pearson = {result['rho_vs_editpct_pearson']})")
    print(f"{'pattern':28}{'kind':7}{'rho':>6}{'occ':>5}{'items':>6}{'edit%':>7}{'rm%':>6}{'keep%':>7}")
    for r in result["patterns"][:30]:
        rho = f"{r['rho']:.0f}" if r["rho"] is not None else "-"
        print(f"{r['pattern'][:27]:28}{r['kind']:7}{rho:>6}{r['occurrences']:>5}{r['items']:>6}"
              f"{r['raw_E']:>7.2f}{r['remove_pct']:>6.2f}{r['preserve_pct']:>7.2f}")
