#!/usr/bin/env python3
"""The explicit analyzer-to-rewrite execution contract.

This module is the shared path for local execution, host-model prompt preparation,
and audit/debug traces.  It contains no text generation logic.
"""

from __future__ import annotations

from typing import Iterable

from anchors import audit_anchor_coverage, extract_source_content_map
from humanstats import analyze, protected_spans
from pragmatics import build_pragmatic_profile, concise_model_summary, infer_genre


PIPELINE_VERSION = "0.2.0"


def extract_targets(text: str, content_map: dict[str, object]) -> dict[str, object]:
    """Describe protected content and editable regions before any rewrite."""
    return {
        "stage": "target_extraction",
        "pipeline_version": PIPELINE_VERSION,
        "protected_span_count": content_map.get("protected_span_count", 0),
        "hard_anchor_count": content_map.get("hard_anchor_count", 0),
        "editable_target_count": content_map.get("editable_target_count", 0),
        "protected_spans": content_map.get("protected_spans", []),
        "editable_targets": content_map.get("editable_targets", []),
    }


def prepare_rewrite_context(
    text: str,
    requested_genre: str = "auto",
    explicit_protected: Iterable[str] | None = None,
    structural_families: Iterable[str] | None = None,
    structural_model: object = None,
    structural_rid: object = None,
    expendable_families: Iterable[str] | None = None,
) -> dict[str, object]:
    """Run target extraction, genre inference, scan, and pragmatic profiling.

    Experimental: when `structural_families` and `structural_model` are both given, the hardened
    repetition-only structural-findings bridge appends at most one LOCAL, anchor-guarded finding to
    `actionable_findings` (after the rhetorical ones, lower priority). `structural_rid` is excluded
    from the population model (leave-one-out). Default (families/model None) is v1: identical output.
    """
    content_map = extract_source_content_map(text, explicit_protected)
    targets = extract_targets(text, content_map)
    inference = infer_genre(text, requested_genre)
    genre = str(inference["genre"])
    original_stats = analyze(text, genre)
    profile = build_pragmatic_profile(inference, original_stats.get("findings", []))
    model_summary = concise_model_summary(inference, profile, original_stats, content_map)
    structural_audit = None
    if structural_families and structural_model is not None:
        from structural_bridge import structural_findings
        extra, structural_audit = structural_findings(
            text, structural_rid, structural_model, content_map, families=tuple(structural_families))
        model_summary["actionable_findings"] = list(model_summary["actionable_findings"]) + extra
    expendable_audit = None
    if expendable_families:
        from expendable_bridge import expendable_findings
        extra, expendable_audit = expendable_findings(text, content_map, families=tuple(expendable_families))
        model_summary["actionable_findings"] = list(model_summary["actionable_findings"]) + extra
    return {
        "pipeline_version": PIPELINE_VERSION,
        "stage_order": [
            "target_extraction",
            "genre_register_inference",
            "humanstats_original",
            "pragmatic_profile",
            "rewrite",
            "humanstats_rewrite",
            "targeted_correction",
            "fidelity",
        ],
        "requested_genre": requested_genre,
        "targets": targets,
        "genre_inference": inference,
        "original_humanstats": original_stats,
        "pragmatic_profile": profile,
        "source_content_map": content_map,
        "model_summary": model_summary,
        "structural_audit": structural_audit,
        "expendable_audit": expendable_audit,
    }


# Severity at or above which a surviving finding is treated as high confidence.
HIGH_CONFIDENCE_SEVERITY = 2


def _anchor_spans_in(text: str, content_map: dict[str, object]) -> list[tuple[int, int]]:
    """Character spans occupied by exact hard-anchor occurrences inside ``text``."""
    spans: list[tuple[int, int]] = []
    for anchor in content_map.get("hard_anchors", []):
        needle = str(anchor.get("text", ""))
        if not needle:
            continue
        start = text.find(needle)
        while start != -1:
            spans.append((start, start + len(needle)))
            start = text.find(needle, start + 1)
    return spans


def classify_second_scan_finding(
    finding: dict[str, object],
    anchor_spans: list[tuple[int, int]],
    intentional_families: set[str],
) -> tuple[bool, str]:
    """Gate one surviving finding. Returns (actionable, reason).

    A second-pass finding may drive an edit only when all four hold: it maps to a
    concrete span, it is high confidence, correcting it does not threaten a hard
    anchor, and it is relevant to the inferred pragmatic profile. Otherwise it is
    diagnostic-only and the reason names the first failed gate.
    """
    start = finding.get("start")
    end = finding.get("end")
    if not isinstance(start, int) or not isinstance(end, int) or end <= start or not str(finding.get("evidence", "")):
        return False, "no_concrete_span"
    if int(finding.get("severity", 0)) < HIGH_CONFIDENCE_SEVERITY:
        return False, "low_confidence"
    if any(start < right and end > left for left, right in anchor_spans):
        return False, "would_threaten_anchor"
    if str(finding.get("family", "")) in intentional_families:
        return False, "pragmatically_intentional"
    return True, "actionable"


