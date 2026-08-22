#!/usr/bin/env python3
"""Span / pattern-family edit-budget model + deterministic counterfactual (no model calls).

Document-level SED failed as a prompt control (POLICY_SMOKE.md round 2): the host cannot steer an
abstract residual. So convert the research signals into discrete LOCAL edit decisions instead.

Per family in a document: estimate how many occurrences a human editor would likely change —
  budget = occurrences x E(family) x SEL_weight(aspect)   (uncertainty-aware, confidence-tagged)
where E = span-validated human edit propensity, SEL_weight down-weights GENERAL editing
(readability/grammar) vs slop-specific families (redundancy strong; cliche/specificity provisional).
Rank occurrences within the family and mark the top `budget` MUST/SHOULD_EDIT, the rest
OPTIONAL/PRESERVE. Emit a model-actionable plan with instructions but NO raw numeric formulas.

HCSR is kept only as a metric / offline calibration input, never a host instruction.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from humanstats import finding_list, words
from slop_overrepresentation import resolve_profile, scan as slop_scan

RESULTS = ROOT / "textslopbench" / "results"

FAMILY_ASPECT = {
    "filler": "Redundancy", "hedging_stack": "Redundancy",
    "inflation": "Cliche/Ornament", "promotional": "Cliche/Ornament", "ai_vocabulary": "Cliche/Ornament",
    "slop_overrepresentation": "Cliche/Ornament", "negative_parallelism": "Cliche/Ornament",
    "false_range": "Cliche/Ornament", "generic_conclusion": "Cliche/Ornament",
    "vague_attribution": "Specificity",
    "participial_tail": "Readability", "copula_avoidance": "Readability", "interface_artifact": "Readability",
}
# SEL-informed, PROVISIONAL humanization weights. Redundancy robust; cliche/specificity provisional
# (genre-confounded); readability/grammar ~ general editing (near-zero humanization budget).
ASPECT_WEIGHT = {"Redundancy": 1.0, "Cliche/Ornament": 0.6, "Specificity": 0.6, "WordChoice": 0.5,
                 "Readability": 0.15, "Grammar": 0.0, "Clarity": 0.0, "Consistency": 0.0, "Style": 0.0}
FAMILY_COMPONENT = {
    "inflation": "rhetoric", "promotional": "rhetoric", "ai_vocabulary": "rhetoric",
    "negative_parallelism": "rhetoric", "false_range": "rhetoric", "generic_conclusion": "rhetoric",
    "slop_overrepresentation": "rhetoric", "interface_artifact": "rhetoric",
    "participial_tail": "syntax", "copula_avoidance": "syntax",
    "filler": "semantic", "hedging_stack": "semantic", "vague_attribution": "semantic",
}
INSTRUCTION = {
    "Redundancy": "Consolidate these overlapping claims into one.",
    "Cliche/Ornament": "Replace only the strongest cliched/ornamental phrasings with plain wording; leave the rest if they read naturally.",
    "Specificity": "Add concrete detail only where the text is genuinely vague.",
    "Readability": "Only adjust if the sentence is genuinely hard to read; otherwise leave it.",
}
NEGPAR_INSTR = "Rewrite only the strongest repeated contrast construction; preserve the others unless independently awkward."


def _load_E():
    sv = json.load(open(RESULTS / "span-validation-lamp.json", encoding="utf-8"))
    slop, rhet, conf = {}, {}, {}
    for p in sv["patterns"]:
        (slop if p["family"] == "slop" else rhet)[p["pattern"]] = p["E_annotated"]
        conf[p["pattern"]] = "high" if p["n"] >= 40 else "medium" if p["n"] >= 15 else "low"
    slop_mean = round(statistics.mean(slop.values()), 3) if slop else 0.4
    rhet_mean = round(statistics.mean(rhet.values()), 3) if rhet else 0.4
    return {"slop": slop, "rhet": rhet, "conf": conf, "slop_mean": slop_mean, "rhet_mean": rhet_mean}


def _family_E(family, occ_pattern_ids, E, genre):
    """E with backoff: rhet family -> global rhet mean; slop -> mean of present patterns' E."""
    if family == "slop_overrepresentation":
        vals = [E["slop"].get(pid, E["slop_mean"]) for pid in occ_pattern_ids]
        base = statistics.mean(vals) if vals else E["slop_mean"]
        level = "pattern+genre(LAMP)" if any(pid in E["slop"] for pid in occ_pattern_ids) else "family_global"
    elif family in E["rhet"]:
        base, level = E["rhet"][family], "family+genre(LAMP)"
    else:
        base, level = E["rhet_mean"], "family_global"
    # genre confound: E is LAMP-derived; downgrade confidence for non-LAMP genres.
    confidence = "low" if genre != "LAMP" else "medium"
    return round(base, 3), level, confidence


