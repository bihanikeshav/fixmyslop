#!/usr/bin/env python3
"""Decompose the Beemo delete deficit (diagnostic; no model calls, no policy changes).

For every source->target deletion (human, FixMySlop, Humanizer on the same frozen-100 Beemo items),
classify the deleted unit by scope and role, its anchor overlap, and its claim impact (reusing the
deterministic anchor/fidelity machinery). Then measure the SAFE-delete opportunity, what Fix does on
human-safe-delete spans instead of deleting, operation co-occurrence with deletion, and Humanizer's
safe-vs-protected deletions. Reports how much of the +0.57 doc-level delete gap is closeable without
touching FixMySlop's fidelity guarantees.
"""
from __future__ import annotations

import difflib
import glob
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from anchors import extract_source_content_map
from policy_smoke import _parse, _refs, RESULTS
from edit_operations import classify as op_classify, _sents, _toks, _NOMINAL, HEDGES, FRAMING, _WORD

DISCOURSE = {"however", "moreover", "furthermore", "additionally", "indeed", "notably", "importantly",
             "therefore", "thus", "hence", "consequently", "meanwhile", "nevertheless", "nonetheless",
             "also", "besides", "similarly", "likewise", "overall", "ultimately", "essentially"}
DISCOURSE_PHRASE = ["in addition", "in fact", "of course", "that said", "on the other hand", "as such",
                    "in particular", "for instance", "for example", "as mentioned", "needless to say"]
ORNAMENTAL = {"very", "really", "truly", "quite", "incredibly", "remarkably", "significantly", "extremely",
              "highly", "particularly", "especially", "absolutely", "completely", "utterly", "deeply",
              "vast", "myriad", "seamless", "robust", "comprehensive", "vibrant", "powerful", "crucial",
              "vital", "essential", "innovative", "cutting-edge", "invaluable", "unique", "significant"}
EXPLAIN_START = ("which", "that", "such as", "for example", "for instance", "including", "e.g", "i.e", "namely")
VERBISH = {"is", "are", "was", "were", "be", "been", "being", "has", "have", "had", "do", "does", "did",
           "will", "would", "can", "could", "should", "may", "might", "must", "provides", "offers",
           "ensures", "helps", "makes", "allows", "enables", "includes", "requires", "creates"}
ANCHOR_CATS = {"numbers": {"number"}, "entities": {"named_entity"}, "dates": {"date"},
               "urls_citations": {"url", "email", "citation"}, "measurements": {"number"},
               "qualifications": {"qualification"}, "quotations": {"quotation"},
               "causal": {"causal_relationship"}}
HARD_NONQUAL = {"number", "named_entity", "date", "url", "email", "citation", "quotation",
                "ui_or_command", "causal_relationship", "protected_span"}


def _has_subseq(hay, needle):
    n = len(needle)
    return n > 0 and n <= len(hay) and any(hay[i:i + n] == needle for i in range(len(hay) - n + 1))


def _anchor_hits(unit, anchors):
    """kinds of anchors whose text sits inside the deleted unit (boundary-safe token match)."""
    ut = _toks(unit)
    kinds = set()
    for a in anchors:
        at = _toks(str(a.get("text", "")))
        if at and _has_subseq(ut, at):
            kinds.add(str(a.get("kind")))
    return kinds


def _scope(unit, is_sentence, n_sents):
    if is_sentence:
        return "multi_sentence" if n_sents >= 2 else "sentence"
    w = _toks(unit)
    if any(t in VERBISH for t in w) or len(w) >= 7:
        return "clause"
    if len(w) >= 3:
        return "phrase"
    return "token_modifier"


