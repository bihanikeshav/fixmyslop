#!/usr/bin/env python3
"""Expendable-content deletion dev experiment + ablation (development data only; coverage-dev-beemo,
disjoint from frozen-100). Arms differ ONLY in the expendable deletion findings added to
actionable_findings. Primary: recall on human true-safe deletions within the four eligible categories.
Parallelized single-pass generation. No holdout here.
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from pipeline import prepare_rewrite_context
from slop_overrepresentation import weighted_density
from policy_smoke import _call, _parse, prompts, score, aggregate, RESULTS, _mean, _refs
from bootstrap import paired_bootstrap
from delete_scorer import score_system as del_score, _survives
from anchors import extract_source_content_map

CHUNK, WORKERS = 10, 8
ELIGIBLE_ROLE_TO_CAT = {"framing_discourse": "ai_framing", "pleasantry": "pleasantry",
                        "attribution_filler": "attribution_filler", "ornamental_or_connective": "ornamental_detail"}
CATS = ["ai_framing", "pleasantry", "attribution_filler", "ornamental_detail"]
ARMS = {"v1": None, "framing_pleasantry": ("ai_framing", "pleasantry", "attribution_filler"),
        "ornamental": ("ornamental_detail",), "all": tuple(CATS)}


def load_items():
    rows = []
    for line in (RESULTS / "coverage-dev-beemo.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if refs:
            S, H = str(r["source_text"]), str(refs[0])
            rows.append({"rid": r["record_id"], "corpus": "Beemo", "S": S, "H": H,
                         "sed_s": weighted_density(S), "sed_h": weighted_density(H)})
    return rows


def _sys_instr():
    return prompts([{"rid": "_", "S": "hi.", "sed_s": 0.0}], "current")[0]["content"]


def _parallel(jobs):
    def run(job):
        try:
            return _call(job[1], job[0])
        except Exception as e:
            print(f"  [warn] {job[0]}: {e}"); return None
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        return list(ex.map(run, jobs))


def generate(items, arm, families, sys_instr):
    jobs = []
    for ci in range(0, len(items), CHUNK):
        batch = items[ci:ci + CHUNK]
        payload = []
        for it in batch:
            ctx = prepare_rewrite_context(it["S"], "auto", [], expendable_families=families) if families \
                else prepare_rewrite_context(it["S"], "auto", [])
            payload.append({"id": it["rid"], "source": it["S"], "pragmatics": ctx["model_summary"]})
        msgs = [{"role": "system", "content": sys_instr}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]
        jobs.append((f"exp-{arm}-{ci // CHUNK}", msgs))
    out = {}
    for content in _parallel(jobs):
        if content:
            try:
                out.update(_parse(content))
            except Exception as e:
                print(f"  [warn] parse: {e}")
    return out


def human_eligible_safe(items):
    """Per rid: list of (category, span_text) human true-safe deletions in the 4 eligible categories."""
    out = {}
    for it in items:
        cm = extract_source_content_map(it["S"], [])
        units, _, _ = del_score(it["S"], it["H"], cm)
        out[it["rid"]] = [(ELIGIBLE_ROLE_TO_CAT[u["role"]], u["text"]) for u in units
                          if u["label"] == "true_safe_deletion" and u["role"] in ELIGIBLE_ROLE_TO_CAT]
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    items = load_items()
    sys_instr = _sys_instr()
    print(f"Expendable dev experiment: {len(items)} Beemo dev items, arms={list(ARMS)}")

    rewrites = {arm: generate(items, arm, fam, sys_instr) for arm, fam in ARMS.items()}
    scored = {arm: score([it for it in items if it["rid"] in rw], rw) for arm, rw in rewrites.items()}
    agg = {arm: aggregate(s) for arm, s in scored.items()}

    HSAFE = human_eligible_safe(items)
    # requested spans per arm (bridge findings on source)
    requested = {arm: {} for arm in ARMS}
    for arm, fam in ARMS.items():
        if not fam:
            continue
        for it in items:
            ctx = prepare_rewrite_context(it["S"], "auto", [], expendable_families=fam)
            requested[arm][it["rid"]] = [f["evidence"] for f in ctx["model_summary"]["actionable_findings"] if f.get("expendable")]

    def removed(span, text):
        return _survives(span, str(text)) < 0.4

    def per_doc_recall(arm):
        rw = rewrites[arm]
        out = {}
        for it in items:
            if it["rid"] not in rw:
                continue
            hs = HSAFE[it["rid"]]
            if not hs:
                continue
            out[it["rid"]] = statistics.mean([1.0 if removed(sp, rw[it["rid"]]) else 0.0 for _, sp in hs])
        return out

    def cat_recall(arm):
        rw = rewrites[arm]
        num = Counter(); den = Counter()
        for it in items:
            if it["rid"] not in rw:
                continue
            for cat, sp in HSAFE[it["rid"]]:
                den[cat] += 1; num[cat] += 1 if removed(sp, rw[it["rid"]]) else 0
        return {c: round(num[c] / den[c], 3) if den[c] else None for c in CATS}

    def unsafe_rejection(arm):
        """P(system does NOT delete | it is a human fidelity-conflict span)."""
        rw = rewrites[arm]
        keep = tot = 0
        for it in items:
            if it["rid"] not in rw:
                continue
            cm = extract_source_content_map(it["S"], [])
            hunits, _, _ = del_score(it["S"], it["H"], cm)
            for u in hunits:
                if u["label"] == "true_fidelity_conflict":
                    tot += 1; keep += 0 if removed(u["text"], rw[it["rid"]]) else 1
        return round(keep / tot, 3) if tot else None

    def false_safe(arm):
        """system output deletions that the scorer flags as fidelity_conflict (unsafe deletions made)."""
        rw = rewrites[arm]
        cnt = 0
        for it in items:
            if it["rid"] not in rw:
                continue
            cm = extract_source_content_map(it["S"], [])
            units, _, _ = del_score(it["S"], str(rw[it["rid"]]), cm)
            cnt += sum(1 for u in units if u["label"] == "true_fidelity_conflict")
        return cnt

    def deletions_made(arm):
        rw = rewrites[arm]
        req = made = 0
        for it in items:
            for sp in requested[arm].get(it["rid"], []):
                req += 1
                if it["rid"] in rw and removed(sp, rw[it["rid"]]):
                    made += 1
        return req, made

    def gmetric(a, m):
        if m in a:
            return a[m]
        blk = (a.get("chea") or {}).get(m)
        return blk.get("overall") if isinstance(blk, dict) else None

    v1r = per_doc_recall("v1")
    report = {"n": len(items), "arms": {}}
    for arm in ARMS:
        pr = per_doc_recall(arm)
        req, made = deletions_made(arm)
        boot = None
        if arm != "v1":
            common = [r for r in v1r if r in pr]
            boot = paired_bootstrap([pr[r] for r in common], [v1r[r] for r in common])
        report["arms"][arm] = {
            "n_scored": len(scored[arm]),
            "eligible_safe_recall": round(statistics.mean(list(pr.values())), 3) if pr else None,
            "category_recall": cat_recall(arm),
            "deletions_requested": req, "deletions_made": made,
            "false_safe_deletions": false_safe(arm),
            "unsafe_rejection": unsafe_rejection(arm),
            "fidelity_pass_rate": agg[arm]["fidelity_pass_rate"], "exact": agg[arm]["exact"],
            "conditional_direction": gmetric(agg[arm], "conditional_direction_agreement"),
            "rhetoric": (agg[arm]["chea"]["reference"] or {}).get("rhetoric"),
            "edit_magnitude": agg[arm]["edit_magnitude"],
            "recall_vs_v1_bootstrap": boot,
        }
    (RESULTS / "expendable-experiment.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    b = report["arms"]
    print(f"\n{'arm':20}{'eligRecall':>11}{'unsafeRej':>10}{'fidel':>7}{'exact':>7}{'condDir':>8}{'rhet':>7}{'editMag':>8}{'req/made':>10}{'falseSafe':>10}")
    for arm in ARMS:
        a = b[arm]
        print(f"{arm:20}{str(a['eligible_safe_recall']):>11}{str(a['unsafe_rejection']):>10}{str(a['fidelity_pass_rate']):>7}"
              f"{str(a['exact']):>7}{str(a['conditional_direction']):>8}{str(a['rhetoric']):>7}{str(a['edit_magnitude']):>8}"
              f"{str(a['deletions_requested'])+'/'+str(a['deletions_made']):>10}{str(a['false_safe_deletions']):>10}")
    print("\ncategory-level recall:")
    for arm in ARMS:
        print(f"  {arm:20} {b[arm]['category_recall']}")
    print("\nrecall vs v1 (bootstrap):")
    for arm in ("framing_pleasantry", "ornamental", "all"):
        bt = b[arm]["recall_vs_v1_bootstrap"]
        if bt:
            print(f"  {arm:20} Δ={bt['delta']:+.3f} CI[{bt['ci_low']:+.3f},{bt['ci_high']:+.3f}] W/L/T={bt['wins']}/{bt['losses']}/{bt['ties']} {'SIG' if bt['significant'] else ''}")
    print("\nwrote results/expendable-experiment.json")


if __name__ == "__main__":
    main()
