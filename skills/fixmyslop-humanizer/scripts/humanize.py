#!/usr/bin/env python3
"""Deterministic rewrite loop for the local FixMySlop:Humanizer prototype.

This is intentionally conservative. A host model can use the analyzer evidence and
the skill instructions for richer prose edits; the bundled CLI provides a reliable
local baseline, typography finalizer, and fidelity guardrail without inventing facts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from fidelity import audit
from pipeline import finish_rewrite_context, prepare_rewrite_context
from humanstats import analyze, protected_spans


EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")
PLACEHOLDER_RE = re.compile(r"\ue000P\d+\ue001")


def protect(text: str) -> tuple[str, list[str]]:
    spans = protected_spans(text)
    values = [text[start:end] for start, end in spans]
    if not values:
        return text, []
    pieces: list[str] = []
    cursor = 0
    for index, (start, end) in enumerate(spans):
        pieces.append(text[cursor:start])
        pieces.append(f"\ue000P{index}\ue001")
        cursor = end
    pieces.append(text[cursor:])
    return "".join(pieces), values


def restore(text: str, values: list[str]) -> str:
    for index, value in enumerate(values):
        text = text.replace(f"\ue000P{index}\ue001", value)
    return text


def normalize_editable_quotes(text: str) -> tuple[str, list[str]]:
    """Normalize smart quotes only in editable text; protected quote spans are placeholders."""
    replacements = {"“": '"', "”": '"', "‘": "'", "’": "'"}
    normalized = text.translate(str.maketrans(replacements))
    return normalized, ["normalized editable curly quotes"] if normalized != text else []


def replace_phrases(text: str) -> tuple[str, list[str]]:
    changes: list[str] = []

    def sub(pattern: str, replacement: str, label: str, flags: int = re.I) -> None:
        nonlocal text
        updated, count = re.subn(pattern, replacement, text, flags=flags)
        if count:
            changes.append(f"{label} ({count})")
            text = updated

    # Remove conversational wrappers only when they are clearly pasted chat framing.
    sub(r"(?im)^\s*(?:hi there[!.,]?\s*)?(?:great question[!.,]?\s*)?(?:you'?re absolutely right[!.,]?\s*)?", "", "removed chat greeting")
    sub(r"(?im)^\s*and you'?re absolutely right to reach out[!.]?\s*", "", "removed chat greeting")
    sub(r"(?is)\s*i hope this helps(?:\s*[—–,-]\s*let me know if you'?d like anything else)?[!.]?\s*$", "", "removed chat closing")
    sub(r"(?is)\s*let me know if you'?d like anything else[!.]?\s*$", "", "removed chat closing")
    sub(r"(?i)\b(?:of course|certainly)[!.,]?\s*", "", "removed servile opener")

    # Filler and stacked hedging.
    substitutions = [
        (r"\bin order to\b", "to", "shortened filler"),
        (r"\bdue to the fact that\b", "because", "shortened filler"),
        (r"\bat this point in time\b", "now", "shortened filler"),
        (r"\bin the event that\b", "if", "shortened filler"),
        (r"\bit is important to note that\b", "", "removed framing"),
        (r"\bhas the ability to\b", "can", "shortened filler"),
        (r"\bcould potentially possibly\b", "may", "simplified hedging"),
        (r"\bit could potentially be argued that\b", "", "simplified hedging"),
        (r"\bmight possibly\b", "might", "simplified hedging"),
    ]
    for pattern, replacement, label in substitutions:
        sub(pattern, replacement, label)

    # Simple constructions are preferable when the meaning is unchanged.
    substitutions = [
        (r"\bserves as\b", "is", "simplified copula"),
        (r"\bstands as\b", "is", "simplified copula"),
        (r"\bfunctions as\b", "is", "simplified copula"),
        (r"\bboasts\b", "has", "simplified verb"),
        (r"\bfeatures\b", "includes", "simplified verb"),
        (r"\badditionally\b", "also", "replaced formulaic transition"),
        (r"\bdelve into\b", "examine", "replaced formulaic verb"),
        (r"\bfostering\b", "supporting", "replaced formulaic verb"),
        (r"\bfoster\b", "support", "replaced formulaic verb"),
        (r"\bshowcase(?:s|d)?\b", "show", "replaced formulaic verb"),
        (r"\bunderscore(?:s|d)?\b", "show", "replaced formulaic verb"),
        (r"\bcrucial\b", "important", "replaced inflated adjective"),
        (r"\bpivotal\b", "important", "replaced inflated adjective"),
        (r"\bintricate\b", "complex", "replaced inflated adjective"),
        (r"\bseamless\b", "smooth", "replaced promotional adjective"),
        (r"\bgroundbreaking\b", "new", "replaced promotional adjective"),
    ]
    for pattern, replacement, label in substitutions:
        sub(pattern, replacement, label)

    # Simplify common parallel frames without deleting either claim.
    sub(r"\bnot only\b\s*", "", "simplified parallel frame")
    sub(r"\bbut\s+(?:will\s+)?also\b", "and", "simplified parallel frame")
    sub(r"\bnot just\b\s*", "", "simplified parallel frame")

    # Remove decorative formatting, not meaningful Markdown code or links (those are placeholders).
    updated, count = EMOJI_RE.subn("", text)
    if count:
        changes.append(f"removed decorative emoji ({count})")
        text = updated
    updated, count = re.subn(r"\*\*([^*\n]+)\*\*", r"\1", text)
    if count:
        changes.append(f"removed decorative bold ({count})")
        text = updated

    # Sentence-case headings when they are clearly title-cased scaffolding.
    def heading(match: re.Match[str]) -> str:
        prefix, value = match.group(1), match.group(2)
        words = value.split()
        if len(words) >= 3 and sum(word[:1].isupper() for word in words) >= 3:
            return prefix + value[:1].upper() + value[1:].lower()
        return match.group(0)

    text, count = re.subn(r"(?m)^(#{1,6}\s+)([^\n]+)$", heading, text)
    if count:
        changes.append(f"normalized heading case ({count})")

    # Drop generic sign-offs/conclusions only when they stand as complete phrases.
    sub(r"(?im)^\s*(?:the future looks bright\.?|exciting times lie ahead\.?|this represents a major step in the right direction\.?)\s*$", "", "removed generic conclusion")
    return text, changes


def reframe_dashes(text: str) -> tuple[str, list[str]]:
    changes: list[str] = []

    def range_replacement(match: re.Match[str]) -> str:
        changes.append("reframed numeric dash range")
        return f"{match.group(1)} to {match.group(2)}"

    text = re.sub(r"(?<=\d)\s*[–—]\s*(?=\d)", " to ", text)
    text = re.sub(r"(\d)\s*[–—]\s*(\d)", range_replacement, text)

    def dash_replacement(match: re.Match[str]) -> str:
        left = match.string[max(0, match.start() - 40) : match.start()].lower()
        right = match.string[match.end() : match.end() + 40].lstrip().lower()
        changes.append("reframed dash construction")
        if left.endswith("not") or right.startswith("it's") or right.startswith("it is") or right.startswith("this is"):
            return "; "
        if right.startswith("including") or right.startswith("for example"):
            return ": "
        # A semicolon separates independent clauses; it is a structural fallback,
        # not a character-for-character punctuation substitution.
        return "; "

    text = re.sub(r"\s*[—–]\s*", dash_replacement, text)
    return text, changes


def clean_spacing(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    # Avoid touching periods in decimals, versions, domains, initials, and paths;
    # those spans are normally placeholders, but this is also safe for plain text.
    text = re.sub(r"\s+([,;!?])", r"\1", text)
    text = re.sub(r"([,;!?])(?=[A-Za-z])", r"\1 ", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)
    return text.strip()


def rewrite(
    text: str,
    genre: str = "auto",
    debug: bool = False,
    protected_values: list[str] | None = None,
) -> dict[str, object]:
    context = prepare_rewrite_context(text, genre, protected_values)
    inferred_genre = str(context["genre_inference"]["genre"])
    before = context["original_humanstats"]
    working, protected = protect(text)
    working = working.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    working, quote_changes = normalize_editable_quotes(working)
    changes = list(quote_changes)
    working, phrase_changes = replace_phrases(working)
    changes.extend(phrase_changes)
    working, dash_changes = reframe_dashes(working)
    changes.extend(dash_changes)
    candidate = restore(clean_spacing(working), protected)

    # Second pass is intentionally restricted to residual hard policies. It does not
    # repeatedly paraphrase text or chase a detector score. Any dash still present
    # is structurally reframed, never character-substituted with a comma.
    second_working, second_protected = protect(candidate)
    second_working = second_working.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    second_working, second_quote_changes = normalize_editable_quotes(second_working)
    changes.extend(second_quote_changes)
    second_working, second_dash_changes = reframe_dashes(second_working)
    changes.extend(second_dash_changes)
    candidate = restore(clean_spacing(second_working), second_protected)
    content_map = context["source_content_map"]
    fidelity = audit(text, candidate, protected, content_map)
    context = finish_rewrite_context(context, candidate, fidelity)
    after = context["rewrite_humanstats"]
    candidate_protected = protected_spans(candidate)
    fidelity["prohibited_dash_count_editable"] = sum(
        1 for match in re.finditer(r"[—–]", candidate)
        if not any(start <= match.start() < end for start, end in candidate_protected)
    )
    return {
        "humanizer": "FixMySlop:Humanizer",
        "version": "0.1.0",
        "genre": inferred_genre,
        "requested_genre": genre,
        "rewrite": candidate,
        "changes": changes,
        "before": before,
        "after": after,
        "deltas": {
            "formulaic_risk": after["formulaic_risk"] - before["formulaic_risk"],
            "finding_count": len(after["findings"]) - len(before["findings"]),
            "word_count": after["token_count"] - before["token_count"],
        },
        "fidelity": fidelity,
        "rewrite_context": context if debug else {
            "pipeline_version": context["pipeline_version"],
            "stage_order": context["stage_order"],
            "genre_inference": context["genre_inference"],
            "pragmatic_profile": context["pragmatic_profile"],
            "model_summary": context["model_summary"],
            "targeted_correction": context["targeted_correction"],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Rewrite prose with deterministic humanization guardrails.")
    parser.add_argument("path", nargs="?", help="Text file; stdin when omitted")
    parser.add_argument("--genre", default="auto")
    parser.add_argument("--json", action="store_true", help="Emit a structured report")
    parser.add_argument("--debug", action="store_true", help="Include the complete structured rewrite context")
    parser.add_argument("--context-out", type=Path, help="Write the complete structured rewrite context to JSON")
    args = parser.parse_args()
    text = Path(args.path).read_text(encoding="utf-8") if args.path else sys.stdin.read()
    result = rewrite(text, args.genre, debug=args.debug or bool(args.context_out))
    if args.context_out:
        args.context_out.parent.mkdir(parents=True, exist_ok=True)
        args.context_out.write_text(json.dumps(result["rewrite_context"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result["rewrite"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
