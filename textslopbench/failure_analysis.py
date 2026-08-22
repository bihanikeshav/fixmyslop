#!/usr/bin/env python3
"""Generate the pre-change failure analysis requested for TextSlopBench.

This script reads frozen fixture/output artifacts and never edits the skill package.
It emits an exact per-example JSON record plus a human-readable diagnostic report.
"""

from __future__ import annotations

import difflib
import json
import math
import re
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))
from humanstats import analyze
from fidelity import audit


FIXTURES = ROOT / "textslopbench" / "fixtures.jsonl"
MERGED = ROOT / "textslopbench" / "results" / "agent-merged.jsonl"
PAIRS = ROOT / "textslopbench" / "results" / "blinded-pairs.jsonl"
JUDGE_FILES = sorted((ROOT / "textslopbench" / "results").glob("judge_*.jsonl"))


BASELINE_RULES = {
    "R01_significance_inflation": (r"(?i)\b(?:testament|pivotal|transformative|evolving landscape|vital role|broader movement|enduring legacy)\b", "undue significance"),
    "R02_media_notability": (r"(?i)\b(?:new york times|bbc|financial times|independent coverage|media outlets|social media presence)\b", "notability/media emphasis"),
    "R03_ing_analysis": (r"(?i),\s*(?:highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|contributing|showcasing|fostering|cultivating)\b", "superficial -ing analysis"),
    "R04_promotional": (r"(?i)\b(?:groundbreaking|breathtaking|must-visit|stunning|vibrant|renowned|seamless|world-class|rich cultural heritage|powerful|intuitive)\b", "promotional language"),
    "R05_vague_attribution": (r"(?i)\b(?:experts|observers|critics|industry reports|some sources|many believe)\b", "vague attribution"),
    "R06_challenges_future": (r"(?i)\b(?:despite (?:its|these|several) challenges|future outlook|challenges and legacy)\b", "outline-like challenges/future"),
    "R07_ai_vocabulary": (r"(?i)\b(?:additionally|delve|crucial|fostering|garner|interplay|intricate|showcase|tapestry|underscore|pivotal)\b", "formulaic AI vocabulary"),
    "R08_copula_avoidance": (r"(?i)\b(?:serves as|stands as|boasts|functions as|represents a)\b", "copula avoidance"),
    "R09_negative_parallelism": (r"(?i)\b(?:not only|not just|not merely|it's not|it was not merely)\b", "negative parallelism"),
    "R10_rule_of_three": (r"\b[^.!?\n,]+,\s+[^.!?\n,]+,\s+(?:and|or)\s+[^.!?\n,]+", "rule of three / list rhythm"),
    "R11_elegant_variation": (r"(?i)\b(?:protagonist|main character|central figure|hero)\b", "synonym cycling proxy"),
    "R12_false_range": (r"(?i)\bfrom\s+[^.!?;]{1,80}\bto\s+[^.!?;]{1,80}\b", "false range"),
    "R13_em_dash": (r"[—–]", "em/en dash"),
    "R14_boldface": (r"\*\*[^*]+\*\*", "decorative bold"),
    "R15_inline_header_list": (r"(?m)^\s*[-*]\s+\*\*[^*]+\*\*:", "inline-header list"),
    "R16_title_case_heading": (r"(?m)^#{1,6}\s+(?:[A-Z][a-z]+\s+){2,}[A-Z][a-z]+", "title-case heading"),
    "R17_emoji": (r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", "emoji decoration"),
    "R18_curly_quotes": (r"[“”‘’]", "curly quotation marks"),
    "R19_chat_artifact": (r"(?i)\b(?:great question|i hope this helps|let me know|here is an overview|welcome to)\b", "collaborative/chat artifact"),
    "R20_cutoff_disclaimer": (r"(?i)\b(?:as of|last training update|based on available information|specific details are limited)\b", "knowledge-cutoff disclaimer"),
    "R21_sycophancy": (r"(?i)\b(?:great question|you're absolutely right|excellent point|happy to help)\b", "sycophantic tone"),
    "R22_filler": (r"(?i)\b(?:in order to|due to the fact that|at this point in time|it is important to note that|has the ability to)\b", "filler"),
    "R23_hedging": (r"(?i)\b(?:could potentially possibly|might possibly|it could be argued|may possibly)\b", "excessive hedging"),
    "R24_generic_conclusion": (r"(?i)\b(?:the future looks bright|exciting times lie ahead|journey toward excellence|step in the right direction)\b", "generic conclusion"),
}


ORACLE = {
    "support_email_refund": {
        "should_change": "Make the apology and next step sound like support correspondence; remove the generic greeting and closing without adding a package-photo requirement.",
        "category": "genre/register miss",
        "detectability": "Analyzer miss: current findings catch chat framing but not support empathy, clarity, or the awkward delivered-but-missing construction.",
        "baseline_issue": "Baseline adds 'package and its contents', a requirement absent from the source; the exact checker does not catch additions.",
        "diagnosis": "FixMySlop retains the factual core but its opening remains generic and less empathetic. The failure is pragmatic/register-sensitive, not caused by an overly strong fidelity guardrail.",
    },
    "release_notes_hype": {
        "should_change": "Use terse release-note structure and retain every measured change, including better performance and the 38% failed-job reduction.",
        "category": "fidelity constraint too strong",
        "detectability": "Analyzer correctly sees hype, emoji, and AI vocabulary; it does not represent claim coverage, so omission of 'better performance' is invisible.",
        "baseline_issue": "Baseline drops the stated performance improvement while retaining the 38% number.",
        "diagnosis": "Fix wins because it preserves the release facts while neutralizing hype. Its higher retention is beneficial here, not under-editing.",
    },
    "incident_postmortem": {
        "should_change": "Keep the timestamp, service, error, quote, and duration; state causality carefully and make remediation concrete.",
        "category": "benchmark/judge uncertainty",
        "detectability": "Analyzer sees the dash, negative parallelism, vague attribution, and generic remediation only partially; no clear remaining high-confidence error is visible in the Fix output.",
        "baseline_issue": "No confirmed baseline factual omission in this fixture; the win is mostly clarity and cautious attribution.",
        "diagnosis": "The apparent win is plausible but not a strong fidelity separation. It should be treated as a useful calibration case, not evidence of a broad advantage.",
    },
    "research_abstract": {
        "should_change": "Use restrained abstract tense and syntax, preserve the sample/statistical values, and state the cautious inference without adding causal force.",
        "category": "genre/register miss",
        "detectability": "Analyzer sees inflation, AI vocabulary, participial framing, and hedging in the source; after the Fix rewrite, it does not score abstract-specific tense, result framing, or claim precision.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline wins on tighter academic result/conclusion phrasing.",
        "diagnosis": "Fix is faithful but still reads like a lightly cleaned source rather than a finished abstract. The missing capability is academic register and information-structure control.",
    },
    "recipe_prose": {
        "should_change": "Turn the introduction into direct instructions while preserving the exact quantities, temperature, time, and dietary property.",
        "category": "benchmark/judge uncertainty",
        "detectability": "Analyzer catches promotional language and false range only weakly; it has no recipe-task or instruction-utility metric.",
        "baseline_issue": "Baseline invents 'a few minutes' and 'light meal'; these are unsupported additions not covered by exact protected spans.",
        "diagnosis": "Fix wins primarily because it does not invent recipe facts. This is a consistent baseline semantic-risk pattern, not proof that Fix's prose is always better.",
    },
    "policy_notice": {
        "should_change": "Lead with the actual policy change and user right; keep scope, deadline, channels, and review period exact; remove empowerment/promotional framing.",
        "category": "rewrite-policy miss",
        "detectability": "Analyzer correctly flags filler, negative parallelism, copula/AI vocabulary, and significance framing in the source, but does not model legal scope or whether generic stewardship language is expendable.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline is more concise and policy-like.",
        "diagnosis": "Fix acts on surface patterns but leaves 'support stronger user control' and 'responsible data stewardship'. This is a rewrite-policy/register failure after partial analyzer success.",
    },
    "social_post_mixed_feelings": {
        "should_change": "Preserve the author's ambivalence and slightly sarcastic first-person voice; remove formulaic announcement framing only if the voice survives.",
        "category": "genre/register miss",
        "detectability": "Analyzer catches negative parallelism and generic conclusion but has no voice-preservation or irony signal; it cannot tell which unusual phrase is intentional.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline supplies a more idiomatic personal close.",
        "diagnosis": "Fix performs safe lexical cleanup but does not add or preserve enough authorial cadence. The shared loss mode is voice flattening in conversational material.",
    },
    "readme_commands": {
        "should_change": "Use direct developer documentation prose, preserve all commands/routes/paths/status codes, and remove promotional claims and chat sign-off.",
        "category": "genre/register miss",
        "detectability": "Analyzer catches promotional vocabulary and chat artifact but does not score README relevance, imperative clarity, or information density.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline is shorter and more operational.",
        "diagnosis": "Fix keeps a generic project-description sentence and an extra evaluation sentence. It is not too conservative about facts; it is insufficiently task/register sensitive about what a README should foreground.",
    },
    "onboarding_microcopy": {
        "should_change": "Keep button labels, route, and limits exact; reduce marketing certainty and make the UI instruction scan quickly.",
        "category": "benchmark/judge uncertainty",
        "detectability": "Analyzer catches emoji and promotional language only at a coarse level; it has no UI microcopy density metric.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline was judged cleaner in the original pass.",
        "diagnosis": "The result is close. Any preference here is likely sensitive to short-copy taste and judge framing rather than a clear system failure.",
    },
    "internal_project_memo": {
        "should_change": "Remove inflated foundation language and generic optimism while retaining owner, deadline, budget, turnaround, reviewer count, and actionable scope.",
        "category": "benchmark/judge uncertainty",
        "detectability": "Analyzer correctly flags significance inflation and generic conclusion; it does not judge whether a memo's remaining challenge sentence is useful or generic.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline rephrases the scope more aggressively.",
        "diagnosis": "Fix preserves the plan and removes the strongest slop. The original 6–6 outcome is not enough to call the remaining memo difference a reliable loss.",
    },
    "interview_transcript": {
        "should_change": "Make Ravi sound spoken and candid, not like an edited corporate summary; keep speaker labels and the 14-to-5 measurement.",
        "category": "genre/register miss",
        "detectability": "Analyzer catches pivotal/significance language and negative parallelism, but it does not model dialogue naturalness, turn-taking, or spoken compression.",
        "baseline_issue": "No confirmed exact-fidelity failure; baseline wins through more idiomatic spoken phrasing.",
        "diagnosis": "Fix sees some surface issues but rewrites them into another polished abstraction. This is the clearest case of rewrite-policy plus register failure, not a missing fidelity permission.",
    },
    "bilingual_customer_review": {
        "should_change": "Keep the code-switch, mixed sentiment, specific ginger detail, login complaint, and rating; remove only generic summary language.",
        "category": "fidelity constraint too strong",
        "detectability": "Analyzer does not need to change the core facts; it has no explicit code-switch or review-voice metric.",
        "baseline_issue": "Baseline changes 'annoying' to 'a pain' and drops the explicit 'memorable' wording; both are acceptable but demonstrate unnecessary voice movement.",
        "diagnosis": "Fix wins by preserving the user's distinctive details and sentiment. Higher retention is clearly beneficial here.",
    },
}


def read_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def levenshtein(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for i, token in enumerate(left, 1):
        current = [i]
        for j, other in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (token != other)))
        previous = current
    return previous[-1]


