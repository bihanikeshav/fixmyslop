#!/usr/bin/env python3
"""Conditional human-residual estimator: E[SED_human | SED_source, genre].

Simple, interpretable, monotonic. Per-genre source-SED bins -> conditional median + p25/p75, made
non-decreasing in source SED via pool-adjacent-violators (PAV) isotonic smoothing, with linear
interpolation between bin centers and hierarchical fallback:

    genre+bin  ->  genre  ->  global+bin  ->  global

Human edits can INCREASE slop (LAMP 68->79), so nothing caps the estimate at the source SED.
Fit ONLY on dev rows; the frozen smoke rids are excluded. Deterministic, no model calls.
"""
from __future__ import annotations

import ast
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from slop_overrepresentation import weighted_density

RESULTS = ROOT / "textslopbench" / "results"
BIN_EDGES = [0, 3, 10, 25, 50, 90, 1e9]  # source-SED bins
MIN_BIN = 6
HELDOUT = {"LAMP": "lamp-heldout-100.jsonl", "Beemo": "beemo-heldout-100.jsonl"}


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


def _pav(centers, ys):
    """Pool-adjacent-violators: nearest non-decreasing fit to ys (weights = 1)."""
    blocks = [[y, 1, [i]] for i, y in enumerate(ys)]
    i = 0
    while i < len(blocks) - 1:
        if blocks[i][0] > blocks[i + 1][0] + 1e-12:
            v = (blocks[i][0] * blocks[i][1] + blocks[i + 1][0] * blocks[i + 1][1]) / (blocks[i][1] + blocks[i + 1][1])
            blocks[i] = [v, blocks[i][1] + blocks[i + 1][1], blocks[i][2] + blocks[i + 1][2]]
            del blocks[i + 1]
            i = max(i - 1, 0)
        else:
            i += 1
    out = [0.0] * len(ys)
    for v, _, idxs in blocks:
        for j in idxs:
            out[j] = round(v, 3)
    return out


def _bin_index(sed):
    for i in range(len(BIN_EDGES) - 1):
        if BIN_EDGES[i] <= sed < BIN_EDGES[i + 1]:
            return i
    return len(BIN_EDGES) - 2


def _bin_center(i):
    lo, hi = BIN_EDGES[i], BIN_EDGES[i + 1]
    return (lo + min(hi, lo * 2 + 30)) / 2  # bounded center for the open top bin


def _fit_genre(pairs):
    """pairs: list[(sed_s, sed_h)] -> populated bins with PAV-monotone median/p25/p75."""
    buckets = {}
    for s, h in pairs:
        buckets.setdefault(_bin_index(s), []).append(h)
    idxs = sorted(b for b, hs in buckets.items() if len(hs) >= MIN_BIN)
    if not idxs:
        return None
    centers = [_bin_center(i) for i in idxs]
    med = _pav(centers, [statistics.median(buckets[i]) for i in idxs])
    p25 = _pav(centers, [_pct(buckets[i], 0.25) for i in idxs])
    p75 = _pav(centers, [_pct(buckets[i], 0.75) for i in idxs])
    return {"centers": centers, "median": med, "p25": p25, "p75": p75, "bin_idx": idxs,
            "support": [len(buckets[i]) for i in idxs]}


def _pct(vals, p):
    vals = sorted(vals)
    return vals[min(len(vals) - 1, int(p * len(vals)))] if vals else 0.0


def _interp(x, xs, ys):
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= x <= xs[i + 1]:
            t = (x - xs[i]) / (xs[i + 1] - xs[i]) if xs[i + 1] > xs[i] else 0.0
            return ys[i] + t * (ys[i + 1] - ys[i])
    return ys[-1]


