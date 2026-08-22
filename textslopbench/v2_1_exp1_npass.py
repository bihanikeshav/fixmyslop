#!/usr/bin/env python3
"""Fable Experiment 1 — the N-PASS probe (gates Option 1). If the heavy-corpus deficit is 'first-party
under-rewrites', re-applying our first-party Stage-1 to its OWN output 2-3x (then repair) should close it.
Exp0 predicts it will NOT (both systems already over-rewrite vs the human; the gap is edit-allocation).
Arms (each -> 2-round repair), LAMP+Baumler dev-40, k=1:
  hz     = Humanizer -> repair (confirmed champion baseline)
  rd_p1  = rules_detected 1 pass -> repair (our current first-party pipeline)
  rd_p2  = rules_detected 2 passes -> repair
  rd_p3  = rules_detected 3 passes -> repair
Also reports Stage-1 rewrite fraction per arm (vs human 0.30/0.32) to show volume drift.
"""
from __future__ import annotations
import json, statistics, sys
from difflib import SequenceMatcher
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(r"C:\Users\Keshav\Documents\ChatGPT\fixslop")
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from humanstats import words
from pipeline import prepare_rewrite_context, finish_rewrite_context
from fidelity import audit as fidelity_audit
from policy_smoke import _call, _parse, score, RESULTS, _refs
from chea import build_conditional_model
from slop_overrepresentation import weighted_density

WORKERS, CHUNK = 8, 10
CORPORA = {"LAMP": "coverage-dev-lamp.jsonl", "Baumler": "coverage-dev-baumler.jsonl"}
# reuse cached first-party pass-1 drafts (rules_detected g1) and cached Humanizer stage-1 g1
RD1_TAG = {"LAMP": "rulesdet-LAMP-g1", "Baumler": "rulesdet-Baumler-g1"}
HZ_TAG = {"LAMP": "s2b-hz-LAMP-g1", "Baumler": "rg2-s1-hz-Baumler-g1"}

RULES_BODY = (
    "You are a strict copy editor stripping the fingerprints of AI-generated writing. Rewrite the passage to "
    "eliminate EVERY instance of these tells, editing boldly and rephrasing whole sentences where needed, while "
    "keeping the meaning intact:\n"
    "1. Assistant/boilerplate framing. 2. Asserted importance ('a testament to','pivotal moment'). 3. Promotional "
    "adjectives ('groundbreaking','stunning','seamless'). 4. Unattributed authority ('experts say'). 5. Explanatory "
    "-ing tails (', highlighting ...'). 6. Contrast frames ('not only X but also Y'). 7. Rhetorical 'from X to Y' "
    "ranges. 8. Wordy filler ('in order to','it is important to note that'). 9. Stacked hedges. 10. Elaborate copulas "
    "('serves as','stands as','boasts'). 11. Generic upbeat endings. 12. Formulaic AI vocabulary ('delve','tapestry',"
    "'underscore','crucial','moreover','furthermore'). Also cut repetition and repeated sentence openings; vary "
    "rhythm. Preserve every number, date, name, quotation, and URL exactly; add no new facts.")
RULES_SYS = RULES_BODY + " Return ONLY JSON {\"id\": \"revised text\", ...}."
CORRECTION_SYS = ("Correct each draft using ONLY its actionable_findings and any hard-anchor failures. Restore every "
    "missing or underrepresented hard anchor exactly. Do NOT change spans listed under diagnostic_findings. Preserve "
    "every hard anchor, qualification, causal relationship, quotation, command, and source certainty. Do not add facts "
    "or make broad stylistic changes. Return ONLY JSON mapping id to corrected text.")


def par(jobs):
    def run(j):
        try:
            return (j[0], _call(j[1], j[0]))
        except Exception as e:
            print("  [warn]", j[0], str(e)[:60]); return (j[0], None)
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        return dict(ex.map(run, jobs))


def psafe(r):
    try:
        return _parse(r)
    except Exception:
        return {}


def load_dev(fname, corpus):
    rows = []
    for line in (RESULTS / fname).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line); refs = _refs(r.get("human_references"))
        if refs:
            S, H = str(r["source_text"]), str(refs[0])
            rows.append({"rid": r["record_id"], "corpus": corpus, "S": S, "H": H,
                         "sed_s": weighted_density(S), "sed_h": weighted_density(H)})
    return rows


def load_cached(prefix):
    d = {}
    for ci in range(0, 40, CHUNK):
        p = RESULTS / f"policy-smoke-{prefix}-{ci // CHUNK}.raw.json"
        if p.exists():
            d.update(psafe(json.loads(p.read_text(encoding="utf-8"))["content"]))
    return d


def rewrite_frac(src, sysx):
    a, b = words(src), words(str(sysx))
    return (1 - SequenceMatcher(None, a, b).ratio()) if a and b else None


