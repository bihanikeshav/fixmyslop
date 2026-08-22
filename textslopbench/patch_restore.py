#!/usr/bin/env python3
"""v1 diff-and-patch architecture (LAMP smoke, operates on CACHED Pass-1 outputs).

Pass 1 (cached current FixMySlop) makes human-like edits — never told to preserve slop.
Pass 2 (deterministic): diff source vs rewrite, classify each source slop occurrence
preserved/removed, and audit the model's REMOVALS against human-editor behaviour — a removal is a
restore-candidate when it is low-E (humans usually retain it) and a one-off. E as a post-hoc audit
of an actual edit, not a source-side gate.
Pass 3 (micro-patch): restore only those spans. Level 1 = deterministic lexical swap (difflib
replace block, 0 model calls); Level 2 = one batched sentence-level micro-patch call; Level 3 =
skip (restructured too far). Then recompute HCSR + component CHEA + fidelity + Edit Precision.

Usage: python patch_restore.py [dry]   (dry = Pass 2/3 classification only, no model call)
"""
from __future__ import annotations

import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from slop_overrepresentation import resolve_profile, scan as slop_scan
from edit_budget import _load_E
from policy_smoke import select, score, _call, _parse, _mean, RESULTS
from budget_smoke import components

E_RESTORE_THRESH = 0.45   # E below this => humans usually RETAIN => removal is suspicious
REP_MAX = 1               # only restore one-off removals (repeated tics are genuine slop)


def _sentences(text):
    return [s for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def _word_idx(words, target):
    for i, w in enumerate(words):
        if w.lower().strip(".,;:!?\"'()") == target.lower():
            return i
    return -1


def _align(src_sents, rw_sents):
    """Greedy nearest rewrite sentence for each source sentence (difflib ratio)."""
    out = {}
    for i, s in enumerate(src_sents):
        best, bi = 0.0, None
        for j, r in enumerate(rw_sents):
            ratio = difflib.SequenceMatcher(None, s.split(), r.split(), autojunk=False).ratio()
            if ratio > best:
                best, bi = ratio, j
        out[i] = (bi, best)
    return out


def pass2_diff(source, rewrite, E):
    profile = resolve_profile(genre=None, source_model=None)
    occ = slop_scan(source, profile=profile)
    reps = {}
    for f in occ:
        reps[str(f["pattern_id"])] = reps.get(str(f["pattern_id"]), 0) + 1
    rw_low = rewrite.lower()
    out = []
    for f in occ:
        ev = str(f["evidence"]).strip()
        pid = str(f["pattern_id"])
        e_val = E["slop"].get(pid, E["slop_mean"])
        removed = len(ev) >= 3 and ev.lower() not in rw_low
        out.append({
            "evidence": ev, "pattern_id": pid, "rho": float(f["overrepresentation"]),
            "weight": float(f["weight"]), "E": round(e_val, 3), "repetition": reps[pid],
            "start": f["start"], "status": "removed" if removed else "preserved",
            "restore_candidate": removed and e_val < E_RESTORE_THRESH and reps[pid] <= REP_MAX
                                 and len(ev.split()) == 1,
        })
    return out


def plan_restore(source, rewrite, candidates):
    """Return (rewrite_after_L1, l2_requests, levels). L1 = deterministic swap; L2 = micro-patch."""
    src_sents, rw_sents = _sentences(source), _sentences(rewrite)
    align = _align(src_sents, rw_sents)
    # map each source-sentence index -> the candidate words that live in it
    result = rewrite
    l2 = []
    levels = {"L1": 0, "L2": 0, "L3": 0}
    for c in candidates:
        word = c["evidence"]
        si = next((i for i, s in enumerate(src_sents) if word.lower() in s.lower()), None)
        if si is None or align[si][0] is None or align[si][1] < 0.30:
            levels["L3"] += 1; c["level"] = "L3"; continue
        s_sent = src_sents[si]
        r_sent = rw_sents[align[si][0]]
        sw, rw = s_sent.split(), r_sent.split()
        # Level 1 ONLY for a clean single-word lexical substitution: the SOURCE side of the replace
        # block is exactly the target word (+/- trailing punct) and the REWRITE side is 1-2 words.
        # Anything wider (clause deleted/restructured) must NOT be spliced back here -> L2/L3.
        done = False
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sw, rw, autojunk=False).get_opcodes():
            if tag != "replace" or not (i1 <= _word_idx(sw, word) < i2):
                continue
            clean = (i2 - i1) == 1 and (j2 - j1) <= 2 and sw[i1].lower().strip(".,;:!?\"'()") == word.lower()
            if clean:
                new_sent = " ".join(rw[:j1] + [sw[i1]] + rw[j2:])
                if r_sent in result:
                    result = result.replace(r_sent, new_sent, 1)
                    levels["L1"] += 1; c["level"] = "L1"; done = True
            break
        if not done and c.get("level") != "L1":
            levels["L2"] += 1; c["level"] = "L2"
            l2.append({"word": word, "source_sentence": s_sent, "current_sentence": r_sent})
    return result, l2, levels


