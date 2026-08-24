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
from typing import Callable

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from fidelity import audit
from pipeline import finish_rewrite_context, prepare_rewrite_context
from humanstats import analyze, protected_spans


DECORATIVE_EMOJI_RE = re.compile(
    r"(?m)^(?P<indent>\s*)(?:[\U0001F300-\U0001FAFF\u2600-\u27BF]\ufe0f?\s*)+(?=[A-Z0-9#*\ue000])"
)
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


def replace_phrases(text: str, genre: str = "general prose") -> tuple[str, list[str]]:
    changes: list[str] = []

    def sub(pattern: str, replacement: str | Callable[[re.Match[str]], str], label: str, flags: int = re.I) -> None:
        nonlocal text
        updated, count = re.subn(pattern, replacement, text, flags=flags)
        if count:
            changes.append(f"{label} ({count})")
            text = updated

    # Remove conversational wrappers only when they are clearly pasted chat framing.
    sub(
        r"(?i)\A[ \t]*(?:(?:hi there[!.,]?[ \t]*)?great question[!.,]?[ \t]*(?:and[ \t]+)?(?:you'?re absolutely right[!.,]?[ \t]*)?|you'?re absolutely right[!.,]?[ \t]*)",
        "",
        "removed chat greeting",
    )
    sub(r"(?i)\A[ \t]*and you'?re absolutely right to reach out[!.]?[ \t]*", "", "removed chat greeting")
    sub(r"(?is)\s*i hope this helps(?:\s*[—–,-]\s*let me know if you'?d like anything else)?[!.]?\s*$", "", "removed chat closing")
    sub(r"(?is)\s*let me know if you'?d like anything else[!.]?\s*$", "", "removed chat closing")
    # Only strip a clearly standalone response opener. Mid-sentence uses such as
    # "She was, of course, ready" carry meaning and must survive.
    sub(r"(?i)\A\s*(?:of course|certainly)(?:[!.]+|,)(?:\s+|$)", "", "removed servile opener")

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
        if replacement:
            def keep_initial_case(match: re.Match[str], value: str = replacement) -> str:
                return value[:1].upper() + value[1:] if match.group(0)[:1].isupper() else value
            sub(pattern, keep_initial_case, label)
        else:
            sub(pattern, replacement, label)

    # Soft copulas, adjectives, transitions, and model-favored vocabulary are not
    # deterministic substitutions. They are diagnostic evidence for the host,
    # which has enough context to decide whether a particular use is formulaic.
    # Parallel contrasts receive the same treatment because they are syntactic
    # structures, not removable tokens.

    # Remove only line-leading decorative emoji in genres where they commonly act
    # as scaffolding. Interior emoji can carry tone, identity, or literal meaning.
    if genre in {"software release notes", "product onboarding UI", "developer README"}:
        updated, count = DECORATIVE_EMOJI_RE.subn(lambda m: m.group("indent"), text)
    else:
        updated, count = text, 0
    if count:
        changes.append(f"removed decorative emoji ({count})")
        text = updated
    # Markdown emphasis and heading capitalization may be semantic or part of a
    # design system. The deterministic pass preserves both; a host can remove
    # demonstrably decorative formatting with document-level context.

    # Drop generic sign-offs/conclusions only when they stand as complete phrases.
    sub(r"(?im)^\s*(?:the future looks bright\.?|exciting times lie ahead\.?|this represents a major step in the right direction\.?)\s*$", "", "removed generic conclusion")
    return text, changes


