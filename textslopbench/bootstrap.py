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
