#!/usr/bin/env python3
"""LAMP-only edit-budget rewrite smoke: current FixMySlop vs FixMySlop + span/family edit budget.

Only NEW policy input is the host-facing plan (family, max_slop_edits, may_edit spans,
leave_unchanged spans, instruction) — NO raw E / rho / SEL / HCSR / target SED / formulas. Same
base prompt, pragmatics, analyzer, fidelity as current. edit_budget is a CEILING, not a quota.
Reuses cached current outputs; generates only the budget outputs (1 luna call). No judges.
"""
from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from pipeline import prepare_rewrite_context
from human_edit_grounded import COMPONENTS, edit_delta, _sign, EPS
from edit_budget import build_plan, _load_E
from residual_estimator import ResidualEstimator
from policy_smoke import select, _call, _parse, _summary, score, _mean, RESULTS


def host_facing_plan(plan):
    """family, max_slop_edits, may_edit (priority span texts), leave_unchanged (PRESERVE texts),
    instruction. No numeric signals."""
    out = []
    for p in plan["families"]:
        occs = p["_occs"]
        prio = set(p["priority_spans"])
        may = [occs[i]["evidence"] for i in prio if str(occs[i]["evidence"]).strip()]
        leave = [o["evidence"] for o in occs if o["decision"] == "PRESERVE" and str(o["evidence"]).strip()]
        if not may and not leave:
            continue
        out.append({"family": p["family"], "max_slop_edits": p["edit_budget"],
                    "may_edit": may[:12], "leave_unchanged": leave[:12], "instruction": p["instruction"]})
    return out


def budget_messages(items):
    base = ("You revise text; you do not regenerate it. Preserve every hard anchor exactly "
            "(numbers, dates, names, identifiers, quotations, URLs, commands) and the source's certainty. "
            "Do not invent facts. Preserve the author's voice and genre. "
            "You are given edit_budget_plan. For each family it lists max_slop_edits (a CEILING on "
            "slop-driven edits for that family, NOT a quota), may_edit (the specific ornamental/slop spans "
            "you may change) and leave_unchanged (slop/ornamental spans you must KEEP). "
            "Rules: (1) The ceiling and leave_unchanged apply ONLY to slop-driven changes — removing "
            "ornamental, formulaic or 'AI-sounding' words. Do NOT remove or reword a leave_unchanged span, "
            "even while editing the sentence around it: keep its ornamental phrasing and vividness. "
            "(2) max_slop_edits is a maximum — change fewer or none if they already read naturally. "
            "(3) You SHOULD still make the ordinary edits a human editor makes — improve rhythm, sentence "
            "flow, transitions, phrasing and clarity — this is expected and not limited by the budget; just "
            "don't strip the leave_unchanged ornamental phrases while doing so. "
            "(4) Fix anchors/meaning/genre issues when required. "
            "Return ONLY JSON {\"id\": \"revised text\", ...}.")
    payload = []
    for it in items:
        payload.append({"id": it["rid"], "source": it["S"], "pragmatics": _summary(it),
                        "edit_budget_plan": it["host_plan"]})
    return [{"role": "system", "content": base}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]


def _changed(evidence, rewrite):
    ev = str(evidence).strip().lower()
    return len(ev) >= 3 and ev not in rewrite.lower()


def adherence(item, rewrite):
    plan = item["plan"]
    permitted = sum(p["edit_budget"] for p in plan["families"])
    slop_occ = [o for p in plan["families"] if p["family"] == "slop_overrepresentation" for o in p["_occs"]]
    preserve = [o for o in slop_occ if o["decision"] == "PRESERVE"]
    priority_slop = [p["_occs"][i] for p in plan["families"] if p["family"] == "slop_overrepresentation"
                     for i in p["priority_spans"]]
    slop_changed = sum(_changed(o["evidence"], rewrite) for o in slop_occ)
    preserve_changed = sum(_changed(o["evidence"], rewrite) for o in preserve)
    priority_changed = sum(_changed(o["evidence"], rewrite) for o in priority_slop)
    return {
        "planned_priority_spans": permitted,
        "priority_changed": priority_changed,
        "total_slop_changed": slop_changed,
        "preserve_total": len(preserve), "preserve_changed": preserve_changed,
        "budget_adherence": round(slop_changed / permitted, 3) if permitted else None,
        "preserve_violation_rate": round(preserve_changed / len(preserve), 3) if preserve else 0.0,
    }