def micro_patch(l2_by_item):
    """One batched sentence-level call. Returns {key: patched_sentence}."""
    payload = []
    for key, reqs in l2_by_item.items():
        for k, r in enumerate(reqs):
            payload.append({"id": f"{key}#{k}", "source_sentence": r["source_sentence"],
                            "current_sentence": r["current_sentence"], "restore_word": r["word"]})
    if not payload:
        return {}
    system = ("You perform a minimal lexical restoration on ONE sentence. Each item has a "
              "source_sentence, a current_sentence (an edited version), and a restore_word from the "
              "source. Return current_sentence changed as little as possible to reintroduce the "
              "source's restore_word (or its exact lexical choice) IF it fits naturally; change "
              "nothing else, add no facts, keep all anchors. If it cannot fit naturally, return "
              "current_sentence unchanged. Return ONLY JSON {\"id\": \"sentence\", ...}.")
    msgs = [{"role": "system", "content": system},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]
    return _parse(_call(msgs, "micropatch-lamp"))


_STOP = {"a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "is", "was", "were",
         "be", "as", "that", "this", "its", "it", "with", "for", "by", "which", "both"}


def _norm(w):
    return w.lower().strip(".,;:!?\"'()—-")


def accept_restore(old, new, word):
    """CHEA-safety gate on a Level-2 micro-patch: accept the model's sentence ONLY if its sole
    content change is (re)introducing `word` (and at most dropping one synonym it replaced). Any
    wider rewording is rejected — we keep the current sentence — so the patch cannot drift rhetoric."""
    if not new or _norm(word) not in [_norm(w) for w in new.split()]:
        return False
    o = [_norm(w) for w in old.split()]
    n = [_norm(w) for w in new.split()]
    added, removed = [], []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, o, n, autojunk=False).get_opcodes():
        if tag in ("replace", "insert"):
            added += [w for w in n[j1:j2] if w and w not in _STOP]
        if tag in ("replace", "delete"):
            removed += [w for w in o[i1:i2] if w and w not in _STOP]
    return set(added) <= {_norm(word)} and len(removed) <= 1


def edit_precision(diffs):
    removed = [o for o in diffs if o["status"] == "removed"]
    if not removed:
        return None, None
    justified = sum(1 for o in removed if o["E"] >= E_RESTORE_THRESH)
    return round(justified / len(removed), 3), round(_mean([o["E"] for o in removed]), 3)


def full_score(items, rewrites):
    per = {p["rid"]: p for p in score(items, rewrites)}
    rows = []
    for it in items:
        r = dict(per[it["rid"]]); r.update(components(it, str(rewrites.get(it["rid"], ""))))
        rows.append(r)
    return rows


