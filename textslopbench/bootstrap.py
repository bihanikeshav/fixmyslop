#!/usr/bin/env python3
"""Paired item-level bootstrap for system-vs-system metric deltas. Deterministic (seeded)."""
from __future__ import annotations

import random
import statistics


def paired_bootstrap(a_vals, b_vals, iters=2000, seed=1234, ci=0.95):
    """a_vals, b_vals: per-item metric values aligned by index (None dropped pairwise). Returns the
    A-minus-B delta with a bootstrap CI over items and paired win/loss/tie counts (A's perspective)."""
    pairs = [(x, y) for x, y in zip(a_vals, b_vals) if x is not None and y is not None]
    if not pairs:
        return None
    diffs = [x - y for x, y in pairs]
    n = len(diffs)
    rng = random.Random(seed)
    boots = []
    for _ in range(iters):
        s = [diffs[rng.randrange(n)] for _ in range(n)]
        boots.append(statistics.mean(s))
    boots.sort()
    lo = boots[int((1 - ci) / 2 * iters)]
    hi = boots[min(iters - 1, int((1 + ci) / 2 * iters))]
    eps = 1e-9
    wins = sum(1 for d in diffs if d > eps)
    losses = sum(1 for d in diffs if d < -eps)
    return {"delta": round(statistics.mean(diffs), 4), "ci_low": round(lo, 4), "ci_high": round(hi, 4),
            "n": n, "wins": wins, "losses": losses, "ties": n - wins - losses,
            "significant": (lo > 0) or (hi < 0)}


def paired_cluster_bootstrap(
    a_vals,
    b_vals,
    clusters,
    iters=2000,
    seed=1234,
    ci=0.95,
    *,
    cluster_source=None,
    grouping_fallback=False,
):
    """Paired bootstrap that resamples whole writer/prompt clusters.

    Within a sampled cluster, every paired item is retained. Missing grouping is
    assigned an item-level fallback only so a descriptive interval can still be
    emitted; it never supports an inferential significance claim.
    """
    triples = []
    missing_grouping = False
    for index, (x, y, group) in enumerate(zip(a_vals, b_vals, clusters)):
        if x is None or y is None:
            continue
        if group is None or not str(group).strip():
            missing_grouping = True
            group = f"__item_fallback__:{index}"
        triples.append((x, y, str(group)))
    if not triples:
        return None
    grouped = {}
    for x, y, group in triples:
        grouped.setdefault(group, []).append(x - y)
    group_ids = sorted(grouped)
    rng = random.Random(seed)
    boots = []
    for _ in range(iters):
        sampled = [group_ids[rng.randrange(len(group_ids))] for _ in group_ids]
        diffs = [diff for group in sampled for diff in grouped[group]]
        boots.append(statistics.mean(diffs))
    boots.sort()
    lo = boots[int((1 - ci) / 2 * iters)]
    hi = boots[min(iters - 1, int((1 + ci) / 2 * iters))]
    diffs = [x - y for x, y, _ in triples]
    eps = 1e-9
    wins = sum(1 for d in diffs if d > eps)
    losses = sum(1 for d in diffs if d < -eps)
    fallback_used = bool(grouping_fallback or missing_grouping)
    inference_valid = len(group_ids) >= 2 and not fallback_used
    if len(group_ids) < 2:
        inference_reason = "fewer_than_two_clusters"
    elif fallback_used:
        inference_reason = "missing_explicit_grouping"
    else:
        inference_reason = None
    return {
        "delta": round(statistics.mean(diffs), 4),
        "ci_low": round(lo, 4), "ci_high": round(hi, 4),
        "n": len(diffs), "clusters": len(group_ids),
        "wins": wins, "losses": losses, "ties": len(diffs) - wins - losses,
        "significant": inference_valid and ((lo > 0) or (hi < 0)),
        "resampling_unit": "cluster",
        "cluster_source": cluster_source or ("item_fallback" if fallback_used else "unspecified"),
        "cluster_fallback": fallback_used,
        "inference_valid": inference_valid,
        "inference_reason": inference_reason,
    }