class ResidualEstimator:
    def __init__(self, exclude_rids=()):
        self.exclude = set(exclude_rids)
        self.by_genre = {}
        self.genre_flat = {}
        self.global_pairs = []
        for genre, fname in HELDOUT.items():
            pairs = []
            for line in (RESULTS / fname).read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                r = json.loads(line)
                if r["record_id"] in self.exclude:
                    continue
                refs = _refs(r.get("human_references"))
                if refs:
                    pairs.append((weighted_density(str(r["source_text"])), weighted_density(str(refs[0]))))
            self.by_genre[genre] = _fit_genre(pairs)
            self.genre_flat[genre] = [h for _, h in pairs]
            self.global_pairs += pairs
        self.global_fit = _fit_genre(self.global_pairs)
        self.global_flat = [h for _, h in self.global_pairs]

    def _global_bin_p75(self, sed_s):
        di = _bin_index(sed_s)
        if self.global_fit and di in self.global_fit["bin_idx"]:
            return _interp(sed_s, self.global_fit["centers"], self.global_fit["p75"])
        if self.global_flat:
            return _pct(self.global_flat, 0.75)
        return 0.0

    def predict(self, sed_s: float, genre: str) -> dict:
        di = _bin_index(sed_s)
        fit = self.by_genre.get(genre)
        if fit and di in fit["bin_idx"]:  # genre + bin: confident, tight interval
            support = fit["support"][fit["bin_idx"].index(di)]
            return self._pack(sed_s, fit, "genre_bin", support,
                              "high" if support >= 20 else "medium")
        if fit:  # genre has a monotone trend but not THIS bin: extrapolate median, widen upper
            rec = self._pack(sed_s, fit, "genre_extrap", min(fit["support"]), "low")
            rec["predicted_human_SED_p75"] = round(max(rec["predicted_human_SED_p75"], self._global_bin_p75(sed_s)), 2)
            return rec
        if self.global_fit and di in self.global_fit["bin_idx"]:
            pos = self.global_fit["bin_idx"].index(di)
            return self._pack(sed_s, self.global_fit, "global_bin", self.global_fit["support"][pos], "low")
        return self._flat(sed_s, self.global_flat, "global", len(self.global_flat))

    def _pack(self, sed_s, fit, level, support, confidence):
        return {"source_SED": round(sed_s, 2),
                "predicted_human_SED_median": round(_interp(sed_s, fit["centers"], fit["median"]), 2),
                "predicted_human_SED_p25": round(_interp(sed_s, fit["centers"], fit["p25"]), 2),
                "predicted_human_SED_p75": round(_interp(sed_s, fit["centers"], fit["p75"]), 2),
                "support_n": support, "fallback_level": level, "confidence": confidence}

    def _flat(self, sed_s, flat, level, support):
        return {"source_SED": round(sed_s, 2),
                "predicted_human_SED_median": round(statistics.median(flat), 2) if flat else 0.0,
                "predicted_human_SED_p25": round(_pct(flat, 0.25), 2),
                "predicted_human_SED_p75": round(_pct(flat, 0.75), 2),
                "support_n": support, "fallback_level": level,
                "confidence": "medium" if support >= 20 else "low"}


if __name__ == "__main__":
    from policy_smoke import select
    items, _ = select()
    est = ResidualEstimator(exclude_rids=[it["rid"] for it in items])
    print("Fitted bins (excluding 8 frozen smoke rids):")
    for g, fit in est.by_genre.items():
        if fit:
            print(f"  {g}: centers={[round(c,1) for c in fit['centers']]} median={fit['median']} "
                  f"p25={fit['p25']} p75={fit['p75']} support={fit['support']}")
    print(f"\n{'label':22}{'sed_S':>7}{'sed_H':>7}{'pred_med':>9}{'p25':>7}{'p75':>7}{'lvl':>11}{'conf':>7}")
    for it in items:
        p = est.predict(it["sed_s"], it["corpus"])
        inside = p["predicted_human_SED_p25"] <= it["sed_h"] <= p["predicted_human_SED_p75"]
        print(f"{it['label']:22}{it['sed_s']:>7.1f}{it['sed_h']:>7.1f}{p['predicted_human_SED_median']:>9.1f}"
              f"{p['predicted_human_SED_p25']:>7.1f}{p['predicted_human_SED_p75']:>7.1f}{p['fallback_level']:>11}{p['confidence']:>7}"
              f"  H_inside={inside}")
