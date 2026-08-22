#!/usr/bin/env python3
"""FixMySlop invokable pipeline with a v1 / v2 mode switch.

Reproduces the CONFIRMED v2 architecture (tag v2-confirmed-baseline; see V2_BASELINE.md):

    source -> Stage 1 aggressive de-slop draft -> Stage 2 FixMySlop 2-round anchor/fidelity repair -> final

Mode switch:
  - "v1": Stage 1 = the conservative FixMySlop host prompt (pragmatics-guided). Default; behavior unchanged.
  - "v2": Stage 1 = the aggressive de-slop generator (the confirmed A_nolock Stage 1).
Stage 2 (the repair loop) is SHARED by both modes.

In v2 mode a ``stage1`` selector picks the Stage-1 draft prompt:
  - "aggressive" (default): the confirmed A_nolock generator (STAGE1_AGGRESSIVE_SYS). This is the held-out,
    preregistered champion; keep it default and do not change its bytes.
  - "rules": a first-party, rule-grounded de-slop prompt (STAGE1_RULES_SYS) enumerating the concrete AI-writing
    tells to strip. Benchmarks (see V2_1_FINDINGS.md): wins light-edit creative text (Beemo) and rhetoric,
    but loses heavy-corpus conditional-direction by ~0.055. Optional, non-default; callers self-route per genre.

Prompt PROVENANCE (see V2_1_FINDINGS.md): every Stage-1 prompt here is original text authored in this repo;
none is copied from any third-party "humanizer" product. The pattern taxonomy both prompts encode derives from
the public, CC BY-SA "Signs of AI writing" guidance. The confirmed Stage-1 was benchmarked under the comparator
label "Humanizer" because it emulates that skill's pattern coverage — that label is benchmark lineage, not the
prompt's authorship.

Generation is abstracted: the caller passes ``generate(messages) -> str`` (chat-completions style), so this
module has no model or network dependency and is unit-testable with a stub. The champion prompts + repair loop
here are byte-identical to the frozen confirmation harness (textslopbench/v2_confirmed_baseline.py); a test
guards against drift.
"""
from __future__ import annotations

import json
from typing import Callable

from fidelity import audit as fidelity_audit
from pipeline import prepare_rewrite_context, finish_rewrite_context, host_rewrite_prompt

# --- Stage-1 aggressive de-slop prompt (confirmed v2 / A_nolock). Original in-repo text; frozen byte-for-byte
# against the confirmation harness constant (humanizer_vs_current.HUMANIZER_SYS is that same benchmarked text).
# Do NOT edit these bytes — it would break the held-out confirmation. See PROVENANCE in the module docstring.
STAGE1_AGGRESSIVE_SYS = (
    "You are a text humanizer. Rewrite the text so it does not read as AI-generated: remove inflated "
    "symbolism, promotional language, vague attributions, em-dash overuse, the rule of three, AI "
    "vocabulary, negative parallelisms, and conjunctive-phrase overuse; vary rhythm; make it sound "
    "naturally human. Preserve every hard anchor exactly (numbers, dates, names, quotations, URLs) "
    "and do not invent facts. Return ONLY JSON {\"id\": \"revised text\", ...}.")
# Back-compat alias (the confirmed-baseline name); identical bytes.
STAGE1_V2_SYS = STAGE1_AGGRESSIVE_SYS

# --- Stage-1 first-party rule-grounded prompt (optional "rules" variant; dependency-free). Original in-repo
# text built from our humanstats.PATTERNS taxonomy (public "Signs of AI writing" families). Frozen: the
# benchmark numbers in V2_1_FINDINGS.md are tied to these exact bytes.
STAGE1_RULES_SYS = (
    "You are a strict copy editor stripping the fingerprints of AI-generated writing. Rewrite the passage to "
    "eliminate EVERY instance of these tells, editing boldly and rephrasing whole sentences where needed, while "
    "keeping the meaning intact:\n"
    "1. Assistant/boilerplate framing ('I hope this helps', 'here is an overview', 'great question').\n"
    "2. Asserted importance ('a testament to', 'pivotal moment', 'evolving landscape', 'plays a vital role', "
    "'marks a shift').\n"
    "3. Promotional adjectives ('groundbreaking', 'breathtaking', 'stunning', 'vibrant', 'world-class', "
    "'seamless', 'rich cultural heritage').\n"
    "4. Unattributed authority ('experts say', 'observers note', 'critics argue', 'many believe').\n"
    "5. Explanatory -ing tails (', highlighting ...', ', underscoring ...', ', reflecting ...').\n"
    "6. Contrast frames ('not only X but also Y', 'not just X, it's Y').\n"
    "7. Rhetorical 'from X to Y' ranges used for sweep rather than a real scale.\n"
    "8. Wordy filler ('in order to', 'due to the fact that', 'at this point in time', 'it is important to note "
    "that', 'has the ability to').\n"
    "9. Stacked hedges ('could potentially possibly', 'it could be argued that').\n"
    "10. Elaborate copulas ('serves as', 'stands as', 'boasts', 'functions as', 'represents a').\n"
    "11. Generic upbeat endings ('the future looks bright', 'exciting times lie ahead', 'a step in the right "
    "direction').\n"
    "12. Formulaic AI vocabulary ('delve', 'tapestry', 'underscore', 'intricate', 'crucial', 'pivotal', "
    "'foster', 'showcase', 'moreover', 'furthermore', 'additionally').\n"
    "Also: cut repetition and repeated sentence openings, and vary sentence rhythm. Preserve every number, date, "
    "name, quotation, and URL exactly; add no new facts."
    " Return ONLY JSON {\"id\": \"revised text\", ...}.")