def _role(unit, scope, akinds, S, T):
    ut = unit.lower().strip()
    toks = _toks(unit)
    if akinds & HARD_NONQUAL:
        return "anchor_bearing"
    if "qualification" in akinds or any(t in HEDGES for t in toks):
        return "qualification_hedge"
    if any(p in ut for p in FRAMING):
        return "formulaic_framing"
    if (toks and toks[0] in DISCOURSE) or any(p in ut for p in DISCOURSE_PHRASE):
        return "discourse_filler"
    # repetition/redundancy: the deleted 3-gram content survives elsewhere in the target
    if len(toks) >= 3:
        tt = _toks(T)
        if _has_subseq(tt, toks[:3]) or _has_subseq(tt, toks[-3:]):
            return "duplicated_proposition"
    if scope in ("sentence", "multi_sentence", "clause"):
        # duplicated vs unique: does a retained target sentence cover this content?
        best = max((len(set(toks) & set(_toks(s))) / max(1, len(set(toks))) for s in _sents(T)), default=0.0)
        if best >= 0.6:
            return "duplicated_proposition"
        if ut.startswith(EXPLAIN_START) or (toks and toks[0] in ("which", "that")):
            return "explanatory_detail"
        return "unique_proposition"
    if toks and (set(toks) & ORNAMENTAL or len(toks) <= 2):
        return "ornamental_modifier"
    return "other"


def _claim_impact(role, akinds, toks):
    if akinds & HARD_NONQUAL:
        return "anchor_breaking"
    if role == "qualification_hedge" or "qualification" in akinds or any(t in HEDGES for t in toks):
        return "certainty_changing"
    if role in ("unique_proposition", "explanatory_detail"):
        return "claim_reducing"
    if role in ("duplicated_proposition", "discourse_filler", "formulaic_framing", "ornamental_modifier"):
        return "claim_preserving"
    return "uncertain"


def deletions(S, T, anchors):
    """Return deleted units [{text, scope, role, anchor_kinds, claim_impact, is_sentence}]."""
    ss, ts = _sents(S), _sents(T)
    units = []
    best = [max((_jac_idx(a, ts)), default=(0.0, -1))[0] if ts else 0.0 for a in ss]
    # whole-sentence deletions grouped into consecutive runs
    del_idx = [i for i, sm in enumerate(best) if sm < 0.35]
    i = 0
    while i < len(del_idx):
        j = i
        while j + 1 < len(del_idx) and del_idx[j + 1] == del_idx[j] + 1:
            j += 1
        group = del_idx[i:j + 1]
        text = " ".join(ss[k] for k in group)
        ak = _anchor_hits(text, anchors)
        role = _role(text, "multi_sentence" if len(group) >= 2 else "sentence", ak, S, T)
        units.append({"text": text[:200], "scope": _scope(text, True, len(group)), "role": role,
                      "anchor_kinds": sorted(ak), "claim_impact": _claim_impact(role, ak, _toks(text)),
                      "is_sentence": True})
        i = j + 1
    # sub-sentence deletions inside matched pairs (pure 'delete' opcodes)
    for i, a in enumerate(ss):
        if best[i] < 0.35 or not ts:
            continue
        j = max(range(len(ts)), key=lambda k: _jac(a, ts[k]))
        at, bt = _toks(a), _toks(ts[j])
        sm = difflib.SequenceMatcher(None, at, bt, autojunk=False)
        for tag, a1, a2, b1, b2 in sm.get_opcodes():
            if tag != "delete":
                continue
            frag = " ".join(at[a1:a2])
            if len(at[a1:a2]) < 1:
                continue
            ak = _anchor_hits(frag, anchors)
            scope = _scope(frag, False, 1)
            role = _role(frag, scope, ak, S, T)
            units.append({"text": frag[:120], "scope": scope, "role": role, "anchor_kinds": sorted(ak),
                          "claim_impact": _claim_impact(role, ak, _toks(frag)), "is_sentence": False})
    return units


def _jac(a, b):
    sa, sb = set(_toks(a)), set(_toks(b))
    return len(sa & sb) / len(sa | sb) if (sa or sb) else 0.0


def _jac_idx(a, ts):
    return [( _jac(a, b), k) for k, b in enumerate(ts)]


def _is_safe(u):
    return u["claim_impact"] == "claim_preserving"