def _uncertainty_round(x, confidence):
    if confidence == "low":
        return int(x)             # floor when uncertain
    return int(x + 0.5)


def _cluster_density(span, spans, window=140):
    a, b = span
    return sum(1 for (c, d) in spans if (c, d) != (a, b) and abs((c + d) / 2 - (a + b) / 2) <= window)


def slop_cap_for_floor(occs, tokens, floor):
    """Max slop edits (remove highest-weight spans first) that keep predicted residual SED >= floor.
    Ties the slop budget to the conditional human residual so we cannot suppress below the human
    band. floor is the estimator p75 for this source state."""
    weights = sorted((o["weight"] for o in occs), reverse=True)
    total = sum(weights)
    removed, cap = 0.0, 0
    for w in weights:
        if (total - removed - w) / tokens * 1000 < floor:
            break
        removed += w
        cap += 1
    return cap


def build_plan(source, genre, E=None, pragmatic_families=frozenset(), slop_residual_floor=None):
    E = E or _load_E()
    profile = resolve_profile(genre=None, source_model=None)
    occ = []
    for f in slop_scan(source, profile=profile):
        occ.append({"family": "slop_overrepresentation", "pattern_id": str(f["pattern_id"]),
                    "span": (f["start"], f["end"]), "rho": float(f["overrepresentation"]),
                    "weight": float(f["weight"]), "evidence": f["evidence"]})
    for f in finding_list(source):
        occ.append({"family": str(f["family"]), "pattern_id": str(f["family"]),
                    "span": (f["start"], f["end"]), "rho": None, "weight": 0.0, "evidence": f.get("evidence", "")})
    all_spans = [o["span"] for o in occ]
    tokens = max(len(words(source)), 1)

    by_fam = defaultdict(list)
    for o in occ:
        by_fam[o["family"]].append(o)

    plan = []
    for family, occs in by_fam.items():
        aspect = FAMILY_ASPECT.get(family, "Cliche/Ornament")
        sel_w = ASPECT_WEIGHT.get(aspect, 0.4)
        base_E, level, confidence = _family_E(family, [o["pattern_id"] for o in occs], E, genre)
        pragmatic = family in pragmatic_families
        expected = len(occs) * base_E * sel_w
        budget = _uncertainty_round(expected, confidence)
        if pragmatic and budget == 0 and len(occs) > 0:
            budget = 1  # pragmatics may restore a single ordinary edit
        budget = max(0, min(budget, len(occs)))
        # Fix #1: cap the SLOP budget by the conditional human residual (offline estimator) so we
        # never suppress below the human band on high-residual sources.
        if family == "slop_overrepresentation" and slop_residual_floor is not None:
            budget = min(budget, slop_cap_for_floor(occs, tokens, slop_residual_floor))
        # rank occurrences: rho + within-doc repetition + local clustering + per-pattern E
        rep = defaultdict(int)
        for o in occs:
            rep[o["pattern_id"]] += 1
        def score(o):
            r = math.log2(o["rho"]) if o["rho"] and o["rho"] > 1 else 0.0
            pe = E["slop"].get(o["pattern_id"], 0.0) if family == "slop_overrepresentation" else base_E
            return (2.0 * pe + r + 0.5 * rep[o["pattern_id"]] + 0.5 * _cluster_density(o["span"], all_spans))
        ranked = sorted(range(len(occs)), key=lambda i: -score(occs[i]))
        priority = sorted(ranked[:budget])
        for rank_pos, i in enumerate(ranked):
            in_budget = rank_pos < budget
            high = sel_w >= 0.6 and base_E >= 0.45
            if family == "slop_overrepresentation" and not in_budget:
                occs[i]["decision"] = "PRESERVE"  # Fix #2: non-budget slop is explicitly kept
            else:
                occs[i]["decision"] = ("MUST_EDIT" if in_budget and high else
                                       "SHOULD_EDIT" if in_budget else
                                       "OPTIONAL" if base_E >= 0.35 and sel_w >= 0.3 else "PRESERVE")
        instr = NEGPAR_INSTR if family == "negative_parallelism" else INSTRUCTION.get(aspect, INSTRUCTION["Cliche/Ornament"])
        plan.append({
            "family": family, "aspect": aspect, "component": FAMILY_COMPONENT.get(family, "rhetoric"),
            "occurrences": len(occs), "E": base_E, "E_level": level, "E_confidence": confidence,
            "sel_weight": sel_w, "pragmatic_relevant": pragmatic,
            "edit_budget": budget, "priority_spans": priority,
            "instruction": instr,
            "_occs": occs,
        })
    plan.sort(key=lambda p: (-p["edit_budget"], -p["occurrences"]))
    return {"tokens": tokens, "families": plan}


