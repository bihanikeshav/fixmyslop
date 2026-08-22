#!/usr/bin/env python3
"""Dump a reproducible sample of human deletions labeled UNSAFE (certainty_changing, claim_reducing)
with full context, so the edits can be read and judged: genuine meaning change vs expendable detail.
No model calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from anchors import extract_source_content_map
from policy_smoke import _refs, RESULTS
from edit_operations import _sents, _toks
from delete_decomposition import deletions, _jac

WANT = {"certainty_changing", "claim_reducing"}
PER_CAT = 14


def survives(frag, target):
    ft = set(_toks(target))
    ct = [t for t in _toks(frag) if len(t) > 3]
    if not ct:
        return None
    return round(sum(1 for t in ct if t in ft) / len(ct), 2)


def src_sentence(frag, S):
    for s in _sents(S):
        if frag[:40].lower() in s.lower() or _jac(frag, s) > 0.5:
            return s
    return "(sub-span)"


def aligned_target(src_sent, T):
    ts = _sents(T)
    if not ts:
        return "(target empty)"
    j = max(range(len(ts)), key=lambda k: _jac(src_sent, ts[k]))
    return ts[j] if _jac(src_sent, ts[j]) >= 0.35 else "[sentence dropped, no aligned target]"


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

    buckets = {c: [] for c in WANT}
    for rid in beemo:
        S, H = beemo[rid]
        cm = extract_source_content_map(S, [])
        for u in deletions(S, H, cm["hard_anchors"]):
            c = u["claim_impact"]
            if c in WANT and len(buckets[c]) < PER_CAT:
                ss = src_sentence(u["text"], S)
                buckets[c].append({"rid": rid, "frag": u["text"], "scope": u["scope"], "role": u["role"],
                                   "anchor_kinds": u["anchor_kinds"], "src_sentence": ss,
                                   "target": aligned_target(ss, H), "survives_in_target": survives(u["text"], H)})
        if all(len(v) >= PER_CAT for v in buckets.values()):
            break

    for cat in ("certainty_changing", "claim_reducing"):
        print(f"\n{'='*90}\n{cat.upper()} — {len(buckets[cat])} human deletions\n{'='*90}")
        for i, e in enumerate(buckets[cat], 1):
            print(f"\n[{cat[:4]}-{i}] rid={e['rid']}  scope={e['scope']} role={e['role']} anchors={e['anchor_kinds']} survives={e['survives_in_target']}")
            print(f"  DELETED : {e['frag']!r}")
            print(f"  SOURCE  : {e['src_sentence'][:220]!r}")
            print(f"  HUMAN   : {e['target'][:220]!r}")
    (RESULTS / "unsafe-deletion-sample.json").write_text(json.dumps(buckets, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote results/unsafe-deletion-sample.json")


if __name__ == "__main__":
    main()
