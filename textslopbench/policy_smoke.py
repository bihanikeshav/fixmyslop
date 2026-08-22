#!/usr/bin/env python3
"""Policy smoke: FixMySlop current vs FixMySlop HCSR+SEL (small, deterministic eval, no judges).

Tests two policy changes as a MECHANISM check, not a final tuning pass:
  A. HCSR magnitude calibration — stop slop editing when residual SED reaches the empirical
     human residual range for the corpus (soft signal from dev H SEDs), instead of driving to 0.
  B. SEL-aware prioritization — weight slop-specific defects (redundancy strong; cliche/ornament,
     specificity provisional) over ordinary polishing (readability/grammar ~0).
E stays evidence-only (never a binary gate). Pragmatic/genre layer preserved.

Two batched host calls on gpt-5.6-luna (one per policy); all scoring deterministic. Run
`python policy_smoke.py select` first for a model-free dry run of the item choice + ranges.
"""
from __future__ import annotations

import ast
import json
import re
import statistics
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from fidelity import audit
from humanstats import analyze
from pipeline import prepare_rewrite_context
from slop_overrepresentation import weighted_density
from functools import lru_cache
from human_edit_grounded import COMPONENTS, edit_delta, feature_vector, _sign, EPS
from chea import chea_all, build_conditional_model, COMPONENT_KEYS


@lru_cache(maxsize=1)
def _residual_estimator():
    from residual_estimator import ResidualEstimator
    return ResidualEstimator(exclude_rids=())

RESULTS = ROOT / "textslopbench" / "results"
ENDPOINT = "http://127.0.0.1:8317/v1/chat/completions"
MODEL = "gpt-5.6-luna"

# Finding family -> SEL aspect -> humanization weight (provisional; cross-corpus/genre-confounded).
# Redundancy is the robust lift; cliche/ornament + specificity are provisional; structure/grammar ~0.
FAMILY_SEL_WEIGHT = {
    "slop_overrepresentation": 0.6,  # cliche/ornament
    "inflation": 0.6, "promotional": 0.6, "ai_vocabulary": 0.6, "negative_parallelism": 0.5,
    "false_range": 0.5, "generic_conclusion": 0.5,
    "filler": 1.0, "hedging_stack": 0.8,          # redundancy (robust)
    "vague_attribution": 0.6,                      # specificity (provisional)
    "participial_tail": 0.1, "copula_avoidance": 0.1, "interface_artifact": 0.3,  # structure/ordinary
}
REDUNDANCY_FEATURES = ["redundancy_proxy", "2_gram_repetition", "3_gram_repetition",
                       "4_gram_repetition", "rhet_filler", "rhet_hedging_stack"]


def _refs(raw):
    if isinstance(raw, list):
        return raw
    for p in (json.loads, ast.literal_eval):
        try:
            v = p(raw)
            if isinstance(v, list):
                return v
        except Exception:
            pass
    return [raw] if isinstance(raw, str) and raw.strip() else []


def _load(name):
    return {json.loads(l)["record_id"]: json.loads(l)
            for l in (RESULTS / name).read_text(encoding="utf-8").splitlines() if l.strip()}


def _q(sorted_vals, p):
    return sorted_vals[min(len(sorted_vals) - 1, int(p * len(sorted_vals)))] if sorted_vals else 0.0


def dev_pairs(heldout: dict) -> list[tuple[float, float]]:
    out = []
    for r in heldout.values():
        refs = _refs(r.get("human_references"))
        if refs:
            out.append((weighted_density(str(r["source_text"])), weighted_density(str(refs[0]))))
    return out


def conditional_residual_range(sed_s: float, pairs: list[tuple[float, float]]) -> list[float]:
    """Empirical human residual SED range conditioned on the SOURCE's SED band (tertile), so
    high-SED sources get a higher expected residual than low-SED ones. Soft stopping signal."""
    if not pairs:
        return [0.0, 0.0]
    ss = sorted(p[0] for p in pairs)
    lo, hi = _q(ss, 1 / 3), _q(ss, 2 / 3)
    band = [h for s, h in pairs if (s <= lo if sed_s <= lo else s >= hi if sed_s >= hi else lo < s < hi)]
    band = band or [h for _, h in pairs]
    band.sort()
    return [round(_q(band, 0.25), 2), round(_q(band, 0.75), 2)]


