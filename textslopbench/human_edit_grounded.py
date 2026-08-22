#!/usr/bin/env python3
"""Human-edit-grounded scoring — the deterministic CORE of TextSlopBench (no LLM judge).

Ground truth is what real editors did to model prose: S = LLM source, H = human edit,
F = FixMySlop, B = baseline Humanizer. We do NOT ask "is F textually similar to H" (two
editors rewrite differently); we ask "did F move the source in the same linguistic/rhetorical
DIRECTIONS humans move it." Metrics:

  1. feature_vector(T)         rich, flat, deterministic feature vector (lexical/phrase/slop/
                               syntax/rhythm/semantic/rhetorical)
  2. edit_delta(S, X)          f(X) - f(S), genre pinned to the source
  3. human_edit_alignment      corpus-standardized cosine + direction agreement of dF vs dH
  4. conditional_alignment     CHEA: bucket items by source-state, learn the human majority
                               edit direction per (feature, bucket), score system agreement
  5. sed_target                Slop Evidence Density vs the HUMAN residual (target is H, not 0)

Blocked on data (not built here): span-level detection precision/recall needs a span-annotated
edit corpus; local LAMP has source->reference pairs + pairwise preferences, no span categories.
"""
from __future__ import annotations

import ast
import json
import math
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from humanstats import analyze, words
from slop_overrepresentation import weighted_density

EPS = 1e-9

# Rhetorical finding families surfaced as densities (per 1,000 tokens).
RHETORICAL_FAMILIES = (
    "inflation", "promotional", "participial_tail", "negative_parallelism", "false_range",
    "generic_conclusion", "hedging_stack", "filler", "vague_attribution", "interface_artifact",
    "ai_vocabulary", "copula_avoidance", "slop_overrepresentation",
)
SLOP_SUBTYPES = ("unigram", "2gram", "3gram", "rhetorical_template", "lexical_bundle")


def _get(d: dict, *path, default=0.0) -> float:
    cur = d
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return float(default)
        cur = cur[key]
    try:
        return float(cur)
    except (TypeError, ValueError):
        return float(default)


def feature_vector(text: str, genre: str = "auto") -> dict[str, float]:
    """Rich deterministic feature vector. Densities are per 1,000 tokens so they are
    comparable across document lengths."""
    report = analyze(text, genre)
    tokens = max(int(report.get("token_count", len(words(text))) or 1), 1)
    per_k = 1000.0 / tokens
    vec: dict[str, float] = {
        "formulaic_risk": _get(report, "formulaic_risk"),
        # lexical
        "ttr": _get(report, "lexical", "ttr"),
        "mattr": _get(report, "lexical", "mattr"),
        "mattr_500": _get(report, "lexical", "mattr_500"),
        "hdd": _get(report, "lexical", "hdd"),
        "distinct_1": _get(report, "lexical", "distinct_1"),
        "distinct_2": _get(report, "lexical", "distinct_2"),
        "distinct_3": _get(report, "lexical", "distinct_3"),
        "hapax_ratio": _get(report, "lexical", "hapax_ratio"),
        "lexical_density": _get(report, "lexical", "lexical_density"),
        "shannon_entropy": _get(report, "lexical", "shannon_entropy"),
        # phrase repetition
        "2_gram_repetition": _get(report, "phrasal", "2_gram_repetition"),
        "3_gram_repetition": _get(report, "phrasal", "3_gram_repetition"),
        "4_gram_repetition": _get(report, "phrasal", "4_gram_repetition"),
        # pos
        "pos_entropy": _get(report, "pos", "entropy"),
        "content_function_ratio": _get(report, "pos", "content_function_ratio"),
        # syntax
        "unique_template_ratio": _get(report, "syntax", "unique_template_ratio"),
        "template_entropy": _get(report, "syntax", "template_entropy"),
        "dominant_template_share": _get(report, "syntax", "dominant_template_share"),
        "subordinate_clause_rate": _get(report, "syntax", "subordinate_clause_rate"),
        "coordinate_clause_rate": _get(report, "syntax", "coordinate_clause_rate"),
        "nominalization_proxy_rate": _get(report, "syntax", "nominalization_proxy_rate"),
        # rhythm
        "mean_sentence_words": _get(report, "rhythm", "mean_sentence_words"),
        "sentence_cv": _get(report, "rhythm", "coefficient_of_variation"),
        # semantic (redundancy_proxy is a dict → use its scalar high-overlap pair count)
        "redundancy_proxy": float((report.get("semantic", {}).get("redundancy_proxy", {}) or {}).get("high_overlap_pair_count", 0) or 0),
        # slop evidence density (overall and per type), per 1k tokens
        "sed_total": _get(report, "slop", "weighted_density"),
    }
    # per-type slop densities
    by_type = {s: 0.0 for s in SLOP_SUBTYPES}
    for f in report.get("slop", {}).get("findings", []):
        st = str(f.get("subtype"))
        key = st if st in by_type else ("rhetorical_template" if "template" in st or "bundle" in st else None)
        if key in by_type:
            by_type[key] += float(f.get("weight", 0.0))
    for s in SLOP_SUBTYPES:
        vec[f"sed_{s}"] = round(by_type[s] * per_k, 4)
    # rhetorical finding densities
    counts = report.get("finding_counts", {}) or {}
    for fam in RHETORICAL_FAMILIES:
        vec[f"rhet_{fam}"] = round(float(counts.get(fam, 0)) * per_k, 4)
    return vec


