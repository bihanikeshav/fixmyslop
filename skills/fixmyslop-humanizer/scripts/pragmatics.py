#!/usr/bin/env python3
"""Genre inference and pragmatic rewrite objectives for FixMySlop.

This module deliberately contains purpose and register guidance rather than a new
collection of banned-word rules.  The host model uses the profile to decide which
surface findings matter in context.
"""

from __future__ import annotations

import re
from typing import Iterable


PROFILE_VERSION = "0.2.0"


GENRE_DEFINITIONS: dict[str, dict[str, object]] = {
    "interview transcript": {
        "register": "conversational dialogue",
        "purpose": "Preserve a spoken exchange and the interviewee's own cadence.",
        "objectives": [
            "Keep speaker turns, contractions, candid wording, and natural short answers.",
            "Replace corporate abstraction with the speaker's concrete account.",
            "Keep testimony and measured changes exactly where they carry evidence.",
        ],
        "preserve": ["speaker labels", "first-person perspective", "spoken hesitation or emphasis when meaningful"],
        "avoid": ["press-release summaries", "formalizing every spoken phrase", "invented personality"],
        "signals": [
            (r"(?im)^\s*(?:interviewer|interviewee|host|ravi|maya|alex)\s*:", 7, "speaker turns"),
            (r"(?i)\b(?:honestly|actually|could you explain|what changed)\b", 2, "spoken framing"),
        ],
    },
    "customer-support email": {
        "register": "warm, concise support correspondence",
        "purpose": "Acknowledge the customer's problem and make the resolution path clear.",
        "objectives": [
            "Name the problem plainly and acknowledge its inconvenience without canned cheerfulness.",
            "State the next action, evidence request, and timeline exactly as given.",
            "End with a useful resolution or apology, not a pasted chat sign-off.",
        ],
        "preserve": ["order or case identifiers", "customer's reported problem", "promised action and timeframe"],
        "avoid": ["generic greeting wrappers", "new evidence requirements", "blaming or overpromising"],
        "signals": [
            (r"(?i)\b(?:refund|order\s*#|replacement|ticket|shipping|delivered|customer)\b", 4, "support task language"),
            (r"(?im)^\s*(?:hi|hello|dear)\b", 1, "email opening"),
        ],
    },
    "personal social post": {
        "register": "first-person informal social voice",
        "purpose": "Sound like a person sharing an experience, including ambivalence or irony.",
        "objectives": [
            "Preserve first-person stance, mixed sentiment, code-switching, and intentional irony.",
            "Remove announcement or promotional framing only when the author's personality survives.",
            "Keep mentions, hashtags, and concrete details exactly.",
        ],
        "preserve": ["first-person voice", "mixed feelings", "irony or understatement", "mentions and hashtags"],
        "avoid": ["brand-announcement voice", "generic upbeat conclusions", "neutralizing a deliberately messy opinion"],
        "signals": [
            (r"(?i)(?:^|\s)@[A-Za-z0-9_]+|#[A-Za-z0-9_]+", 4, "social markers"),
            (r"(?i)\b(?:anyway|genuinely|honestly|i don'?t know how to feel)\b", 2, "personal stance"),
        ],
    },
    "developer README": {
        "register": "direct technical documentation",
        "purpose": "Help a developer perform the task quickly and find the operational facts.",
        "objectives": [
            "Lead with what the tool does and the shortest useful getting-started path.",
            "Compress promotional description and chat sign-offs into task-relevant prose.",
            "Preserve commands, routes, paths, identifiers, and status codes exactly.",
        ],
        "preserve": ["commands", "environment variables", "routes", "paths", "status codes"],
        "avoid": ["marketing adjectives", "generic evaluation claims", "support-email closings"],
        "signals": [
            (r"(?i)\b(?:pnpm|npm|pip|cargo|docker)\s+[a-z-]+\b", 6, "command"),
            (r"(?i)\b(?:GET|POST|PUT|PATCH|DELETE)\s+/[^\s]+|\bREADME\b|\bfixtures?[/\\]", 4, "developer documentation"),
        ],
    },
    "academic abstract": {
        "register": "restrained research summary",
        "purpose": "Summarize method, result, and qualified inference in compact abstract order.",
        "objectives": [
            "Prefer method, result, and interpretation order over significance framing.",
            "Preserve sample sizes, conditions, statistics, and cautious qualifications exactly.",
            "Do not strengthen association into causation or turn uncertainty into a claim.",
        ],
        "preserve": ["sample and condition", "statistical values", "qualification and uncertainty", "causal limits"],
        "avoid": ["importance claims", "decorative implications", "overconfident causal language"],
        "signals": [
            (r"(?i)\b(?:participants?|sample|p\s*=|statistically significant|intervention|method)\b", 5, "research structure"),
            (r"(?i)\b(?:study|results?|findings?|abstract)\b", 2, "academic framing"),
        ],
    },
    "policy notice": {
        "register": "precise rights and policy notice",
        "purpose": "Tell readers what changes, who is affected, what is optional or required, and when.",
        "objectives": [
            "Lead with the concrete policy change, right, obligation, scope, and deadline.",
            "Distinguish may, must, can, and eligibility conditions without broadening them.",
            "Use neutral institutional language and keep channels and review windows exact.",
        ],
        "preserve": ["scope", "obligations and permissions", "deadlines", "channels", "review period"],
        "avoid": ["empowerment slogans", "broad stewardship claims", "new rights or obligations"],
        "signals": [
            (r"(?i)\b(?:section\s+\d|opt out|privacy|retention|policy|customers? may|terms)\b", 5, "policy language"),
            (r"(?i)\b(?:before|within)\s+\d+\s+(?:days?|months?)\b", 2, "policy deadline"),
        ],
    },
    "software release notes": {
        "register": "terse factual release communication",
        "purpose": "Tell users what changed and preserve measured outcomes and controls.",
        "objectives": [
            "Use compact change-first bullets or sentences rather than launch hype.",
            "Retain every measured result, compatibility detail, flag, route, and date.",
            "Separate improvement claims from facts actually stated in the source.",
        ],
        "preserve": ["version", "measured results", "API or command details", "release date"],
        "avoid": ["launch slogans", "unsupported performance claims", "decorative emoji"],
        "signals": [(r"(?i)\b(?:v\d+\.\d+|release|update|changelog|retry|fixed|added)\b", 4, "release language")],
    },
    "recipe": {
        "register": "practical imperative instructions",
        "purpose": "Let a reader cook the dish accurately with minimal friction.",
        "objectives": [
            "Turn scene-setting into direct steps and keep quantities, time, temperature, and dietary facts.",
            "Keep sensory description only when it helps the cook judge progress.",
            "Do not invent serving sizes, timing, or ingredient properties.",
        ],
        "preserve": ["quantities", "temperature", "timing", "dietary properties"],
        "avoid": ["lifestyle promotion", "unsupported timing or serving claims", "ornamental introduction"],
        "signals": [(r"(?i)\b(?:tbsp|tsp|bake|stir|preheat|recipe|oven|ingredients?)\b", 5, "recipe instruction")],
    },
    "engineering incident postmortem": {
        "register": "blunt, accountable technical report",
        "purpose": "Record what happened, why, impact, evidence, and concrete remediation.",
        "objectives": [
            "Keep the timeline, service, error, impact, testimony, and causal qualification exact.",
            "Separate known cause from hypothesis and state remediation concretely.",
            "Remove grand lessons without weakening accountability.",
        ],
        "preserve": ["timestamp", "service and error", "duration or impact", "quoted testimony", "causal qualification"],
        "avoid": ["generic lessons", "unsupported attribution", "promises that the issue cannot recur"],
        "signals": [(r"(?i)\b(?:UTC|incident|degraded|error|alert|postmortem|queue|delay)\b", 5, "incident language")],
    },
    "product onboarding UI": {
        "register": "concise product interface copy",
        "purpose": "Help the user complete the next action without inflated promises.",
        "objectives": [
            "Put the action, limit, and available choices first.",
            "Keep button labels, routes, and limits exact.",
            "Remove guaranteed personalization or marketing claims unless supported.",
        ],
        "preserve": ["button labels", "limits", "routes", "choice semantics"],
        "avoid": ["guaranteed outcomes", "decorative welcome copy", "renaming controls"],
        "signals": [(r"(?i)(?:\bselect\s+(?:continue|skip|next)\b|\bskip\s+for\s+now\b|/(?:settings|profile|onboarding)(?:/|\b)|\b(?:button|checkbox|dropdown|input)\s+(?:label|field)?\b)", 7, "UI control language")],
    },
    "internal project memo": {
        "register": "concise action-oriented internal memo",
        "purpose": "Make ownership, scope, resources, and next actions easy to scan.",
        "objectives": [
            "Lead with owner, deadline, resources, and requested action.",
            "Keep operational facts and staffing targets exact.",
            "Remove broad initiative framing and generic optimism.",
        ],
        "preserve": ["owner", "deadline", "budget", "turnaround", "staffing target"],
        "avoid": ["initiative slogans", "generic future claims", "vague stakeholder language"],
        "signals": [(r"(?i)\b(?:memo|proposal|budget|due|reviewers?|initiative|project)\b", 4, "memo language")],
    },
    "customer review": {
        "register": "personal evaluative prose",
        "purpose": "Report a specific experience with the writer's own mixed judgment.",
        "objectives": [
            "Preserve concrete sensory details, complaints, code-switching, and rating.",
            "Keep mixed sentiment instead of forcing a single verdict.",
            "Remove generic summary language only when the author's voice remains intact.",
        ],
        "preserve": ["first-person experience", "specific detail", "mixed sentiment", "rating"],
        "avoid": ["generic recommendation copy", "flattened complaint language", "invented experience"],
        "signals": [(r"(?i)\b(?:rating|visited|review|tea|app|ordering|experience)\b", 4, "review language")],
    },
    "general prose": {
        "register": "context-matched prose",
        "purpose": "Improve clear, natural expression while preserving meaning and voice.",
        "objectives": ["Make only high-confidence, useful edits.", "Preserve the source's stance and level of certainty."],
        "preserve": ["meaning", "voice", "qualifications"],
        "avoid": ["generic polish", "invented specificity"],
        "signals": [],
    },
}


