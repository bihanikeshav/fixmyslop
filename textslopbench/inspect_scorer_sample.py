#!/usr/bin/env python3
"""Stratified sample from the corrected scorer for manual precision/recall validation. No model calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from anchors import extract_source_content_map, audit_anchor_coverage, QUALIFIER_RE
from policy_smoke import _refs, RESULTS
from edit_operations import _sents
from delete_scorer import score_system, _jac, _epistemic

PER = 10


def src_ctx(frag, S, T):
    ss = _sents(S)
    src = next((s for s in ss if frag[:30].lower() in s.lower() or _jac(frag, s) > 0.5), "(sub-span)")
    ts = _sents(T)
    tgt = "[dropped]"
    if ts:
        j = max(range(len(ts)), key=lambda k: _jac(src, ts[k]))
        tgt = ts[j] if _jac(src, ts[j]) >= 0.35 else "[dropped, no aligned target]"
    return src, tgt


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

    buckets = {"true_safe_deletion": [], "true_fidelity_conflict": [], "ambiguous": [], "certainty_conflict": []}
    for rid, (S, H) in beemo.items():
        cm = extract_source_content_map(S, [])
        units, cc, region = score_system(S, H, cm)
        for u in units:
            b = u["label"]
            if len(buckets[b]) < PER:
                src, tgt = src_ctx(u["text"], S, H)
                buckets[b].append({"rid": rid, "frag": u["text"], "role": u["role"], "scope": u["scope"],
                                   "src": src[:200], "tgt": tgt[:200]})
        # certainty conflicts: matched claims where source qualified, target not
        if len(buckets["certainty_conflict"]) < PER:
            for a in _sents(S):
                ts = _sents(H)
                if not ts:
                    break
                j = max(range(len(ts)), key=lambda k: _jac(a, ts[k]))
                if _jac(a, ts[j]) >= 0.35 and _epistemic(a) and not _epistemic(ts[j]):
                    buckets["certainty_conflict"].append({"rid": rid, "src": a[:200], "tgt": ts[j][:200]})
                    if len(buckets["certainty_conflict"]) >= PER:
                        break
        if all(len(v) >= PER for v in buckets.values()):
            break

    for b, items in buckets.items():
        print(f"\n{'='*88}\n{b.upper()} ({len(items)})\n{'='*88}")
        for i, e in enumerate(items, 1):
            if b == "certainty_conflict":
                print(f"[{i}] rid={e['rid']}\n  SRC: {e['src']!r}\n  TGT: {e['tgt']!r}")
            else:
                print(f"[{i}] rid={e['rid']} role={e['role']} scope={e['scope']} ")
                print(f"  DELETED: {e['frag']!r}\n  SRC: {e['src']!r}\n  TGT: {e['tgt']!r}")


if __name__ == "__main__":
    main()