def apply_pass(items, texts, corpus, passname):
    """Re-apply RULES_SYS to the current texts -> next-generation texts (cached by tag)."""
    jobs = []
    for ci in range(0, len(items), CHUNK):
        batch = [it for it in items[ci:ci + CHUNK] if texts.get(it["rid"])]
        if not batch:
            continue
        payload = [{"id": it["rid"], "text": str(texts[it["rid"]])} for it in batch]
        jobs.append((f"npass-{passname}-{corpus}-{ci // CHUNK}",
                     [{"role": "system", "content": RULES_SYS}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]))
    res = par(jobs)
    out = dict(texts)
    for k, v in res.items():
        out.update(psafe(v or ""))
    return out


def repair(items, texts, corpus, arm):
    cur = dict(texts)
    for rnd in range(2):
        jobs, jmap = [], {}
        need = []
        for it in items:
            rw = cur.get(it["rid"])
            if rw is None:
                continue
            ctx = prepare_rewrite_context(it["S"], "auto", [])
            ctx = finish_rewrite_context(ctx, str(rw), fidelity_audit(it["S"], str(rw), []))
            tc = ctx["targeted_correction"]
            if tc.get("needed"):
                need.append((it, str(rw), tc))
        for ci in range(0, len(need), CHUNK):
            batch = need[ci:ci + CHUNK]
            payload = [{"id": it["rid"], "draft": rw, "correction_plan": {"actionable_findings": tc.get("actionable_findings"), "anchor_coverage": tc.get("anchor_coverage"), "diagnostic_findings": tc.get("diagnostic_findings"), "instructions": tc.get("instructions")}} for (it, rw, tc) in batch]
            tag = f"npass-rep-{arm}-{corpus}-r{rnd}-{ci // CHUNK}"
            jobs.append((tag, [{"role": "system", "content": CORRECTION_SYS}, {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]))
            jmap[tag] = True
        if not jobs:
            break
        res = par(jobs)
        for tag in jmap:
            cur.update(psafe(res.get(tag) or ""))
    return cur


def _co(b, x="overall"):
    return (b or {}).get(x) if isinstance(b, dict) else None


def metrics(items, texts):
    valid = [it for it in items if texts.get(it["rid"])]
    sc = score(valid, texts)
    by = {p["rid"]: p for p in sc}
    def m(fn):
        xs = [fn(p) for p in by.values()]; xs = [v for v in xs if v is not None]
        return round(statistics.mean(xs), 4) if xs else None
    return {"move_coverage": m(lambda p: _co(p["chea"].get("move_coverage"))),
            "cond_dir": m(lambda p: _co(p["chea"].get("conditional_direction_agreement"))),
            "reference_chea": m(lambda p: _co(p["chea"].get("reference"))),
            "rhetoric": m(lambda p: _co(p["chea"].get("reference"), "rhetoric")),
            "fidelity": m(lambda p: 1.0 if p["fidelity_pass"] else 0.0), "exact": m(lambda p: p["exact"])}


def main():
    report = {}
    for corpus, fname in CORPORA.items():
        items = load_dev(fname, corpus)
        build_conditional_model(corpus)
        hz1 = load_cached(HZ_TAG[corpus])
        rd1 = load_cached(RD1_TAG[corpus])
        rd2 = apply_pass(items, rd1, corpus, "p2")
        rd3 = apply_pass(items, rd2, corpus, "p3")
        stage1 = {"hz": hz1, "rd_p1": rd1, "rd_p2": rd2, "rd_p3": rd3}
        rf = {a: round(statistics.mean([v for v in [rewrite_frac(it["S"], t.get(it["rid"], "")) for it in items] if v is not None]), 3) for a, t in stage1.items()}
        rf["human"] = round(statistics.mean([v for v in [rewrite_frac(it["S"], it["H"]) for it in items] if v is not None]), 3)
        final = {a: repair(items, t, corpus, a) for a, t in stage1.items()}
        report[corpus] = {"stage1_rewrite_frac": rf, "pipeline": {a: metrics(items, final[a]) for a in final}}

        print(f"\n=== {corpus} ===  stage1 rewrite_frac: human={rf['human']}  "
              f"hz={rf['hz']}  rd_p1={rf['rd_p1']}  rd_p2={rf['rd_p2']}  rd_p3={rf['rd_p3']}")
        KEYS = ["move_coverage", "cond_dir", "reference_chea", "rhetoric", "fidelity", "exact"]
        print(f"  {'metric':16}{'hz':>9}{'rd_p1':>9}{'rd_p2':>9}{'rd_p3':>9}")
        for k in KEYS:
            row = report[corpus]["pipeline"]
            print(f"  {k:16}{str(row['hz'][k]):>9}{str(row['rd_p1'][k]):>9}{str(row['rd_p2'][k]):>9}{str(row['rd_p3'][k]):>9}")

    (RESULTS / "v2_1-exp1-npass.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\nwrote results/v2_1-exp1-npass.json")
    print("READ: Option 1 SURVIVES only if rd_p2/rd_p3 close the cond_dir/reference_chea gap to hz WITHOUT")
    print("      cratering fidelity. If iterating just pushes rewrite_frac further above human and doesn't")
    print("      lift cond_dir, thoroughness wasn't the lever -> ship Option 3.")


if __name__ == "__main__":
    main()