ALIASES = {
    "interview": "interview transcript",
    "conversation": "interview transcript",
    "support email": "customer-support email",
    "support-email": "customer-support email",
    "social post": "personal social post",
    "social": "personal social post",
    "readme": "developer README",
    "technical documentation": "developer README",
    "academic": "academic abstract",
    "research": "academic abstract",
    "policy": "policy notice",
    "release notes": "software release notes",
    "onboarding": "product onboarding UI",
    "ui microcopy": "product onboarding UI",
    "memo": "internal project memo",
    "review": "customer review",
}


def canonical_genre(value: str | None) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip())
    if not cleaned or cleaned.lower() == "auto":
        return "auto"
    lowered = cleaned.lower()
    return ALIASES.get(lowered, cleaned if cleaned in GENRE_DEFINITIONS else cleaned)


def infer_genre(text: str, requested: str = "auto") -> dict[str, object]:
    """Infer a canonical genre/register and return evidence and confidence."""
    explicit = canonical_genre(requested)
    if explicit != "auto" and explicit in GENRE_DEFINITIONS:
        definition = GENRE_DEFINITIONS[explicit]
        return {
            "inference_version": PROFILE_VERSION,
            "requested_genre": requested,
            "genre": explicit,
            "register": definition["register"],
            "confidence": 1.0,
            "method": "explicit_request",
            "evidence": [{"text": "explicit genre request", "weight": 1.0}],
        }

    scores: list[tuple[str, int, list[dict[str, object]]]] = []
    for genre, definition in GENRE_DEFINITIONS.items():
        score = 0
        evidence: list[dict[str, object]] = []
        for pattern, weight, label in definition.get("signals", []):
            matches = list(re.finditer(pattern, text))
            if matches:
                score += int(weight)
                evidence.append({"signal": label, "weight": weight, "examples": [m.group(0) for m in matches[:3]]})
        if score:
            scores.append((genre, score, evidence))
    scores.sort(key=lambda row: row[1], reverse=True)
    if not scores:
        genre = "general prose"
        score = 0
        evidence = []
        method = "fallback"
        confidence = 0.35
    else:
        genre, score, evidence = scores[0]
        second = scores[1][1] if len(scores) > 1 else 0
        confidence = min(0.98, round(0.45 + min(0.45, score / 20) + min(0.08, max(0, score - second) / 20), 3))
        method = "weighted_lexical_and_structural_signals"
    definition = GENRE_DEFINITIONS[genre]
    return {
        "inference_version": PROFILE_VERSION,
        "requested_genre": requested,
        "genre": genre,
        "register": definition["register"],
        "confidence": confidence,
        "method": method,
        "evidence": evidence,
        "ranked_candidates": [{"genre": name, "score": value} for name, value, _ in scores[:4]],
    }