# Feature components, so CHEA/direction can be split into interpretable families.
COMPONENTS = {
    "lexical": ["ttr", "mattr", "mattr_500", "hdd", "distinct_1", "distinct_2", "distinct_3",
                "hapax_ratio", "lexical_density", "shannon_entropy"],
    "phrasal": ["2_gram_repetition", "3_gram_repetition", "4_gram_repetition"],
    "syntax": ["unique_template_ratio", "template_entropy", "dominant_template_share",
               "subordinate_clause_rate", "coordinate_clause_rate", "nominalization_proxy_rate",
               "pos_entropy", "content_function_ratio"],
    "rhythm": ["mean_sentence_words", "sentence_cv"],
    "rhetoric": ["formulaic_risk", "sed_total", "sed_unigram", "sed_2gram", "sed_3gram",
                 "sed_rhetorical_template", "sed_lexical_bundle"] + [f"rhet_{f}" for f in RHETORICAL_FAMILIES],
    "semantic": ["redundancy_proxy"],
}


def component_direction(system_deltas, human_deltas) -> dict[str, object]:
    """Direction agreement split by feature component — shows *which* families a system moves the
    human way, instead of hiding it in one cosine."""
    out = {}
    for comp, feats in COMPONENTS.items():
        matched = total = 0
        for dS, dH in zip(system_deltas, human_deltas):
            for k in feats:
                h = dH.get(k, 0.0)
                if abs(h) <= EPS:
                    continue
                total += 1
                matched += _sign(dS.get(k, 0.0)) == _sign(h)
        out[comp] = round(matched / total, 4) if total else None
    return out


def edit_delta(source: str, target: str) -> dict[str, float]:
    src = feature_vector(source, "auto")
    genre = str(analyze(source, "auto").get("genre", "auto"))
    tgt = feature_vector(target, genre)
    return {k: round(tgt[k] - src[k], 6) for k in src if k in tgt}


def _sign(x: float, eps: float = EPS) -> int:
    return 0 if abs(x) < eps else (1 if x > 0 else -1)