def fix_behavior_on(unit_text, F):
    """What did Fix do with a source fragment the human safely deleted?"""
    ut = [t for t in _toks(unit_text) if len(t) > 2]
    if not ut:
        return "n/a"
    ft = _toks(F)
    if unit_text.lower().strip() and unit_text.lower().strip() in F.lower():
        return "unchanged"
    present = sum(1 for t in ut if t in ft) / len(ut)
    if present < 0.34:
        return "deletes"
    return "rewrites_retains"   # content survives in Fix (reworded/substituted/compressed)


def _load(prefix):
    out = {}
    for f in sorted(glob.glob(str(RESULTS / f"policy-smoke-{prefix}-*.raw.json"))):
        try:
            out.update(_parse(json.loads(Path(f).read_text(encoding="utf-8"))["content"]))
        except Exception:
            pass
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    beemo = {}
    for line in (RESULTS / "beemo-heldout-100.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if refs:
            beemo[r["record_id"]] = (str(r["source_text"]), str(refs[0]))
    fix, hz = _load("frozen-fix-Beemo"), _load("frozen-hz-Beemo")
    rids = [r for r in beemo if r in fix and r in hz]
    n = len(rids)

    dels = {"human": {}, "fixmyslop": {}, "humanizer": {}}
    anchors_by = {}
    for rid in rids:
        S, H = beemo[rid]
        cm = extract_source_content_map(S, [])
        anchors_by[rid] = cm["hard_anchors"]
        dels["human"][rid] = deletions(S, H, cm["hard_anchors"])
        dels["fixmyslop"][rid] = deletions(S, str(fix[rid]), cm["hard_anchors"])
        dels["humanizer"][rid] = deletions(S, str(hz[rid]), cm["hard_anchors"])

    def docfreq(system, pred):
        return round(sum(1 for rid in rids if any(pred(u) for u in dels[system][rid])) / n, 3)

    # --- scope/role distributions (human, unit-level) ---
    scope_dist = Counter(u["scope"] for rid in rids for u in dels["human"][rid])
    role_dist = Counter(u["role"] for rid in rids for u in dels["human"][rid])

    # --- anchor overlap of human deletions (fraction of human deletion UNITS intersecting each) ---
    hum_units = [u for rid in rids for u in dels["human"][rid]]
    total_hu = len(hum_units)
    anchor_overlap = {cat: round(sum(1 for u in hum_units if set(u["anchor_kinds"]) & kinds) / total_hu, 3)
                      for cat, kinds in ANCHOR_CATS.items()}
    anchor_overlap["explicit_factual_proposition"] = round(
        sum(1 for u in hum_units if u["role"] in ("unique_proposition", "explanatory_detail")
            or (set(u["anchor_kinds"]) & {"number", "named_entity", "date"})) / total_hu, 3)

    # --- claim impact distribution (human deletion units) ---
    claim_dist = Counter(u["claim_impact"] for u in hum_units)
    claim_frac = {k: round(v / total_hu, 3) for k, v in claim_dist.items()}

    # --- safe-delete frequency (doc-level) ---
    safe = {s: docfreq(s, _is_safe) for s in dels}
    anyd = {s: docfreq(s, lambda u: True) for s in dels}
    unsafe_pred = lambda u: u["claim_impact"] in ("anchor_breaking", "certainty_changing", "claim_reducing")
    unsafe = {s: docfreq(s, unsafe_pred) for s in dels}
    certainty = {s: docfreq(s, lambda u: u["claim_impact"] == "certainty_changing") for s in dels}

    # --- Fix behavior on human safe-delete spans ---
    fixbeh = Counter()
    for rid in rids:
        for u in dels["human"][rid]:
            if _is_safe(u):
                fixbeh[fix_behavior_on(u["text"], str(fix[rid]))] += 1
    fixbeh_frac = {k: round(v / max(1, sum(fixbeh.values())), 3) for k, v in fixbeh.items()}

    # --- operation co-occurrence with deletion (human, doc-level) ---
    cooc = {}
    for op in ("de_nominalize", "repetition_reduction", "qualification_change"):
        with_del = wo_del = ndel = nno = 0
        for rid in rids:
            S, H = beemo[rid]
            ops = op_classify(S, H)
            has_del = "delete" in ops
            has_op = op in ops
            if has_del:
                ndel += 1; with_del += has_op
            else:
                nno += 1; wo_del += has_op
        cooc[op] = {"P(op|delete)": round(with_del / ndel, 3) if ndel else None,
                    "P(op|no_delete)": round(wo_del / nno, 3) if nno else None,
                    "share_of_op_docs_that_also_delete": None}
        op_docs = sum(1 for rid in rids if op in op_classify(*beemo[rid]))
        cooc[op]["share_of_op_docs_that_also_delete"] = round(
            sum(1 for rid in rids if op in op_classify(*beemo[rid]) and "delete" in op_classify(*beemo[rid])) / op_docs, 3) if op_docs else None

    # --- Humanizer safe vs protected deletions (doc-level) ---
    hz_summary = {"any_delete": anyd["humanizer"], "safe_delete": safe["humanizer"],
                  "protected_or_claim_delete": unsafe["humanizer"]}

    # --- summary deficits + closeable estimate ---
    total_deficit = round(anyd["human"] - anyd["fixmyslop"], 3)
    safe_deficit = round(safe["human"] - safe["fixmyslop"], 3)
    fidelity_conflict_deficit = round(unsafe["human"] - unsafe["fixmyslop"], 3)
    certainty_deficit = round(certainty["human"] - certainty["fixmyslop"], 3)
    closeable_fraction = round(safe_deficit / total_deficit, 3) if total_deficit else None

    report = {
        "corpus": "Beemo", "n": n, "human_deletion_units": total_hu,
        "human_scope_distribution": {k: round(v / total_hu, 3) for k, v in scope_dist.items()},
        "human_role_distribution": {k: round(v / total_hu, 3) for k, v in role_dist.items()},
        "human_anchor_overlap": anchor_overlap,
        "human_claim_impact": claim_frac,
        "delete_frequency_docs": anyd, "safe_delete_frequency_docs": safe,
        "unsafe_delete_frequency_docs": unsafe, "certainty_delete_frequency_docs": certainty,
        "fix_behavior_on_human_safe_deletes": fixbeh_frac,
        "operation_cooccurrence_with_deletion": cooc,
        "humanizer_deletions": hz_summary,
        "deficits": {"total_delete_deficit": total_deficit, "safe_delete_deficit": safe_deficit,
                     "fidelity_conflicting_delete_deficit": fidelity_conflict_deficit,
                     "certainty_qualification_deficit": certainty_deficit},
        "closeable_fraction_of_delete_gap": closeable_fraction,
    }
    (RESULTS / "delete-decomposition-beemo.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    def show(d):
        return "  ".join(f"{k}={v}" for k, v in d.items())
    print(f"===== Beemo delete decomposition (n={n}; {total_hu} human deletion units) =====")
    print(f"scope dist (human): {report['human_scope_distribution']}")
    print(f"role  dist (human): {report['human_role_distribution']}")
    print(f"\nanchor overlap of human deletions (frac of units): {anchor_overlap}")
    print(f"claim impact (human deletions): {claim_frac}")
    print(f"\ndelete freq (docs):        {show(anyd)}")
    print(f"SAFE-delete freq (docs):   {show(safe)}   <-- the number that matters")
    print(f"unsafe-delete freq (docs): {show(unsafe)}")
    print(f"certainty-delete (docs):   {show(certainty)}")
    print(f"\nFix behavior on human SAFE-delete spans: {fixbeh_frac}")
    print(f"\nop co-occurrence with deletion (human):")
    for op, v in cooc.items():
        print(f"  {op:22} {v}")
    print(f"\nHumanizer deletions: {hz_summary}")
    print(f"\n=== DEFICITS ===")
    print(f"  total delete deficit         : {total_deficit}")
    print(f"  safe-delete deficit          : {safe_deficit}")
    print(f"  fidelity-conflicting deficit : {fidelity_conflict_deficit}")
    print(f"  certainty/qualification def. : {certainty_deficit}")
    print(f"  closeable fraction of +{total_deficit} delete gap (safe/total): {closeable_fraction}")
    print("\nwrote results/delete-decomposition-beemo.json")


if __name__ == "__main__":
    main()
