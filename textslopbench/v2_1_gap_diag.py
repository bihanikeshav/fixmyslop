#!/usr/bin/env python3
"""v2.1 HEAVY-TEXT GAP DIAGNOSTIC (deterministic, cached outputs only; the Stage-2 gate).

Question: on LAMP + Baumler, WHERE does Humanizer's Stage-1 edit align with the human editor and
our first-party rules_detected Stage-1 does NOT? Decompose the Reference-CHEA / conditional-direction
deficit by feature, collapse correlated features into editorial operations, bucket A/B/C, and quantify
how much of the deficit a bucket-A-only Stage-2 could theoretically recover.

Data hygiene: system drafts are the dev-40 Stage-1 generations (coverage-dev-*.jsonl), pulled from cache
(NO new generation). The conditional population model is the benchmark's fixed human-edit-direction
instrument (source->human prior, same one that scores every experiment) — no v2 system output or holdout
SCORE is read or tuned against.
"""
from __future__ import annotations
import json, statistics, sys, math
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"C:\Users\Keshav\Documents\ChatGPT\fixslop")
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from human_edit_grounded import feature_vector, edit_delta, COMPONENTS, _sign, EPS
from chea import build_conditional_model, _moved
from policy_smoke import _parse, _refs, RESULTS

CORPORA = {"LAMP": "coverage-dev-lamp.jsonl", "Baumler": "coverage-dev-baumler.jsonl"}
KGENS, CHUNK = 3, 10
HZ_TAG = {"LAMP": "s2b-hz-LAMP", "Baumler": "rg2-s1-hz-Baumler"}
RD_TAG = {"LAMP": "rulesdet-LAMP", "Baumler": "rulesdet-Baumler"}

# feature -> component family (reverse of COMPONENTS)
FAM = {f: c for c, fs in COMPONENTS.items() for f in fs}

# feature -> editorial operation (correlated features collapse here; validated against dH correlation)
OP = {
    # DESLOP: strip AI tells / overrepresented phrasing (local substitution/deletion)
    "sed_total": "DESLOP", "sed_unigram": "DESLOP", "sed_2gram": "DESLOP", "sed_3gram": "DESLOP",
    "sed_rhetorical_template": "DESLOP", "sed_lexical_bundle": "DESLOP", "formulaic_risk": "DESLOP",
    "rhet_inflation": "DESLOP", "rhet_promotional": "DESLOP", "rhet_ai_vocabulary": "DESLOP",
    "rhet_interface_artifact": "DESLOP", "rhet_generic_conclusion": "DESLOP", "rhet_slop_overrepresentation": "DESLOP",
    "rhet_participial_tail": "DESLOP", "rhet_negative_parallelism": "DESLOP", "rhet_false_range": "DESLOP",
    "rhet_filler": "DESLOP", "rhet_copula_avoidance": "DESLOP",
    # attribution / hedging carry claim-certainty risk
    "rhet_vague_attribution": "DE-ATTRIBUTE", "rhet_hedging_stack": "DE-HEDGE",
    # DIVERSIFY: raise lexical variety (word choice)
    "ttr": "DIVERSIFY", "mattr": "DIVERSIFY", "mattr_500": "DIVERSIFY", "hdd": "DIVERSIFY",
    "distinct_1": "DIVERSIFY", "distinct_2": "DIVERSIFY", "distinct_3": "DIVERSIFY",
    "hapax_ratio": "DIVERSIFY", "shannon_entropy": "DIVERSIFY", "pos_entropy": "DIVERSIFY",
    # CONSOLIDATE: remove repeated phrasing / repeated structure / redundant propositions
    "2_gram_repetition": "CONSOLIDATE", "3_gram_repetition": "CONSOLIDATE", "4_gram_repetition": "CONSOLIDATE",
    "dominant_template_share": "CONSOLIDATE", "redundancy_proxy": "CONSOLIDATE",
    # VARY-TEMPLATE: diversify sentence openings / syntactic templates
    "unique_template_ratio": "VARY-TEMPLATE", "template_entropy": "VARY-TEMPLATE",
    # DIRECTIFY: de-nominalize, tighten clause structure, raise content density
    "nominalization_proxy_rate": "DIRECTIFY", "subordinate_clause_rate": "DIRECTIFY",
    "coordinate_clause_rate": "DIRECTIFY", "content_function_ratio": "DIRECTIFY", "lexical_density": "DIRECTIFY",
    # RESHAPE-RHYTHM: sentence length / variance (restructuring, split/merge)
    "mean_sentence_words": "RESHAPE-RHYTHM", "sentence_cv": "RESHAPE-RHYTHM",
}

