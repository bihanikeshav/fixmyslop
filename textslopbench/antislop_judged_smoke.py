#!/usr/bin/env python3
"""Minimal judged smoke: does the Antislop slop layer improve a pragmatics-only rewrite?

Two host arms on the SAME model (isolating the slop evidence): pragmatics_only vs
pragmatics_plus_slop, then one batched A/B judge pass. Directional only -- host/judge is
Grok, NOT the pinned gpt-5.6-terra/GPT provenance. 3 batched model calls total. Every call
is cached to results/ and never recomputed if the cache exists.
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))

from fidelity import audit
from pipeline import prepare_rewrite_context
from slop_overrepresentation import slop_pattern_suppression, weighted_density, scan

RESULTS = ROOT / "textslopbench" / "results"
ENDPOINT = "http://127.0.0.1:8317/v1/chat/completions"
API_KEY = "claudex-local"
MODEL = "gpt-5.6-luna"
SENTINELS = [
    "recipe_prose", "research_abstract", "release_notes_hype", "readme_commands",
    "interview_transcript", "policy_notice", "social_post_mixed_feelings", "bilingual_customer_review",
]


def call(messages: list[dict], tag: str) -> str:
    slug = MODEL.replace(".", "").replace("/", "-")
    cache = RESULTS / f"antislop-smoke-{slug}-{tag}.raw.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))["content"]
    body = json.dumps({"model": MODEL, "messages": messages}).encode("utf-8")
    req = urllib.request.Request(ENDPOINT, data=body, method="POST", headers={
        "Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    cache.write_text(json.dumps({"content": content, "raw": data}, ensure_ascii=False, indent=2), encoding="utf-8")
    return content


def parse_json(text: str) -> object:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    start = min([i for i in (text.find("{"), text.find("[")) if i != -1] or [0])
    return json.loads(text[start:])


def load_fixtures() -> dict[str, dict]:
    rows = {}
    for line in (ROOT / "textslopbench" / "fixtures.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = json.loads(line)
            rows[r["id"]] = r
    return rows


def arm_context(source: str, protected: list, with_slop: bool) -> dict:
    ctx = prepare_rewrite_context(source, "auto", protected)
    summary = json.loads(json.dumps(ctx["model_summary"]))  # deep copy
    if not with_slop:
        summary["actionable_findings"] = [f for f in summary.get("actionable_findings", []) if f.get("family") != "slop_overrepresentation"]
        slop_block = []
    else:
        slop_block = [{"evidence": f["evidence"], "overrepresentation": f["overrepresentation"], "action": f["action"]}
                      for f in ctx["original_humanstats"]["slop"]["findings"][:10]]
    return {"genre": summary["genre"]["label"], "summary": summary, "slop_evidence": slop_block}


def host_prompt(items: list[dict], with_slop: bool) -> list[dict]:
    instr = (
        "You revise text; you do not regenerate it. For each item, return a natural, register-appropriate "
        "revision that preserves every hard anchor exactly (numbers, dates, identifiers, commands, quotations, "
        "URLs) and the source's certainty. Do not invent facts. "
        + ("Use slop_evidence as review-in-context flags: rewrite an overrepresented word/phrase naturally ONLY "
           "if it does not serve the genre; do not blindly delete flagged words. " if with_slop else "")
        + 'Return ONLY JSON: {"id": "revised text", ...}.'
    )
    payload = [{"id": it["id"], "genre": it["genre"], "source": it["source"],
                "pragmatics": it["ctx"]["summary"], **({"slop_evidence": it["ctx"]["slop_evidence"]} if with_slop else {})}
               for it in items]
    return [{"role": "system", "content": instr},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]


def orient(item_id: str) -> bool:
    # deterministic counterbalance: True => A=pragmatics_only, B=slop
    return int(hashlib.sha256(item_id.encode()).hexdigest(), 16) % 2 == 0


def judge_prompt(items: list[dict], arm_only: dict, arm_slop: dict) -> list[dict]:
    instr = ("You are a blind writing judge. For each item you get SOURCE and two revisions A and B. "
             "Pick which reads more naturally while staying faithful to the source's facts and register. "
             'Return ONLY JSON: {"id": {"choice": "A"|"B"|"tie", "naturalness_A": 1-5, "naturalness_B": 1-5, '
             '"fidelity_A": 1-5, "fidelity_B": 1-5, "note": "..."}, ...}.')
    payload = []
    for it in items:
        a_only = orient(it["id"])
        A = arm_only[it["id"]] if a_only else arm_slop[it["id"]]
        B = arm_slop[it["id"]] if a_only else arm_only[it["id"]]
        payload.append({"id": it["id"], "source": it["source"], "A": A, "B": B})
    return [{"role": "system", "content": instr},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}]


def main() -> int:
    fixtures = load_fixtures()
    items = []
    for fid in SENTINELS:
        r = fixtures[fid]
        items.append({"id": fid, "source": str(r["source"]), "protected": list(r.get("protected", [])), "genre": None})
    for it in items:
        it["ctx_only"] = arm_context(it["source"], it["protected"], with_slop=False)
        it["ctx_slop"] = arm_context(it["source"], it["protected"], with_slop=True)
        it["genre"] = it["ctx_slop"]["genre"]

    only_items = [{**it, "ctx": it["ctx_only"]} for it in items]
    slop_items = [{**it, "ctx": it["ctx_slop"]} for it in items]
    rew_only = parse_json(call(host_prompt(only_items, False), "host-pragmatics-only"))
    rew_slop = parse_json(call(host_prompt(slop_items, True), "host-pragmatics-slop"))

    judged = parse_json(call(judge_prompt(items, rew_only, rew_slop), "judge"))

    report = []
    for it in items:
        fid = it["id"]
        src = it["source"]
        r_only = str(rew_only.get(fid, ""))
        r_slop = str(rew_slop.get(fid, ""))
        fid_only = audit(src, r_only, it["protected"])
        fid_slop = audit(src, r_slop, it["protected"])
        j = judged.get(fid, {}) if isinstance(judged, dict) else {}
        choice = j.get("choice", "tie")
        # map A/B back to arm
        a_only = orient(fid)
        winner = ("pragmatics_only" if a_only else "slop") if choice == "A" else ("slop" if a_only else "pragmatics_only") if choice == "B" else "tie"
        report.append({
            "id": fid, "genre": it["genre"],
            "slop_evidence_count": len(it["ctx_slop"]["slop_evidence"]),
            "sps_only": slop_pattern_suppression(src, r_only)["relative_reduction"],
            "sps_slop": slop_pattern_suppression(src, r_slop)["relative_reduction"],
            "residual_density_only": weighted_density(r_only),
            "residual_density_slop": weighted_density(r_slop),
            "fidelity_only_pass": fid_only["passed"], "fidelity_slop_pass": fid_slop["passed"],
            "judge_choice": choice, "judge_winner_arm": winner,
            "naturalness_only": j.get("naturalness_A") if a_only else j.get("naturalness_B"),
            "naturalness_slop": j.get("naturalness_B") if a_only else j.get("naturalness_A"),
            "note": j.get("note", ""),
        })

    out = {"model": MODEL, "provenance": "directional smoke on gpt-5.6-luna (host+judge); pinned host is gpt-5.6-terra",
           "arms": ["pragmatics_only", "pragmatics_plus_slop"], "items": report}
    (RESULTS / f"antislop-judged-smoke-{MODEL.replace('.', '').replace('/', '-')}.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    wins = sum(r["judge_winner_arm"] == "slop" for r in report)
    losses = sum(r["judge_winner_arm"] == "pragmatics_only" for r in report)
    ties = sum(r["judge_winner_arm"] == "tie" for r in report)
    fid_regress = sum(r["fidelity_only_pass"] and not r["fidelity_slop_pass"] for r in report)
    print(json.dumps({"slop_wins": wins, "pragmatics_only_wins": losses, "ties": ties,
                      "fidelity_regressions_from_slop": fid_regress, "n": len(report)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