def reframe_dashes(text: str, typography: str = "contextual") -> tuple[str, list[str]]:
    changes: list[str] = []

    # This contrast is both formulaic and structurally safe to repair. A lone dash
    # elsewhere is not evidence of bad writing, so contextual mode leaves it alone.
    text, contrast_count = re.subn(
        r"(?i)\b(not\b[^.!?\n]{1,100}?)\s*[—–]\s*(?=(?:it|this|that)\s+(?:is|was)\b)",
        r"\1; ",
        text,
    )
    if contrast_count:
        changes.append(f"reframed formulaic dash contrast ({contrast_count})")
    if typography != "plain":
        return text, changes

    def range_replacement(match: re.Match[str]) -> str:
        changes.append("reframed numeric dash range")
        return f"{match.group(1)} to {match.group(2)}"

    text = re.sub(r"(\d)\s*[–—]\s*(\d)", range_replacement, text)

    # Paired dashes usually mark an appositive or parenthetical aside. Parentheses
    # preserve that relationship; two semicolons do not.
    def paired_replacement(match: re.Match[str]) -> str:
        changes.append("reframed paired dash aside")
        return f" ({match.group(1).strip()}) "

    text = re.sub(r"\s*[—–]\s*([^\n.!?—–]{1,100}?)\s*[—–]\s*", paired_replacement, text)

    def dash_replacement(match: re.Match[str]) -> str:
        left_raw = match.string[max(0, match.start() - 80) : match.start()].rstrip()
        right_raw = match.string[match.end() : match.end() + 80].lstrip()
        left = left_raw.lower()
        right = right_raw.lower()
        changes.append("reframed dash construction")
        if left.endswith("not") or right.startswith("it's") or right.startswith("it is") or right.startswith("this is"):
            return "; "
        if right.startswith(("including", "for example", "namely")):
            return ": "
        # Use a semicolon only when both sides plausibly contain full clauses.
        # Otherwise a comma is the safer deterministic parenthetical boundary.
        left_words = re.findall(r"[A-Za-z']+", left_raw)
        right_words = re.findall(r"[A-Za-z']+", right_raw.split(".", 1)[0])
        clause_markers = {"is", "are", "was", "were", "has", "have", "had", "will", "can", "could", "did", "does", "do"}
        if len(left_words) >= 3 and len(right_words) >= 3 and (
            any(word.lower() in clause_markers for word in left_words[-8:])
            and any(word.lower() in clause_markers for word in right_words[:8])
        ):
            return "; "
        return ", "

    text = re.sub(r"\s*[—–]\s*", dash_replacement, text)
    return text, changes


def clean_spacing(text: str) -> str:
    """Clean edit-created spacing without flattening Markdown layout."""
    output: list[str] = []
    for line in text.splitlines(keepends=True):
        ending = "\n" if line.endswith("\n") else ""
        content = line[:-1] if ending else line
        indent_match = re.match(r"[ \t]*", content)
        indent = indent_match.group(0) if indent_match else ""
        body = content[len(indent):]
        body = re.sub(r"[ \t]+", " ", body)
        body = re.sub(r"\s+([,;!?])", r"\1", body)
        body = re.sub(r"([,;!?])(?=[A-Za-z])", r"\1 ", body)
        output.append(indent + body.rstrip() + ending)
    return "".join(output)


def rewrite(
    text: str,
    genre: str = "auto",
    debug: bool = False,
    protected_values: list[str] | None = None,
    typography: str = "contextual",
) -> dict[str, object]:
    context = prepare_rewrite_context(text, genre, protected_values)
    inferred_genre = str(context["genre_inference"]["genre"])
    before = context["original_humanstats"]
    working, protected = protect(text)
    changes: list[str] = []
    if typography == "plain":
        working, quote_changes = normalize_editable_quotes(working)
        changes.extend(quote_changes)
    working, phrase_changes = replace_phrases(working, inferred_genre)
    changes.extend(phrase_changes)
    working, dash_changes = reframe_dashes(working, typography)
    changes.extend(dash_changes)
    candidate = restore(clean_spacing(working), protected)

    # Second pass is intentionally restricted to residual hard policies. It does not
    # repeatedly paraphrase text or chase a detector score. Any dash still present
    # is structurally reframed, never character-substituted with a comma.
    second_working, second_protected = protect(candidate)
    if typography == "plain":
        second_working, second_quote_changes = normalize_editable_quotes(second_working)
        changes.extend(second_quote_changes)
    second_working, second_dash_changes = reframe_dashes(second_working, typography)
    changes.extend(second_dash_changes)
    candidate = restore(clean_spacing(second_working), second_protected)
    content_map = context["source_content_map"]
    fidelity = audit(text, candidate, protected, content_map, allow_low_overlap=True)
    safety = {
        "fail_closed": True,
        "candidate_reverted": False,
        "reasons": [],
    }
    if not fidelity["passed"]:
        safety = {
            "fail_closed": True,
            "candidate_reverted": True,
            "reasons": [
                check["name"]
                for check in fidelity.get("checks", [])
                if not check.get("passed", True)
            ] + list(fidelity.get("blocking_drift_flags", [])),
        }
        changes.append("reverted candidate after fidelity failure")
        candidate = text
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
        "version": "0.2.0",
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
        "safety": safety,
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
    parser.add_argument(
        "--typography",
        choices=("contextual", "plain"),
        default="contextual",
        help="Preserve intentional typography by default; plain mode reframes editable em/en dashes.",
    )
    parser.add_argument("--json", action="store_true", help="Emit a structured report")
    parser.add_argument("--debug", action="store_true", help="Include the complete structured rewrite context")
    parser.add_argument("--context-out", type=Path, help="Write the complete structured rewrite context to JSON")
    args = parser.parse_args()
    text = Path(args.path).read_text(encoding="utf-8") if args.path else sys.stdin.read()
    result = rewrite(text, args.genre, debug=args.debug or bool(args.context_out), typography=args.typography)
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
