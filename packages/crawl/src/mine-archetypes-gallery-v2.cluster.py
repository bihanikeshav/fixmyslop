"""
Ward-linkage clustering companion for mine-archetypes-gallery-v2.ts (FIX 2: non-chaining
clustering, to stop the 200-host portfolio pool chaining into one 52-member catch-all under
average linkage).

Input JSON (written by the .ts orchestrator):
  {
    "minClusterSize": 6,
    "capPerPageKind": 6,
    "bisectAbove": 20,
    "pageKinds": {
      "<pageKind>": { "hosts": [...], "vectors": [[...combined feature vec...], ...] },
      ...
    }
  }

For each pageKind:
  1. scipy.cluster.hierarchy.linkage(vectors, method="ward") on the combined feature vectors
     (block-scaled so squared Euclidean approximates the TS side's weighted combined distance).
  2. Try k = 2..min(40, n-1) via fcluster(criterion="maxclust"); pick the k whose valid
     (size >= minClusterSize) cluster count is largest but <= capPerPageKind (ties -> smallest k,
     for stability); falls back to the k closest to that band if none lands in it.
  3. Recursively bisect (sklearn KMeans, k=2, n_init=10) any resulting cluster with more than
     bisectAbove members, as long as BOTH halves would still meet minClusterSize; otherwise leave
     the oversized cluster intact (a hard-to-split, genuinely large family is not itself a defect).

Output JSON (read back by the .ts orchestrator):
  { "pageKinds": { "<pageKind>": { "clusters": [ { "hosts": [...] }, ... ] } } }

The TRUE visualCoherence floor (0.5, DINOv2 cosine) and the authored-family dedup are applied
back in Node — this script only does the linkage/cut/bisect mechanics on the numeric feature
space.
"""
import json
import sys

import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
from sklearn.cluster import KMeans


def tune_cut(Z, n, min_size, cap):
    """Mirror v1's tuneCutGallery intent: prefer the richest split (max valid cluster count)
    within [2, cap], tie-break toward a smaller/stabler k."""
    best = None
    max_k = min(40, max(2, n - 1))
    candidates = []
    for k in range(2, max_k + 1):
        labels = fcluster(Z, k, criterion="maxclust")
        sizes = {}
        for lab in labels:
            sizes[lab] = sizes.get(lab, 0) + 1
        valid_count = sum(1 for s in sizes.values() if s >= min_size)
        candidates.append((k, labels, valid_count))

    in_range = [c for c in candidates if 2 <= c[2] <= cap]
    if in_range:
        max_valid = max(c[2] for c in in_range)
        best_candidates = [c for c in in_range if c[2] == max_valid]
        best = min(best_candidates, key=lambda c: c[0])  # smallest k among the richest splits
    else:
        def band_dist(c):
            vc = c[2]
            if vc < 2:
                return 2 - vc
            return vc - cap
        best = min(candidates, key=lambda c: (band_dist(c), c[0]))

    k, labels, _ = best
    groups = {}
    for i, lab in enumerate(labels):
        groups.setdefault(lab, []).append(i)
    return list(groups.values())


def mean_pairwise_cosine(mat):
    """mat: (n, d) unit-scale-invariant — cosine similarity is invariant to a positive scalar,
    so this works directly on the scaled visual block without unscaling."""
    n = mat.shape[0]
    if n < 2:
        return 1.0
    norms = np.linalg.norm(mat, axis=1, keepdims=True)
    norms[norms < 1e-12] = 1e-12
    unit = mat / norms
    sim = unit @ unit.T
    iu = np.triu_indices(n, k=1)
    return float(sim[iu].mean())


def recursive_bisect(idxs, vectors, visual_block, min_size, bisect_above, coherence_floor):
    """idxs: list of indices into `vectors` (global). Returns list of index-lists.

    Splits (on the VISUAL block specifically, to directly target visual coherence — the metric
    the floor check downstream in Node actually enforces) while a group is oversized OR its
    visual coherence is below the floor, as long as both halves would still clear min_size.
    """
    n = len(idxs)
    coherence = mean_pairwise_cosine(visual_block[idxs])
    needs_split = n > bisect_above or coherence < coherence_floor
    if not needs_split or n < 2 * min_size:
        return [idxs]
    sub = visual_block[idxs]
    km = KMeans(n_clusters=2, n_init=10, random_state=0)
    labels = km.fit_predict(sub)
    a = [idxs[i] for i in range(n) if labels[i] == 0]
    b = [idxs[i] for i in range(n) if labels[i] == 1]
    if len(a) < min_size or len(b) < min_size:
        # a 2-means split would strand a piece below the min cluster size; keep the parent whole
        return [idxs]
    return recursive_bisect(a, vectors, visual_block, min_size, bisect_above, coherence_floor) + recursive_bisect(
        b, vectors, visual_block, min_size, bisect_above, coherence_floor
    )


def main():
    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path, "r", encoding="utf8") as f:
        payload = json.load(f)

    min_size = payload["minClusterSize"]
    cap = payload["capPerPageKind"]
    bisect_above = payload["bisectAbove"]
    visual_dim = payload["visualDim"]
    coherence_floor = payload.get("coherenceFloor", 0.5)

    out = {"pageKinds": {}}
    for pk, data in payload["pageKinds"].items():
        hosts = data["hosts"]
        vectors = np.array(data["vectors"], dtype=np.float64)
        visual_block = vectors[:, :visual_dim]
        n = len(hosts)
        if n < min_size:
            continue

        Z = linkage(vectors, method="ward")
        groups = tune_cut(Z, n, min_size, cap)

        # recursively bisect any oversized OR visually-incoherent group (bisecting on the visual
        # block specifically, since that's the metric the downstream 0.5 floor actually enforces)
        final_groups = []
        for g in groups:
            final_groups.extend(recursive_bisect(g, vectors, visual_block, min_size, bisect_above, coherence_floor))

        clusters = [{"hosts": [hosts[i] for i in g]} for g in final_groups if len(g) >= min_size]
        out["pageKinds"][pk] = {"clusters": clusters}
        print(f"[cluster.py] {pk}: n={n} -> {len(groups)} ward cut groups -> {len(clusters)} clusters after bisect (sizes={[len(g['hosts']) for g in clusters]})", file=sys.stderr)

    with open(out_path, "w", encoding="utf8") as f:
        json.dump(out, f)
    print(f"[cluster.py] wrote -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
