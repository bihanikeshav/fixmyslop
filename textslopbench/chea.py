#!/usr/bin/env python3
"""CHEA in two flavours (Conditional Human-Edit Alignment) — canonical implementation.

Reference CHEA   — CHEA_ref(S, H_i, R): did the system move each feature the way the ONE assigned
                   editor did? The stricter benchmark. Objective, reproducible.
Population CHEA  — CHEA_pop(S, {H_1..H_k}, R): is each move PLAUSIBLE under the distribution of human
                   edits? True form needs several human edits of the SAME source.

Population CHEA mode:
  true_multireference — the item carries several independent human edits (not available in LAMP/Beemo)
  corpus_proxy        — population approximated from the CORPUS of single human edits (per-feature
                        consensus). NEVER present this as true multi-reference scoring.
  unavailable         — no reference / no population model.

Both metrics are reported together and never collapsed into one score. Deterministic; no model calls.
The benchmark scorer (`policy_smoke.score`) imports THIS module — no duplicated logic.
"""
from __future__ import annotations

import ast
import json
import statistics
import sys
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from human_edit_grounded import COMPONENTS, edit_delta, feature_vector, _sign, EPS

RESULTS = ROOT / "textslopbench" / "results"
MIN_SUPPORT = 10
CONS_THRESH = 0.70
COMPONENT_KEYS = ["overall", "lexical", "phrasal", "syntax", "rhythm", "rhetoric", "semantic"]
CORPUS_FILE = {"LAMP": "lamp-heldout-100.jsonl", "Beemo": "beemo-heldout-100.jsonl",
               "Baumler": "baumler-corpus.jsonl"}


def _refs(raw):
    if isinstance(raw, list):
        return raw
    for p in (json.loads, ast.literal_eval):
        try:
            v = p(raw)
            if isinstance(v, list):
                return v
        except Exception:
            pass
    return [raw] if isinstance(raw, str) and raw.strip() else []


def corpus_consensus(corpus_jsonl):
    """Population model from a single-reference corpus. Returns (cons, n_human_edits) where cons maps
    each feature -> 'pos'/'neg' (humans move it consistently), 'split' (they disagree), None (low
    support). Stands in for {H_1..H_k} until we have several human edits per source."""
    signs = defaultdict(list)
    n = 0
    for line in (RESULTS / corpus_jsonl).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if not refs:
            continue
        n += 1
        for k, v in edit_delta(str(r["source_text"]), str(refs[0])).items():
            if abs(v) > EPS:
                signs[k].append(_sign(v))
    cons = {}
    for k, ss in signs.items():
        if len(ss) < MIN_SUPPORT:
            cons[k] = None
            continue
        pos = sum(1 for s in ss if s > 0) / len(ss)
        cons[k] = "pos" if pos >= CONS_THRESH else "neg" if (1 - pos) >= CONS_THRESH else "split"
    return cons, n


class PopulationModel:
    """Per-feature human edit-direction distribution + support metadata."""

    def __init__(self, cons, n_edits, corpus, mode="corpus_proxy", threshold=CONS_THRESH):
        self.cons = cons
        self.n_edits = n_edits
        self.corpus = corpus
        self.mode = mode
        self.threshold = threshold
        self.consensus_features = [k for k, v in cons.items() if v in ("pos", "neg")]
        self.split_features = [k for k, v in cons.items() if v == "split"]
        self.scorable = [k for k, v in cons.items() if v in ("pos", "neg", "split")]

    def coverage(self):
        """Discriminative coverage = consensus / scorable features."""
        return round(len(self.consensus_features) / len(self.scorable), 3) if self.scorable else None

    def support(self, fallback_total=None, scored_total=None):
        d = {"corpus": self.corpus, "mode": self.mode, "n_human_edits": self.n_edits,
             "consensus_features": len(self.consensus_features), "split_features": len(self.split_features),
             "scorable_features": len(self.scorable), "consensus_threshold": self.threshold,
             "discriminative_coverage": self.coverage()}
        if fallback_total is not None:
            d["fallback_features_total"] = fallback_total
        if scored_total is not None:
            d["scored_features_total"] = scored_total
        return d