def components(item, rewrite):
    dH = edit_delta(item["S"], item["H"])
    dS = edit_delta(item["S"], rewrite)
    out = {}
    for c, feats in COMPONENTS.items():
        moved = [(dS.get(k, 0.0), dH.get(k, 0.0)) for k in feats if abs(dH.get(k, 0.0)) > EPS]
        out[c] = round(sum(_sign(a) == _sign(b) for a, b in moved) / len(moved), 3) if moved else None
    return out


if __name__ == "__main__":
    E = _load_E()
    all_frozen = select()[0]
    est = ResidualEstimator(exclude_rids=[it["rid"] for it in all_frozen])  # offline, excludes smoke rids
    items = [it for it in all_frozen if it["corpus"] == "LAMP"]
    for it in items:
        ctx = prepare_rewrite_context(it["S"], "auto", [])
        prag = {f.get("family") for f in ctx["model_summary"].get("actionable_findings", [])}
        floor = est.predict(it["sed_s"], "LAMP")["predicted_human_SED_p75"]  # Fix #1: residual floor
        it["residual_floor"] = floor
        it["plan"] = build_plan(it["S"], "LAMP", E, prag, slop_residual_floor=floor)
        it["host_plan"] = host_facing_plan(it["plan"])

    current_all = _parse(json.loads((RESULTS / "policy-smoke-current.raw.json").read_text(encoding="utf-8"))["content"])
    current = {it["rid"]: current_all[it["rid"]] for it in items}
    budget = _parse(_call(budget_messages(items), "budget-lamp-v2"))

    def full_score(rewrites):
        per = {p["rid"]: p for p in score(items, rewrites)}
        rows = []
        for it in items:
            rid = it["rid"]; rw = str(rewrites.get(rid, ""))
            row = dict(per[rid]); row.update(components(it, rw)); row.update(adherence(it, rw))
            rows.append(row)
        return rows

    scored = {"current": full_score(current), "budget": full_score(budget)}

    def agg(rows):
        keys = ("hcsr", "sed_final", "edit_magnitude", "dir_overall", "rhetoric", "phrasal", "syntax",
                "rhythm", "lexical", "semantic", "redundancy_align", "exact", "budget_adherence",
                "preserve_violation_rate")
        a = {k: _mean([r.get(k) for r in rows]) for k in keys}
        a["fidelity_pass_rate"] = _mean([1.0 if r["fidelity_pass"] else 0.0 for r in rows])
        a["priority_changed"] = sum(r.get("priority_changed", 0) for r in rows)
        a["planned_priority_spans"] = sum(r.get("planned_priority_spans", 0) for r in rows)
        a["preserve_changed"] = sum(r.get("preserve_changed", 0) for r in rows)
        a["preserve_total"] = sum(r.get("preserve_total", 0) for r in rows)
        return a

    aggs = {k: agg(v) for k, v in scored.items()}
    out = {"model": "gpt-5.6-luna", "dataset": "LAMP frozen (4)", "n": len(items),
           "aggregate": aggs, "per_item": scored}
    (RESULTS / "budget-smoke-lamp.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{'metric':22}{'current':>10}{'budget':>10}")
    for m in ("hcsr", "sed_final", "fidelity_pass_rate", "exact", "edit_magnitude", "dir_overall",
              "rhetoric", "phrasal", "syntax", "rhythm", "lexical", "semantic", "redundancy_align",
              "budget_adherence", "preserve_violation_rate"):
        print(f"{m:22}{str(aggs['current'].get(m)):>10}{str(aggs['budget'].get(m)):>10}")
    print(f"\nplanned priority spans: {aggs['budget']['planned_priority_spans']} | "
          f"priority changed: {aggs['budget']['priority_changed']} | "
          f"PRESERVE changed: {aggs['budget']['preserve_changed']}/{aggs['budget']['preserve_total']}")
    print(f"\n{'label':22}{'sedS':>6}{'sedH':>6}{'cur_fin':>8}{'bud_fin':>8}{'hcsr_c':>8}{'hcsr_b':>8}{'rhet_c':>7}{'rhet_b':>7}")
    cb = {r["rid"]: r for r in scored["current"]}
    for it in items:
        rid = it["rid"]; b = next(r for r in scored["budget"] if r["rid"] == rid); c = cb[rid]
        print(f"{it['label']:22}{it['sed_s']:>6.0f}{it['sed_h']:>6.0f}{c['sed_final']:>8.1f}{b['sed_final']:>8.1f}"
              f"{c['hcsr']:>8.1f}{b['hcsr']:>8.1f}{str(c['rhetoric']):>7}{str(b['rhetoric']):>7}")
