#!/usr/bin/env python3
"""Deterministic plan audit for the structural-findings bridge (step 8). No generation, no LLM.
Runs the bridge over a dev set and reports selectivity: which docs get structural findings, by family,
predicted direction, confidence, dedup/defer decisions, and docs still receiving nothing."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from pipeline import prepare_rewrite_context
from chea import build_conditional_model

RESULTS = ROOT / "textslopbench" / "results"
FAMILIES = ("clause", "formulaic", "repetition")


def load(fname):
    return [json.loads(l) for l in (RESULTS / fname).read_text(encoding="utf-8").splitlines() if l.strip()]


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    corpus = sys.argv[2] if len(sys.argv) > 2 else "Beemo"
    fname = sys.argv[1] if len(sys.argv) > 1 else "coverage-dev-beemo.jsonl"
    model = build_conditional_model(corpus)
    dev = load(fname)
    N = len(dev)

    fired_docs = 0; by_family = Counter(); by_dir = Counter(); by_level = Counter()
    skip_reasons = Counter(); defer = 0; rhet_only = 0; nothing = 0; both_rhet_struct = 0
    total_struct = 0; per_doc = []
    for r in dev:
        ctx = prepare_rewrite_context(r["source_text"], "auto", [], structural_families=FAMILIES, structural_model=model)
        af = ctx["model_summary"]["actionable_findings"]
        struct = [f for f in af if f.get("structural")]
        rhet = [f for f in af if not f.get("structural")]
        aud = ctx["structural_audit"]
        for f in struct:
            by_family[f["family"]] += 1; by_dir[f["predicted_direction"]] += 1; by_level[f["confidence_level"]] += 1
        for s in aud["skipped"]:
            skip_reasons[s["reason"]] += 1
            if s["reason"] == "deferred_to_rhetorical_path":
                defer += 1
        total_struct += len(struct)
        if struct:
            fired_docs += 1
            if rhet:
                both_rhet_struct += 1
        elif rhet:
            rhet_only += 1
        else:
            nothing += 1
        per_doc.append({"rid": r["record_id"], "n_rhetorical": len(rhet), "n_structural": len(struct),
                        "families": [f["family"] for f in struct],
                        "directions": [f["predicted_direction"] for f in struct]})

    report = {
        "corpus": corpus, "dev_file": fname, "n_docs": N,
        "docs_with_structural_findings": fired_docs,
        "docs_rhetorical_only": rhet_only, "docs_no_findings": nothing,
        "docs_both_rhetorical_and_structural": both_rhet_struct,
        "total_structural_findings": total_struct,
        "mean_structural_per_doc": round(total_struct / N, 3),
        "by_family": dict(by_family), "by_direction": dict(by_dir), "by_confidence_level": dict(by_level),
        "skip_reasons": dict(skip_reasons), "formulaic_deferred_to_rhetorical": defer,
        "max_per_family_respected": all(c <= N for c in by_family.values()),
        "per_doc": per_doc,
    }
    (RESULTS / "coverage-bridge-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"===== Structural-bridge plan audit — {fname} ({corpus}, n={N}) =====")
    print(f"docs with >=1 structural finding : {fired_docs}/{N} ({fired_docs/N:.0%})")
    print(f"  of which also have rhetorical  : {both_rhet_struct}")
    print(f"docs rhetorical-only             : {rhet_only}")
    print(f"docs with NO findings at all     : {nothing}/{N} ({nothing/N:.0%})   (v1 baseline: most Beemo docs)")
    print(f"total structural findings        : {total_struct}  (mean {total_struct/N:.2f}/doc, cap 2)")
    print(f"by family    : {dict(by_family)}")
    print(f"by direction : {dict(by_dir)}")
    print(f"by confidence: {dict(by_level)}  (bin = source-state-conditioned; global = backoff)")
    print(f"skip reasons : {dict(skip_reasons)}")
    print(f"formulaic deferred to rhetorical path (dedup): {defer}")
    print("\nwrote results/coverage-bridge-audit.json")


if __name__ == "__main__":
    main()