@lru_cache(maxsize=8)
def build_population_model(corpus):
    """corpus_proxy PopulationModel for a named corpus (LAMP/Beemo). Cached."""
    cons, n = corpus_consensus(CORPUS_FILE[corpus])
    return PopulationModel(cons, n, corpus, mode="corpus_proxy")


def _ref_agree(dS, dH, feats):
    moved = [(dS.get(k, 0.0), dH[k]) for k in feats if abs(dH.get(k, 0.0)) > EPS]
    return round(statistics.mean(_sign(a) == _sign(b) for a, b in moved), 3) if moved else None


def _pop_detail(dS, dH, feats, cons):
    """Returns (population_score, consensus_only_score, fallback_count, scored_count)."""
    hits, cons_hits, fallback, scored = [], [], 0, 0
    for k in feats:
        if abs(dH.get(k, 0.0)) <= EPS:
            continue
        scored += 1
        s = _sign(dS.get(k, 0.0))
        c = cons.get(k)
        if c == "split":
            hits.append(1)                                        # plausible either way
        elif c in ("pos", "neg"):
            hit = 1 if s == (1 if c == "pos" else -1) else 0
            hits.append(hit)
            cons_hits.append(hit)
        else:
            fallback += 1
            hits.append(1 if s == _sign(dH[k]) else 0)            # low support -> reference sign
    return (round(statistics.mean(hits), 3) if hits else None,
            round(statistics.mean(cons_hits), 3) if cons_hits else None, fallback, scored)


def reference_chea(source, rewrite, reference):
    dS, dH = edit_delta(source, rewrite), edit_delta(source, reference)
    out = {"overall": _ref_agree(dS, dH, list(dH.keys()))}
    out.update({c: _ref_agree(dS, dH, fs) for c, fs in COMPONENTS.items()})
    return out


def population_chea(source, rewrite, reference, cons):
    dS, dH = edit_delta(source, rewrite), edit_delta(source, reference)
    out = {"overall": _pop_detail(dS, dH, list(dH.keys()), cons)[0]}
    out.update({c: _pop_detail(dS, dH, fs, cons)[0] for c, fs in COMPONENTS.items()})
    return out


# ---- Phase A additions: dead-zone, Reference decomposition, source-state-conditioned population ----

MOVE_DEAD_FRAC = 0.10   # a feature counts as "moved" only if |delta| > 0.10 * median human |delta| for it


def _moved(x, dz):
    return abs(x) > dz


def _feat_deadzones(deltas_by_feat):
    """Per-feature dead-zone = MOVE_DEAD_FRAC * median(|human delta|) over items that moved it (>EPS)."""
    dz = {}
    for k, vals in deltas_by_feat.items():
        moved = [abs(v) for v in vals if abs(v) > EPS]
        dz[k] = MOVE_DEAD_FRAC * statistics.median(moved) if moved else EPS
    return dz


def reference_decomposition(dS, dH, feats, dz):
    """Split Reference CHEA into move_coverage x conditional_direction_agreement (dead-zoned).
    move_coverage = (#human-moved features the system also moved) / (#human-moved features).
    conditional_direction_agreement = (#same-direction) / (#features moved by BOTH)."""
    hm = [k for k in feats if _moved(dH.get(k, 0.0), dz.get(k, EPS))]
    if not hm:
        return None, None
    both = [k for k in hm if _moved(dS.get(k, 0.0), dz.get(k, EPS))]
    coverage = round(len(both) / len(hm), 3)
    cond = round(statistics.mean(_sign(dS[k]) == _sign(dH[k]) for k in both), 3) if both else None
    return coverage, cond


def _quantile_edges(vals, n_bins):
    vals = sorted(vals)
    if len(set(vals)) < n_bins:
        return []                      # too few distinct values -> single (global) bin
    return [vals[int(q * len(vals))] for q in [i / n_bins for i in range(1, n_bins)]]


