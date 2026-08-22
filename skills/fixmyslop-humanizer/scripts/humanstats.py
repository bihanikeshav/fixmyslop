#!/usr/bin/env python3
"""Dependency-free linguistic and rhetorical profiler for FixMySlop:Humanizer.

The profiler intentionally reports evidence and risk signals, never an AI-authorship
probability.  It is small enough to bundle with a skill and deterministic enough to
use in TextSlopBench.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import statistics
from collections import Counter
from pathlib import Path
from typing import Iterable, Sequence


WORD_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?|\d+(?:[.,]\d+)?")
SENTENCE_RE = re.compile(r"(?<=[.!?])(?:[\"'”’)]*)\s+|\n+(?=[A-Z0-9\"'“‘])")
URL_RE = re.compile(r"https?://[^\s)]+|www\.[^\s)]+", re.I)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w.-]+\.\w+\b")
CODE_FENCE_RE = re.compile(r"```[\s\S]*?```", re.M)
INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
QUOTE_RE = re.compile(r"(?:\"[^\"\n]+\"|(?<![A-Za-z])'[^'\n]+'(?![A-Za-z])|“[^”\n]+”|‘[^’\n]+’)")
VERSION_RE = re.compile(r"(?<!\w)v?\d+\.\d+(?:\.\d+)+(?!\w)")
PATH_RE = re.compile(r"(?<!\w)(?:/[A-Za-z0-9_.-]+)+(?:/[A-Za-z0-9_.-]+)*|[A-Za-z0-9_.-]+/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+")
STRUCTURED_RE = re.compile(r"(?<!\w)(?:--[A-Za-z0-9_-]+|[A-Z][A-Z0-9_]{2,}|[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)(?!\w)")

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
    "from", "had", "has", "have", "he", "her", "hers", "him", "his", "i",
    "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or",
    "our", "ours", "she", "that", "the", "their", "them", "there", "these",
    "they", "this", "those", "to", "was", "we", "were", "what", "when", "which",
    "who", "why", "will", "with", "you", "your", "yours", "can", "could", "should",
    "would", "do", "does", "did", "not", "no", "so", "than", "then", "too", "very",
}
CONTENT_POS = {"NOUN", "VERB", "ADJ", "ADV"}

PATTERNS = [
    ("interface_artifact", r"(?i)\b(?:great question|i hope this helps|let me know if|would you like me to|here is an overview)\b", 2, "chat-response language"),
    ("inflation", r"(?i)\b(?:testament|pivotal moment|transformative potential|enduring legacy|broader movement|evolving landscape|vital role|marks? a shift)\b", 1, "importance is asserted rather than shown"),
    ("promotional", r"(?i)\b(?:groundbreaking|breathtaking|must-visit|stunning|vibrant|renowned|seamless|world-class|rich cultural heritage)\b", 1, "promotional adjective or bundle"),
    ("vague_attribution", r"(?i)\b(?:experts|observers|critics|industry reports|some sources|many believe)\s+(?:argue|say|believe|note|have cited)\b", 2, "authority is not identified"),
    ("participial_tail", r"(?i),\s*(?:highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|contributing|showcasing|fostering|cultivating)\b", 1, "explanatory -ing tail"),
    ("negative_parallelism", r"(?i)\b(?:not only\b[\s\S]{0,120}\bbut also|not just\b[\s\S]{0,120}\b(?:it'?s|but))\b", 1, "repeated contrast frame"),
    ("false_range", r"(?i)\bfrom\s+[^.!?;]{1,80}\bto\s+[^.!?;]{1,80}\b(?:from\s+[^.!?;]{1,80}\bto\b)?", 1, "range may be rhetorical rather than scalar"),
    ("filler", r"(?i)\b(?:in order to|due to the fact that|at this point in time|in the event that|it is important to note that|has the ability to)\b", 1, "needless framing"),
    ("hedging_stack", r"(?i)\b(?:could potentially possibly|might possibly|it could be argued that|appears to possibly)\b", 2, "stacked uncertainty"),
    ("copula_avoidance", r"(?i)\b(?:serves as|stands as|boasts|functions as|represents a)\b", 1, "elaborate substitute for a simple verb"),
    ("generic_conclusion", r"(?i)\b(?:the future looks bright|exciting times lie ahead|journey toward excellence|step in the right direction)\b", 2, "generic positive ending"),
    ("ai_vocabulary", r"(?i)\b(?:additionally|delve into|foster(?:ing)?|garner|interplay|intricate|showcase|tapestry|underscore|crucial|pivotal)\b", 1, "context-sensitive formulaic vocabulary"),
]


def protected_spans(text: str) -> list[tuple[int, int]]:
    """Return code, URL, and quotation spans that should not be rewritten."""
    spans: list[tuple[int, int]] = []
    for regex in (CODE_FENCE_RE, INLINE_CODE_RE, URL_RE, EMAIL_RE, VERSION_RE, PATH_RE, STRUCTURED_RE, QUOTE_RE):
        spans.extend((m.start(), m.end()) for m in regex.finditer(text))
    spans.sort()
    merged: list[tuple[int, int]] = []
    for start, end in spans:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    return merged


def in_spans(start: int, end: int, spans: Sequence[tuple[int, int]]) -> bool:
    return any(start < right and end > left for left, right in spans)


def words(text: str) -> list[str]:
    return WORD_RE.findall(text)


def lemma(token: str) -> str:
    value = token.lower().replace("’", "'")
    if len(value) > 4 and value.endswith("ies"):
        return value[:-3] + "y"
    if len(value) > 4 and value.endswith("s") and not value.endswith(("ss", "us")):
        return value[:-1]
    return value


def split_sentences(text: str) -> list[str]:
    parts = [part.strip() for part in SENTENCE_RE.split(text) if part.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def split_paragraphs(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"\n\s*\n+", text) if part.strip()]


def entropy(values: Iterable[str]) -> float:
    counts = Counter(values)
    total = sum(counts.values())
    if not total or len(counts) <= 1:
        return 0.0
    return round(-sum((n / total) * math.log2(n / total) for n in counts.values()), 4)


def ratio(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def mattr(values: Sequence[str], window: int = 50) -> float:
    if not values:
        return 0.0
    if len(values) <= window:
        return ratio(len(set(values)), len(values))
    scores = [ratio(len(set(values[i : i + window])), window) for i in range(len(values) - window + 1)]
    return round(statistics.mean(scores), 4)


def hdd(values: Sequence[str], sample: int = 42) -> float:
    """HD-D (McCarthy & Jarvis 2010): expected type contribution over a random sample of
    ``sample`` tokens. Length-controlled lexical diversity, as used by Antislop."""
    total = len(values)
    if total < sample or total == 0:
        return ratio(len(set(values)), total)
    counts = Counter(values)
    contribution = 0.0
    denom = math.comb(total, sample)
    for freq in counts.values():
        remaining = total - freq
        prob_absent = math.comb(remaining, sample) / denom if remaining >= sample else 0.0
        contribution += (1.0 - prob_absent) / sample
    return round(contribution, 4)


def distinct_n(values: Sequence[str], size: int) -> float:
    """Distinct-n (Li et al. 2016): unique n-grams / total n-grams."""
    grams = [tuple(values[i : i + size]) for i in range(len(values) - size + 1)]
    return ratio(len(set(grams)), len(grams))


def pos_guess(token: str) -> str:
    value = token.lower().strip("'’")
    if value in STOPWORDS:
        if value in {"a", "an", "the", "this", "that", "these", "those"}:
            return "DET"
        if value in {"and", "or", "but", "if", "when", "because", "while"}:
            return "CONJ"
        if value in {"is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did", "can", "could", "should", "would", "will"}:
            return "AUX"
        if value in {"in", "on", "at", "by", "for", "from", "to", "with", "of", "into"}:
            return "ADP"
        return "PRON"
    if value.endswith(("ly",)):
        return "ADV"
    if value.endswith(("ous", "ful", "ive", "al", "ic", "able", "ible", "less", "ish")):
        return "ADJ"
    if value.endswith(("ed", "ing", "en")):
        return "VERB"
    if value.isdigit():
        return "NUM"
    return "NOUN"


def reduced_template(sentence: str) -> str:
    return " ".join(pos_guess(token) for token in words(sentence))


def ngram_counts(values: Sequence[str], size: int) -> Counter[tuple[str, ...]]:
    return Counter(tuple(values[i : i + size]) for i in range(len(values) - size + 1))


def top_items(counter: Counter, limit: int = 10) -> list[dict[str, object]]:
    return [{"item": list(item) if isinstance(item, tuple) else item, "count": count} for item, count in counter.most_common(limit)]


def finding_list(text: str) -> list[dict[str, object]]:
    protected = protected_spans(text)
    findings: list[dict[str, object]] = []
    for family, pattern, severity, message in PATTERNS:
        for match in re.finditer(pattern, text):
            if in_spans(match.start(), match.end(), protected):
                continue
            findings.append({
                "family": family,
                "severity": severity,
                "start": match.start(),
                "end": match.end(),
                "evidence": match.group(0),
                "message": message,
            })
    findings.sort(key=lambda item: (item["start"], -int(item["severity"])))
    return findings


def segment_stats(text: str) -> list[dict[str, object]]:
    paragraphs = split_paragraphs(text)
    if len(paragraphs) < 3:
        return []
    buckets = [paragraphs[:1], paragraphs[1:-1], paragraphs[-1:]]
    result = []
    for name, bucket in zip(("opening", "body", "closing"), buckets):
        tokens = [lemma(token) for token in words("\n\n".join(bucket))]
        sents = split_sentences("\n\n".join(bucket))
        templates = [reduced_template(sentence) for sentence in sents]
        result.append({
            "segment": name,
            "token_count": len(tokens),
            "sentence_count": len(sents),
            "lexical_diversity": ratio(len(set(tokens)), len(tokens)),
            "template_entropy": entropy(templates),
            "mean_sentence_words": round(statistics.mean([len(words(s)) for s in sents]), 4) if sents else 0.0,
        })
    return result


def semantic_redundancy_proxy(sentences: Sequence[str]) -> dict[str, object]:
    """Use sentence content overlap as a dependency-free semantic proxy."""
    sets = [{lemma(token) for token in words(sentence) if len(token) > 2} for sentence in sentences]
    pairs: list[dict[str, object]] = []
    for left in range(len(sets)):
        for right in range(left + 1, len(sets)):
            union = sets[left] | sets[right]
            overlap = len(sets[left] & sets[right]) / len(union) if union else 0.0
            if overlap >= 0.75:
                pairs.append({"left_sentence": left, "right_sentence": right, "jaccard": round(overlap, 4)})
    return {"high_overlap_pair_count": len(pairs), "pairs": pairs[:20]}


def analyze(text: str, genre: str = "auto") -> dict[str, object]:
    tokens = words(text)
    lemmas = [lemma(token) for token in tokens]
    content = [token for token in tokens if lemma(token) not in STOPWORDS and not token.isdigit()]
    sentences = split_sentences(text)
    paragraphs = split_paragraphs(text)
    lengths = [len(words(sentence)) for sentence in sentences]
    templates = [reduced_template(sentence) for sentence in sentences]
    pos = [pos_guess(token) for token in tokens]
    ngrams = {str(size): ngram_counts(lemmas, size) for size in (2, 3, 4)}
    repeated = {
        f"{size}_gram_repetition": ratio(sum(count - 1 for count in counts.values() if count > 1), max(sum(counts.values()), 1))
        for size, counts in ngrams.items()
    }
    template_counts = Counter(templates)
    sentence_mean = statistics.mean(lengths) if lengths else 0.0
    sentence_std = statistics.pstdev(lengths) if len(lengths) > 1 else 0.0
    openings = [words(sentence)[0].lower() for sentence in sentences if words(sentence)]
    opening_counts = Counter(openings)
    findings = finding_list(text)
    short_runs = 0
    current_run = 0
    for left, right in zip(lengths, lengths[1:]):
        if abs(left - right) <= 2:
            current_run += 1
            short_runs = max(short_runs, current_run)
        else:
            current_run = 0
    risk = min(100, round(sum(int(item["severity"]) for item in findings) * 4 + max(0, template_counts.most_common(1)[0][1] - 2) * 3, 2))
    # Empirical slop overrepresentation (Antislop-style). Lazy import avoids a module cycle.
    # Kept out of formulaic_risk so legacy risk stays stable; exposed as its own family/section.
    from slop_overrepresentation import scan as _slop_scan, weighted_density as _slop_density

    slop_findings = _slop_scan(text, None if genre in ("auto", None) else genre)
    slop_block = {
        "profile_id": slop_findings[0]["profile_id"] if slop_findings else None,
        "weighted_density": _slop_density(text, slop_findings),
        "pattern_count": len(slop_findings),
        "findings": slop_findings,
    }
    findings = findings + slop_findings
    family_counts = Counter(item["family"] for item in findings)
    return {
        "analyzer_version": "0.1.0",
        "genre": genre,
        "token_count": len(tokens),
        "type_count": len(set(lemmas)),
        "lemma_count": len(set(lemmas)),
        "sentence_count": len(sentences),
        "paragraph_count": len(paragraphs),
        "lexical": {
            "ttr": ratio(len(set(tokens)), len(tokens)),
            "root_ttr": round(len(set(tokens)) / math.sqrt(len(tokens)), 4) if tokens else 0.0,
            "mattr": mattr(lemmas),
            "mattr_500": mattr(lemmas, window=500),
            "hdd": hdd(lemmas),
            "distinct_1": distinct_n(lemmas, 1),
            "distinct_2": distinct_n(lemmas, 2),
            "distinct_3": distinct_n(lemmas, 3),
            "hapax_ratio": ratio(sum(1 for count in Counter(lemmas).values() if count == 1), len(lemmas)),
            "lexical_density": ratio(len(content), len(tokens)),
            "content_word_ratio": ratio(len(content), len(tokens)),
            "shannon_entropy": entropy(lemmas),
            "top_repeated_content_lemmas": top_items(Counter(lemma(token) for token in content)),
        },
        "phrasal": {
            **repeated,
            "top_2_grams": top_items(ngrams["2"]),
            "top_3_grams": top_items(ngrams["3"]),
            "top_4_grams": top_items(ngrams["4"]),
        },
        "pos": {
            "counts": dict(Counter(pos)),
            "entropy": entropy(pos),
            "content_function_ratio": ratio(sum(tag in CONTENT_POS for tag in pos), len(pos)),
        },
        "syntax": {
            "template_count": len(templates),
            "unique_template_ratio": ratio(len(set(templates)), len(templates)),
            "template_entropy": entropy(templates),
            "dominant_template_share": ratio(template_counts.most_common(1)[0][1], len(templates)) if templates else 0.0,
            "top_templates": top_items(template_counts, 5),
            "subordinate_clause_rate": ratio(len(re.findall(r"(?i)\b(?:because|although|while|which|that|if|when)\b", text)), max(len(sentences), 1)),
            "coordinate_clause_rate": ratio(len(re.findall(r"(?i),?\s+(?:and|but|or)\s+", text)), max(len(sentences), 1)),
            "participial_tail_rate": ratio(len(family_counts.get("participial_tail", 0) and [x for x in findings if x["family"] == "participial_tail"] or []), max(len(sentences), 1)),
            "nominalization_proxy_rate": ratio(len(re.findall(r"\b[A-Za-z]+(?:tion|ment|ness|ity|ance|ence)\b", text)), max(len(tokens), 1)),
        },
        "rhythm": {
            "mean_sentence_words": round(sentence_mean, 4),
            "median_sentence_words": statistics.median(lengths) if lengths else 0,
            "stddev_sentence_words": round(sentence_std, 4),
            "coefficient_of_variation": round(sentence_std / sentence_mean, 4) if sentence_mean else 0.0,
            "p10": round(sorted(lengths)[max(0, math.ceil(len(lengths) * 0.10) - 1)], 4) if lengths else 0,
            "p90": round(sorted(lengths)[max(0, math.ceil(len(lengths) * 0.90) - 1)], 4) if lengths else 0,
            "short_sentence_ratio": ratio(sum(length <= 8 for length in lengths), len(lengths)),
            "long_sentence_ratio": ratio(sum(length >= 35 for length in lengths), len(lengths)),
            "max_similar_length_run": short_runs + 1 if lengths else 0,
            "sentence_opening_concentration": ratio(opening_counts.most_common(1)[0][1], len(openings)) if openings else 0.0,
        },
        "document": {
            "words_per_paragraph": [len(words(paragraph)) for paragraph in paragraphs],
            "sentences_per_paragraph": [len(split_sentences(paragraph)) for paragraph in paragraphs],
            "paragraph_length_cv": round(statistics.pstdev([len(words(p)) for p in paragraphs]) / statistics.mean([len(words(p)) for p in paragraphs]), 4) if len(paragraphs) > 1 and statistics.mean([len(words(p)) for p in paragraphs]) else 0.0,
            "segments": segment_stats(text),
        },
        "semantic": {
            "redundancy_proxy": semantic_redundancy_proxy(sentences),
        },
        "slop": slop_block,
        "findings": findings,
        "finding_counts": dict(family_counts),
        "formulaic_risk": risk,
        "protected_span_count": len(protected_spans(text)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze prose for humanization evidence.")
    parser.add_argument("path", nargs="?", help="Text file; stdin when omitted")
    parser.add_argument("--compare", help="Revised text file to compare with path")
    parser.add_argument("--genre", default="auto")
    args = parser.parse_args()
    text = Path(args.path).read_text(encoding="utf-8") if args.path else __import__("sys").stdin.read()
    if args.compare:
        revised = Path(args.compare).read_text(encoding="utf-8")
        before = analyze(text, args.genre)
        after = analyze(revised, args.genre)
        payload = {
            "before": before,
            "after": after,
            "deltas": {
                "formulaic_risk": after["formulaic_risk"] - before["formulaic_risk"],
                "finding_count": len(after["findings"]) - len(before["findings"]),
                "token_count": after["token_count"] - before["token_count"],
            },
        }
    else:
        payload = analyze(text, args.genre)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
