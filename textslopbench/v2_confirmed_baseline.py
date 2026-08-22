#!/usr/bin/env python3
"""V2 CONFIRMATION (held-out, preregistered — see V2_CONFIRMATION_PREREG.md).
v2 = A_nolock (raw Humanizer -> 2-round anchor repair, no pre-lock) vs Humanizer (hz).
Beemo holdout-80 + LAMP holdout-100, k=3. Paired item-level bootstrap. Tier1/Tier2 verdicts.
Dumps 10 sample outputs for the manual coherence gate. Deterministic scoring; resumable (cached tags)."""
from __future__ import annotations
import json
import statistics
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from policy_smoke import _call, _parse, score, RESULTS, _refs
from pipeline import prepare_rewrite_context, finish_rewrite_context
from fidelity import audit as fidelity_audit
from slop_overrepresentation import weighted_density
from chea import build_conditional_model
from humanizer_vs_current import humanizer_messages
from bootstrap import paired_bootstrap

WORKERS, CHUNK, KGENS = 8, 10, 3
CORRECTION_SYS = (
    "Correct each draft using ONLY its actionable_findings and any hard-anchor failures. Restore every "
    "missing or underrepresented hard anchor exactly. Do NOT change spans listed under diagnostic_findings. "
    "Preserve every hard anchor, qualification, causal relationship, quotation, command, and source certainty. "
    "Do not add facts or make broad stylistic changes. Return ONLY JSON mapping id to corrected text.")
CORPORA = {"Beemo": "coverage-holdout-beemo-80.jsonl", "LAMP": "coverage-holdout-lamp-100.jsonl"}


def _par(jobs):
    def run(j):
        try:
            return _call(j[1], j[0])
        except Exception as e:
            print("  [warn]", j[0], e)
            return None
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        return list(ex.map(run, jobs))


def load_items(fname, corpus):
    rows = []
    for line in (RESULTS / fname).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if not refs:
            continue
        S, H = str(r["source_text"]), str(refs[0])
        rows.append({"rid": r["record_id"], "corpus": corpus, "S": S, "H": H,
                     "sed_s": weighted_density(S), "sed_h": weighted_density(H)})
    return rows


def gen_hz(items, corpus, g):
    jobs = [(f"conf-hz-{corpus}-g{g}-{ci // CHUNK}", humanizer_messages(items[ci:ci + CHUNK])) for ci in range(0, len(items), CHUNK)]
    out = {}
    for c in _par(jobs):
        if c:
            try:
                out.update(_parse(c))
            except Exception:
                pass
    return out


def repair(items, drafts, corpus, g, rounds=2):
    cur = dict(drafts)
    for rnd in range(rounds):
        need = []
        for it in items:
            rw = cur.get(it["rid"])
            if rw is None:
                continue
            ctx = prepare_rewrite_context(it["S"], "auto", [])
            ctx = finish_rewrite_context(ctx, str(rw), fidelity_audit(it["S"], str(rw), []))
            if ctx["targeted_correction"].get("needed"):
                need.append((it, str(rw), ctx["targeted_correction"]))
        if not need:
            break
        jobs = []
        for ci in range(0, len(need), CHUNK):
            batch = need[ci:ci + CHUNK]
            payload = [{"id": it["rid"], "draft": rw, "correction_plan": {
                "actionable_findings": tc.get("actionable_findings"), "anchor_coverage": tc.get("anchor_coverage"),
                "diagnostic_findings": tc.get("diagnostic_findings"), "instructions": tc.get("instructions")}}
                for (it, rw, tc) in batch]
            jobs.append((f"conf-A-{corpus}-g{g}-r{rnd}-{ci // CHUNK}",
                         [{"role": "system", "content": CORRECTION_SYS}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]))
        corr = {}
        for c in _par(jobs):
            if c:
                try:
                    corr.update(_parse(c))
                except Exception:
                    pass
        cur.update(corr)
    return cur


def _co(b, c="overall"):
    return (b or {}).get(c) if isinstance(b, dict) else None


def per_item(items, texts):
    sc = score([it for it in items if it["rid"] in texts and texts[it["rid"]]], texts)
    by = {p["rid"]: p for p in sc}
    S = {it["rid"]: it["S"] for it in items}
    out = {}
    for r, p in by.items():
        cb = p["chea"]
        out[r] = {"move_coverage": _co(cb.get("move_coverage")), "cond_dir": _co(cb.get("conditional_direction_agreement")),
                  "reference_chea": _co(cb.get("reference")), "cond_population": _co(cb.get("conditional_population")),
                  "consensus_only": _co(cb.get("conditional_consensus_only")), "rhetoric": _co(cb.get("reference"), "rhetoric"),
                  "fidelity": 1.0 if p["fidelity_pass"] else 0.0, "exact": p["exact"],
                  "jaccard": fidelity_audit(S[r], str(texts[r]), []).get("content_word_jaccard"),
                  "edit_magnitude": p["edit_magnitude"]}
    return out


ALIGN = ["move_coverage", "cond_dir", "reference_chea", "cond_population", "consensus_only", "rhetoric"]
POINT_MARGIN = {"move_coverage": -0.02, "cond_dir": -0.02, "reference_chea": -0.02, "cond_population": -0.02,
                "consensus_only": -0.03, "rhetoric": -0.03}