def _bin_index(edges, v):
    i = 0
    for e in edges:
        if v >= e:
            i += 1
        else:
            break
    return i


class ConditionalPopulationModel:
    """P(human edit direction | source feature state). For each feature: bin the SOURCE value, and
    within each bin hold the human edit-direction signs (leave-one-out capable). Backoff bin->global;
    if global support is also thin the feature is 'unavailable' (never falls back to reference sign)."""

    mode = "corpus_proxy"

    def __init__(self, rows, corpus, n_bins=3, min_support=8, threshold=0.70):
        self.corpus = corpus
        self.n_bins = n_bins
        self.min_support = min_support
        self.threshold = threshold
        src_vals = defaultdict(list)
        deltas = defaultdict(list)
        recs = []
        for rid, S, ref in rows:
            fv = feature_vector(S)
            dH = edit_delta(S, ref)
            recs.append((rid, fv, dH))
            for k, v in fv.items():
                src_vals[k].append(v)
            for k, v in dH.items():
                deltas[k].append(v)
        self.dz = _feat_deadzones(deltas)
        self.edges = {k: _quantile_edges(vs, n_bins) for k, vs in src_vals.items()}
        # cell[(feature, bin)] -> list of (rid, sign) for human MOVES (dead-zoned); global[feature] too
        self.cell = defaultdict(list)
        self.glob = defaultdict(list)
        for rid, fv, dH in recs:
            for k, dv in dH.items():
                if not _moved(dv, self.dz.get(k, EPS)):
                    continue
                s = _sign(dv)
                b = _bin_index(self.edges.get(k, []), fv.get(k, 0.0))
                self.cell[(k, b)].append((rid, s))
                self.glob[k].append((rid, s))
        self.n_edits = len(recs)

    def _consensus(self, signs):
        if len(signs) < self.min_support:
            return None
        pos = sum(1 for s in signs if s > 0) / len(signs)
        return "pos" if pos >= self.threshold else "neg" if (1 - pos) >= self.threshold else "split"

    def consensus(self, feature, source_val, exclude_rid=None):
        b = _bin_index(self.edges.get(feature, []), source_val)
        cell = [s for rid, s in self.cell.get((feature, b), []) if rid != exclude_rid]
        c = self._consensus(cell)
        if c is not None:
            return c, "bin"
        glob = [s for rid, s in self.glob.get(feature, []) if rid != exclude_rid]
        c = self._consensus(glob)
        return (c, "global") if c is not None else (None, "unavailable")

    def coverage_summary(self):
        """Corpus-level discriminative coverage over (feature,bin) cells with enough support."""
        cells = list(self.cell) + [(k, "g") for k in self.glob]
        defined = split = 0
        for k in self.glob:
            for b in range(self.n_bins + 1):
                c = self._consensus([s for _, s in self.cell.get((k, b), [])])
                if c in ("pos", "neg"):
                    defined += 1
                elif c == "split":
                    split += 1
        tot = defined + split
        return {"corpus": self.corpus, "mode": self.mode, "n_human_edits": self.n_edits,
                "n_bins": self.n_bins, "min_support": self.min_support, "consensus_threshold": self.threshold,
                "consensus_cells": defined, "split_cells": split, "scorable_cells": tot,
                "discriminative_coverage": round(defined / tot, 3) if tot else None,
                "move_dead_frac": MOVE_DEAD_FRAC}


def _load_rows(corpus):
    rows = []
    for line in (RESULTS / CORPUS_FILE[corpus]).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if refs:
            rows.append((r["record_id"], str(r["source_text"]), str(refs[0])))
    return rows


@lru_cache(maxsize=8)
def build_conditional_model(corpus):
    return ConditionalPopulationModel(_load_rows(corpus), corpus)


