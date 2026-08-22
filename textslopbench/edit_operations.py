#!/usr/bin/env python3
"""Operation-level taxonomy of Beemo edits: classify each transformation (source->target) into an
interpretable set of operations, then compare human vs FixMySlop vs Humanizer operation frequencies and
locate the 2-3 operations carrying most of FixMySlop's coverage deficit. Deterministic; no LLM.

Uses the frozen-100 Beemo set (diagnostic only) with the cached FixMySlop + Humanizer rewrites.
Operation frequency = fraction of documents in which the operation is present (an edit can carry
several). Detectors are heuristic and documented inline; treat magnitudes as directional, not exact.
"""
from __future__ import annotations

import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from policy_smoke import _parse, _refs, RESULTS

_WORD = re.compile(r"[A-Za-z0-9']+")
_SENT = re.compile(r"[^.!?]*[.!?]+|\S[^.!?]*$")
_NOMINAL = re.compile(r"\b\w{4,}(?:tion|tions|ment|ments|ance|ence|ity|ities|ness|sion|sions)\b", re.I)
HEDGES = {"may", "might", "could", "would", "should", "can", "perhaps", "possibly", "likely",
          "generally", "often", "sometimes", "arguably", "seems", "appears", "tends", "relatively",
          "somewhat", "fairly", "roughly", "approximately", "presumably", "essentially", "typically"}
FRAMING = ["it is important to note", "it's important to note", "it is worth noting", "worth noting that",
           "in conclusion", "to summarize", "in summary", "overall,", "i hope this helps", "sure,",
           "certainly,", "as an ai", "in today's", "in the world of", "when it comes to", "note that",
           "keep in mind", "that being said", "at the end of the day", "needless to say",
           "first and foremost", "last but not least", "it is essential", "it's essential",
           "plays a crucial role", "plays a vital role", "in order to", "it should be noted"]

OPS = ["delete", "compress", "merge", "split", "reorder", "lexical_substitution", "de_nominalize",
       "remove_formulaic_framing", "repetition_reduction", "qualification_change", "other"]


def _toks(s):
    return _WORD.findall(s.lower())


def _sents(t):
    return [s.strip() for s in _SENT.findall(t) if s.strip()]


def _jac(a, b):
    sa, sb = set(_toks(a)), set(_toks(b))
    return len(sa & sb) / len(sa | sb) if (sa or sb) else 0.0


def _rep_score(text):
    """# of 3-/4-gram occurrences that are repeats (occurrence count beyond the first, summed)."""
    toks = _toks(text)
    total = 0
    for n in (3, 4):
        c = Counter(tuple(toks[i:i + n]) for i in range(len(toks) - n + 1))
        total += sum(v - 1 for v in c.values() if v > 1)
    return total


def _framing_count(text):
    low = text.lower()
    return sum(low.count(p) for p in FRAMING)


