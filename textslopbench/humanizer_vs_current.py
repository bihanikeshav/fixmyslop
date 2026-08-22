#!/usr/bin/env python3
"""Apples-to-apples: baseline humanizer vs current FixMySlop on the frozen items, scored through the
CURRENT canonical pipeline (dual CHEA + SED + HCSR + fidelity + edit magnitude). One luna call
(humanizer outputs); FixMySlop-current is reused from cache. For grounding external feedback.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from policy_smoke import select, _call, _parse, score, aggregate, RESULTS

HUMANIZER_SYS = (
    "You are a text humanizer. Rewrite the text so it does not read as AI-generated: remove inflated "
    "symbolism, promotional language, vague attributions, em-dash overuse, the rule of three, AI "
    "vocabulary, negative parallelisms, and conjunctive-phrase overuse; vary rhythm; make it sound "
    "naturally human. Preserve every hard anchor exactly (numbers, dates, names, quotations, URLs) "
    "and do not invent facts. Return ONLY JSON {\"id\": \"revised text\", ...}.")


def humanizer_messages(items):
    payload = [{"id": it["rid"], "text": it["S"]} for it in items]
    return [{"role": "system", "content": HUMANIZER_SYS},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]


def _by_corpus(per):
    out = {}
    for corpus in ("LAMP", "Beemo"):
        rows = [p for p in per if p["corpus"] == corpus]
        if rows:
            out[corpus] = aggregate(rows)
    return out


if __name__ == "__main__":
    items = select()[0]
    current = _parse(json.loads((RESULTS / "policy-smoke-current.raw.json").read_text(encoding="utf-8"))["content"])
    humanizer = _parse(_call(humanizer_messages(items), "humanizer-frozen"))

    scored = {"fixmyslop_current": score(items, current), "baseline_humanizer": score(items, humanizer)}
    result = {sys_name: _by_corpus(per) for sys_name, per in scored.items()}
    (RESULTS / "humanizer-vs-current-frozen.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    for corpus in ("LAMP", "Beemo"):
        print(f"\n===== {corpus} =====")
        fx, hz = result["fixmyslop_current"].get(corpus), result["baseline_humanizer"].get(corpus)
        if not fx:
            continue
        print(f"{'metric':26}{'fixmyslop':>12}{'humanizer':>12}")
        for m in ("hcsr", "sed_final", "fidelity_pass_rate", "exact", "edit_magnitude"):
            print(f"{m:26}{str(fx.get(m)):>12}{str(hz.get(m)):>12}")
        for kind in ("reference", "population", "population_consensus_only"):
            print(f"  -- {kind} CHEA (mode={fx['chea']['mode']}) --")
            for c in ("overall", "lexical", "phrasal", "syntax", "rhythm", "rhetoric", "semantic"):
                a = fx["chea"][kind] and fx["chea"][kind].get(c)
                b = hz["chea"][kind] and hz["chea"][kind].get(c)
                print(f"    {c:22}{str(a):>12}{str(b):>12}")
        print(f"  population_support: {json.dumps(fx['chea']['population_support'])}")