FINDING_ACTIONS = {
    "interface_artifact": "Remove pasted chat framing unless warmth is part of the genre; replace a generic sign-off with a useful close.",
    "inflation": "State the concrete fact instead of asserting importance or historical significance.",
    "promotional": "Use neutral, task-fit wording; preserve intentional personal enthusiasm in social/review prose.",
    "vague_attribution": "Name the source only if the source text names it; otherwise remove the unsupported authority claim.",
    "participial_tail": "Split or integrate the explanation when it adds a claim; do not delete a meaningful result.",
    "negative_parallelism": "Use the simplest direct contrast that preserves both claims and the genre's voice.",
    "false_range": "Replace a rhetorical range with the concrete items or a meaningful scale; keep natural speech in dialogue.",
    "filler": "Shorten the framing and put the action or result first.",
    "hedging_stack": "Keep the strongest qualification needed by the source, but remove stacked uncertainty.",
    "copula_avoidance": "Prefer a plain verb when it does not change the claim.",
    "generic_conclusion": "End on the concrete implication or next action; do not add optimism.",
    "ai_vocabulary": "Replace formulaic vocabulary only when the surrounding register makes it unnatural.",
    "slop_overrepresentation": "Statistically overrepresented word/phrase versus a human baseline. Review in context and rewrite naturally only if it does not serve the genre; do not simply delete flagged words.",
}


