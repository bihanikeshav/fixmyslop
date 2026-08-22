#!/usr/bin/env python3
"""Judged head-to-head on the partial (owned 12-fixture) benchmark: FixMySlop vs Humanizer.

Reuses CACHED host-agent rewrites (agent-merged.jsonl, gpt-5.6-terra) -- no regeneration.
One batched, counterbalanced A/B judge call on gpt-5.6-luna. Directional single-judge read.
"""
from __future__ import annotations
import hashlib, json, sys, urllib.request
from pathlib import Path

REVERSE = "--reverse" in sys.argv

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "textslopbench" / "results"
ENDPOINT = "http://127.0.0.1:8317/v1/chat/completions"
MODEL = "gpt-5.6-luna"
FIX = "FixMySlop:Humanizer/host-agent"
HUM = "humanizer/host-agent"


def call(messages, tag):
    cache = RESULTS / f"partial-judge-{MODEL.replace('.','')}-{tag}{'-rev' if REVERSE else ''}.raw.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))["content"]
    body = json.dumps({"model": MODEL, "messages": messages}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST",
        headers={"Authorization": "Bearer claudex-local", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.loads(r.read().decode())
    content = data["choices"][0]["message"]["content"]
    cache.write_text(json.dumps({"content": content, "raw": data}, ensure_ascii=False, indent=2), encoding="utf-8")
    return content


def parse(text):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"): text = text[4:]
    s = min([i for i in (text.find("{"), text.find("[")) if i != -1] or [0])
    return json.loads(text[s:])


def fix_a(fid):  # deterministic counterbalance: True => A=FixMySlop
    base = int(hashlib.sha256(fid.encode()).hexdigest(), 16) % 2 == 0
    return (not base) if REVERSE else base


def main():
    fx = {json.loads(l)["id"]: json.loads(l) for l in (ROOT/"textslopbench"/"fixtures.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()}
    rows = [json.loads(l) for l in (RESULTS/"agent-merged.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    out = {}
    for r in rows: out.setdefault(r["id"], {})[r["system"]] = r["rewrite"]
    payload = []
    for fid in fx:
        A = out[fid][FIX] if fix_a(fid) else out[fid][HUM]
        B = out[fid][HUM] if fix_a(fid) else out[fid][FIX]
        payload.append({"id": fid, "source": str(fx[fid]["source"]), "A": A, "B": B})
    instr = ("You are a blind writing judge. Each item has SOURCE and two anonymous revisions A and B. "
             "Rate BOTH on naturalness, quality, fidelity (faithfulness to source facts/claims), and voice/register, 1-5, "
             "then choose A, B, or tie for which you would deliver after minimal editing. "
             'Return ONLY JSON {"id": {"choice":"A|B|tie","A":{"naturalness":n,"quality":n,"fidelity":n,"voice":n},'
             '"B":{...},"note":"..."}, ...}.')
    judged = parse(call([{"role": "system", "content": instr},
                         {"role": "user", "content": json.dumps(payload, ensure_ascii=False)}], "ab"))
    agg = {FIX: {"win": 0, "nat": [], "qual": [], "fid": [], "voice": []},
           HUM: {"win": 0, "nat": [], "qual": [], "fid": [], "voice": []}}
    ties = 0; detail = []
    for fid in fx:
        j = judged.get(fid, {})
        a_is_fix = fix_a(fid)
        a_sys, b_sys = (FIX, HUM) if a_is_fix else (HUM, FIX)
        ch = j.get("choice", "tie")
        winner = "tie" if ch == "tie" else (a_sys if ch == "A" else b_sys)
        if winner == "tie": ties += 1
        else: agg[winner]["win"] += 1
        for role, sysn in (("A", a_sys), ("B", b_sys)):
            sc = j.get(role, {})
            for m, k in (("nat", "naturalness"), ("qual", "quality"), ("fid", "fidelity"), ("voice", "voice")):
                if isinstance(sc.get(k), (int, float)): agg[sysn][m].append(float(sc[k]))
        detail.append({"id": fid, "winner": winner, "note": j.get("note", "")})
    mean = lambda xs: round(sum(xs)/len(xs), 2) if xs else None
    summary = {"model": MODEL, "n": len(fx), "ties": ties,
               "fixmyslop_wins": agg[FIX]["win"], "humanizer_wins": agg[HUM]["win"],
               "fixmyslop_means": {m: mean(agg[FIX][m]) for m in ("nat", "qual", "fid", "voice")},
               "humanizer_means": {m: mean(agg[HUM][m]) for m in ("nat", "qual", "fid", "voice")},
               "detail": detail}
    summary["orientation"] = "reversed" if REVERSE else "original"
    (RESULTS/f"partial-benchmark-judged-luna{'-rev' if REVERSE else ''}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: summary[k] for k in ("n", "fixmyslop_wins", "humanizer_wins", "ties", "fixmyslop_means", "humanizer_means")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