STAGE1_V2_VARIANTS = {"aggressive": STAGE1_AGGRESSIVE_SYS, "rules": STAGE1_RULES_SYS}

# --- Stage-2 repair prompt. Byte-identical to the confirmed harness CORRECTION_SYS.
REPAIR_SYS = (
    "Correct each draft using ONLY its actionable_findings and any hard-anchor failures. Restore every "
    "missing or underrepresented hard anchor exactly. Do NOT change spans listed under diagnostic_findings. "
    "Preserve every hard anchor, qualification, causal relationship, quotation, command, and source certainty. "
    "Do not add facts or make broad stylistic changes. Return ONLY JSON mapping id to corrected text.")

Generate = Callable[[list[dict]], str]
DEFAULT_ROUNDS = 2


def _parse_one(text: str, doc_id: str = "doc") -> str:
    """Parse a model reply that is either a JSON id->text map or plain prose. Returns the doc's text."""
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```", 2)[1]
        if s.startswith("json"):
            s = s[4:]
        s = s.strip()
    try:
        obj = json.loads(s[min([i for i in (s.find("{"), s.find("[")) if i != -1] or [0]):])
        if isinstance(obj, dict):
            if doc_id in obj:
                return str(obj[doc_id])
            if len(obj) == 1:
                return str(next(iter(obj.values())))
    except Exception:
        pass
    return text.strip()


def stage1_messages(source: str, mode: str = "v2", doc_id: str = "doc",
                    variant: str = "aggressive") -> list[dict]:
    """Build the Stage-1 draft-generation messages for the given mode.

    In v2 mode, ``variant`` selects the Stage-1 prompt: "aggressive" (default, confirmed champion) or
    "rules" (first-party, dependency-free; optional). ``variant`` is ignored in v1 mode.
    """
    if mode == "v2":
        try:
            system = STAGE1_V2_VARIANTS[variant]
        except KeyError:
            raise ValueError(f"unknown stage1 variant: {variant!r} (expected {sorted(STAGE1_V2_VARIANTS)})")
        payload = [{"id": doc_id, "text": source}]
        return [{"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]
    if mode == "v1":
        ctx = prepare_rewrite_context(source, "auto", [])
        return [{"role": "user", "content": host_rewrite_prompt(source, ctx)}]
    raise ValueError(f"unknown mode: {mode!r} (expected 'v1' or 'v2')")


def repair_step(source: str, draft: str, protected: list[str] | None = None, doc_id: str = "doc"):
    """One repair-round plan. Returns (needed, messages_or_None). `messages` runs the bounded correction pass."""
    protected = protected or []
    ctx = prepare_rewrite_context(source, "auto", protected)
    ctx = finish_rewrite_context(ctx, str(draft), fidelity_audit(source, str(draft), protected))
    tc = ctx["targeted_correction"]
    if not tc.get("needed"):
        return False, None
    payload = [{"id": doc_id, "draft": str(draft), "correction_plan": {
        "actionable_findings": tc.get("actionable_findings"), "anchor_coverage": tc.get("anchor_coverage"),
        "diagnostic_findings": tc.get("diagnostic_findings"), "instructions": tc.get("instructions")}}]
    return True, [{"role": "system", "content": REPAIR_SYS},
                  {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]


def run(source: str, generate: Generate, mode: str = "v1", rounds: int = DEFAULT_ROUNDS,
        protected: list[str] | None = None, doc_id: str = "doc", variant: str = "aggressive") -> str:
    """Run the full pipeline for one document.

    Stage 1 draft (mode-selected; in v2, ``variant``-selected) then up to ``rounds`` shared FixMySlop repair
    passes, stopping early when the anchor/fidelity audit is clean. ``generate(messages) -> raw_text``; parsing
    tolerates JSON-map or prose.
    """
    draft = _parse_one(generate(stage1_messages(source, mode, doc_id, variant)), doc_id)
    current = draft
    for _ in range(max(0, rounds)):
        needed, messages = repair_step(source, current, protected, doc_id)
        if not needed:
            break
        current = _parse_one(generate(messages), doc_id)
    return current