def _cond_detail(dS, dH, source_fv, feats, model, exclude_rid, dz):
    """Conditional Population over features the human moved (dead-zoned) with a defined conditional
    consensus. Returns (population, consensus_only, n_scored, n_consensus, n_unavailable)."""
    hits, cons_hits = [], []
    unavailable = 0
    for k in feats:
        if not _moved(dH.get(k, 0.0), dz.get(k, EPS)):
            continue
        c, _ = model.consensus(k, source_fv.get(k, 0.0), exclude_rid)
        if c is None:
            unavailable += 1
            continue                                     # never fall back to reference sign
        s = _sign(dS.get(k, 0.0))
        if c == "split":
            hits.append(1)
        else:
            hit = 1 if s == (1 if c == "pos" else -1) else 0
            hits.append(hit)
            cons_hits.append(hit)
    return (round(statistics.mean(hits), 3) if hits else None,
            round(statistics.mean(cons_hits), 3) if cons_hits else None,
            len(hits), len(cons_hits), unavailable)


def chea_all(source, rewrite, reference, model, rid=None):
    """Frozen per-item CHEA block: legacy Reference CHEA (compat) + decomposition
    (move_coverage / conditional_direction_agreement) + source-state-conditioned Population
    (conditional_population / conditional_consensus_only) + per-item discriminative coverage.
    `model` is a ConditionalPopulationModel or None."""
    dS, dH = edit_delta(source, rewrite), edit_delta(source, reference)
    comp_feats = {"overall": list(dH.keys()), **COMPONENTS}
    reference_scores = {c: _ref_agree(dS, dH, fs) for c, fs in comp_feats.items()}
    block = {"mode": "unavailable" if model is None else model.mode, "reference": reference_scores}
    if model is None:
        block.update(move_coverage=None, conditional_direction_agreement=None,
                     conditional_population=None, conditional_consensus_only=None,
                     discriminative_coverage=None, corpus=None, unavailable_features=None)
        return block
    fv = feature_vector(source)
    dz = model.dz
    mcov, cdir, cpop, ccon = {}, {}, {}, {}
    disc_num = disc_den = unav = 0
    for c, fs in comp_feats.items():
        mcov[c], cdir[c] = reference_decomposition(dS, dH, fs, dz)
        p, co, ns, nc, u = _cond_detail(dS, dH, fv, fs, model, rid, dz)
        cpop[c], ccon[c] = p, co
        if c == "overall":
            disc_num, disc_den, unav = nc, ns, u
    block.update(move_coverage=mcov, conditional_direction_agreement=cdir,
                 conditional_population=cpop, conditional_consensus_only=ccon,
                 discriminative_coverage=round(disc_num / disc_den, 3) if disc_den else None,
                 corpus=model.corpus, unavailable_features=unav)
    return block


if __name__ == "__main__":
    from policy_smoke import select, _parse, score, aggregate

    corpus = sys.argv[1] if len(sys.argv) > 1 else "LAMP"
    items = [it for it in select()[0] if it["corpus"] == corpus]
    rewrites = _parse(json.loads((RESULTS / "policy-smoke-current.raw.json").read_text(encoding="utf-8"))["content"])
    rewrites = {it["rid"]: rewrites[it["rid"]] for it in items}
    agg = aggregate(score(items, rewrites))
    c = agg["chea"]
    print(f"CHEA - current FixMySlop on {corpus} (n={agg['n']})   mode: {c['mode']}\n")
    print(f"{'component':10}{'Ref':>8}{'moveCov':>9}{'dir|co':>9}{'condPop':>9}{'consOnly':>10}")
    for k in COMPONENT_KEYS:
        row = [c["reference"].get(k), (c["move_coverage"] or {}).get(k),
               (c["conditional_direction_agreement"] or {}).get(k),
               (c["conditional_population"] or {}).get(k),
               (c["conditional_consensus_only"] or {}).get(k)]
        print(f"{k:10}" + "".join(f"{str(v):>{w}}" for v, w in zip(row, (8, 9, 9, 9, 10))))
    print(f"\ncoverage_summary: {json.dumps(c.get('coverage_summary'))}")
