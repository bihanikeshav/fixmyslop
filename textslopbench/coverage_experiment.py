#!/usr/bin/env python3
"""Coverage-bridge dev experiment + 3-family ablation (steps 9-10). Development data only
(coverage-dev-beemo, disjoint from frozen-100). Arms differ ONLY in the structural findings added to
`actionable_findings`; identical system prompt, identical everything else. Generation chunked+cached.

Primary: targeted_move_coverage on the 3 targets. Guardrails: conditional_direction_agreement, fidelity,
exact anchors, rhetoric alignment >= v1; edit_magnitude only modestly up; normalized_HCSR not worse.
Also coverage gain per additional edit. Stop rule: reject if coverage rises mainly via global edit
volume or conditional-direction accuracy drops.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from pipeline import prepare_rewrite_context
from human_edit_grounded import edit_delta, _sign
from slop_overrepresentation import weighted_density
from policy_smoke import _call, _parse, prompts, score, aggregate, RESULTS, _mean, _refs
from chea import build_conditional_model, _moved, EPS
from bootstrap import paired_bootstrap

CHUNK = 10
TARGETS = ["coordinate_clause_rate", "formulaic_risk", "4_gram_repetition"]
ARMS = {"v1": None, "clause": ("clause",), "formulaic": ("formulaic",),
        "repetition": ("repetition",), "all": ("clause", "formulaic", "repetition")}


def load_items(fname, corpus):
    rows = []
    for line in (RESULTS / fname).read_text(encoding="utf-8").splitlines():
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


def _sys_instr():
    return prompts([{"rid": "_", "S": "hello world.", "sed_s": 0.0}], "current")[0]["content"]


def messages(items, families, model, sys_instr):
    payload = []
    for it in items:
        if families:
            ctx = prepare_rewrite_context(it["S"], "auto", [], structural_families=families, structural_model=model)
        else:
            ctx = prepare_rewrite_context(it["S"], "auto", [])
        payload.append({"id": it["rid"], "source": it["S"], "pragmatics": ctx["model_summary"]})
    return [{"role": "system", "content": sys_instr}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]


def generate(items, arm, families, model, corpus, sys_instr):
    out = {}
    for ci in range(0, len(items), CHUNK):
        batch = items[ci:ci + CHUNK]
        tag = f"cov-{arm}-{corpus}-{ci // CHUNK}"
        try:
            out.update(_parse(_call(messages(batch, families, model, sys_instr), tag)))
        except Exception as e:
            print(f"  [warn] {tag}: {e}")
    return out


def targeted(items, rewrites, dz):
    per_item = {}
    per_feat = {t: {"hm": 0, "cov": 0, "dir": 0} for t in TARGETS}
    for it in items:
        rw = rewrites.get(it["rid"])
        if rw is None:
            continue
        dH = edit_delta(it["S"], it["H"]); dF = edit_delta(it["S"], str(rw))
        hm = cov = diro = 0
        for t in TARGETS:
            if _moved(dH.get(t, 0.0), dz.get(t, EPS)):
                hm += 1; per_feat[t]["hm"] += 1
                if _moved(dF.get(t, 0.0), dz.get(t, EPS)):
                    cov += 1; per_feat[t]["cov"] += 1
                    ok = _sign(dF.get(t, 0.0)) == _sign(dH.get(t, 0.0))
                    diro += ok; per_feat[t]["dir"] += ok
        per_item[it["rid"]] = {"cov": cov / hm if hm else None, "dir": diro / cov if cov else None, "hm": hm}
    hm_tot = sum(v["hm"] for v in per_feat.values())
    cov_tot = sum(v["cov"] for v in per_feat.values())
    dir_tot = sum(v["dir"] for v in per_feat.values())
    return {
        "targeted_move_coverage": round(cov_tot / hm_tot, 3) if hm_tot else None,
        "targeted_dir_agreement": round(dir_tot / cov_tot, 3) if cov_tot else None,
        "human_moved_pairs": hm_tot, "covered_pairs": cov_tot,
        "per_feature": {t: {"coverage": round(per_feat[t]["cov"] / per_feat[t]["hm"], 3) if per_feat[t]["hm"] else None,
                            "dir_agreement": round(per_feat[t]["dir"] / per_feat[t]["cov"], 3) if per_feat[t]["cov"] else None,
                            "human_moved": per_feat[t]["hm"]} for t in TARGETS},
        "_per_item": per_item,
    }


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    corpus = "Beemo"
    items = load_items("coverage-dev-beemo.jsonl", corpus)
    model = build_conditional_model(corpus)
    dz = model.dz
    sys_instr = _sys_instr()
    print(f"Coverage dev experiment: {len(items)} Beemo dev items (disjoint from frozen-100), arms={list(ARMS)}")

    rewrites = {arm: generate(items, arm, fam, model, corpus, sys_instr) for arm, fam in ARMS.items()}
    scored = {arm: score([it for it in items if it["rid"] in rw], rw) for arm, rw in rewrites.items()}
    agg = {arm: aggregate(s) for arm, s in scored.items()}
    tgt = {arm: targeted(items, rw, dz) for arm, rw in rewrites.items()}

    def gmetric(a, m):
        if m in a:
            return a[m]
        block = (a.get("chea") or {}).get(m)
        return block.get("overall") if isinstance(block, dict) else None

    report = {"corpus": corpus, "n_items": len(items), "dev_file": "coverage-dev-beemo.jsonl", "arms": {}}
    for arm in ARMS:
        report["arms"][arm] = {
            "n_scored": len(scored[arm]),
            "targeted_move_coverage": tgt[arm]["targeted_move_coverage"],
            "targeted_dir_agreement": tgt[arm]["targeted_dir_agreement"],
            "per_feature": tgt[arm]["per_feature"],
            "conditional_direction_agreement": gmetric(agg[arm], "conditional_direction_agreement"),
            "move_coverage_overall": gmetric(agg[arm], "move_coverage"),
            "fidelity_pass_rate": agg[arm]["fidelity_pass_rate"], "exact": agg[arm]["exact"],
            "rhetoric_reference": (agg[arm]["chea"]["reference"] or {}).get("rhetoric"),
            "edit_magnitude": agg[arm]["edit_magnitude"],
            "normalized_hcsr": agg[arm]["normalized_hcsr"], "residual_interval_hit": agg[arm]["residual_interval_hit"],
        }
    # v1 vs all: paired bootstrap on targeted coverage + guardrails
    v1c = tgt["v1"]["_per_item"]
    boots = {}
    for arm in ("clause", "formulaic", "repetition", "all"):
        armc = tgt[arm]["_per_item"]
        common = [r for r in v1c if r in armc and v1c[r]["cov"] is not None and armc[r]["cov"] is not None]
        boots[arm] = {
            "targeted_coverage": paired_bootstrap([armc[r]["cov"] for r in common], [v1c[r]["cov"] for r in common]),
        }
    report["bootstrap_arm_minus_v1"] = boots

    # coverage gain per additional edit vs v1
    b = report["arms"]
    for arm in ("clause", "formulaic", "repetition", "all"):
        dcov = (b[arm]["targeted_move_coverage"] or 0) - (b["v1"]["targeted_move_coverage"] or 0)
        dmag = (b[arm]["edit_magnitude"] or 0) - (b["v1"]["edit_magnitude"] or 0)
        b[arm]["coverage_gain_per_edit"] = round(dcov / dmag, 3) if abs(dmag) > 1e-6 else None

    (RESULTS / "coverage-experiment.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'arm':11}{'tgtCov':>8}{'tgtDir':>8}{'condDir':>9}{'fidel':>7}{'exact':>7}{'rhet':>7}{'editMag':>8}{'nHCSR':>7}{'cov/edit':>9}")
    for arm in ARMS:
        a = b[arm]
        print(f"{arm:11}{str(a['targeted_move_coverage']):>8}{str(a['targeted_dir_agreement']):>8}"
              f"{str(a['conditional_direction_agreement']):>9}{str(a['fidelity_pass_rate']):>7}{str(a['exact']):>7}"
              f"{str(a['rhetoric_reference']):>7}{str(a['edit_magnitude']):>8}{str(a['normalized_hcsr']):>7}"
              f"{str(a.get('coverage_gain_per_edit','')):>9}")
    print("\nper-target coverage (human_moved n):")
    for arm in ("v1", "all"):
        pf = report["arms"][arm]["per_feature"]
        print(f"  {arm:4} " + "  ".join(f"{t.split('_')[0]}:{pf[t]['coverage']}(dir {pf[t]['dir_agreement']},n{pf[t]['human_moved']})" for t in TARGETS))
    print("\nv1 vs arm — targeted coverage bootstrap (Δ = arm − v1):")
    for arm, bd in boots.items():
        tc = bd["targeted_coverage"]
        if tc:
            print(f"  {arm:11} Δ={tc['delta']:+.3f} CI[{tc['ci_low']:+.3f},{tc['ci_high']:+.3f}] W/L/T={tc['wins']}/{tc['losses']}/{tc['ties']} {'SIG' if tc['significant'] else ''}")
    print("\nwrote results/coverage-experiment.json")


if __name__ == "__main__":
    main()