def host_plan(plan):
    """Host-facing projection: family, occurrences, edit_budget, priority_spans, instruction only.
    Raw numeric signals (E, rho, sel_weight, confidence) stay internal — the host gets decisions."""
    return [{"family": p["family"], "occurrences": p["occurrences"], "edit_budget": p["edit_budget"],
             "priority_spans": p["priority_spans"], "instruction": p["instruction"]}
            for p in plan["families"] if p["edit_budget"] > 0 or p["occurrences"] > 0]


def counterfactual_item(source, genre, sed_h, E, pragmatic_families):
    plan = build_plan(source, genre, E, pragmatic_families)
    tokens = plan["tokens"]
    cur_requests = sum(p["occurrences"] for p in plan["families"])   # current: detect -> edit all
    budget_requests = sum(p["edit_budget"] for p in plan["families"])
    comp_cur, comp_bud = defaultdict(int), defaultdict(int)
    preserved_slop_weight = 0.0
    for p in plan["families"]:
        comp_cur[p["component"]] += p["occurrences"]
        comp_bud[p["component"]] += p["edit_budget"]
        if p["family"] == "slop_overrepresentation":
            # slop occurrences NOT in budget keep their weight -> predicted residual SED
            keep = [o for i, o in enumerate(p["_occs"]) if i not in set(p["priority_spans"])]
            preserved_slop_weight += sum(o["weight"] for o in keep)
    predicted_sed = round(preserved_slop_weight / tokens * 1000, 2)
    return {
        "current_requests": cur_requests, "budget_requests": budget_requests,
        "prevented": cur_requests - budget_requests,
        "by_component_current": dict(comp_cur), "by_component_budget": dict(comp_bud),
        "predicted_residual_SED_budget": predicted_sed,
        "predicted_HCSR_budget": round(abs(predicted_sed - sed_h), 2),
        "current_HCSR_editall": round(sed_h, 2),   # detect->edit-all drives SED ~0
        "rhetoric_budget_kept": comp_bud.get("rhetoric", 0), "rhetoric_occ": comp_cur.get("rhetoric", 0),
        "syntax_budget_kept": comp_bud.get("syntax", 0), "syntax_occ": comp_cur.get("syntax", 0),
        "plan": [{k: v for k, v in p.items() if k != "_occs"} for p in plan["families"]],
    }


if __name__ == "__main__":
    from policy_smoke import select
    from pipeline import prepare_rewrite_context
    items, _ = select()
    E = _load_E()
    agg = {"prevented": 0, "current": 0, "budget": 0}
    comp_cur, comp_bud = defaultdict(int), defaultdict(int)
    rows = []
    for it in items:
        ctx = prepare_rewrite_context(it["S"], "auto", [])
        prag = {f.get("family") for f in ctx["model_summary"].get("actionable_findings", [])}
        cf = counterfactual_item(it["S"], it["corpus"], it["sed_h"], E, prag)
        rows.append((it, cf))
        agg["prevented"] += cf["prevented"]; agg["current"] += cf["current_requests"]; agg["budget"] += cf["budget_requests"]
        for c, n in cf["by_component_current"].items():
            comp_cur[c] += n
        for c, n in cf["by_component_budget"].items():
            comp_bud[c] += n
    out = {"n": len(items), "aggregate": agg,
           "by_component": {c: {"current": comp_cur[c], "budget": comp_bud[c]} for c in comp_cur},
           "items": [{"label": it["label"], **cf} for it, cf in rows]}
    (RESULTS / "edit-budget-counterfactual.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Total slop/rhetoric candidate occurrences: {agg['current']}")
    print(f"Current policy (detect->edit-all) requests: {agg['current']}")
    print(f"Budget policy requests: {agg['budget']}   -> prevents {agg['prevented']} edits "
          f"({agg['prevented']/max(agg['current'],1):.0%})")
    print("\nEdits requested by CHEA component (current -> budget):")
    for c in sorted(comp_cur):
        print(f"  {c:10} {comp_cur[c]:>4} -> {comp_bud[c]:>4}")
    print(f"\n{'label':22}{'sedS':>6}{'sedH':>6}{'pred_SED':>9}{'HCSR_bud':>9}{'HCSR_editall':>13}{'prevent':>8}")
    for it, cf in rows:
        print(f"{it['label']:22}{it['sed_s']:>6.0f}{it['sed_h']:>6.0f}{cf['predicted_residual_SED_budget']:>9.1f}"
              f"{cf['predicted_HCSR_budget']:>9.1f}{cf['current_HCSR_editall']:>13.1f}{cf['prevented']:>8}")