def human_edit_alignment(system_deltas, human_deltas, feature_std) -> dict[str, object]:
    """Corpus-standardized cosine + direction agreement, averaged over items.

    Deltas are z-scaled by the per-feature std of the HUMAN deltas so heterogeneous feature
    scales (risk in points vs ratios in [0,1]) do not dominate the cosine."""
    keys = sorted(feature_std)
    cosines, dir_agrees = [], []
    for dS, dH in zip(system_deltas, human_deltas):
        s = [dS.get(k, 0.0) / feature_std[k] for k in keys]
        h = [dH.get(k, 0.0) / feature_std[k] for k in keys]
        ns, nh = math.sqrt(sum(v * v for v in s)), math.sqrt(sum(v * v for v in h))
        cosines.append(sum(a * b for a, b in zip(s, h)) / (ns * nh) if ns and nh else 0.0)
        moved = [(a, b) for a, b in zip(s, h) if abs(b) > EPS]  # features the human moved
        dir_agrees.append(sum(_sign(a) == _sign(b) for a, b in moved) / len(moved) if moved else 0.0)
    return {
        "mean_cosine": round(statistics.mean(cosines), 4) if cosines else 0.0,
        "mean_direction_agreement": round(statistics.mean(dir_agrees), 4) if dir_agrees else 0.0,
        "n": len(cosines),
    }


