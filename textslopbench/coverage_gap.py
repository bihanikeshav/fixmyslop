#!/usr/bin/env python3
"""FixMySlop move-coverage decomposition (frozen-100 diagnostic, no LLM calls — reads cached rewrites).

For each feature x genre, rank by: human move frequency, Fix/Humanizer move frequency, Fix
missed-human-move rate, Fix conditional direction accuracy (when it DOES move), and human direction
confidence. Flags the ideal coverage targets: humans reliably move F (freq + confident direction),
Fix frequently leaves F unchanged, and when Fix does move F it already picks the right direction.
This is diagnostic only — frozen-100 stays a reported baseline, never a tuning set.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from human_edit_grounded import edit_delta, feature_vector, _sign
from chea import build_conditional_model, _moved, EPS
import frozen_run as fr

FAMILY = {
    **{f: "template" for f in ("unique_template_ratio", "template_entropy", "dominant_template_share")},
    "nominalization_proxy_rate": "nominalization",
    **{f: "lexical_density" for f in ("lexical_density", "content_function_ratio")},
    **{f: "clause" for f in ("subordinate_clause_rate", "coordinate_clause_rate")},
    **{f: "rhythm" for f in ("mean_sentence_words", "sentence_cv")},
    **{f: "lexical_diversity" for f in ("ttr", "mattr", "mattr_500", "hdd", "distinct_1", "distinct_2",
                                        "distinct_3", "hapax_ratio", "shannon_entropy", "pos_entropy")},
    **{f: "phrasal_repetition" for f in ("2_gram_repetition", "3_gram_repetition", "4_gram_repetition")},
    "redundancy_proxy": "redundancy",
}


def family(f):
    if f in FAMILY:
        return FAMILY[f]
    if f.startswith("sed_") or f.startswith("rhet_") or f == "formulaic_risk":
        return "rhetoric_slop"
    return "other"


# ideal-target thresholds
T_HUMAN_FREQ, T_DIR_CONF, T_MISSED, T_FIX_ACC, T_FIX_SUP = 0.30, 0.70, 0.40, 0.60, 8


def analyze(corpus):
    items = fr.load_frozen(corpus)
    model = build_conditional_model(corpus)
    dz = model.dz
    fix_rw, _ = fr.generate(items, "fix", corpus)      # cached, no LLM
    hz_rw, _ = fr.generate(items, "hz", corpus)
    N = len(items)

    hmove = defaultdict(int); fmove = defaultdict(int); zmove = defaultdict(int)
    missed = defaultdict(int); comoved = defaultdict(int); dir_ok = defaultdict(int)
    hsigns = defaultdict(list); cond_defined = defaultdict(int)
    for it in items:
        S, H = it["S"], it["H"]
        fv = feature_vector(S)
        dH = edit_delta(S, H)
        dF = edit_delta(S, str(fix_rw.get(it["rid"], S)))
        dZ = edit_delta(S, str(hz_rw.get(it["rid"], S)))
        for k, hv in dH.items():
            hm = _moved(hv, dz.get(k, EPS))
            fm = _moved(dF.get(k, 0.0), dz.get(k, EPS))
            zm = _moved(dZ.get(k, 0.0), dz.get(k, EPS))
            hmove[k] += hm; fmove[k] += fm; zmove[k] += zm
            if hm:
                hsigns[k].append(_sign(hv))
                # conditional direction determinacy: is this human move in a cell with a defined pos/neg
                # consensus given source state (leave-one-out)?
                c, _lvl = model.consensus(k, fv.get(k, 0.0), exclude_rid=it["rid"])
                if c in ("pos", "neg"):
                    cond_defined[k] += 1
                if fm:
                    comoved[k] += 1
                    dir_ok[k] += (_sign(dF.get(k, 0.0)) == _sign(hv))
                else:
                    missed[k] += 1

    rows = []
    for k in hmove:
        hn = hmove[k]
        signs = hsigns[k]
        dir_conf = round(max(sum(s > 0 for s in signs), sum(s < 0 for s in signs)) / len(signs), 3) if signs else None
        cond_conf = round(cond_defined[k] / hn, 3) if hn else None   # conditional direction determinacy
        fix_acc = round(dir_ok[k] / comoved[k], 3) if comoved[k] else None
        row = {
            "feature": k, "family": family(k), "genre": corpus,
            "human_move_freq": round(hn / N, 3),
            "fix_move_freq": round(fmove[k] / N, 3),
            "hz_move_freq": round(zmove[k] / N, 3),
            "fix_missed_rate": round(missed[k] / hn, 3) if hn else None,
            "fix_dir_acc": fix_acc, "fix_comoved_n": comoved[k],
            "human_dir_conf": dir_conf, "cond_dir_conf": cond_conf, "human_movers_n": hn,
        }
        # opportunity: humans reliably move it GIVEN SOURCE STATE, Fix misses it, but Fix is right when it acts
        if all(v is not None for v in (row["fix_missed_rate"], fix_acc, cond_conf)):
            row["opportunity"] = round(row["human_move_freq"] * row["fix_missed_rate"] * fix_acc * cond_conf, 4)
        else:
            row["opportunity"] = None
        row["ideal_target"] = bool(
            row["human_move_freq"] >= T_HUMAN_FREQ and (cond_conf or 0) >= T_DIR_CONF and
            (row["fix_missed_rate"] or 0) >= T_MISSED and (fix_acc or 0) >= T_FIX_ACC and
            comoved[k] >= T_FIX_SUP)
        rows.append(row)
    return sorted(rows, key=lambda r: -(r["opportunity"] or -1)), N


def fam_rollup(rows):
    agg = defaultdict(lambda: {"opp": 0.0, "feats": [], "targets": 0})
    for r in rows:
        a = agg[r["family"]]
        a["opp"] += (r["opportunity"] or 0)
        a["feats"].append(r["feature"])
        a["targets"] += int(r["ideal_target"])
    return sorted(({"family": k, "total_opportunity": round(v["opp"], 4),
                    "ideal_targets": v["targets"], "n_features": len(v["feats"])}
                   for k, v in agg.items()), key=lambda x: -x["total_opportunity"])


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    out = {}
    for corpus in ("LAMP", "Beemo"):
        rows, N = analyze(corpus)
        out[corpus] = {"n": N, "features": rows, "family_rollup": fam_rollup(rows),
                       "thresholds": {"human_move_freq": T_HUMAN_FREQ, "human_dir_conf": T_DIR_CONF,
                                      "fix_missed_rate": T_MISSED, "fix_dir_acc": T_FIX_ACC, "fix_comoved_n": T_FIX_SUP}}
        print(f"\n########## {corpus} (n={N}) — coverage-gap decomposition ##########")
        print(f"{'feature':26}{'fam':16}{'hFreq':>7}{'fFreq':>7}{'zFreq':>7}{'miss':>7}{'fAcc':>7}{'fN':>5}{'cConf':>7}{'opp':>8}")
        for r in rows[:18]:
            t = " *" if r["ideal_target"] else ""
            print(f"{r['feature']:26}{r['family']:16}{r['human_move_freq']:>7}{r['fix_move_freq']:>7}"
                  f"{r['hz_move_freq']:>7}{str(r['fix_missed_rate']):>7}{str(r['fix_dir_acc']):>7}"
                  f"{r['fix_comoved_n']:>5}{str(r['cond_dir_conf']):>7}{str(r['opportunity']):>8}{t}")
        print("  -- ideal coverage targets (all thresholds met) --")
        for r in rows:
            if r["ideal_target"]:
                print(f"    {r['feature']:26} hFreq={r['human_move_freq']} miss={r['fix_missed_rate']} "
                      f"fAcc={r['fix_dir_acc']}(n={r['fix_comoved_n']}) cConf={r['cond_dir_conf']} opp={r['opportunity']}")
        print("  -- family rollup (by total opportunity) --")
        for f in out[corpus]["family_rollup"]:
            print(f"    {f['family']:18} opp={f['total_opportunity']:>7}  ideal_targets={f['ideal_targets']}/{f['n_features']}")
    (fr.RESULTS / "coverage-gap-decomposition.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote results/coverage-gap-decomposition.json")


if __name__ == "__main__":
    main()