# fidelity-safety class per feature given the anchor/claim map (what changing it risks).
#  SAFE  = local lexical/phrasal substitution, no claim/qualifier/deletion risk
#  RISKY = interacts with claims, qualification, source certainty, or requires deletion/restructuring
SAFE = {
    "sed_total","sed_unigram","sed_2gram","sed_3gram","sed_rhetorical_template","sed_lexical_bundle",
    "formulaic_risk","rhet_inflation","rhet_promotional","rhet_ai_vocabulary","rhet_interface_artifact",
    "rhet_generic_conclusion","rhet_slop_overrepresentation","rhet_participial_tail","rhet_negative_parallelism",
    "rhet_false_range","rhet_filler","rhet_copula_avoidance",
    "ttr","mattr","mattr_500","hdd","distinct_1","distinct_2","distinct_3","hapax_ratio","shannon_entropy",
    "pos_entropy","2_gram_repetition","3_gram_repetition","4_gram_repetition","dominant_template_share",
    "unique_template_ratio","template_entropy","nominalization_proxy_rate",
}
# everything else RISKY: redundancy_proxy (deletes propositions), mean_sentence_words/sentence_cv (restructure),
# lexical_density/content_function_ratio (can cut qualifiers), subordinate/coordinate clause (restructure),
# vague_attribution (drop attribution), hedging_stack (drop hedges = source-certainty fidelity fail).
def safe(f):
    return "SAFE" if f in SAFE else "RISKY"


def load_dev(fname):
    rows = []
    for line in (RESULTS / fname).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line); refs = _refs(r.get("human_references"))
        if refs:
            rows.append({"rid": r["record_id"], "S": str(r["source_text"]), "H": str(refs[0])})
    return rows


def load_stage1(prefix):
    """Merge cached Stage-1 drafts across chunks per generation g -> {g: {rid: text}}."""
    out = {}
    for g in range(1, KGENS + 1):
        d = {}
        for ci in range(0, 40, CHUNK):
            p = RESULTS / f"policy-smoke-{prefix}-g{g}-{ci // CHUNK}.raw.json"
            if not p.exists():
                continue
            content = json.loads(p.read_text(encoding="utf-8"))["content"]
            try:
                d.update(_parse(content))
            except Exception:
                pass
        out[g] = d
    return out


def pearson(a, b):
    n = len(a)
    if n < 3:
        return 0.0
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a); vb = sum((x - mb) ** 2 for x in b)
    if va < EPS or vb < EPS:
        return 0.0
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    return cov / math.sqrt(va * vb)