def build_conditional_model(source_vecs, human_deltas, min_consensus=0.6, min_bucket=4):
    """CHEA target: for each feature, tertile-bucket items by SOURCE value and record the human
    majority edit direction per bucket (only where a consensus exists). Returns a callable that
    scores a system's deltas against the learned human directions."""
    keys = sorted(human_deltas[0]) if human_deltas else []
    model = {}  # feature -> {bucket_index: majority_sign}
    edges = {}
    for k in keys:
        svals = sorted(v.get(k, 0.0) for v in source_vecs)
        if len(svals) < 3:
            continue
        lo, hi = svals[len(svals) // 3], svals[2 * len(svals) // 3]
        edges[k] = (lo, hi)
        buckets = {0: [], 1: [], 2: []}
        for sv, dH in zip(source_vecs, human_deltas):
            b = 0 if sv.get(k, 0.0) <= lo else (2 if sv.get(k, 0.0) >= hi else 1)
            buckets[b].append(_sign(dH.get(k, 0.0)))
        model[k] = {}
        for b, signs in buckets.items():
            nz = [s for s in signs if s != 0]
            if len(signs) < min_bucket or not nz:
                continue
            pos = sum(s > 0 for s in nz)
            frac = max(pos, len(nz) - pos) / len(nz)
            if frac >= min_consensus:
                model[k][b] = 1 if pos >= len(nz) - pos else -1

    def bucket_of(k, sv):
        lo, hi = edges[k]
        return 0 if sv <= lo else (2 if sv >= hi else 1)

    def score(source_vec, system_delta):
        matched = evaluable = 0
        for k, buckets in model.items():
            if k not in edges:
                continue
            b = bucket_of(k, source_vec.get(k, 0.0))
            target = buckets.get(b)
            if target is None:
                continue
            evaluable += 1
            if _sign(system_delta.get(k, 0.0)) == target:
                matched += 1
        return {"matched": matched, "evaluable": evaluable, "rate": round(matched / evaluable, 4) if evaluable else None}

    return score, model


def sed_target(items, system_key) -> dict[str, object]:
    """Is the system's residual slop density closer to the HUMAN residual than the baseline is?
    Target is H, not 0 — if editors leave some overrepresented phrase alone, 0 is the wrong goal."""
    sed_s = [weighted_density(it["S"]) for it in items]
    sed_h = [weighted_density(it["H"]) for it in items]
    sed_sys = [weighted_density(it[system_key]) for it in items]
    gaps = [abs(a - b) for a, b in zip(sed_sys, sed_h)]
    return {
        "mean_sed_source": round(statistics.mean(sed_s), 3),
        "mean_sed_human": round(statistics.mean(sed_h), 3),
        "mean_sed_system": round(statistics.mean(sed_sys), 3),
        # HCSR: Human-Calibrated Slop Residual — distance to the human edit's residual, NOT to 0.
        # Lower is better; driving SED to 0 is penalized because humans don't.
        "hcsr": round(statistics.mean(gaps), 3),
        "mean_abs_gap_to_human": round(statistics.mean(gaps), 3),
    }


# dataset -> (heldout, fix, baseline) filename templates ({n} filled in).
DATASETS = {
    "LAMP": ("lamp-heldout-{n}.jsonl", "lamp_fix_new_{n}.jsonl", "lamp_baseline_{n}.jsonl"),
    "Beemo": ("beemo-heldout-{n}.jsonl", "beemo_fix_new_{n}.jsonl", "beemo_baseline_{n}.jsonl"),
}


def _parse_refs(raw):
    if isinstance(raw, list):
        return raw
    for parser in (json.loads, ast.literal_eval):
        try:
            val = parser(raw)
            if isinstance(val, list):
                return val
        except Exception:
            pass
    return [raw] if isinstance(raw, str) and raw.strip() else []


def _load_jsonl(path: Path) -> dict:
    return {json.loads(l)["record_id"]: json.loads(l)
            for l in path.read_text(encoding="utf-8").splitlines() if l.strip()}


def load_join(dataset: str = "LAMP", n: int = 24):
    R = ROOT / "textslopbench" / "results"
    held_t, fix_t, base_t = DATASETS[dataset]
    held = _load_jsonl(R / held_t.format(n=n))
    fix = _load_jsonl(R / fix_t.format(n=n))
    base = _load_jsonl(R / base_t.format(n=n))
    items = []
    for rid in held:
        if rid not in fix or rid not in base:
            continue
        refs = _parse_refs(held[rid].get("human_references"))
        if not refs:
            continue
        items.append({"rid": rid, "S": str(held[rid]["source_text"]), "H": str(refs[0]),
                      "F": str(fix[rid]["rewrite"]), "B": str(base[rid]["rewrite"]),
                      "stratum": held[rid].get("stratum")})
    return items


def run(dataset: str = "LAMP", n: int = 24) -> dict[str, object]:
    items = load_join(dataset, n)
    for it in items:
        it["fvS"] = feature_vector(it["S"], "auto")
        it["dH"] = edit_delta(it["S"], it["H"])
        it["dF"] = edit_delta(it["S"], it["F"])
        it["dB"] = edit_delta(it["S"], it["B"])
    keys = sorted(set.intersection(*[set(it["dH"]) for it in items]))
    feature_std = {}
    for k in keys:
        vals = [it["dH"][k] for it in items]
        sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
        feature_std[k] = sd if sd > EPS else 1.0
    src_vecs = [it["fvS"] for it in items]
    human_deltas = [it["dH"] for it in items]
    score_fn, model = build_conditional_model(src_vecs, human_deltas)

    def chea(delta_key):
        rates = [score_fn(it["fvS"], it[delta_key])["rate"] for it in items]
        rates = [r for r in rates if r is not None]
        return round(statistics.mean(rates), 4) if rates else None

    out = {
        "benchmark": "TextSlopBench / human-edit-grounded", "dataset": f"{dataset}-{n}", "n": len(items),
        "note": "Deterministic, no LLM judge. Ground truth = professional human edits.",
        "conditional_features_with_consensus": sum(len(v) for v in model.values()),
        "strata": ({s: sum(str(it.get("stratum")) == s for it in items) for s in sorted({str(it.get("stratum")) for it in items})} if any(it.get("stratum") for it in items) else None),
        "systems": {},
    }
    for name, dkey in (("FixMySlop", "dF"), ("Humanizer", "dB")):
        align = human_edit_alignment([it[dkey] for it in items], human_deltas, feature_std)
        out["systems"][name] = {
            "human_edit_alignment": align,
            "conditional_human_edit_alignment": chea(dkey),
            "component_direction_agreement": component_direction([it[dkey] for it in items], human_deltas),
            "sed_target": sed_target(items, dkey[-1]),
        }
    return out


if __name__ == "__main__":
    dataset = sys.argv[1] if len(sys.argv) > 1 else "LAMP"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    result = run(dataset, n)
    (ROOT / "textslopbench" / "results" / f"human-edit-grounded-{dataset.lower()}-{n}.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
