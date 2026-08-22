#!/usr/bin/env python3
"""Fable Experiment 0 (free, deterministic): test the THOROUGHNESS hypothesis directly.
Does Humanizer rewrite MORE than our first-party rules_detected Stage-1, and does per-document
rewrite intensity predict the per-document Reference-CHEA deficit? If the correlation isn't there,
the 'under-rewrites' interpretation is wrong. Cached dev-40 Stage-1 drafts, no generation."""
from __future__ import annotations
import json, statistics, sys, math
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(r"C:\Users\Keshav\Documents\ChatGPT\fixslop")
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from human_edit_grounded import feature_vector, edit_delta, _sign, EPS
from humanstats import words
from chea import _ref_agree
from policy_smoke import _parse, _refs, RESULTS

CORPORA = {"LAMP": "coverage-dev-lamp.jsonl", "Baumler": "coverage-dev-baumler.jsonl"}
KGENS, CHUNK = 3, 10
HZ_TAG = {"LAMP": "s2b-hz-LAMP", "Baumler": "rg2-s1-hz-Baumler"}
RD_TAG = {"LAMP": "rulesdet-LAMP", "Baumler": "rulesdet-Baumler"}


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
    out = {}
    for g in range(1, KGENS + 1):
        d = {}
        for ci in range(0, 40, CHUNK):
            p = RESULTS / f"policy-smoke-{prefix}-g{g}-{ci // CHUNK}.raw.json"
            if not p.exists():
                continue
            try:
                d.update(_parse(json.loads(p.read_text(encoding="utf-8"))["content"]))
            except Exception:
                pass
        out[g] = d
    return out


def rewrite_frac(src, sysx):
    a, b = words(src), words(sysx)
    if not a or not b:
        return None
    return round(1 - SequenceMatcher(None, a, b).ratio(), 4)


def pearson(a, b):
    n = len(a)
    if n < 3:
        return None
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a); vb = sum((x - mb) ** 2 for x in b)
    if va < EPS or vb < EPS:
        return None
    return round(sum((x - ma) * (y - mb) for x, y in zip(a, b)) / math.sqrt(va * vb), 3)


def ref_overall(S, X, H):
    dS, dH = edit_delta(S, X), edit_delta(S, H)
    return _ref_agree(dS, dH, list(dH.keys()))


def main():
    report = {}
    for corpus, fname in CORPORA.items():
        rows = load_dev(fname)
        hz, rd = load_stage1(HZ_TAG[corpus]), load_stage1(RD_TAG[corpus])
        # human rewrite fraction (how much the human editor actually changed)
        recs = []
        for r in rows:
            rf_h = statistics.mean([v for v in [rewrite_frac(r["S"], hz[g].get(r["rid"], "")) for g in range(1, KGENS + 1)] if v is not None] or [0])
            rf_r = statistics.mean([v for v in [rewrite_frac(r["S"], rd[g].get(r["rid"], "")) for g in range(1, KGENS + 1)] if v is not None] or [0])
            ref_h = statistics.mean([v for v in [ref_overall(r["S"], hz[g][r["rid"]], r["H"]) for g in range(1, KGENS + 1) if hz[g].get(r["rid"])] if v is not None] or [0])
            ref_r = statistics.mean([v for v in [ref_overall(r["S"], rd[g][r["rid"]], r["H"]) for g in range(1, KGENS + 1) if rd[g].get(r["rid"])] if v is not None] or [0])
            rf_human = rewrite_frac(r["S"], r["H"])
            recs.append({"rid": r["rid"], "rf_hz": rf_h, "rf_rd": rf_r, "rf_human": rf_human,
                         "ref_hz": ref_h, "ref_rd": ref_r,
                         "d_rf": rf_h - rf_r, "d_ref": ref_h - ref_r})

        mean_rf_hz = statistics.mean(x["rf_hz"] for x in recs)
        mean_rf_rd = statistics.mean(x["rf_rd"] for x in recs)
        mean_rf_hu = statistics.mean(x["rf_human"] for x in recs if x["rf_human"] is not None)
        # H1: Humanizer rewrites more thoroughly than first-party
        more_thorough = sum(1 for x in recs if x["rf_hz"] > x["rf_rd"])
        # H2: per-doc thoroughness gap predicts per-doc Reference-CHEA gap
        r_gap = pearson([x["d_rf"] for x in recs], [x["d_ref"] for x in recs])
        # also: absolute rewrite intensity vs absolute ref (pooled over both systems)
        r_abs = pearson([x["rf_hz"] for x in recs] + [x["rf_rd"] for x in recs],
                        [x["ref_hz"] for x in recs] + [x["ref_rd"] for x in recs])
        # how close is each system's thoroughness to the HUMAN's
        gap_hz_to_human = mean_rf_hu - mean_rf_hz
        gap_rd_to_human = mean_rf_hu - mean_rf_rd

        report[corpus] = {"n": len(recs),
            "mean_rewrite_frac": {"human": round(mean_rf_hu, 3), "humanizer": round(mean_rf_hz, 3), "rules_det": round(mean_rf_rd, 3)},
            "humanizer_more_thorough_than_rd": f"{more_thorough}/{len(recs)} docs",
            "mean_thoroughness_gap_hz_minus_rd": round(mean_rf_hz - mean_rf_rd, 3),
            "gap_hz_vs_human_rewrite": round(gap_hz_to_human, 3), "gap_rd_vs_human_rewrite": round(gap_rd_to_human, 3),
            "corr(d_rewrite, d_refCHEA)": r_gap, "corr(abs_rewrite, abs_refCHEA)": r_abs}

        print(f"\n=== {corpus} (n={len(recs)}) ===")
        print(f"  mean rewrite fraction:  human={mean_rf_hu:.3f}  humanizer={mean_rf_hz:.3f}  rules_det={mean_rf_rd:.3f}")
        print(f"  humanizer more thorough than rules_det: {more_thorough}/{len(recs)} docs "
              f"(mean gap {mean_rf_hz - mean_rf_rd:+.3f})")
        print(f"  distance to HUMAN rewrite intensity:    humanizer {gap_hz_to_human:+.3f}   rules_det {gap_rd_to_human:+.3f}")
        print(f"  H2 corr(per-doc thoroughness gap, per-doc Ref-CHEA gap) = {r_gap}")
        print(f"     corr(abs rewrite intensity, abs Ref-CHEA, pooled)    = {r_abs}")

    (RESULTS / "v2_1-exp0-thoroughness.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote results/v2_1-exp0-thoroughness.json")
    print("\nREAD: H1 supported if humanizer rewrites more (both mean gap>0 and doc-majority).")
    print("      H2 supported if corr(d_rewrite,d_refCHEA) is clearly positive -> thoroughness explains the deficit.")


if __name__ == "__main__":
    main()