def analyze_corpus(corpus):
    rows = load_dev(CORPORA[corpus])
    model = build_conditional_model(corpus)
    dz = model.dz
    hz = load_stage1(HZ_TAG[corpus]); rd = load_stage1(RD_TAG[corpus])

    # per-observation deltas (pool g=1..3); cache source fv/dH per rid (source-only, g-independent)
    src_fv, dH_by = {}, {}
    for r in rows:
        src_fv[r["rid"]] = feature_vector(r["S"], "auto")
        dH_by[r["rid"]] = edit_delta(r["S"], r["H"])

    feats = sorted(dH_by[rows[0]["rid"]].keys())
    # accumulators
    N_hm = defaultdict(int)                     # human-moved observations
    ref_hz = defaultdict(list); ref_rd = defaultdict(list)   # ref-agree (coverage-inclusive) per feat
    covm_hz = defaultdict(lambda: [0, 0]); covm_rd = defaultdict(lambda: [0, 0])  # [both_moved, hm]
    dir_hz = defaultdict(lambda: [0, 0]); dir_rd = defaultdict(lambda: [0, 0])    # [agree, both_moved]
    conf = defaultdict(lambda: [0, 0, 0])       # [confident(pos/neg), split, unavailable]
    conf_matches_h = defaultdict(lambda: [0, 0])  # [consensus dir == human sign, confident count]
    dH_series = defaultdict(list)               # per-obs human delta (for correlation)
    n_obs = 0

    for g in range(1, KGENS + 1):
        for r in rows:
            rid = r["rid"]
            th = hz[g].get(rid); tr = rd[g].get(rid)
            if not th or not tr:
                continue
            n_obs += 1
            fv = src_fv[rid]; dH = dH_by[rid]
            dHZ = edit_delta(r["S"], str(th)); dRD = edit_delta(r["S"], str(tr))
            for k in feats:
                if not _moved(dH.get(k, 0.0), dz.get(k, EPS)):
                    continue
                N_hm[k] += 1
                hs = _sign(dH[k])
                dH_series[k].append(dH[k])
                # reference agreement (system-not-moved => sign 0 => mismatch): folds coverage in
                ref_hz[k].append(1 if _sign(dHZ.get(k, 0.0)) == hs else 0)
                ref_rd[k].append(1 if _sign(dRD.get(k, 0.0)) == hs else 0)
                # coverage + conditional direction (both-moved), per system
                hzm = _moved(dHZ.get(k, 0.0), dz.get(k, EPS)); rdm = _moved(dRD.get(k, 0.0), dz.get(k, EPS))
                covm_hz[k][1] += 1; covm_rd[k][1] += 1
                if hzm:
                    covm_hz[k][0] += 1; dir_hz[k][1] += 1
                    dir_hz[k][0] += 1 if _sign(dHZ[k]) == hs else 0
                if rdm:
                    covm_rd[k][0] += 1; dir_rd[k][1] += 1
                    dir_rd[k][0] += 1 if _sign(dRD[k]) == hs else 0
                # source-state conditional confidence (population instrument, leave-one-out)
                c, _lvl = model.consensus(k, fv.get(k, 0.0), exclude_rid=rid)
                if c in ("pos", "neg"):
                    conf[k][0] += 1
                    conf_matches_h[k][1] += 1
                    if (1 if c == "pos" else -1) == hs:
                        conf_matches_h[k][0] += 1
                elif c == "split":
                    conf[k][1] += 1
                else:
                    conf[k][2] += 1

    tot_hm = sum(N_hm.values())
    # dH-correlation partner (redundancy) — only over features with enough moved obs
    corr_feats = [k for k in feats if len(dH_series[k]) >= 8]
    # align on common observation index is not possible (different obs sets); use per-rid mean human delta
    # instead: build per-rid human delta vector to measure feature co-movement across items.
    rid_dH = {r["rid"]: dH_by[r["rid"]] for r in rows}
    def series(k):
        return [rid_dH[r["rid"]].get(k, 0.0) for r in rows]
    partner = {}
    for k in corr_feats:
        sk = series(k); best = (0.0, None)
        for j in corr_feats:
            if j == k:
                continue
            c = abs(pearson(sk, series(j)))
            if c > best[0]:
                best = (c, j)
        partner[k] = best

    rec = []
    for k in feats:
        if N_hm[k] == 0:
            continue
        w = N_hm[k] / tot_hm
        rh = statistics.mean(ref_hz[k]); rr = statistics.mean(ref_rd[k])
        gap = rh - rr
        confident = conf[k][0]; conf_den = sum(conf[k])
        rec.append({
            "feature": k, "family": FAM.get(k, "?"), "operation": OP.get(k, "?"), "safety": safe(k),
            "human_move_freq": round(N_hm[k] / n_obs, 3), "weight_in_ref": round(w, 4),
            "hz_ref_agree": round(rh, 3), "rd_ref_agree": round(rr, 3),
            "gap_hz_minus_rd": round(gap, 3), "gap_contribution": round(w * gap, 4),
            "hz_cov": round(covm_hz[k][0] / covm_hz[k][1], 3) if covm_hz[k][1] else None,
            "rd_cov": round(covm_rd[k][0] / covm_rd[k][1], 3) if covm_rd[k][1] else None,
            "hz_dir": round(dir_hz[k][0] / dir_hz[k][1], 3) if dir_hz[k][1] else None,
            "rd_dir": round(dir_rd[k][0] / dir_rd[k][1], 3) if dir_rd[k][1] else None,
            "cond_confidence": round(confident / conf_den, 3) if conf_den else None,
            "cond_matches_human": round(conf_matches_h[k][0] / conf_matches_h[k][1], 3) if conf_matches_h[k][1] else None,
            "redundant_with": partner.get(k, (0.0, None))[1],
            "redundancy_r": round(partner.get(k, (0.0, None))[0], 2),
        })

    overall_ref_hz = sum(sum(ref_hz[k]) for k in ref_hz) / tot_hm
    overall_ref_rd = sum(sum(ref_rd[k]) for k in ref_rd) / tot_hm
    deficit = overall_ref_hz - overall_ref_rd
    # micro cond_dir (both-moved) aggregates
    cdh = sum(dir_hz[k][0] for k in dir_hz) / max(sum(dir_hz[k][1] for k in dir_hz), 1)
    cdr = sum(dir_rd[k][0] for k in dir_rd) / max(sum(dir_rd[k][1] for k in dir_rd), 1)

    return {
        "corpus": corpus, "n_items": len(rows), "n_obs": n_obs,
        "overall_ref_hz": round(overall_ref_hz, 4), "overall_ref_rd": round(overall_ref_rd, 4),
        "ref_deficit_hz_minus_rd": round(deficit, 4),
        "micro_cond_dir_hz": round(cdh, 4), "micro_cond_dir_rd": round(cdr, 4),
        "cond_dir_deficit": round(cdh - cdr, 4),
        "features": sorted(rec, key=lambda x: -x["gap_contribution"]),
    }