def build_pragmatic_profile(inference: dict[str, object], findings: Iterable[dict[str, object]] = ()) -> dict[str, object]:
    genre = str(inference["genre"])
    definition = GENRE_DEFINITIONS.get(genre, GENRE_DEFINITIONS["general prose"])
    finding_actions = []
    seen: set[str] = set()
    for finding in sorted(findings, key=lambda item: (-int(item.get("severity", 0)), int(item.get("start", 0)))):
        family = str(finding.get("family", ""))
        if family in seen:
            continue
        seen.add(family)
        finding_actions.append({
            "family": family,
            "severity": finding.get("severity", 1),
            "evidence": finding.get("evidence", ""),
            "action": FINDING_ACTIONS.get(family, "Review this finding in context and change only if it conflicts with the genre objective."),
        })
    return {
        "profile_version": PROFILE_VERSION,
        "genre": genre,
        "register": definition["register"],
        "purpose": definition["purpose"],
        "objectives": list(definition["objectives"]),
        "preserve": list(definition["preserve"]),
        "avoid": list(definition["avoid"]),
        # Finding families this genre treats as intentional voice; a surviving instance
        # of one of these is reported diagnostically rather than corrected. Empty by
        # default (no family is presumed intentional); populate per genre with evidence.
        "intentional_families": list(definition.get("intentional_families", [])),
        "finding_actions": finding_actions,
    }


def concise_model_summary(
    inference: dict[str, object],
    profile: dict[str, object],
    original_stats: dict[str, object],
    content_map: dict[str, object],
) -> dict[str, object]:
    """Return the bounded context sent to a host rewriting model."""
    findings = list(profile.get("finding_actions", []))[:8]
    return {
        "genre": {
            "label": inference["genre"],
            "register": inference["register"],
            "confidence": inference["confidence"],
        },
        "purpose": profile["purpose"],
        "objectives": list(profile["objectives"])[:4],
        "preserve": list(profile["preserve"])[:6],
        "avoid": list(profile["avoid"])[:5],
        "actionable_findings": findings,
        "measured_signals": {
            "formulaic_risk": original_stats.get("formulaic_risk", 0),
            "finding_count": len(original_stats.get("findings", [])),
            "sentence_count": original_stats.get("sentence_count", 0),
            "word_count": original_stats.get("token_count", 0),
            "protected_span_count": original_stats.get("protected_span_count", 0),
        },
        "hard_anchor_policy": {
            "count": content_map.get("hard_anchor_count", 0),
            "anchors": [
                {"kind": anchor.get("kind"), "text": anchor.get("text"), "required_count": anchor.get("occurrence_count", 1)}
                for anchor in list(content_map.get("hard_anchors", []))[:32]
            ],
            "instruction": "Preserve every hard anchor exactly; wording and ordering remain flexible unless the profile requires operational order.",
        },
    }