ALLM = ALIGN + ["fidelity", "exact", "jaccard", "edit_magnitude"]


def run_corpus(corpus, fname, samples):
    items = load_items(fname, corpus)
    build_conditional_model(corpus)
    print(f"[{corpus}] n={len(items)} k={KGENS}")
    hz_g, A_g, A_texts_last = [], [], {}
    for g in range(1, KGENS + 1):
        hz = gen_hz(items, corpus, g)
        A = repair(items, hz, corpus, g, rounds=2)
        hz_g.append(per_item(items, hz))
        A_g.append(per_item(items, A))
        A_texts_last = A
        print(f"  [{corpus}] gen{g}: hz={len(hz)} A_nolock={len(A)}")
    # 5 sample outputs for coherence gate (from last gen)
    for it in items[:5]:
        if it["rid"] in A_texts_last:
            samples.append({"corpus": corpus, "rid": it["rid"], "source": it["S"][:500], "v2_output": str(A_texts_last[it["rid"]])[:500]})

    def pim(gs):
        rids = set().union(*[set(g) for g in gs])
        out = {}
        for r in rids:
            for m in ALLM:
                vs = [gs[i][r][m] for i in range(len(gs)) if r in gs[i] and gs[i][r].get(m) is not None]
                out.setdefault(r, {})[m] = statistics.mean(vs) if vs else None
        return out
    hz_m, A_m = pim(hz_g), pim(A_g)

    def am(p, m):
        vs = [p[r][m] for r in p if p[r].get(m) is not None]
        return round(statistics.mean(vs), 4) if vs else None
    means = {"hz": {m: am(hz_m, m) for m in ALLM}, "v2": {m: am(A_m, m) for m in ALLM}}
    boots = {}
    for m in ALLM:
        cm = [r for r in A_m if r in hz_m and A_m[r].get(m) is not None and hz_m[r].get(m) is not None]
        boots[m] = paired_bootstrap([A_m[r][m] for r in cm], [hz_m[r][m] for r in cm]) if len(cm) >= 3 else None

    tier1 = {
        "fidelity_strict_superior": bool(boots["fidelity"] and boots["fidelity"]["delta"] > 0 and boots["fidelity"]["significant"]),
        "exact_strict_superior": bool(boots["exact"] and boots["exact"]["delta"] > 0 and boots["exact"]["significant"]),
        "fidelity_ceiling": means["v2"]["fidelity"] >= 0.98,
        "exact_ceiling": means["v2"]["exact"] >= 99.5,
        "jaccard_non_inferior": bool(boots["jaccard"] and boots["jaccard"]["ci_high"] >= -0.0001 and (means["v2"]["jaccard"] - means["hz"]["jaccard"]) >= -0.02),
    }
    tier1["pass"] = all(tier1.values())
    tier2 = {}
    for m in ALIGN:
        b = boots[m]
        tier2[m] = {"delta": b["delta"] if b else None, "ci_low": b["ci_low"] if b else None, "ci_high": b["ci_high"] if b else None,
                    "ci_non_inferior": bool(b and b["ci_high"] >= 0), "point_margin_pass": (means["v2"][m] >= means["hz"][m] + POINT_MARGIN[m])}
    tier2["ci_all_pass"] = all(tier2[m]["ci_non_inferior"] for m in ALIGN)
    tier2["point_all_pass"] = all(tier2[m]["point_margin_pass"] for m in ALIGN)
    return {"n": len(items), "means": means, "paired_vs_hz": boots, "tier1": tier1, "tier2": tier2}


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    samples = []
    report = {}
    for corpus, fname in CORPORA.items():
        report[corpus] = run_corpus(corpus, fname, samples)
    report["coherence_samples"] = samples
    report["tier1_both_corpora"] = all(report[c]["tier1"]["pass"] for c in CORPORA)
    report["tier2_ci_both_corpora"] = all(report[c]["tier2"]["ci_all_pass"] for c in CORPORA)
    (RESULTS / "v2-confirmation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    for corpus in CORPORA:
        r = report[corpus]
        print(f"\n===== {corpus} (n={r['n']}) =====")
        print(f"{'metric':16}{'hz':>10}{'v2':>10}{'delta':>9}{'CI':>20}")
        for m in ALLM:
            b = r["paired_vs_hz"][m]
            ci = f"[{b['ci_low']:+.3f},{b['ci_high']:+.3f}]{'*' if b['significant'] else ''}" if b else "-"
            d = f"{b['delta']:+.3f}" if b else "-"
            print(f"{m:16}{str(r['means']['hz'][m]):>10}{str(r['means']['v2'][m]):>10}{d:>9}{ci:>20}")
        print(f"  TIER1 pass={r['tier1']['pass']}  {r['tier1']}")
        print(f"  TIER2 ci_all={r['tier2']['ci_all_pass']} point_all={r['tier2']['point_all_pass']}")
    print(f"\n===== VERDICT =====")
    print(f"Tier1 (Pareto gain) BOTH corpora: {report['tier1_both_corpora']}")
    print(f"Tier2 (alignment non-inferiority, CI) BOTH corpora: {report['tier2_ci_both_corpora']}")
    print("wrote results/v2-confirmation.json (+ coherence_samples for manual gate)")


if __name__ == "__main__":
    main()