def bucketize(feat):
    """A: HZ wins, human moves it, strong conditional signal, fidelity-safe.
       B: HZ wins / human-aligned but RISKY (claims/deletion/restructure).
       C: diffuse — negligible gap, weak conditional signal, or no clean operation."""
    g = feat["gap_contribution"]; conf = feat["cond_confidence"] or 0.0
    if g <= 0.002:                                # RD already >= HZ or negligible: not a deficit source
        return "none"
    strong = conf >= 0.5 and feat["human_move_freq"] >= 0.15
    if not strong:
        return "C"
    return "A" if feat["safety"] == "SAFE" else "B"


def main():
    report = {}
    for corpus in CORPORA:
        r = analyze_corpus(corpus)
        for f in r["features"]:
            f["bucket"] = bucketize(f)
        report[corpus] = r

        print(f"\n{'='*96}\n{corpus}   n_items={r['n_items']}  n_obs={r['n_obs']}")
        print(f"  Reference-CHEA(overall,micro):  HZ={r['overall_ref_hz']}  RD={r['overall_ref_rd']}  "
              f"deficit={r['ref_deficit_hz_minus_rd']}")
        print(f"  cond_dir(both-moved,micro):     HZ={r['micro_cond_dir_hz']}  RD={r['micro_cond_dir_rd']}  "
              f"deficit={r['cond_dir_deficit']}")
        print(f"\n  {'feature':26}{'op':14}{'saf':5}{'buck':5}{'hmf':>6}{'gapC':>7}{'HZref':>7}{'RDref':>7}"
              f"{'HZcov':>7}{'RDcov':>7}{'conf':>6}{'redR':>6}")
        for f in r["features"]:
            if f["gap_contribution"] <= 0.0 and f["bucket"] == "none":
                continue
            print(f"  {f['feature']:26}{f['operation']:14}{f['safety'][:4]:5}{f['bucket']:5}"
                  f"{f['human_move_freq']:>6}{f['gap_contribution']:>7}{f['hz_ref_agree']:>7}{f['rd_ref_agree']:>7}"
                  f"{str(f['hz_cov']):>7}{str(f['rd_cov']):>7}{str(f['cond_confidence']):>6}{f['redundancy_r']:>6}")

        # bucket rollup + operation rollup + headroom
        tot_pos = sum(f["gap_contribution"] for f in r["features"] if f["gap_contribution"] > 0)
        deficit = r["ref_deficit_hz_minus_rd"]
        by_b = defaultdict(float); by_op = defaultdict(float)
        for f in r["features"]:
            if f["gap_contribution"] > 0:
                by_b[f["bucket"]] += f["gap_contribution"]
                by_op[(f["bucket"], f["operation"])] += f["gap_contribution"]
        print(f"\n  positive gap mass (sum of HZ>RD contributions) = {round(tot_pos,4)}   net ref deficit = {deficit}")
        for b in ("A", "B", "C"):
            frac_def = by_b[b] / deficit if deficit > EPS else float('nan')
            frac_pos = by_b[b] / tot_pos if tot_pos > EPS else float('nan')
            print(f"    bucket {b}: mass={round(by_b[b],4)}  = {round(100*frac_def,1)}% of net deficit  "
                  f"({round(100*frac_pos,1)}% of positive gap mass)")
        print("  by operation (positive mass):")
        for (b, op), m in sorted(by_op.items(), key=lambda x: -x[1]):
            if m > 0.002:
                print(f"    [{b}] {op:16}{round(m,4)}")
        r["headroom"] = {"net_ref_deficit": deficit, "positive_gap_mass": round(tot_pos, 4),
                         "bucketA_mass": round(by_b['A'], 4),
                         "bucketA_frac_of_net_deficit": round(by_b['A'] / deficit, 3) if deficit > EPS else None,
                         "bucketA_frac_of_positive_mass": round(by_b['A'] / tot_pos, 3) if tot_pos > EPS else None,
                         "bucketB_frac_of_net_deficit": round(by_b['B'] / deficit, 3) if deficit > EPS else None,
                         "bucketC_frac_of_net_deficit": round(by_b['C'] / deficit, 3) if deficit > EPS else None}

    (RESULTS / "v2_1-gap-diagnostic.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote results/v2_1-gap-diagnostic.json")


if __name__ == "__main__":
    main()
