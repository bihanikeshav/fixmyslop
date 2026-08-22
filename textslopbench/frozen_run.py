#!/usr/bin/env python3
"""Frozen-100 head-to-head: FixMySlop vs baseline Humanizer, scored by the FROZEN metric set
(BENCHMARK_FREEZE.md). Deterministic scoring; generation is chunked + cached (resumable). No judges.

`python frozen_run.py`            -> generate (cached) + score + report
`python frozen_run.py score-only` -> assume caches exist; score + report only
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from human_edit_grounded import edit_delta, _sign
from slop_overrepresentation import weighted_density
from policy_smoke import _call, _parse, prompts, score, aggregate, RESULTS, _mean, _refs
from humanizer_vs_current import humanizer_messages
from chea import build_conditional_model, _moved, EPS
from bootstrap import paired_bootstrap

HELDOUT = {"LAMP": "lamp-heldout-100.jsonl", "Beemo": "beemo-heldout-100.jsonl"}
CHUNK = 12
_WORD = re.compile(r"[a-z0-9]+")

HEADLINE = ["reference", "move_coverage", "conditional_direction_agreement", "conditional_population",
            "conditional_consensus_only", "fidelity", "exact", "edit_magnitude", "jaccard_to_human",
            "hcsr", "normalized_hcsr", "residual_interval_hit", "sed_final"]
COMPS = ["overall", "lexical", "phrasal", "syntax", "rhythm", "rhetoric", "semantic"]

# smoke conclusion -> (metric, expected fix-vs-hz direction, corpus filter)
CONCLUSIONS = [
    ("FixMySlop is lighter-touch (edit magnitude)", "edit_magnitude", "fix<hz", None),
    ("Humanizer aligns better on Reference CHEA", "reference", "fix<hz", None),
    ("FixMySlop preserves fidelity, humanizer breaks it", "fidelity", "fix>hz", None),
    ("FixMySlop stays closer to human wording (jaccard)", "jaccard_to_human", "fix>hz", None),
    ("FixMySlop better HCSR on LAMP", "hcsr", "fix<hz", "LAMP"),
    ("Humanizer over-suppresses on LAMP (lower SED_final)", "sed_final", "fix>hz", "LAMP"),
    ("FixMySlop wins consensus-only Population on LAMP", "conditional_consensus_only", "fix>hz", "LAMP"),
]


def load_frozen(corpus):
    rows = []
    for line in (RESULTS / HELDOUT[corpus]).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if not refs:
            continue
        S, H = str(r["source_text"]), str(refs[0])
        rows.append({"rid": r["record_id"], "corpus": corpus, "S": S, "H": H,
                     "sed_s": weighted_density(S), "sed_h": weighted_density(H)})
    return rows


def generate(items, system, corpus):
    out, missing = {}, []
    for ci in range(0, len(items), CHUNK):
        batch = items[ci:ci + CHUNK]
        tag = f"frozen-{system}-{corpus}-{ci // CHUNK}"
        msgs = prompts(batch, "current") if system == "fix" else humanizer_messages(batch)
        try:
            out.update(_parse(_call(msgs, tag)))
        except Exception as e:
            print(f"  [warn] chunk {tag} failed: {e}")
            missing += [b["rid"] for b in batch]
    return out, missing


def jaccard(a, b):
    sa, sb = set(_WORD.findall(a.lower())), set(_WORD.findall(b.lower()))
    return round(len(sa & sb) / len(sa | sb), 4) if (sa or sb) else None


def scalars_for(scored, rw_map, items_by_rid):
    out = {}
    for p in scored:
        cb = p["chea"]
        H = items_by_rid[p["rid"]]["H"]
        rw = rw_map.get(p["rid"])
        ov = lambda name: (cb.get(name) or {}).get("overall")
        out[p["rid"]] = {
            "reference": cb["reference"]["overall"], "move_coverage": ov("move_coverage"),
            "conditional_direction_agreement": ov("conditional_direction_agreement"),
            "conditional_population": ov("conditional_population"),
            "conditional_consensus_only": ov("conditional_consensus_only"),
            "fidelity": 1.0 if p["fidelity_pass"] else 0.0, "exact": p["exact"],
            "edit_magnitude": p["edit_magnitude"], "hcsr": p["hcsr"],
            "normalized_hcsr": p["normalized_hcsr"], "residual_interval_hit": p["residual_interval_hit"],
            "sed_final": p["sed_final"], "jaccard_to_human": jaccard(str(rw), H) if rw else None,
        }
    return out


def feature_gap(items, fix_rw, hz_rw, dz):
    fa, ha, cnt = {}, {}, {}
    for it in items:
        dH = edit_delta(it["S"], it["H"])
        dSf = edit_delta(it["S"], str(fix_rw.get(it["rid"], it["S"])))
        dSh = edit_delta(it["S"], str(hz_rw.get(it["rid"], it["S"])))
        for k, hv in dH.items():
            if not _moved(hv, dz.get(k, EPS)):
                continue
            cnt[k] = cnt.get(k, 0) + 1
            fa[k] = fa.get(k, 0) + (_sign(dSf.get(k, 0.0)) == _sign(hv))
            ha[k] = ha.get(k, 0) + (_sign(dSh.get(k, 0.0)) == _sign(hv))
    rows = [{"feature": k, "n": cnt[k], "fix": round(fa[k] / cnt[k], 3), "hz": round(ha[k] / cnt[k], 3),
             "gap": round(fa[k] / cnt[k] - ha[k] / cnt[k], 3)} for k in cnt]
    return sorted(rows, key=lambda r: -abs(r["gap"]))


def verdict(boot, direction):
    if not boot:
        return "no data"
    d = boot["delta"]
    same = (d > 0) if direction == "fix>hz" else (d < 0)
    if not same:
        return "failed to replicate"
    return "replicated" if boot["significant"] else "partially replicated"


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    report = {}
    for corpus in ("LAMP", "Beemo"):
        items = load_frozen(corpus)
        items_by_rid = {it["rid"]: it for it in items}
        print(f"\n########## {corpus}  (n={len(items)}) ##########")
        fix_rw, miss_f = generate(items, "fix", corpus)
        hz_rw, miss_h = generate(items, "hz", corpus)

        scored_fix = score([it for it in items if it["rid"] in fix_rw], fix_rw)
        scored_hz = score([it for it in items if it["rid"] in hz_rw], hz_rw)
        agg_fix, agg_hz = aggregate(scored_fix), aggregate(scored_hz)
        fix_s = scalars_for(scored_fix, fix_rw, items_by_rid)
        hz_s = scalars_for(scored_hz, hz_rw, items_by_rid)
        common = [it["rid"] for it in items if it["rid"] in fix_s and it["rid"] in hz_s]

        boots, mfix, mhz = {}, {}, {}
        for m in HEADLINE:
            fa = [fix_s[r][m] for r in common]
            hb = [hz_s[r][m] for r in common]
            mfix[m], mhz[m] = _mean(fa), _mean(hb)
            boots[m] = paired_bootstrap(fa, hb)

        dz = build_conditional_model(corpus).dz
        gaps = feature_gap(items, fix_rw, hz_rw, dz)
        verdicts = [{"conclusion": c, "metric": m, "expected": dr, "corpus": cf or "both",
                     "boot": boots.get(m), "verdict": verdict(boots.get(m), dr)}
                    for (c, m, dr, cf) in CONCLUSIONS if (cf is None or cf == corpus)]

        report[corpus] = {"n": len(items), "n_scored": len(common), "missing_fix": miss_f, "missing_hz": miss_h,
                          "headline": {"fixmyslop": mfix, "humanizer": mhz}, "bootstrap_fix_minus_hz": boots,
                          "chea_components": {"fixmyslop": agg_fix["chea"], "humanizer": agg_hz["chea"]},
                          "feature_gaps_top": gaps[:10], "verdicts": verdicts}

        print(f"scored {len(common)}/{len(items)} (missing fix={len(miss_f)} hz={len(miss_h)})")
        print(f"{'metric':32}{'fixmyslop':>11}{'humanizer':>11}{'d(F-H)':>9}{'95% CI':>19}{'W/L/T':>10}")
        for m in HEADLINE:
            b = boots[m]
            ci = f"[{b['ci_low']:+.3f},{b['ci_high']:+.3f}]" if b else ""
            wlt = f"{b['wins']}/{b['losses']}/{b['ties']}" if b else ""
            d = f"{b['delta']:+.3f}{'*' if b['significant'] else ''}" if b else ""
            print(f"{m:32}{str(mfix[m]):>11}{str(mhz[m]):>11}{d:>10}{ci:>19}{wlt:>10}")
        print("  -- top feature gaps (fix-hz direction-agreement vs human) --")
        for g in gaps[:6]:
            print(f"    {g['feature']:28} n={g['n']:3} fix={g['fix']:.2f} hz={g['hz']:.2f} gap={g['gap']:+.2f}")
        print("  -- replication verdicts --")
        for v in verdicts:
            b = v["boot"]
            print(f"    {v['verdict']:22} {v['conclusion']}  d={b['delta'] if b else None}")

    (RESULTS / "frozen-100-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote results/frozen-100-report.json")


if __name__ == "__main__":
    main()