def metrics(source: str, candidate: str, protected: list[str]) -> dict[str, object]:
    source_words = re.findall(r"\b\w+(?:['’]\w+)?\b", source.lower())
    candidate_words = re.findall(r"\b\w+(?:['’]\w+)?\b", candidate.lower())
    source_content = {word for word in source_words if len(word) > 2}
    candidate_content = {word for word in candidate_words if len(word) > 2}
    union = source_content | candidate_content
    return {
        "word_edit_distance": levenshtein(source_words, candidate_words),
        "normalized_word_edit_distance": round(levenshtein(source_words, candidate_words) / max(len(source_words), 1), 4),
        "char_edit_distance": levenshtein(list(source), list(candidate)),
        "normalized_char_edit_distance": round(levenshtein(list(source), list(candidate)) / max(len(source), 1), 4),
        "content_retention_jaccard": round(len(source_content & candidate_content) / len(union), 4) if union else 1.0,
        "source_word_count": len(source_words),
        "candidate_word_count": len(candidate_words),
        "word_delta": len(candidate_words) - len(source_words),
        "length_ratio": round(len(candidate_words) / max(len(source_words), 1), 4),
        "fidelity": audit(source, candidate, protected),
    }


def baseline_findings(text: str) -> list[dict[str, object]]:
    findings = []
    for rule_id, (pattern, title) in BASELINE_RULES.items():
        matches = [match.group(0) for match in re.finditer(pattern, text)]
        if matches:
            findings.append({"rule": rule_id, "title": title, "count": len(matches), "evidence": matches[:8]})
    return findings


