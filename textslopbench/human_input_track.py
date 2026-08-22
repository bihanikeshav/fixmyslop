#!/usr/bin/env python3
"""Human-input track (Iteration 2, review point 6).

Replaces flat "do-no-harm" reporting. A system is not rewarded merely for making
zero edits to human prose; instead we report, per system:

- Human Intervention Rate   - fraction of human inputs it changed at all
- Human Rewrite Preference  - judges preferred the rewrite over the untouched original
- Original Preference       - judges preferred the untouched original
- Tie Rate                  - judges saw no difference
- Anchor/claim fidelity     - hard-anchor preservation pass rate on the human inputs

A high tie rate driven by zero intervention and a high preference rate driven by heavy
intervention are different regimes, and both are shown so neither is mistaken for the
other. This module is deterministic and makes no model calls; judge preferences are read
from previously recorded judge files.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "skills" / "fixmyslop-humanizer" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from anchors import audit_anchor_coverage, extract_source_content_map
from humanstats import words


def load_jsonl(path: Path) -> list[dict[str, object]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def levenshtein(left: list[str], right: list[str]) -> int:
    previous = list(range(len(right) + 1))
    for i, token in enumerate(left, 1):
        current = [i]
        for j, other in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (token != other)))
        previous = current
    return previous[-1]


def normalized_edit(source: str, rewrite: str) -> float:
    left, right = words(source), words(rewrite)
    denom = max(len(left), len(right))
    return round(levenshtein(left, right) / denom, 4) if denom else 0.0


def _norm(text: str) -> str:
    return " ".join(text.split())


def score_human_input_track(
    source_by_id: dict[str, str],
    candidates_by_id: dict[str, str],
    judge_choices: list[str],
) -> dict[str, object]:
    """Score one system. ``judge_choices`` is a flat list of 'rewrite'|'original'|'tie'."""
    intervened = 0
    edits: list[float] = []
    anchor_pass = 0
    ids = sorted(candidates_by_id)
    for record_id in ids:
        source = source_by_id[record_id]
        rewrite = candidates_by_id[record_id]
        if _norm(source) != _norm(rewrite):
            intervened += 1
        edits.append(normalized_edit(source, rewrite))
        content_map = extract_source_content_map(source)
        if audit_anchor_coverage(content_map, rewrite)["passed"]:
            anchor_pass += 1
    total = len(ids)
    judged = len(judge_choices)
    rewrite_pref = judge_choices.count("rewrite")
    original_pref = judge_choices.count("original")
    ties = judge_choices.count("tie")
    return {
        "inputs": total,
        "human_intervention_rate": round(intervened / total, 4) if total else 0.0,
        "mean_normalized_edit_magnitude": round(sum(edits) / total, 4) if total else 0.0,
        "anchor_claim_fidelity_pass_rate": round(anchor_pass / total, 4) if total else 0.0,
        "judgments": judged,
        "human_rewrite_preference": rewrite_pref,
        "original_preference": original_pref,
        "tie_rate": round(ties / judged, 4) if judged else 0.0,
        "rewrite_preference_rate": round(rewrite_pref / judged, 4) if judged else 0.0,
        "original_preference_rate": round(original_pref / judged, 4) if judged else 0.0,
    }


def _candidates(path: Path) -> dict[str, str]:
    return {str(row["record_id"]): str(row["rewrite"]) for row in load_jsonl(path)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="human-input jsonl with record_id + source_text")
    parser.add_argument("--system", action="append", nargs=3, metavar=("NAME", "CANDIDATES_JSONL", "CHOICE_KEY"),
                        default=[], help="system name, its rewrite jsonl, and the judge choice key (e.g. baseline_choice)")
    parser.add_argument("--judge", action="append", type=Path, default=[], help="judge jsonl file (repeatable)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--markdown", type=Path, required=True)
    args = parser.parse_args()

    source_by_id = {str(row["record_id"]): str(row["source_text"]) for row in load_jsonl(args.source)}
    judges = [load_jsonl(path) for path in args.judge]

    results: dict[str, object] = {}
    for name, cand_path, choice_key in args.system:
        candidates = _candidates(Path(cand_path))
        choices = [str(row[choice_key]) for judge in judges for row in judge if choice_key in row]
        results[name] = score_human_input_track(source_by_id, candidates, choices)

    report = {"schema_version": "textslopbench.human-input-track.v1", "systems": results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    header = "| System | Intervention rate | Mean norm. edit | Anchor/claim fidelity | Rewrite pref | Original pref | Tie rate |"
    lines = [
        "# Human-input track",
        "",
        "Systems are graded on human-written inputs. Zero intervention is not itself a win; see [METRICS_GLOSSARY.md](../METRICS_GLOSSARY.md).",
        "",
        header,
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for name, row in results.items():
        lines.append(
            f"| {name} | {row['human_intervention_rate']:.1%} | {row['mean_normalized_edit_magnitude']:.4f} | "
            f"{row['anchor_claim_fidelity_pass_rate']:.1%} | {row['human_rewrite_preference']}/{row['judgments']} | "
            f"{row['original_preference']}/{row['judgments']} | {row['tie_rate']:.1%} |"
        )
    args.markdown.parent.mkdir(parents=True, exist_ok=True)
    args.markdown.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"json": str(args.output), "markdown": str(args.markdown), "systems": list(results)}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