def select():
    lamp = _load("lamp-heldout-100.jsonl")
    beemo = _load("beemo-heldout-100.jsonl")
    fix_l = _load("lamp_fix_new_24.jsonl")
    l_pairs, b_pairs = dev_pairs(lamp), dev_pairs(beemo)

    def profile(rid, row, cached):
        S = str(row["source_text"]); refs = _refs(row.get("human_references"))
        if not refs:
            return None
        rep = analyze(S, "auto")
        fams = rep.get("finding_counts", {})
        oversupp = None
        if rid in cached:
            oversupp = round(weighted_density(str(refs[0])) - weighted_density(str(cached[rid]["rewrite"])), 2)
        return {"rid": rid, "S": S, "H": str(refs[0]), "sed_s": weighted_density(S),
                "sed_h": weighted_density(str(refs[0])),
                "phrasal_rep": rep["phrasal"]["3_gram_repetition"],
                "cliche": sum(fams.get(f, 0) for f in ("inflation", "promotional", "slop_overrepresentation", "ai_vocabulary")),
                "vague": fams.get("vague_attribution", 0), "oversupp_gap": oversupp, "fams": dict(fams)}

    lp = [p for p in (profile(k, v, fix_l) for k, v in lamp.items()) if p]
    bp = [p for p in (profile(k, v, {}) for k, v in beemo.items()) if p]
    lp_sorted = sorted(lp, key=lambda p: p["sed_s"])
    picks = [
        ("lamp_high_sed", max(lp, key=lambda p: p["sed_s"])),
        ("lamp_moderate_sed", lp_sorted[len(lp_sorted) // 2]),
        ("lamp_cliche", max(lp, key=lambda p: p["cliche"])),
        ("lamp_over_suppressed", max((p for p in lp if p["oversupp_gap"] is not None),
                                     key=lambda p: p["oversupp_gap"], default=max(lp, key=lambda p: p["phrasal_rep"]))),
    ]
    # Beemo human residual is ~0, so Beemo items are do-no-harm CONTROLS (full suppression IS
    # human-like there). Pick the 4 highest-SED Beemo items so each has real slop to act on.
    b_top = sorted(bp, key=lambda p: -p["sed_s"])
    picks += [("beemo_cliche", max(bp, key=lambda p: p["cliche"]))] + \
             [(f"beemo_sed{i+1}", b_top[i]) for i in range(4)]
    seen, items = set(), []
    for label, p in picks:
        rng = conditional_residual_range(p["sed_s"], l_pairs if label.startswith("lamp") else b_pairs)
        if p["rid"] in seen:
            continue
        seen.add(p["rid"])
        items.append({"label": label, "corpus": "LAMP" if label.startswith("lamp") else "Beemo",
                      "target_range": rng, **p})
    return items, {"LAMP_pairs": len(l_pairs), "Beemo_pairs": len(b_pairs)}


def _call(messages, tag):
    cache = RESULTS / f"policy-smoke-{tag}.raw.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))["content"]
    body = json.dumps({"model": MODEL, "messages": messages}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST",
                                 headers={"Authorization": "Bearer claudex-local", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.loads(r.read().decode())
    content = data["choices"][0]["message"]["content"]
    cache.write_text(json.dumps({"content": content, "raw": data}, ensure_ascii=False, indent=2), encoding="utf-8")
    return content


_PAIR = re.compile(r'"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"')


def _salvage(text):
    """Recover all well-formed "key":"value" string pairs when json.loads fails on one bad entry
    (e.g. an unescaped quote). Properly-escaped strings resync the scanner past a broken pair."""
    out = {}
    for m in _PAIR.finditer(text):
        try:
            out[json.loads('"' + m.group(1) + '"')] = json.loads('"' + m.group(2) + '"')
        except Exception:
            continue
    return out


def _parse(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    s = min([i for i in (text.find("{"), text.find("[")) if i != -1] or [0])
    try:
        return json.loads(text[s:])
    except json.JSONDecodeError:
        salvaged = _salvage(text[s:])
        if not salvaged:
            raise
        return salvaged


def _summary(it):
    ctx = prepare_rewrite_context(it["S"], "auto", [])
    return ctx["model_summary"]


def build_payload(items, policy):
    out = []
    for it in items:
        entry = {"id": it["rid"], "source": it["S"], "pragmatics": _summary(it)}
        if policy == "hcsr_sel":
            entry["source_slop_density"] = round(it["sed_s"], 1)
            entry["target_residual_range"] = it["target_range"]
        elif policy == "cond_hcsr":
            p = it["pred"]
            entry["source_slop_density"] = round(it["sed_s"], 1)
            entry["acceptable_residual_range"] = [p["predicted_human_SED_p25"], p["predicted_human_SED_p75"]]
            entry["typical_human_residual"] = p["predicted_human_SED_median"]
        out.append(entry)
    return out


def prompts(items, policy):
    base = ("You revise text; you do not regenerate it. Preserve every hard anchor exactly "
            "(numbers, dates, names, identifiers, quotations, URLs, commands) and the source's certainty. "
            "Do not invent facts. Preserve the author's voice and genre. ")
    if policy == "current":
        instr = base + ("Remove AI-slop patterns and formulaic phrasing; make the prose read as natural human "
                        "writing. Return ONLY JSON {\"id\": \"revised text\", ...}.")
    elif policy == "cond_hcsr":
        instr = base + (
            "MAGNITUDE (conditional HCSR): each item gives source_slop_density and an "
            "acceptable_residual_range [lo,hi] — the slop density per 1000 tokens that human editors "
            "of this genre leave for a source in this state. Rules: if your revision's residual slop "
            "is within [lo,hi], STOP — do not suppress further. Do NOT push residual below lo (that is "
            "over-suppression). Only if clearly above hi should you reduce slop toward the band, and "
            "even then stay constrained by fidelity and pragmatics. Humans sometimes leave MORE slop "
            "than the source — leaving a residual is correct, not a failure. "
            "PRIORITY (SEL): prioritise redundancy first, then cliche/ornamental phrasing and "
            "unsupported vagueness. Do NOT generically polish or restructure every sentence; leave "
            "ordinary grammar and readability alone unless meaning requires it. "
            "Return ONLY JSON {\"id\": \"revised text\", ...}.")
    else:
        instr = base + (
            "MAGNITUDE (HCSR): each item gives source_slop_density and a target_residual_range "
            "[lo,hi] (slop density per 1000 tokens that human editors of this genre/state typically "
            "leave). Make ONLY the intervention needed to bring slop into that range — do NOT drive "
            "slop to zero; humans leave a residual. If the source is already within/below the range, "
            "make minimal slop edits. "
            "PRIORITY (SEL): prioritise slop-specific defects — redundancy (strongest), then "
            "cliche/ornamental phrasing and unsupported vagueness. Do NOT generically polish or "
            "restructure every sentence; leave ordinary grammar and readability alone unless meaning "
            "requires it. Return ONLY JSON {\"id\": \"revised text\", ...}.")
    return [{"role": "system", "content": instr},
            {"role": "user", "content": json.dumps(build_payload(items, policy), ensure_ascii=False)}]


def _dir_overall(dS, dH):
    moved = [(dS.get(k, 0.0), v) for k, v in dH.items() if abs(v) > EPS]
    return sum(_sign(a) == _sign(b) for a, b in moved) / len(moved) if moved else None


def _dir_component(dS, dH, feats):
    moved = [(dS.get(k, 0.0), dH.get(k, 0.0)) for k in feats if abs(dH.get(k, 0.0)) > EPS]
    return sum(_sign(a) == _sign(b) for a, b in moved) / len(moved) if moved else None


def _population_models(items, population):
    """Resolve a {corpus: PopulationModel} map. population='auto' builds corpus_proxy models per
    corpus present; a dict is used verbatim; False/None disables (Population CHEA -> unavailable)."""
    if population in (False, None):
        return {}
    if isinstance(population, dict):
        return population
    models = {}
    for c in {it["corpus"] for it in items}:
        try:
            models[c] = build_conditional_model(c)
        except Exception:
            models[c] = None
    return models


def score(items, rewrites, population="auto"):
    """Canonical scorer. Emits dual CHEA (Reference + Population) per item under key 'chea', plus
    backward-compatible top-level Reference-CHEA aliases (dir_overall/rhetoric/syntax/rhythm/lexical).
    `population`: 'auto' (corpus_proxy per corpus), an explicit {corpus: PopulationModel} map, or
    False to disable (mode 'unavailable')."""
    import difflib
    models = _population_models(items, population)
    per = []
    for it in items:
        rw = str(rewrites.get(it["rid"], "")).strip()
        if not rw:
            continue
        dH = edit_delta(it["S"], it["H"])
        dS = edit_delta(it["S"], rw)
        a = audit(it["S"], rw, [])
        sed_final = weighted_density(rw)
        cb = chea_all(it["S"], rw, it["H"], models.get(it["corpus"]), rid=it["rid"])
        ref = cb["reference"]
        # HCSR hygiene: raw is SHARED-INSTRUMENT (FixMySlop edits using the same slop patterns SED
        # scores). normalized_HCSR scales by source slop; residual_interval_hit tests membership in
        # the estimator's [p25,p75] human residual band.
        pred = _residual_estimator().predict(it["sed_s"], it["corpus"])
        hit = 1.0 if pred["predicted_human_SED_p25"] <= sed_final <= pred["predicted_human_SED_p75"] else 0.0
        per.append({
            "rid": it["rid"], "corpus": it["corpus"], "sed_s": it["sed_s"], "sed_h": it["sed_h"],
            "sed_final": round(sed_final, 2), "hcsr": round(abs(sed_final - it["sed_h"]), 2),
            "normalized_hcsr": round(abs(sed_final - it["sed_h"]) / max(it["sed_s"], 1.0), 3),
            "residual_interval_hit": hit, "hcsr_shared_instrument": True,
            "fidelity_pass": a["passed"], "exact": a.get("exact_check_score", 0),
            "edit_magnitude": round(1 - difflib.SequenceMatcher(None, it["S"].split(), rw.split(), autojunk=False).ratio(), 3),
            "dir_overall": ref["overall"], "rhetoric": ref["rhetoric"],
            "redundancy_align": _dir_component(dS, dH, REDUNDANCY_FEATURES),
            "syntax": ref["syntax"], "rhythm": ref["rhythm"], "lexical": ref["lexical"],
            "chea": cb,
        })
    return per


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.mean(xs), 3) if xs else None


def _aggregate_chea(per):
    """Frozen CHEA aggregate: legacy Reference + the Reference decomposition (move_coverage,
    conditional_direction_agreement) + source-state-conditioned Population (conditional_population,
    conditional_consensus_only), by component and overall, plus corpus coverage_summary. Reference
    and Population are never collapsed."""
    blocks = [p["chea"] for p in per if p.get("chea")]
    if not blocks:
        return None
    mode = blocks[0]["mode"]

    def field(name):
        return {c: _mean([(b.get(name) or {}).get(c) for b in blocks if b.get(name)]) for c in COMPONENT_KEYS}

    out = {"mode": mode, "reference": {c: _mean([b["reference"].get(c) for b in blocks]) for c in COMPONENT_KEYS}}
    if mode == "unavailable" or not any(b.get("conditional_population") for b in blocks):
        out.update(move_coverage=None, conditional_direction_agreement=None,
                   conditional_population=None, conditional_consensus_only=None,
                   discriminative_coverage=None, coverage_summary=None)
        return out
    out.update(move_coverage=field("move_coverage"),
               conditional_direction_agreement=field("conditional_direction_agreement"),
               conditional_population=field("conditional_population"),
               conditional_consensus_only=field("conditional_consensus_only"),
               discriminative_coverage=_mean([b.get("discriminative_coverage") for b in blocks]))
    corpus = next((b.get("corpus") for b in blocks if b.get("corpus")), None)
    if corpus:
        out["coverage_summary"] = build_conditional_model(corpus).coverage_summary()
    return out


def aggregate(per):
    keys = ("hcsr", "normalized_hcsr", "residual_interval_hit", "sed_final", "edit_magnitude",
            "dir_overall", "rhetoric", "redundancy_align", "syntax", "rhythm", "lexical", "exact")
    agg = {k: _mean([p.get(k) for p in per]) for k in keys}
    agg["fidelity_pass_rate"] = _mean([1.0 if p["fidelity_pass"] else 0.0 for p in per])
    agg["n"] = len(per)
    agg["chea"] = _aggregate_chea(per)
    return agg


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "run":
    items, _ = select()
    rew = {}
    for policy in ("current", "hcsr_sel"):
        rew[policy] = _parse(_call(prompts(items, policy), policy))
    scored = {p: score(items, rew[p]) for p in rew}
    agg = {p: aggregate(scored[p]) for p in scored}
    out = {"model": MODEL, "n": len(items), "items": [it["label"] for it in items],
           "aggregate": agg, "per_item": scored}
    (RESULTS / "policy-smoke-results.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{'metric':20}{'current':>10}{'hcsr_sel':>10}  (lower HCSR/edit better; higher align/fidelity better)")
    for k in ("hcsr", "sed_final", "fidelity_pass_rate", "exact", "edit_magnitude", "dir_overall",
              "rhetoric", "redundancy_align", "syntax", "rhythm", "lexical"):
        c, h = agg["current"].get(k), agg["hcsr_sel"].get(k)
        print(f"{k:20}{str(c):>10}{str(h):>10}")


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "cond":
    from residual_estimator import ResidualEstimator
    items, _ = select()
    est = ResidualEstimator(exclude_rids=[it["rid"] for it in items])
    for it in items:
        it["pred"] = est.predict(it["sed_s"], it["corpus"])
    cur = _parse(_call(prompts(items, "current"), "current"))          # cached (reused)
    cond = _parse(_call(prompts(items, "cond_hcsr"), "cond_hcsr"))     # only new generation
    scored = {"current": score(items, cur), "cond_hcsr": score(items, cond)}
    pred = {it["rid"]: it["pred"] for it in items}
    for per in scored.values():
        for p in per:
            pr = pred[p["rid"]]
            p["inside_interval"] = pr["predicted_human_SED_p25"] <= p["sed_final"] <= pr["predicted_human_SED_p75"]
            p["p25"], p["p75"] = pr["predicted_human_SED_p25"], pr["predicted_human_SED_p75"]
    agg = {k: aggregate(scored[k]) for k in scored}
    for k in agg:
        agg[k]["inside_interval_count"] = sum(1 for p in scored[k] if p["inside_interval"])
    out = {"model": MODEL, "n": len(items), "estimator": "conditional E[SED_H|SED_S,genre]",
           "predictions": pred, "aggregate": agg, "per_item": scored}
    (RESULTS / "policy-smoke-cond-results.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{'metric':22}{'current':>10}{'cond_hcsr':>11}")
    for m in ("hcsr", "sed_final", "inside_interval_count", "fidelity_pass_rate", "exact",
              "edit_magnitude", "dir_overall", "rhetoric", "redundancy_align", "syntax", "rhythm", "lexical"):
        print(f"{m:22}{str(agg['current'].get(m)):>10}{str(agg['cond_hcsr'].get(m)):>11}")
    print(f"\n{'label':22}{'sedS':>6}{'sedH':>6}{'range':>13}{'cur_fin':>8}{'new_fin':>8}{'hcsr_c':>8}{'hcsr_n':>8}")
    cbyr = {p["rid"]: p for p in scored["current"]}
    for it in items:
        rid = it["rid"]; n = next(p for p in scored["cond_hcsr"] if p["rid"] == rid); c = cbyr[rid]
        print(f"{it['label']:22}{it['sed_s']:>6.0f}{it['sed_h']:>6.0f}{str([n['p25'],n['p75']]):>13}"
              f"{c['sed_final']:>8.1f}{n['sed_final']:>8.1f}{c['hcsr']:>8.1f}{n['hcsr']:>8.1f}")


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "select":
    items, meta = select()
    print("dev pairs:", meta, "| n items:", len(items))
    print(f"\n{'label':22}{'corp':6}{'sed_S':>7}{'sed_H':>7}{'target_range':>16}{'cliche':>7}{'vague':>6}{'oversupp':>9}")
    for it in items:
        print(f"{it['label']:22}{it['corpus']:6}{it['sed_s']:>7.1f}{it['sed_h']:>7.1f}"
              f"{str(it['target_range']):>16}{it['cliche']:>7}{it['vague']:>6}{str(it['oversupp_gap']):>9}")