if __name__ == "__main__":
    dry = len(sys.argv) > 1 and sys.argv[1] == "dry"
    E = _load_E()
    items = [it for it in select()[0] if it["corpus"] == "LAMP"]
    current = _parse(json.loads((RESULTS / "policy-smoke-current.raw.json").read_text(encoding="utf-8"))["content"])

    diffs, restored_L1, l2_by_item, levels_tot = {}, {}, {}, {"L1": 0, "L2": 0, "L3": 0}
    for it in items:
        rid = it["rid"]; rw = str(current[rid])
        d = pass2_diff(it["S"], rw, E)
        diffs[rid] = d
        cands = [o for o in d if o["restore_candidate"]]
        new_rw, l2, lv = plan_restore(it["S"], rw, cands)
        restored_L1[rid] = new_rw
        if l2:
            l2_by_item[rid] = l2
        for k in levels_tot:
            levels_tot[k] += lv[k]
        rem = sum(o["status"] == "removed" for o in d)
        print(f"{it['label']:22} slop_occ={len(d):2} removed={rem:2} restore_cand={len(cands):2} "
              f"L1={lv['L1']} L2={lv['L2']} L3={lv['L3']}  cands={[o['evidence'] for o in cands]}")
    print(f"\nTOTAL levels: {levels_tot}")

    if dry:
        for rid, l2 in l2_by_item.items():
            for r in l2:
                print(f"  L2 [{rid[:16]}] restore '{r['word']}': {r['current_sentence'][:70]}")
        sys.exit(0)

    patched = dict(restored_L1)
    mp = micro_patch(l2_by_item)
    accepted, rejected = 0, 0
    for key, reqs in l2_by_item.items():
        for k, r in enumerate(reqs):
            new_sent = mp.get(f"{key}#{k}")
            if new_sent and r["current_sentence"] in patched[key] and \
                    accept_restore(r["current_sentence"], str(new_sent), r["word"]):
                patched[key] = patched[key].replace(r["current_sentence"], str(new_sent), 1)
                accepted += 1
            else:
                rejected += 1
    print(f"micro-patch: {accepted} accepted, {rejected} rejected by CHEA-safety gate")

    cur_rows = full_score(items, current)
    pat_rows = full_score(items, patched)

    def agg(rows, rewrites):
        keys = ("hcsr", "sed_final", "edit_magnitude", "dir_overall", "rhetoric", "phrasal",
                "syntax", "rhythm", "lexical", "redundancy_align", "exact")
        a = {k: _mean([r.get(k) for r in rows]) for k in keys}
        a["fidelity_pass_rate"] = _mean([1.0 if r["fidelity_pass"] else 0.0 for r in rows])
        precs = [edit_precision(pass2_diff(it["S"], str(rewrites[it["rid"]]), E)) for it in items]
        a["edit_precision"] = _mean([p[0] for p in precs])
        a["mean_E_removed"] = _mean([p[1] for p in precs])
        return a

    A = {"current": agg(cur_rows, current), "patched": agg(pat_rows, patched)}
    out = {"model": "gpt-5.6-luna", "dataset": "LAMP frozen (4)", "levels": levels_tot,
           "aggregate": A, "diffs": diffs}
    (RESULTS / "patch-restore-lamp.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'metric':20}{'current':>10}{'patched':>10}")
    for m in ("hcsr", "sed_final", "fidelity_pass_rate", "exact", "edit_magnitude", "dir_overall",
              "rhetoric", "phrasal", "syntax", "rhythm", "lexical", "redundancy_align",
              "edit_precision", "mean_E_removed"):
        print(f"{m:20}{str(A['current'].get(m)):>10}{str(A['patched'].get(m)):>10}")
    print(f"\n{'label':22}{'sedS':>6}{'sedH':>6}{'cur':>7}{'pat':>7}{'hcsr_c':>8}{'hcsr_p':>8}")
    cb = {r["rid"]: r for r in cur_rows}
    for it in items:
        p = next(r for r in pat_rows if r["rid"] == it["rid"]); c = cb[it["rid"]]
        print(f"{it['label']:22}{it['sed_s']:>6.0f}{it['sed_h']:>6.0f}{c['sed_final']:>7.1f}{p['sed_final']:>7.1f}"
              f"{c['hcsr']:>8.1f}{p['hcsr']:>8.1f}")
