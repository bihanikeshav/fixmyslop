#!/usr/bin/env python3
"""Held-out dataset preparation and human-edit-delta scoring for TextSlopBench."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from adapters.baumler import BaumlerAdapter
from adapters.beemo import BeemoAdapter
from adapters.lamp import LAMPAdapter
from adapters.wq import WQAdapter
from humanstats import analyze, lemma, words
from pipeline import prepare_rewrite_context


ADAPTERS = {
    "lamp": LAMPAdapter,
    "baumler": BaumlerAdapter,
    "beemo": BeemoAdapter,
    "wq": WQAdapter,
}


def stable_select(records: list[dict[str, object]], limit: int | None) -> list[dict[str, object]]:
    ordered = sorted(records, key=lambda row: hashlib.sha256(str(row["record_id"]).encode("utf-8")).hexdigest())
    return ordered[:limit] if limit else ordered


def stratum_of(record: dict[str, object], key: str) -> str:
    meta = record.get("metadata", {})
    value = meta.get(key) if isinstance(meta, dict) else None
    if value in (None, ""):
        value = record.get(key)
    return str(value) if value not in (None, "") else "unspecified"


def stratified_select(records: list[dict[str, object]], limit: int, key: str) -> list[dict[str, object]]:
    """Deterministically pick ``limit`` records with round-robin coverage of each stratum.

    Within a stratum, records are ordered by SHA-256 of their id (same stable order as
    ``stable_select``); strata are visited in sorted name order and filled one per round.
    Guarantees every stratum with any records is represented before any stratum is
    exhausted, so no genre is silently dropped from the frozen subset.
    """
    from collections import defaultdict

    groups: dict[str, list[dict[str, object]]] = defaultdict(list)
    for record in records:
        groups[stratum_of(record, key)].append(record)
    for group in groups.values():
        group.sort(key=lambda row: hashlib.sha256(str(row["record_id"]).encode("utf-8")).hexdigest())
    ordered_strata = [groups[name] for name in sorted(groups)]
    selected: list[dict[str, object]] = []
    depth = 0
    while len(selected) < limit and any(depth < len(group) for group in ordered_strata):
        for group in ordered_strata:
            if depth < len(group):
                record = dict(group[depth])
                record["stratum"] = stratum_of(group[depth], key)
                selected.append(record)
                if len(selected) >= limit:
                    break
        depth += 1
    return selected


def write_jsonl(path: Path, rows: Iterable[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")


def load_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def content_set(text: str) -> set[str]:
    return {lemma(token) for token in words(text) if len(token) > 2 and not token.isdigit()}


def levenshtein(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for i, token in enumerate(left, 1):
        current = [i]
        for j, other in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (token != other)))
        previous = current
    return previous[-1]


def changed_ngrams(source: str, target: str, size: int) -> set[tuple[str, ...]]:
    def grams(text: str) -> set[tuple[str, ...]]:
        tokens = [lemma(token) for token in words(text)]
        return {tuple(tokens[i : i + size]) for i in range(max(0, len(tokens) - size + 1))}
    return grams(source) ^ grams(target)


def phrase_overlap(source: str, candidate: str, reference: str) -> dict[str, float]:
    values: dict[str, float] = {}
    for size in (2, 3, 4):
        ours = changed_ngrams(source, candidate, size)
        human = changed_ngrams(source, reference, size)
        union = ours | human
        values[f"{size}_gram_change_overlap"] = round(len(ours & human) / len(union), 4) if union else 1.0
    return values


def lexical_change(source: str, target: str, reference: str) -> dict[str, object]:
    source_words = content_set(source)
    target_words = content_set(target)
    human_words = content_set(reference)
    ours_changed = (source_words - target_words) | (target_words - source_words)
    human_changed = (source_words - human_words) | (human_words - source_words)
    union = ours_changed | human_changed
    return {
        "candidate_added": sorted(target_words - source_words)[:80],
        "candidate_dropped": sorted(source_words - target_words)[:80],
        "human_added": sorted(human_words - source_words)[:80],
        "human_dropped": sorted(source_words - human_words)[:80],
        "change_set_overlap": round(len(ours_changed & human_changed) / len(union), 4) if union else 1.0,
    }


def delta_vector(source: str, target: str) -> dict[str, float]:
    before = analyze(source, "auto")
    after = analyze(target, str(before.get("genre", "auto")))
    return {
        "formulaic_risk": float(after["formulaic_risk"]) - float(before["formulaic_risk"]),
        "2_gram_repetition": float(after["phrasal"]["2_gram_repetition"]) - float(before["phrasal"]["2_gram_repetition"]),
        "3_gram_repetition": float(after["phrasal"]["3_gram_repetition"]) - float(before["phrasal"]["3_gram_repetition"]),
        "4_gram_repetition": float(after["phrasal"]["4_gram_repetition"]) - float(before["phrasal"]["4_gram_repetition"]),
        "unique_template_ratio": float(after["syntax"]["unique_template_ratio"]) - float(before["syntax"]["unique_template_ratio"]),
        "dominant_template_share": float(after["syntax"]["dominant_template_share"]) - float(before["syntax"]["dominant_template_share"]),
        "mean_sentence_words": float(after["rhythm"]["mean_sentence_words"]) - float(before["rhythm"]["mean_sentence_words"]),
        "sentence_cv": float(after["rhythm"]["coefficient_of_variation"]) - float(before["rhythm"]["coefficient_of_variation"]),
        "ttr": float(after["lexical"]["ttr"]) - float(before["lexical"]["ttr"]),
        "mattr": float(after["lexical"]["mattr"]) - float(before["lexical"]["mattr"]),
        "subordinate_clause_rate": float(after["syntax"]["subordinate_clause_rate"]) - float(before["syntax"]["subordinate_clause_rate"]),
        "coordinate_clause_rate": float(after["syntax"]["coordinate_clause_rate"]) - float(before["syntax"]["coordinate_clause_rate"]),
        "nominalization_proxy_rate": float(after["syntax"]["nominalization_proxy_rate"]) - float(before["syntax"]["nominalization_proxy_rate"]),
    }


def delta_alignment(candidate_delta: dict[str, float], human_delta: dict[str, float]) -> dict[str, object]:
    keys = sorted(set(candidate_delta) & set(human_delta))
    ours = [candidate_delta[key] for key in keys]
    human = [human_delta[key] for key in keys]
    norm_ours = math.sqrt(sum(value * value for value in ours))
    norm_human = math.sqrt(sum(value * value for value in human))
    cosine = sum(left * right for left, right in zip(ours, human)) / (norm_ours * norm_human) if norm_ours and norm_human else 1.0 if ours == human else 0.0
    direction = sum((left == 0 and right == 0) or (left * right > 0) for left, right in zip(ours, human)) / max(len(keys), 1)
    return {"feature_count": len(keys), "cosine": round(cosine, 4), "direction_agreement": round(direction, 4), "candidate_delta": candidate_delta, "human_delta": human_delta}


def score_one(source: str, candidate: str, human_reference: str) -> dict[str, object]:
    source_tokens = words(source)
    candidate_tokens = words(candidate)
    reference_tokens = words(human_reference)
    candidate_delta = delta_vector(source, candidate)
    human_delta = delta_vector(source, human_reference)
    return {
        "candidate_word_edit_distance": levenshtein(source_tokens, candidate_tokens),
        "human_word_edit_distance": levenshtein(source_tokens, reference_tokens),
        "candidate_normalized_edit": round(levenshtein(source_tokens, candidate_tokens) / max(len(source_tokens), 1), 4),
        "human_normalized_edit": round(levenshtein(source_tokens, reference_tokens) / max(len(source_tokens), 1), 4),
        "content_jaccard_to_source": round(len(content_set(source) & content_set(candidate)) / max(len(content_set(source) | content_set(candidate)), 1), 4),
        "content_jaccard_to_human_reference": round(len(content_set(candidate) & content_set(human_reference)) / max(len(content_set(candidate) | content_set(human_reference)), 1), 4),
        "phrase_reuse": phrase_overlap(source, candidate, human_reference),
        "lexical_change": lexical_change(source, candidate, human_reference),
        "human_edit_delta_alignment": delta_alignment(candidate_delta, human_delta),
        "slop_pattern_suppression": _sps(source, candidate),
    }


def _sps(source: str, candidate: str) -> dict[str, object]:
    from slop_overrepresentation import slop_pattern_suppression

    return slop_pattern_suppression(source, candidate)


def prepare_prompts(records: list[dict[str, object]], output: Path, host_model: str = "gpt-5.6-terra") -> None:
    rows: list[dict[str, object]] = []
    for record in records:
        source = str(record["source_text"])
        context = prepare_rewrite_context(source, "auto")
        summary = context["model_summary"]
        rows.append({
            "record_id": record["record_id"],
            "source": source,
            "human_reference": record.get("human_references", [""])[0] if record.get("human_references") else "",
            "metadata": record.get("metadata", {}),
            "inferred_genre": context["genre_inference"],
            "new_context": summary,
                "new_prompt": "\n".join([
                "Revise this LAMP source using the structured context below. Preserve every listed hard anchor and the source's certainty; improve the prose in the inferred register. Before returning, compare the draft with the anchors and correct any missing or changed anchor. Return only the revision.",
                "STRUCTURED CONTEXT:", json.dumps(summary, ensure_ascii=False, sort_keys=True),
                "SOURCE:", source,
            ]),
            "host_model": host_model,
        })
    write_jsonl(output, rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", choices=sorted(ADAPTERS), required=True)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--split", default="test")
    parser.add_argument("--limit", type=int, default=24)
    parser.add_argument("--stratify-key", default=None, help="metadata field to stratify the frozen subset by (e.g. genre, use_case)")
    parser.add_argument("--freeze-manifest", type=Path, default=None, help="write a frozen id-list manifest (declared before Iteration 2)")
    parser.add_argument("--normalized-output", type=Path, required=True)
    parser.add_argument("--prompts-output", type=Path)
    args = parser.parse_args()
    records = ADAPTERS[args.dataset]().adapt(args.input, split=args.split)
    if args.stratify_key:
        selected = stratified_select(records, args.limit, args.stratify_key)
    else:
        selected = stable_select(records, args.limit)
    write_jsonl(args.normalized_output, selected)
    if args.prompts_output:
        prepare_prompts(selected, args.prompts_output)
    strata_counts = Counter(record.get("stratum", stratum_of(record, args.stratify_key)) for record in selected) if args.stratify_key else {}
    manifest = {
        "dataset": args.dataset,
        "input": str(args.input),
        "split": args.split,
        "selection": (
            f"stratified round-robin by '{args.stratify_key}', SHA-256 within stratum; frozen before evaluation; no tuning"
            if args.stratify_key
            else "stable SHA-256 order, declared before evaluation; no tuning"
        ),
        "stratify_key": args.stratify_key,
        "records": len(selected),
        "corpus_records": len(records),
        "strata_counts": dict(sorted(strata_counts.items())),
        "record_ids": [record["record_id"] for record in selected],
        "raw_text_retained_locally": True,
        "adapter_version": "0.2.0",
    }
    if args.freeze_manifest:
        args.freeze_manifest.parent.mkdir(parents=True, exist_ok=True)
        args.freeze_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
