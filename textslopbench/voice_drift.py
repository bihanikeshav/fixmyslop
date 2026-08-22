#!/usr/bin/env python3
"""Voice Drift — stylometric direction of damage a rewrite does to a human's voice.

From "Voice Under Revision" (van Nuenen, 2026): even when told to preserve voice, LLMs pull
prose in a consistent direction — fewer contractions, function words, and first-person pronouns;
more lexical diversity, longer words, more punctuation elaboration — and outputs converge toward
each other. This is the damage the model does when editing HUMAN prose, the mirror of Baumler
(can humans edit AI prose back toward themselves).

For the human-input track we measure, per marker, the signed delta rewrite - source, an overall
standardized Voice Drift distance, and a "drift signature" — how much of the movement is in the
LLM-characteristic direction. Low VD = the system left the voice alone (do-no-harm). This gives
the human-input track a real purpose beyond "did it touch the text."

Deterministic, no LLM judge.
"""
from __future__ import annotations

import ast
import json
import math
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from humanstats import STOPWORDS, lemma, mattr, split_sentences, words

EPS = 1e-9
FIRST_PERSON = {"i", "me", "my", "mine", "we", "us", "our", "ours", "myself", "ourselves"}
CONTRACTION_RE = re.compile(r"\b\w+(?:n['’]t|['’](?:re|ve|ll|d|m|s))\b", re.IGNORECASE)
ELABORATION_RE = re.compile(r"[—;:()\"“”]")  # em dash, semicolon, colon, parens, quotes
# Small, seed emotion lexicon (flagged: replace with a validated affect lexicon).
EMOTION = {
    "love", "hate", "fear", "joy", "sad", "sadness", "happy", "happiness", "angry", "anger",
    "afraid", "scared", "excited", "worried", "hope", "hopeful", "proud", "ashamed", "grateful",
    "lonely", "anxious", "delighted", "furious", "terrified", "miserable", "thrilled", "nervous",
}
# LLM-characteristic drift direction per marker (+1 rewrite raises it, -1 lowers it).
LLM_DIRECTION = {
    "first_person_rate": -1, "contraction_rate": -1, "function_word_rate": -1,
    "punctuation_elaboration": +1, "lexical_diversity": +1, "mean_word_length": +1,
}


def style_vector(text: str) -> dict[str, float]:
    toks = words(text)
    n = max(len(toks), 1)
    lemmas = [lemma(t) for t in toks]
    sentences = split_sentences(text) or [text]
    alpha = [t for t in toks if any(c.isalpha() for c in t)]
    return {
        "first_person_rate": round(sum(t.lower() in FIRST_PERSON for t in toks) / n * 1000, 4),
        "contraction_rate": round(len(CONTRACTION_RE.findall(text)) / n * 1000, 4),
        "function_word_rate": round(sum(l in STOPWORDS for l in lemmas) / n * 1000, 4),
        "punctuation_elaboration": round(len(ELABORATION_RE.findall(text)) / max(len(sentences), 1), 4),
        "lexical_diversity": mattr(lemmas),
        "mean_word_length": round(statistics.mean([len(t) for t in alpha]), 4) if alpha else 0.0,
        "emotion_word_rate": round(sum(l in EMOTION for l in lemmas) / n * 1000, 4),
    }


def style_delta(source: str, rewrite: str) -> dict[str, float]:
    s, r = style_vector(source), style_vector(rewrite)
    return {k: round(r[k] - s[k], 4) for k in s}


def _sign(x: float) -> int:
    return 0 if abs(x) < EPS else (1 if x > 0 else -1)


def voice_drift(deltas, marker_std) -> dict[str, object]:
    """Standardized L2 Voice Drift + LLM-direction 'drift signature', averaged over items."""
    keys = sorted(marker_std)
    vds, sig = [], []
    for d in deltas:
        z = {k: d.get(k, 0.0) / marker_std[k] for k in keys}
        vds.append(math.sqrt(sum(v * v for v in z.values())))
        drift_keys = [k for k in keys if k in LLM_DIRECTION]
        weight = sum(abs(z[k]) for k in drift_keys)
        toward = sum(abs(z[k]) for k in drift_keys if _sign(d.get(k, 0.0)) == LLM_DIRECTION[k])
        sig.append(toward / weight if weight > EPS else 0.0)
    return {
        "mean_voice_drift": round(statistics.mean(vds), 4) if vds else 0.0,
        "mean_drift_signature": round(statistics.mean(sig), 4) if sig else 0.0,
        "n": len(vds),
    }


def _parse_refs(raw):
    if isinstance(raw, list):
        return raw
    for parser in (json.loads, ast.literal_eval):
        try:
            v = parser(raw)
            if isinstance(v, list):
                return v
        except Exception:
            pass
    return [raw] if isinstance(raw, str) and raw.strip() else []


def _load(path):
    return {json.loads(l)["record_id"]: json.loads(l)
            for l in Path(path).read_text(encoding="utf-8").splitlines() if l.strip()}


def run_human_input(n: int = 24) -> dict[str, object]:
    R = ROOT / "textslopbench" / "results"
    src = _load(R / f"donoharm-beemo-human-{n}.jsonl")
    fix = _load(R / f"donoharm_fix_new_{n}.jsonl")
    base = _load(R / f"donoharm_baseline_{n}.jsonl")
    items = []
    for rid in src:
        if rid in fix and rid in base:
            items.append({"rid": rid, "S": str(src[rid]["source_text"]),
                          "F": str(fix[rid]["rewrite"]), "B": str(base[rid]["rewrite"])})
    dF = [style_delta(it["S"], it["F"]) for it in items]
    dB = [style_delta(it["S"], it["B"]) for it in items]
    keys = list(style_vector("x").keys())
    marker_std = {}
    for k in keys:
        vals = [d[k] for d in dF + dB]
        sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
        marker_std[k] = sd if sd > EPS else 1.0

    def per_marker(deltas):
        return {k: round(statistics.mean([d[k] for d in deltas]), 4) for k in keys}

    changed = {"FixMySlop": [it["S"].strip() != it["F"].strip() for it in items],
               "Humanizer": [it["S"].strip() != it["B"].strip() for it in items]}
    out = {"benchmark": "TextSlopBench / voice-drift (human-input track)",
           "dataset": f"do-no-harm human originals -{n}", "n": len(items),
           "note": "Voice Under Revision (2026). Voice Drift of 0 by declining to edit is trivial "
                   "(so would `cat`); voice_drift_given_intervention is the real number — when the "
                   "system DOES edit, how much voice does it disturb? drift_signature = share of "
                   "movement in the LLM-characteristic direction.",
           "llm_direction": LLM_DIRECTION, "systems": {}}
    for name, deltas in (("FixMySlop", dF), ("Humanizer", dB)):
        ch = changed[name]
        edited = [d for d, c in zip(deltas, ch) if c]
        conditional = (voice_drift(edited, marker_std) if edited
                       else {"mean_voice_drift": None, "mean_drift_signature": None, "n": 0})
        out["systems"][name] = {
            "intervention_rate": round(sum(ch) / len(ch), 4) if ch else 0.0,
            "voice_drift_all": voice_drift(deltas, marker_std),
            "voice_drift_given_intervention": conditional,
            "mean_marker_delta": per_marker(deltas),
        }
    return out


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    result = run_human_input(n)
    (ROOT / "textslopbench" / "results" / f"voice-drift-human-input-{n}.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