def heuristic_genre(text: str) -> tuple[str, str]:
    lower = text.lower()
    if "interviewer:" in lower or "ravi:" in lower:
        return "interview transcript", "conversational dialogue"
    if "pnpm " in lower or "post /v1/" in lower or "fixtures/" in lower:
        return "developer README", "direct technical documentation"
    if "rating:" in lower or "i visited" in lower:
        return "customer review", "personal evaluative prose"
    if "refund" in lower or "order #" in lower or "replacement filter" in lower:
        return "customer-support email", "warm, concise support correspondence"
    if "n =" in lower or "p =" in lower or "participants" in lower:
        return "academic abstract", "restrained research summary"
    if "opt out" in lower or "section 4.2" in lower or "privacy@" in lower:
        return "policy notice", "precise rights/policy notice"
    if "@devnisha" in lower or "#localtrain" in lower:
        return "personal social post", "first-person informal social voice"
    if "bake" in lower or "tbsp" in lower or "190°c" in lower:
        return "recipe", "practical imperative instructions"
    if "err_batch" in lower or "utc" in lower or "queue-worker" in lower:
        return "engineering incident postmortem", "blunt accountable technical report"
    if "mina owns" in lower or "budget of" in lower:
        return "internal project memo", "concise action-oriented internal memo"
    if "v2.4.0" in lower or "release" in lower and "retry" in lower:
        return "software release notes", "terse factual release communication"
    return "unknown", "unknown"


