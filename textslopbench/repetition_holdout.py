#!/usr/bin/env python3
"""Preregistered repetition-bridge holdout (see REPETITION_HOLDOUT_PREREG.md). FROZEN protocol.
Full production 2-pass pipeline (rewrite -> targeted correction/anchor restore -> fidelity), n=80 Beemo
holdout, arms v1 vs v2, k=3 generations. Deterministic scoring; no judges. Resumable (cached).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from pipeline import prepare_rewrite_context, finish_rewrite_context
from fidelity import audit as fidelity_audit
from human_edit_grounded import edit_delta
from slop_overrepresentation import weighted_density
from policy_smoke import _call, _parse, prompts, score, aggregate, RESULTS, _mean, _refs
from chea import build_conditional_model, _moved
from bootstrap import paired_bootstrap
import statistics
import random
from concurrent.futures import ThreadPoolExecutor

WORKERS = 8


def _parallel_calls(jobs, workers=WORKERS):
    """jobs = [(tag, messages), ...]; dispatch _call concurrently (proxy tolerates it), return
    contents aligned to jobs order (None on failure). Cached tags return instantly."""
    def run(job):
        tag, msgs = job
        try:
            return _call(msgs, tag)
        except Exception as e:
            print(f"  [warn] {tag}: {e}")
            return None
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(run, jobs))

CHUNK = 10
KGENS = 3
FEATURE = "4_gram_repetition"
DEAD_ZONE = 0.0016350000000000002   # frozen (Beemo dz[4_gram_repetition])
CORRECTION_SYS = (
    "Correct each draft using ONLY its actionable_findings and any hard-anchor failures. Restore every "
    "missing or underrepresented hard anchor exactly. Do NOT change spans listed under diagnostic_findings. "
    "Preserve every hard anchor, qualification (e.g. 'may'), causal relationship, quotation, command, and "
    "source certainty. Do not add facts or make broad stylistic changes. "
    "Return ONLY JSON {\"id\": \"corrected text\", ...}.")


def load_holdout():
    rows = []
    for line in (RESULTS / "coverage-holdout-beemo-80.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if not refs:
            continue
        S, H = str(r["source_text"]), str(refs[0])
        rows.append({"rid": r["record_id"], "corpus": "Beemo", "S": S, "H": H,
                     "sed_s": weighted_density(S), "sed_h": weighted_density(H)})
    return rows


def _sys_instr():
    return prompts([{"rid": "_", "S": "hello world.", "sed_s": 0.0}], "current")[0]["content"]


def pass1(items, arm, model, gen, sys_instr):
    """Full-pipeline pass 1 (rewrite), chunked/cached; returns {rid: rewrite_text}."""
    fam = ("repetition",) if arm == "v2" else None
    jobs = []
    for ci in range(0, len(items), CHUNK):
        batch = items[ci:ci + CHUNK]
        payload = []
        for it in batch:
            ctx = prepare_rewrite_context(it["S"], "auto", [], structural_families=fam,
                                          structural_model=model if fam else None, structural_rid=it["rid"])
            payload.append({"id": it["rid"], "source": it["S"], "pragmatics": ctx["model_summary"]})
        msgs = [{"role": "system", "content": sys_instr}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]
        jobs.append((f"holdout-{arm}-g{gen}-p1-{ci // CHUNK}", msgs))
    out = {}
    for content in _parallel_calls(jobs):
        if content:
            try:
                out.update(_parse(content))
            except Exception as e:
                print(f"  [warn] p1 parse: {e}")
    return out


def pass2(items, arm, model, gen, rewrites):
    """Targeted correction / anchor restoration for items whose second scan requires it."""
    fam = ("repetition",) if arm == "v2" else None
    need = []
    for it in items:
        rw = rewrites.get(it["rid"])
        if rw is None:
            continue
        ctx = prepare_rewrite_context(it["S"], "auto", [], structural_families=fam,
                                      structural_model=model if fam else None, structural_rid=it["rid"])
        ctx = finish_rewrite_context(ctx, str(rw), fidelity_audit(it["S"], str(rw), []))
        tc = ctx["targeted_correction"]
        if tc.get("needed"):
            need.append((it, str(rw), tc))
    jobs = []
    for ci in range(0, len(need), CHUNK):
        batch = need[ci:ci + CHUNK]
        payload = [{"id": it["rid"], "draft": rw,
                    "correction_plan": {"actionable_findings": tc.get("actionable_findings"),
                                        "anchor_coverage": tc.get("anchor_coverage"),
                                        "diagnostic_findings": tc.get("diagnostic_findings"),
                                        "instructions": tc.get("instructions")}}
                   for (it, rw, tc) in batch]
        msgs = [{"role": "system", "content": CORRECTION_SYS}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]
        jobs.append((f"holdout-{arm}-g{gen}-p2-{ci // CHUNK}", msgs))
    corrected = {}
    for content in _parallel_calls(jobs):
        if content:
            try:
                corrected.update(_parse(content))
            except Exception as e:
                print(f"  [warn] p2 parse: {e}")
    final = dict(rewrites)
    final.update({rid: txt for rid, txt in corrected.items()})
    return final, len(need)


def run_arm(items, arm, model, sys_instr):
    gens = []
    for g in range(1, KGENS + 1):
        rw = pass1(items, arm, model, g, sys_instr)
        final, n_corr = pass2(items, arm, model, g, rw)
        gens.append(final)
        print(f"  {arm} gen{g}: {len(final)} rewrites, {n_corr} corrected (2nd pass)")
    return gens


def moved_4gram(S, txt):
    return 1 if _moved(edit_delta(S, str(txt)).get(FEATURE, 0.0), DEAD_ZONE) else 0


def per_item_scalars(items, gen_final):
    """Score one generation; return {rid: {...}} with the frozen scalars."""
    present = [it for it in items if it["rid"] in gen_final]
    sc = score(present, gen_final)
    by = {p["rid"]: p for p in sc}
    out = {}
    for it in present:
        p = by[it["rid"]]
        cb = p["chea"]
        out[it["rid"]] = {
            "moved_4gram": moved_4gram(it["S"], gen_final[it["rid"]]),
            "cond_dir": (cb.get("conditional_direction_agreement") or {}).get("overall"),
            "move_cov_overall": (cb.get("move_coverage") or {}).get("overall"),
            "rhetoric": (cb.get("reference") or {}).get("rhetoric"),
            "fidelity": 1.0 if p["fidelity_pass"] else 0.0, "exact": p["exact"],
            "edit_magnitude": p["edit_magnitude"], "normalized_hcsr": p["normalized_hcsr"],
            "residual_interval_hit": p["residual_interval_hit"],
        }
    return out


def doc_cluster_bootstrap(E_docs, cov_v2, cov_v1, iters=2000, seed=1234):
    """One-sided document-cluster bootstrap for C_v2 - C_v1 over eligible docs (per-doc means)."""
    diffs_obs = statistics.mean([cov_v2[d] - cov_v1[d] for d in E_docs])
    rng = random.Random(seed)
    n = len(E_docs)
    boots = []
    for _ in range(iters):
        samp = [E_docs[rng.randrange(n)] for _ in range(n)]
        boots.append(statistics.mean([cov_v2[d] - cov_v1[d] for d in samp]))
    boots.sort()
    lo = boots[int(0.05 * iters)]        # one-sided 95% lower bound
    hi = boots[int(0.95 * iters)]
    return {"delta": round(diffs_obs, 4), "one_sided_95_lower": round(lo, 4),
            "two_sided_hi": round(hi, 4), "n_docs": n,
            "credible_improvement": lo > 0}


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    items = load_holdout()
    model = build_conditional_model("Beemo")
    sys_instr = _sys_instr()
    print(f"Preregistered holdout: n={len(items)} Beemo, arms v1/v2, k={KGENS}, full 2-pass pipeline")

    gens = {arm: run_arm(items, arm, model, sys_instr) for arm in ("v1", "v2")}

    # per-arm per-gen scalars
    scal = {arm: [per_item_scalars(items, gens[arm][g]) for g in range(KGENS)] for arm in ("v1", "v2")}

    # eligible docs E: human moved 4-gram
    E = [it["rid"] for it in items if _moved(edit_delta(it["S"], it["H"]).get(FEATURE, 0.0), DEAD_ZONE)]

    def per_doc_cov(arm):   # mean over gens of moved_4gram, per doc in E
        out = {}
        for rid in E:
            vals = [scal[arm][g][rid]["moved_4gram"] for g in range(KGENS) if rid in scal[arm][g]]
            if vals:
                out[rid] = statistics.mean(vals)
        return out

    cov_v1, cov_v2 = per_doc_cov("v1"), per_doc_cov("v2")
    E_common = [d for d in E if d in cov_v1 and d in cov_v2]
    C_v1 = round(statistics.mean([cov_v1[d] for d in E_common]), 4)
    C_v2 = round(statistics.mean([cov_v2[d] for d in E_common]), 4)
    primary = doc_cluster_bootstrap(E_common, cov_v2, cov_v1)

    # per-generation primary (stability)
    per_gen_primary = []
    for g in range(KGENS):
        v1g = statistics.mean([scal["v1"][g][d]["moved_4gram"] for d in E_common if d in scal["v1"][g]])
        v2g = statistics.mean([scal["v2"][g][d]["moved_4gram"] for d in E_common if d in scal["v2"][g]])
        per_gen_primary.append({"gen": g + 1, "v1": round(v1g, 3), "v2": round(v2g, 3), "delta": round(v2g - v1g, 3)})

    # guardrails: per-doc mean over gens, arm means over ALL scored docs
    def arm_mean(arm, key):
        vals = []
        for it in items:
            rid = it["rid"]
            dv = [scal[arm][g][rid][key] for g in range(KGENS) if rid in scal[arm][g] and scal[arm][g][rid][key] is not None]
            if dv:
                vals.append(statistics.mean(dv))
        return round(statistics.mean(vals), 4) if vals else None

    G = {}
    for key in ("cond_dir", "fidelity", "exact", "rhetoric", "edit_magnitude", "normalized_hcsr", "move_cov_overall", "residual_interval_hit"):
        G[key] = {"v1": arm_mean("v1", key), "v2": arm_mean("v2", key)}
    margins = {"cond_dir": -0.03, "fidelity": -0.02, "exact": -1.0, "rhetoric": -0.03,
               "edit_magnitude": +0.03, "normalized_hcsr": +0.10}
    guard_pass = {}
    for k, m in margins.items():
        v1v, v2v = G[k]["v1"], G[k]["v2"]
        guard_pass[k] = (v2v >= v1v + m) if k in ("cond_dir", "fidelity", "exact", "rhetoric") else (v2v <= v1v + m)

    stable = all((pg["delta"] > 0) for pg in per_gen_primary) or all((pg["delta"] >= 0) for pg in per_gen_primary)
    decision = {
        "primary_positive": primary["delta"] > 0,
        "primary_credible": primary["credible_improvement"],
        "guardrails_pass": guard_pass,
        "all_guardrails_pass": all(guard_pass.values()),
        "edit_volume_ok": guard_pass["edit_magnitude"],
        "stable_across_gens": stable,
    }
    decision["validated"] = bool(decision["primary_credible"] and decision["all_guardrails_pass"]
                                 and decision["stable_across_gens"])

    report = {"n": len(items), "n_eligible_4gram": len(E_common), "k": KGENS,
              "primary_C_v1": C_v1, "primary_C_v2": C_v2, "primary_bootstrap": primary,
              "per_gen_primary": per_gen_primary, "guardrails": G, "guardrail_margins": margins,
              "guardrail_pass": guard_pass, "decision": decision}
    (RESULTS / "repetition-holdout.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n===== PRIMARY: 4-gram targeted coverage (n_eligible={len(E_common)}) =====")
    print(f"  C_v1={C_v1}  C_v2={C_v2}  Δ={primary['delta']}  one-sided 95% lower={primary['one_sided_95_lower']}  credible={primary['credible_improvement']}")
    print(f"  per-gen Δ: {[pg['delta'] for pg in per_gen_primary]}  stable={stable}")
    print("\n===== GUARDRAILS (non-inferiority) =====")
    for k in margins:
        print(f"  {k:18} v1={G[k]['v1']}  v2={G[k]['v2']}  margin={margins[k]:+}  PASS={guard_pass[k]}")
    print(f"  (secondary) move_cov_overall v1={G['move_cov_overall']['v1']} v2={G['move_cov_overall']['v2']}")
    print(f"\nDECISION: validated={decision['validated']}  (credible={decision['primary_credible']}, guardrails={decision['all_guardrails_pass']}, stable={stable})")
    print("wrote results/repetition-holdout.json")


if __name__ == "__main__":
    main()
