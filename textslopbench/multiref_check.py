#!/usr/bin/env python3
"""Multi-reference proxy for the patch-restore rhetoric dip (deterministic, no model calls).

LAMP is strictly single-reference (100 unique sources, 1 human edit each), so true per-source
multi-reference CHEA is impossible. Faithful substitute: use the 100-item corpus as the POPULATION
of human edit behaviours per feature. A system move on feature k is "human-attested" if humans in
the corpus move k that way. On features where humans SPLIT (no strong consensus), disagreeing with
one particular reference is within human variance and should not be scored as non-human.

Reports rhetoric + overall CHEA for current vs patched under STRICT (single-reference) and
TOLERANT (corpus-attested) scoring. If the patched dip shrinks under tolerant, it was a
single-reference artifact.
"""
from __future__ import annotations

import ast
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from human_edit_grounded import COMPONENTS, edit_delta, _sign, EPS
from patch_restore import pass2_diff, plan_restore, micro_patch, accept_restore, _load_E
from policy_smoke import select, RESULTS, _parse

MIN_SUPPORT = 10
CONS_THRESH = 0.70   # dominant-direction fraction below this = humans split (non-consensus)


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


def corpus_consensus():
    """Per feature: 'pos'/'neg' if humans move it consistently, 'split' if they disagree."""
    signs = defaultdict(list)
    for line in (RESULTS / "lamp-heldout-100.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if not refs:
            continue
        dH = edit_delta(str(r["source_text"]), str(refs[0]))
        for k, v in dH.items():
            if abs(v) > EPS:
                signs[k].append(_sign(v))
    cons = {}
    for k, ss in signs.items():
        if len(ss) < MIN_SUPPORT:
            cons[k] = None
            continue
        pos = sum(1 for s in ss if s > 0) / len(ss)
        cons[k] = "pos" if pos >= CONS_THRESH else "neg" if (1 - pos) >= CONS_THRESH else "split"
    return cons


def comp_chea(dS, dH_ref, feats, cons, tolerant):
    hits = []
    for k in feats:
        if abs(dH_ref.get(k, 0.0)) <= EPS:
            continue
        s = _sign(dS.get(k, 0.0))
        if tolerant and cons.get(k) in ("split",):
            hits.append(1)                                   # human-attested both ways
        elif tolerant and cons.get(k) in ("pos", "neg"):
            hits.append(1 if s == (1 if cons[k] == "pos" else -1) else 0)
        else:
            hits.append(1 if s == _sign(dH_ref[k]) else 0)   # strict: match the one reference
    return statistics.mean(hits) if hits else None


def build_current_patched(items, E):
    current = _parse(json.loads((RESULTS / "policy-smoke-current.raw.json").read_text(encoding="utf-8"))["content"])
    patched, l2 = dict(current), {}
    for it in items:
        rw = str(current[it["rid"]])
        cands = [o for o in pass2_diff(it["S"], rw, E) if o["restore_candidate"]]
        new_rw, l2r, _ = plan_restore(it["S"], rw, cands)
        patched[it["rid"]] = new_rw
        if l2r:
            l2[it["rid"]] = l2r
    mp = micro_patch(l2)
    for key, reqs in l2.items():
        for k, r in enumerate(reqs):
            ns = mp.get(f"{key}#{k}")
            if ns and r["current_sentence"] in patched[key] and accept_restore(r["current_sentence"], str(ns), r["word"]):
                patched[key] = patched[key].replace(r["current_sentence"], str(ns), 1)
    return current, patched


if __name__ == "__main__":
    E = _load_E()
    cons = corpus_consensus()
    items = [it for it in select()[0] if it["corpus"] == "LAMP"]
    current, patched = build_current_patched(items, E)

    def agg(rewrites, comp, tolerant):
        vals = []
        for it in items:
            dS = edit_delta(it["S"], str(rewrites[it["rid"]]))
            dH = edit_delta(it["S"], it["H"])
            v = comp_chea(dS, dH, COMPONENTS[comp], cons, tolerant)
            if v is not None:
                vals.append(v)
        return round(statistics.mean(vals), 3) if vals else None

    split = sum(1 for v in cons.values() if v == "split")
    consensus = sum(1 for v in cons.values() if v in ("pos", "neg"))
    print(f"corpus features: {consensus} consensus, {split} split (non-consensus), "
          f"{sum(1 for v in cons.values() if v is None)} low-support")
    rhet_feats = COMPONENTS["rhetoric"]
    print(f"rhetoric features consensus map: "
          f"{ {k: cons.get(k) for k in rhet_feats} }")

    print(f"\n{'component':12}{'scoring':10}{'current':>9}{'patched':>9}{'delta':>8}")
    for comp in ("rhetoric", "overall" if "overall" in COMPONENTS else "syntax"):
        pass
    for comp in ["rhetoric", "syntax", "rhythm", "lexical"]:
        for tol, name in ((False, "strict"), (True, "tolerant")):
            c = agg(current, comp, tol)
            p = agg(patched, comp, tol)
            d = round(p - c, 3) if (c is not None and p is not None) else None
            print(f"{comp:12}{name:10}{str(c):>9}{str(p):>9}{str(d):>8}")

    out = {"consensus_summary": {"consensus": consensus, "split": split},
           "rhetoric_features": {k: cons.get(k) for k in rhet_feats},
           "scores": {comp: {name: {"current": agg(current, comp, tol), "patched": agg(patched, comp, tol)}
                             for tol, name in ((False, "strict"), (True, "tolerant"))}
                      for comp in ["rhetoric", "syntax", "rhythm", "lexical"]}}
    (RESULTS / "multiref-check-lamp.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