def map_judgments(fixtures: dict[str, dict[str, object]], outputs: dict[str, dict[str, str]]) -> dict[str, list[dict[str, object]]]:
    pairs = {row["id"]: row for row in read_jsonl(PAIRS)}
    result: dict[str, list[dict[str, object]]] = defaultdict(list)
    for path in JUDGE_FILES:
        for row in read_jsonl(path):
            item = pairs[row["id"]]
            group = outputs[row["id"]]
            a_system = next(system for system, text in group.items() if text == item["A"])
            b_system = next(system for system, text in group.items() if text == item["B"])
            winner = None if row["choice"] == "Tie" else (a_system if row["choice"] == "A" else b_system)
            result[row["id"]].append({**row, "a_system": a_system, "b_system": b_system, "winner": winner})
    return result


def main() -> int:
    fixtures = {str(row["id"]): row for row in read_jsonl(FIXTURES)}
    merged = read_jsonl(MERGED)
    outputs: dict[str, dict[str, str]] = defaultdict(dict)
    for row in merged:
        outputs[str(row["id"])][str(row["system"])] = str(row["rewrite"])
    judgments = map_judgments(fixtures, outputs)
    expanded_judgments: dict[str, list[dict[str, object]]] = defaultdict(list)
    expanded_path = ROOT / "textslopbench" / "results" / "benchmark-audit-v2.json"
    if not expanded_path.exists():
        expanded_path = ROOT / "textslopbench" / "results" / "benchmark-audit.json"
    if expanded_path.exists():
        for row in json.loads(expanded_path.read_text(encoding="utf-8")).get("raw_judgments", []):
            expanded_judgments[str(row["fixture_id"])].append(row)
    examples = []
    for fixture_id, item in fixtures.items():
        source = str(item["source"])
        fix_system = "FixMySlop:Humanizer/host-agent"
        base_system = "humanizer/host-agent"
        fix_text = outputs[fixture_id][fix_system]
        base_text = outputs[fixture_id][base_system]
        before = analyze(source, str(item["genre"]))
        fix_after = analyze(fix_text, str(item["genre"]))
        base_after = analyze(base_text, str(item["genre"]))
        fixture_judgments = judgments.get(fixture_id, [])
        last = fixture_judgments[-1] if fixture_judgments else {}
        examples.append({
            "id": fixture_id,
            "genre_metadata": item["genre"],
            "condition": item["condition"],
            "source": source,
            "fixmyslop_output_exact": fix_text,
            "baseline_humanizer_output_exact": base_text,
            "judge_reasoning": fixture_judgments,
            "expanded_counterbalanced_judge_reasoning": expanded_judgments.get(fixture_id, []),
            "prior_judge_winner": last.get("winner"),
            "humanstats_fixmyslop_before": before,
            "humanstats_fixmyslop_after": fix_after,
            "humanstats_baseline_after": base_after,
            "fixmyslop_findings_triggered": before["findings"],
            "fixmyslop_findings_remaining_after": fix_after["findings"],
            "fixmyslop_findings_resolved": sorted(set(f["family"] for f in before["findings"]) - set(f["family"] for f in fix_after["findings"])),
            "baseline_rules_on_source": baseline_findings(source),
            "baseline_rules_remaining": baseline_findings(base_text),
            "fixmyslop_rules_remaining": baseline_findings(fix_text),
            "metrics": {
                "fixmyslop": metrics(source, fix_text, list(item.get("protected", []))),
                "baseline_humanizer": metrics(source, base_text, list(item.get("protected", []))),
            },
            "genre_register_audit": {
                "current_benchmark_argument": item["genre"],
                "current_default_cli_behavior": "genre='auto' is recorded but not inferred; benchmark passed fixture genre explicitly",
                "heuristic_inference": heuristic_genre(source),
                "matches_metadata": heuristic_genre(source)[0] == item["genre"],
            },
            "oracle_diagnostic": ORACLE[fixture_id],
            "agent_context_audit": {
                "rewrite_host_model": "not recorded by the original multi_agent_v1 run; it inherited the parent default",
                "outer_prompt_template": "Use the FixMySlop:Humanizer or humanizer skill at its path. Read fixtures.jsonl, process only the assigned ids, produce final rewrites, and write JSONL with id/system/rewrite. No analyzer report or per-finding edit plan was supplied to the rewriting host.",
                "implication": "For the host-agent comparison, the skill instructions were available, but the outer task did not pass humanstats findings as actionable edit targets. The deterministic local CLI reports findings and applies hard-coded transformations; it does not feed findings into a model rewrite step.",
            },
        })

    fix_wins = [e["id"] for e in examples if e["prior_judge_winner"] == "FixMySlop:Humanizer/host-agent"]
    fix_losses = [e["id"] for e in examples if e["prior_judge_winner"] == "humanizer/host-agent"]
    fix_jaccard = {e["id"]: e["metrics"]["fixmyslop"]["content_retention_jaccard"] for e in examples}
    fix_edit = {e["id"]: e["metrics"]["fixmyslop"]["normalized_word_edit_distance"] for e in examples}
    def average(values: list[float]) -> float | None:
        return round(statistics.mean(values), 4) if values else None
    win_binary = [1 if e["id"] in fix_wins else 0 for e in examples]
    jaccards = [fix_jaccard[e["id"]] for e in examples]
    edits = [fix_edit[e["id"]] for e in examples]
    def corr(left: list[float], right: list[float]) -> float | None:
        if len(left) < 2 or len(set(left)) < 2 or len(set(right)) < 2:
            return None
        return round(sum((a - statistics.mean(left)) * (b - statistics.mean(right)) for a, b in zip(left, right)) / math.sqrt(sum((a - statistics.mean(left)) ** 2 for a in left) * sum((b - statistics.mean(right)) ** 2 for b in right)), 4)
    aggregate = {
        "fixture_count": len(examples),
        "fix_wins_in_prior_single_judge_pass": fix_wins,
        "fix_losses_in_prior_single_judge_pass": fix_losses,
        "fix_win_count": len(fix_wins),
        "fix_loss_count": len(fix_losses),
        "fix_jaccard_mean_wins": average([fix_jaccard[i] for i in fix_wins]),
        "fix_jaccard_mean_losses": average([fix_jaccard[i] for i in fix_losses]),
        "fix_edit_mean_wins": average([fix_edit[i] for i in fix_wins]),
        "fix_edit_mean_losses": average([fix_edit[i] for i in fix_losses]),
        "point_biserial_jaccard_vs_fix_win": corr(jaccards, win_binary),
        "point_biserial_edit_vs_fix_win": corr(edits, win_binary),
        "known_baseline_semantic_risk_cases_all": ["support_email_refund", "release_notes_hype", "recipe_prose", "bilingual_customer_review"],
        "known_baseline_semantic_risk_cases_within_fix_wins": ["release_notes_hype", "recipe_prose", "bilingual_customer_review"],
        "known_baseline_semantic_risk_rate_over_fix_wins": 0.5,
        "known_baseline_semantic_risk_rate_over_all_fixtures": 0.3333,
        "interpretation": "The sample is too small for a causal claim. Higher retention is beneficial in the release/recipe/bilingual cases, but the same retention can leave register problems untouched in the interview/social/support/README cases.",
    }
    recommendations = [
        {
            "rank": 1,
            "change": "Add explicit genre/register inference and genre-specific rewrite objectives for dialogue, support, social, README, academic, and policy text.",
            "expected_impact": "High",
            "evidence": "The six prior losses cluster in these genres; the heuristic audit matched 11/12 fixtures, while the current CLI records genre='auto' without inferring it. Interview, social, support, and README failures are task-fit failures rather than missing surface substitutions.",
        },
        {
            "rank": 2,
            "change": "Pass analyzer findings into the rewrite step as actionable edit targets with a preserve/allow decision for each finding.",
            "expected_impact": "High",
            "evidence": "The host-agent prompt supplied no humanstats findings or per-finding edit plan. Two of six loss outputs still retain a detector finding (social promotional language; interview false-range phrasing), while the remaining four losses expose analyzer blind spots that need explicit genre targets.",
        },
        {
            "rank": 3,
            "change": "Add claim-coverage and unsupported-addition checks, not just protected-span/exact-fidelity checks.",
            "expected_impact": "High",
            "evidence": "Within the six prior Fix wins, the baseline drops release performance data, invents recipe timing/meal details, and changes/drops distinctive review wording: 3/6 show semantic or voice-fidelity risk. Separately, the support baseline adds a package-contents photo requirement. The existing exact checker passes both systems.",
        },
        {
            "rank": 4,
            "change": "Add genre-sensitive voice and information-density scoring, plus human do-no-harm judgments, before using retention as a guardrail.",
            "expected_impact": "Medium-high",
            "evidence": "Fix Jaccard is higher on prior wins (0.6291) than losses (0.5875), but edit magnitude has almost no association with winning (point-biserial 0.0373). Retention helps fact-rich cases and can preserve the wrong register; the current control slice has automatic fidelity only, not human preservation judgments.",
        },
        {
            "rank": 5,
            "change": "Pin and record rewrite-host provenance, then evaluate locked held-out LAMP, Baumler, Beemo, and WQ subsets before tuning the skill.",
            "expected_impact": "Medium-high",
            "evidence": "The original rewrite host model/settings were not recorded; the expanded judge audit shows 37.1% orientation winner flips and Fleiss kappa 0.228. The adapters are implemented, but real-data access, terms, and held-out manifests are still outstanding.",
        },
    ]
    payload = {"benchmark": "TextSlopBench", "snapshot": "0.1.0", "generated_without_skill_changes": True, "aggregate": aggregate, "recommendations": recommendations, "examples": examples}
    json_path = ROOT / "textslopbench" / "failure_analysis.json"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    md: list[str] = [
        "# TextSlopBench failure analysis",
        "",
        "Pre-change analysis only. No skill files were modified. The comparison uses the six prior host-agent output files and the single original judge pass per fixture. The prior judge result is a smoke test, not a claim of equivalence.",
        "",
        "## Main answer",
        "",
        "The six FixMySlop losses share a register-and-pragmatics gap more than a fidelity gap. The analyzer often detects surface inflation, filler, or negative parallelism, but the rewrite policy does not convert those signals into genre-specific decisions about spoken cadence, support empathy, policy scope, README relevance, or academic information structure. The deterministic CLI does not pass analyzer findings to a rewriting model at all; the host-agent comparison prompt also did not supply a finding list. This is therefore mostly rewrite-policy/genre miss, with analyzer miss for pragmatic and claim-coverage properties.",
        "",
        "Higher Jaccard is not uniformly good or bad. It tracks fidelity wins on release notes, recipes, and the bilingual review, but it also tracks under-editing when the remaining defect is voice or register. The small prior pass has no power to establish a correlation; the computed point-biserial values below are descriptive only.",
        "",
        f"Prior single-pass FixMySlop wins ({len(fix_wins)}): {', '.join(fix_wins)}.",
        f"Prior single-pass FixMySlop losses ({len(fix_losses)}): {', '.join(fix_losses)}.",
        "",
        "## Aggregate diagnostics",
        "",
        "```json",
        json.dumps(aggregate, ensure_ascii=False, indent=2),
        "```",
        "",
        "## Ranked recommendations (do not implement yet)",
        "",
        "These are pre-change recommendations only; none was applied to the skill.",
        "",
    ]
    for recommendation in recommendations:
        md.extend([
            f"{recommendation['rank']}. **{recommendation['change']}** *(expected impact: {recommendation['expected_impact']})* — {recommendation['evidence']}",
            "",
        ])
    md.extend([
        "## Per-fixture comparison",
    ])
    for e in examples:
        md.extend([
            "",
            f"### {e['id']}",
            f"Genre metadata: `{e['genre_metadata']}`; condition: `{e['condition']}`; prior judge winner: `{e['prior_judge_winner'] or 'Tie/unknown'}`.",
            "",
            "#### Exact source",
            "```text", e["source"], "```",
            "",
            "#### Exact FixMySlop output",
            "```text", e["fixmyslop_output_exact"], "```",
            "",
            "#### Exact baseline Humanizer output",
            "```text", e["baseline_humanizer_output_exact"], "```",
            "",
            "#### Judge reasoning",
            "Original smoke-test judgment:",
            "```json", json.dumps(e["judge_reasoning"], ensure_ascii=False, indent=2), "```",
            "Expanded counterbalanced judgments:",
            "```json", json.dumps(e["expanded_counterbalanced_judge_reasoning"], ensure_ascii=False, indent=2), "```",
            "",
            "#### Metrics",
            "```json", json.dumps(e["metrics"], ensure_ascii=False, indent=2), "```",
            "",
            "#### Triggered rules/findings",
            f"FixMySlop resolved families: `{', '.join(e['fixmyslop_findings_resolved']) or 'none'}`.",
            "```json", json.dumps({"fix_before": e["fixmyslop_findings_triggered"], "fix_remaining": e["fixmyslop_findings_remaining_after"], "baseline_source": e["baseline_rules_on_source"], "baseline_remaining": e["baseline_rules_remaining"], "fix_rules_remaining": e["fixmyslop_rules_remaining"]}, ensure_ascii=False, indent=2), "```",
            "",
            "#### Genre/register and oracle diagnosis",
            "```json", json.dumps({"genre_register_audit": e["genre_register_audit"], "oracle_diagnostic": e["oracle_diagnostic"], "agent_context_audit": e["agent_context_audit"]}, ensure_ascii=False, indent=2), "```",
        ])
    md.extend([
        "",
        "## Em dash and curly-quote audit",
        "",
        "The local pipeline protects quoted interiors before finalization. In the incident fixture, the editable dash in `failure—it` is reframed as a comma, while the protected quoted testimony retains its interior punctuation. In the support fixture, the editable closing dash is removed with the chat closing. The source release, policy, social, and recipe cases contain no protected quote that should be rewritten. The policy is structural in intent, but the current implementation is still a lightweight contextual substitution and should not yet be treated as a full syntactic rewriter.",
        "",
        "## Boundary of this analysis",
        "",
        "The machine-readable file contains the full humanstats before/after objects and exact text. Human judgments, especially on six close cases, need the expanded counterbalanced evaluation in BENCHMARK_AUDIT.md before they can justify a skill change.",
    ])
    (ROOT / "FAILURE_ANALYSIS.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(json.dumps({"json": str(json_path), "markdown": str(ROOT / "FAILURE_ANALYSIS.md"), "fix_wins": fix_wins, "fix_losses": fix_losses}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
