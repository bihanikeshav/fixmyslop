#!/usr/bin/env python3
"""Deterministic head-to-head: baseline_humanizer vs FixMySlop, no LLM calls.

Uses the cached held-out evals (`lamp-eval-24.json`, `beemo-eval-24.json`), which store per-system
per-feature edit deltas (candidate vs human) for 24 items each. CHEA is direction agreement of those
deltas, so Reference and Population CHEA recompute exactly (via chea.py's scorers). Edit magnitude
and jaccard-to-human come straight from the cached aggregates. SED/HCSR are NOT in these files (no
rewrite text cached for the humanizer), so they are marked unavailable rather than guessed.
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from human_edit_grounded import COMPONENTS, _sign, EPS
from chea import _ref_agree, _pop_detail

RESULTS = ROOT / "textslopbench" / "results"
SYSTEMS = ["baseline_humanizer", "fixmyslop_new", "fixmyslop_old", "professional_human_edit"]
COMPS = ["overall", "lexical", "phrasal", "syntax", "rhythm", "rhetoric"]  # semantic has no eval features
MIN_SUPPORT = 8   # 24-item corpus


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.mean(xs), 3) if xs else None


def consensus_from_deltas(human_deltas):
    signs = defaultdict(list)
    for dH in human_deltas:
        for k, v in dH.items():
            if abs(v) > EPS:
                signs[k].append(_sign(v))
    cons = {}
    for k, ss in signs.items():
        if len(ss) < MIN_SUPPORT:
            cons[k] = None
            continue
        pos = sum(1 for s in ss if s > 0) / len(ss)
        cons[k] = "pos" if pos >= 0.70 else "neg" if (1 - pos) >= 0.70 else "split"
    return cons


def evaluate(eval_file, corpus):
    d = json.load(open(RESULTS / eval_file, encoding="utf-8"))
    per = d["per_example"]
    agg = d["aggregate"]
    feats13 = list(next(iter(per.values()))["fixmyslop_new"]["human_edit_delta_alignment"]["human_delta"].keys())
    comp_feats = {"overall": feats13, **{c: [f for f in COMPONENTS[c] if f in feats13] for c in COMPS if c != "overall"}}
    cons = consensus_from_deltas([sysmap["professional_human_edit"]["human_edit_delta_alignment"]["human_delta"]
                                  for sysmap in per.values()])
    n_cons = sum(1 for v in cons.values() if v in ("pos", "neg"))
    n_split = sum(1 for v in cons.values() if v == "split")

    rows = {}
    for system in SYSTEMS:
        ref = {c: [] for c in COMPS}
        pop = {c: [] for c in COMPS}
        conly = {c: [] for c in COMPS}
        for sysmap in per.values():
            al = sysmap[system]["human_edit_delta_alignment"]
            dS, dH = al["candidate_delta"], al["human_delta"]
            for c, fs in comp_feats.items():
                ref[c].append(_ref_agree(dS, dH, fs))
                p, co, _, _ = _pop_detail(dS, dH, fs, cons)
                pop[c].append(p)
                conly[c].append(co)
        rows[system] = {
            "reference": {c: _mean(ref[c]) for c in COMPS},
            "population": {c: _mean(pop[c]) for c in COMPS},
            "population_consensus_only": {c: _mean(conly[c]) for c in COMPS},
            "edit_magnitude": agg[system]["candidate_normalized_edit"],
            "jaccard_to_human": agg[system]["content_jaccard_to_human_reference"],
            "delta_cosine": agg[system]["human_delta_cosine"],
        }
    meta = {"corpus": corpus, "n": len(per), "population_mode": "corpus_proxy",
            "consensus_features": n_cons, "split_features": n_split,
            "scorable_features": n_cons + n_split, "n_human_edits": len(per)}
    return rows, meta


def main():
    out = {}
    for eval_file, corpus in (("lamp-eval-24.json", "LAMP"), ("beemo-eval-24.json", "Beemo")):
        rows, meta = evaluate(eval_file, corpus)
        out[corpus] = {"meta": meta, "systems": rows}
        print(f"\n===== {corpus}  (n={meta['n']}, Population mode: corpus_proxy, "
              f"coverage {meta['consensus_features']}/{meta['scorable_features']}) =====")
        hz, fx = rows["baseline_humanizer"], rows["fixmyslop_new"]
        print(f"{'scale':26}{'humanizer':>12}{'fixmyslop':>12}{'winner':>10}")
        print(f"{'edit_magnitude':26}{hz['edit_magnitude']:>12}{fx['edit_magnitude']:>12}{'':>10}")
        print(f"{'jaccard_to_human':26}{hz['jaccard_to_human']:>12}{fx['jaccard_to_human']:>12}"
              f"{('fixmyslop' if fx['jaccard_to_human']>hz['jaccard_to_human'] else 'humanizer'):>10}")
        for kind in ("reference", "population", "population_consensus_only"):
            print(f"  -- {kind} CHEA --")
            for c in COMPS:
                h, f = hz[kind][c], fx[kind][c]
                w = "" if (h is None or f is None) else ("fixmyslop" if f > h else "humanizer" if h > f else "tie")
                print(f"    {c:22}{str(h):>12}{str(f):>12}{w:>10}")
        print(f"  (anchor) professional_human_edit reference overall = {rows['professional_human_edit']['reference']['overall']}")
    (RESULTS / "compare-humanizer-fixmyslop.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