def classify(S, T):
    """Return a set of operations present in the transformation S->T (heuristic, document-level)."""
    ss, ts = _sents(S), _sents(T)
    present = set()
    if not ss:
        return present
    THR = 0.35
    # best target match per source sentence + reverse
    best_j = []
    for a in ss:
        sims = [_jac(a, b) for b in ts] or [0.0]
        j = max(range(len(sims)), key=lambda k: sims[k])
        best_j.append((j, sims[j]))
    # DELETE: a source sentence with no adequately-similar target
    if any(sim < THR for _, sim in best_j):
        present.add("delete")
    # MERGE: >=2 source sentences map to the same target sentence (well-matched)
    tgt_hits = Counter(j for (j, sim) in best_j if sim >= THR)
    if any(c >= 2 for c in tgt_hits.values()):
        present.add("merge")
    # SPLIT: one source sentence is highly similar to >=2 target sentences
    for a in ss:
        if sum(1 for b in ts if _jac(a, b) >= THR) >= 2:
            present.add("split")
            break
    # REORDER: matched pairs whose target order inverts source order
    matched = [(i, j) for i, (j, sim) in enumerate(best_j) if sim >= THR]
    tj = [j for _, j in matched]
    if any(tj[a] > tj[b] for a in range(len(tj)) for b in range(a + 1, len(tj))):
        present.add("reorder")
    # COMPRESS / LEXICAL_SUBSTITUTION on matched pairs
    for i, (j, sim) in enumerate(best_j):
        if sim < THR:
            continue
        ws, wt = len(_toks(ss[i])), len(_toks(ts[j]))
        if wt < 0.72 * ws and ws >= 8:
            present.add("compress")
        elif 0.85 <= (wt / ws if ws else 1) <= 1.18 and 0.45 <= sim <= 0.9:
            sa, sb = set(_toks(ss[i])), set(_toks(ts[j]))
            if len(sa ^ sb) >= 3:
                present.add("lexical_substitution")
    # CONTENT operations (document level)
    if len(_NOMINAL.findall(T)) <= len(_NOMINAL.findall(S)) - 1:
        present.add("de_nominalize")
    if _framing_count(T) <= _framing_count(S) - 1:
        present.add("remove_formulaic_framing")
    if _rep_score(T) < _rep_score(S):
        present.add("repetition_reduction")
    hs = sum(1 for w in _toks(S) if w in HEDGES)
    ht = sum(1 for w in _toks(T) if w in HEDGES)
    if abs(hs - ht) >= 1:
        present.add("qualification_change")
    if not present:
        present.add("other")
    return present


def _load_cached(prefix):
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
    fix = _load_cached("frozen-fix-Beemo")
    hz = _load_cached("frozen-hz-Beemo")
    rids = [rid for rid in beemo if rid in fix and rid in hz]

    freq = {"human": Counter(), "fixmyslop": Counter(), "humanizer": Counter()}
    for rid in rids:
        S, H = beemo[rid]
        freq["human"].update(classify(S, H))
        freq["fixmyslop"].update(classify(S, str(fix[rid])))
        freq["humanizer"].update(classify(S, str(hz[rid])))
    n = len(rids)

    rows = []
    for op in OPS:
        h = freq["human"][op] / n
        f = freq["fixmyslop"][op] / n
        z = freq["humanizer"][op] / n
        rows.append({"operation": op, "human": round(h, 3), "fixmyslop": round(f, 3),
                     "humanizer": round(z, 3), "deficit_human_minus_fix": round(h - f, 3),
                     "hz_minus_fix": round(z - f, 3)})
    rows.sort(key=lambda r: -r["deficit_human_minus_fix"])

    report = {"corpus": "Beemo", "n": n, "operations": rows,
              "note": "operation frequency = fraction of documents where the operation is present; "
                      "detectors heuristic/deterministic (see edit_operations.py)."}
    # smallest set of ops covering most of the positive deficit
    total_def = sum(max(0, r["deficit_human_minus_fix"]) for r in rows)
    cum, top = 0.0, []
    for r in rows:
        if r["deficit_human_minus_fix"] <= 0:
            break
        top.append(r["operation"]); cum += r["deficit_human_minus_fix"]
        if total_def and cum / total_def >= 0.60:
            break
    report["top_deficit_operations"] = top
    report["top_deficit_share"] = round(cum / total_def, 3) if total_def else None
    (RESULTS / "edit-operations-beemo.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"===== Beemo edit operations (n={n}); freq = fraction of docs where op present =====")
    print(f"{'operation':26}{'human':>8}{'fixmyslop':>11}{'humanizer':>11}{'H-Fix':>8}{'Hz-Fix':>8}")
    for r in rows:
        print(f"{r['operation']:26}{r['human']:>8}{r['fixmyslop']:>11}{r['humanizer']:>11}"
              f"{r['deficit_human_minus_fix']:>8}{r['hz_minus_fix']:>8}")
    print(f"\nSmallest op set covering >=60% of FixMySlop's positive deficit: {top}  "
          f"({report['top_deficit_share']:.0%} of total deficit)" if total_def else "no positive deficit")
    print("wrote results/edit-operations-beemo.json")


if __name__ == "__main__":
    main()