def targeted_correction_plan(
    context: dict[str, object],
    rewritten: str,
    rewritten_stats: dict[str, object],
) -> dict[str, object]:
    """Turn post-rewrite evidence into a bounded correction request.

    Correction is triggered only by a concrete, high-confidence, anchor-safe,
    pragmatically-relevant finding (or a hard-anchor failure). Everything else is
    reported diagnostically and the text is left alone.
    """
    anchor_result = audit_anchor_coverage(context["source_content_map"], rewritten)
    anchor_spans = _anchor_spans_in(rewritten, context["source_content_map"])
    intentional = set(context["pragmatic_profile"].get("intentional_families", []))

    actionable: list[dict[str, object]] = []
    diagnostic: list[dict[str, object]] = []
    for finding in rewritten_stats.get("findings", []):
        keep, reason = classify_second_scan_finding(finding, anchor_spans, intentional)
        entry = {
            "family": finding.get("family"),
            "severity": finding.get("severity"),
            "evidence": finding.get("evidence"),
            "message": finding.get("message"),
            "start": finding.get("start"),
            "end": finding.get("end"),
        }
        if keep:
            actionable.append(entry)
        else:
            diagnostic.append({**entry, "diagnostic_reason": reason})
    actionable = actionable[:8]

    instructions: list[str] = []
    if not anchor_result["passed"]:
        instructions.append("Restore every missing or underrepresented hard anchor exactly before returning the revision.")
    if actionable:
        instructions.append("Edit only the spans named in `actionable_findings`; leave everything else, including all diagnostic findings, unchanged.")
    return {
        "stage": "targeted_correction",
        "anchor_coverage": anchor_result,
        "actionable_findings": actionable,
        "diagnostic_findings": diagnostic[:16],
        "instructions": instructions,
        "needed": bool(instructions),
        "profile": {
            "genre": context["genre_inference"]["genre"],
            "objectives": context["pragmatic_profile"]["objectives"],
            "preserve": context["pragmatic_profile"]["preserve"],
        },
    }


def finish_rewrite_context(
    context: dict[str, object],
    rewritten: str,
    fidelity: dict[str, object],
) -> dict[str, object]:
    """Append the second scan, correction plan, and fidelity result."""
    genre = str(context["genre_inference"]["genre"])
    rewritten_stats = analyze(rewritten, genre)
    correction = targeted_correction_plan(context, rewritten, rewritten_stats)
    context["rewrite"] = {"text": rewritten}
    context["rewrite_humanstats"] = rewritten_stats
    context["targeted_correction"] = correction
    context["targeted_correction_prompt"] = targeted_correction_prompt(context)
    context["fidelity"] = fidelity
    return context


def targeted_correction_prompt(context: dict[str, object]) -> str | None:
    """Render the bounded second host pass when post-rewrite evidence requires it."""
    correction = context.get("targeted_correction", {})
    if not correction.get("needed"):
        return None
    import json

    return "\n".join([
        "Correct the draft below using ONLY `actionable_findings` and any hard-anchor failures.",
        "Do NOT change spans listed under `diagnostic_findings`; they are reported for the record only.",
        "Preserve every hard anchor, qualification, causal relationship, quotation, command, and source certainty.",
        "Do not add facts or make broad stylistic changes.",
        "DRAFT:",
        str(context.get("rewrite", {}).get("text", "")),
        "CORRECTION PLAN:",
        json.dumps(correction, ensure_ascii=False, sort_keys=True),
        "Return only the corrected prose.",
    ])


def audit_context(context: dict[str, object], include_raw: bool = True) -> dict[str, object]:
    """Return either the full debug trace or only the bounded host summary."""
    if include_raw:
        return context
    return {
        "pipeline_version": context["pipeline_version"],
        "stage_order": context["stage_order"],
        "requested_genre": context["requested_genre"],
        "genre_inference": context["genre_inference"],
        "model_summary": context["model_summary"],
        "targeted_correction": context.get("targeted_correction"),
        "targeted_correction_prompt": context.get("targeted_correction_prompt"),
        "fidelity": context.get("fidelity"),
    }


def host_rewrite_prompt(source: str, context: dict[str, object], condition: str = "humanstats+pragmatic+second-scan") -> str:
    """Render the exact concise context contract given to a host model."""
    import json

    summary = context["model_summary"]
    correction = context.get("targeted_correction", {})
    return "\n".join([
        "You are revising the source below, not regenerating it.",
        f"Ablation condition: {condition}.",
        "Use this structured summary as actionable context. Do not infer new facts.",
        "STRUCTURED REWRITE CONTEXT:",
        json.dumps(summary, ensure_ascii=False, sort_keys=True),
        "SOURCE:",
        source,
        "REWRITE CONTRACT:",
        "Preserve every hard anchor exactly. Revise soft expression freely when it improves the stated genre purpose. Keep uncertainty, causal relationships, quotations, commands, labels, and measured results faithful.",
        "After drafting, run the second-scan correction instructions below if present, then return only the final prose.",
        "CORRECTION INSTRUCTIONS:",
        json.dumps(correction.get("instructions", []), ensure_ascii=False),
    ])
