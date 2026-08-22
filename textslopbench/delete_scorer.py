#!/usr/bin/env python3
"""Corrected deletion / claim-impact scorer, v2 (diagnostic; no model calls, no policy changes).

v2 precision fixes over v1:
  - Named-entity precision: an entity is fidelity-breaking only if it is genuinely referential (not a
    greeting, markdown header, hashtag, or capitalization artifact) AND actually missing from the whole
    target. Entities that survive elsewhere, and ui_or_command/causal markers, are not auto-conflicts.
  - Discourse prefix: leading discourse markers are stripped and the residual proposition is classified
    on its own — "However, X" no longer makes X safe.
  - Qualification semantics: attribution/evidential ("according to", "based on") is separated from
    epistemic certainty; multi-word qualifiers ("subject to change", "likely to", "expected to") are
    handled; certainty is compared at the proposition level, not token counts.

Partitions deleted-looking units into rewrite_fragment / true_safe_deletion / true_fidelity_conflict /
ambiguous, and reports span-level safe-delete recall & precision, unsafe-delete rejection, and a
breakdown of Fix's missed safe deletions.
"""
from __future__ import annotations

import difflib
import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "skills" / "fixmyslop-humanizer" / "scripts"))
sys.path.insert(0, str(ROOT / "textslopbench"))

from anchors import extract_source_content_map, audit_anchor_coverage
from policy_smoke import _refs, RESULTS, _parse
from edit_operations import _sents, _toks

STOP = {"the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with", "as", "at", "by",
        "is", "are", "was", "were", "be", "this", "that", "it", "its", "their", "your", "you", "they",
        "can", "will", "would", "so", "if", "then", "than", "from", "into", "about", "which", "who"}
# hard factual anchors that are genuinely fidelity-breaking when removed (entity handled separately)
HARD_FACTUAL = {"number", "date", "url", "email", "citation", "quotation", "measurement", "protected_span"}
FRAMING_RE = re.compile(
    r"^\s*(?:sure|certainly|of course|absolutely|great)[.!,:]?\s*$"
    r"|^\s*(?:sure|certainly|of course)[.!,:]"
    r"|^\s*here(?:'s| is| are)\b"
    r"|^\s*here's a (?:quick )?(?:summary|overview|breakdown|list)\b"
    r"|^\s*(?:below|following) (?:is|are)\b"
    r"|^\s*the following (?:tips|steps|points|are)\b"
    r"|^\s*i (?:can |will |'ll |'d )?(?:help|be happy|assist)\b"
    r"|^\s*as an ai\b|^\s*in (?:conclusion|summary)\b", re.I)
DISCOURSE = {"however", "moreover", "furthermore", "additionally", "therefore", "thus", "hence",
             "consequently", "meanwhile", "nevertheless", "nonetheless", "besides", "overall",
             "ultimately", "indeed", "notably", "importantly", "also", "similarly", "likewise",
             "conversely", "unfortunately", "fortunately"}
# epistemic certainty markers (NOT attribution). Attribution is excluded on purpose.
EPISTEMIC_RE = re.compile(
    r"(?i)\b(?:may|might|could|likely|unlikely|possibly|probably|perhaps|seems?|appears?|suggests?|"
    r"approximately|roughly|generally|often|sometimes|maybe|presumably|not necessarily)\b"
    r"|\b(?:at least|up to|more than|fewer than)\b")
EPISTEMIC_PHRASES = ("subject to change", "likely to", "unlikely to", "expected to", "tends to",
                     "supposed to", "appears to", "seems to", "may have", "might have", "could have",
                     "is subject to", "are subject to", "thought to", "believed to")
ATTRIBUTION = ("according to", "based on the", "based on your", "the text says", "the passage",
               "as stated in", "per the", "the article", "the excerpt", "the provided text")
PLEASANTRY = ("thank you", "thanks", "please", "i look forward", "i appreciate", "greatly appreciate",
              "best regards", "sincerely", "warm regards", "i hope", "feel free", "don't hesitate",
              "i eagerly await", "kind regards", "have a great", "i am writing to")


def _cw(t):
    return [w for w in _toks(t) if len(w) > 3 and w not in STOP]


def _survives(frag, target):
    cw = _cw(frag)
    if not cw:
        return 1.0
    ft = set(_toks(target))
    return sum(1 for w in cw if w in ft) / len(cw)


def _jac(a, b):
    sa, sb = set(_toks(a)), set(_toks(b))
    return len(sa & sb) / len(sa | sb) if (sa or sb) else 0.0


def _is_framing(u):
    us = u.strip().lower()
    if us in {"sure", "sure!", "sure.", "certainly", "certainly.", "of course", "absolutely", '"', "'"}:
        return True
    return bool(FRAMING_RE.search(u))


def _strip_discourse(text):
    """Remove a leading discourse marker (word or 'in addition,'/'that said,') and return residual."""
    t = text.strip()
    m = re.match(r"^\s*([A-Za-z]+)\s*,\s*(.*)$", t, re.S)
    if m and m.group(1).lower() in DISCOURSE:
        return m.group(2).strip()
    for ph in ("in addition", "that said", "on the other hand", "for example", "for instance", "as such"):
        if t.lower().startswith(ph):
            return t[len(ph):].lstrip(" ,").strip()
    return t


def _epistemic(text):
    tl = text.lower()
    return bool(EPISTEMIC_RE.search(text)) or any(p in tl for p in EPISTEMIC_PHRASES)


def _is_greeting_or_header(unit, src_sentence):
    u, s = unit.strip(), src_sentence.strip()
    if u.lower().startswith("dear ") or s.lower().startswith("dear "):
        return True
    if s[:2] in ("**", "* ", "- ", "# ") or s.startswith(("#", "*", "-")):
        return True
    if "\n" in unit:                       # spans a header/section boundary
        return True
    if "#" in unit:                        # hashtag
        return True
    if s.endswith(":") and len(_toks(s)) <= 8 and not any(t.endswith(("ed", "es", "ing")) for t in _toks(s)):
        return True                        # short title-like header, no verb
    return False


_TEMPLATE = re.compile(r"\[/?\s*INST|</?s>|\[/?SYS", re.I)


def _breaks_hard_anchor(unit, src_sentence, anchors, missing_texts):
    """missing_texts = anchors FULLY absent from the target (count 0). An anchor breaks fidelity only if
    it is genuinely gone (not merely underrepresented / surviving elsewhere)."""
    ml = [m.lower() for m in missing_texts]
    for a in anchors:
        val = str(a.get("text", ""))
        if not val or _TEMPLATE.search(val) or val.lower() not in unit.lower() or val.lower() not in ml:
            continue                       # not here / survives elsewhere / model-template artifact
        kind = str(a.get("kind"))
        if kind in HARD_FACTUAL:
            if kind == "number" and len(_toks(unit)) <= 3:
                continue                   # standalone list marker / truncation, not a factual claim
            if kind == "protected_span" and _TEMPLATE.search(val):
                continue
            return True
        if kind == "named_entity" and not _is_greeting_or_header(unit, src_sentence):
            return True                    # genuinely referential entity, fully missing from target
        # ui_or_command, causal_relationship, qualification -> not auto fidelity-breaking
    return False


def _has_verb(toks):
    VERBS = {"is", "are", "was", "were", "has", "have", "had", "provides", "offers", "ensures", "helps",
             "makes", "allows", "enables", "includes", "requires", "creates", "means", "shows", "occurs",
             "becomes", "remains", "presents", "struggles", "faces", "shapes", "leads", "results", "expect"}
    return any(t in VERBS for t in toks) or any(t.endswith(("ed", "es", "ing")) for t in toks)


def _classify_unit(text, scope, S, T, anchors, missing_texts, src_sentence):
    if _is_framing(text):
        return _mk(text, scope, "framing_discourse", "true_safe_deletion", T)
    if _breaks_hard_anchor(text, src_sentence, anchors, missing_texts):
        return _mk(text, scope, "anchor_breaking", "true_fidelity_conflict", T)
    residual = _strip_discourse(text)
    tl = text.lower()
    if len(_cw(residual)) <= 2:
        return _mk(text, scope, "ornamental_or_connective", "true_safe_deletion", T)
    # positively-expendable => safe; otherwise a substantive removed sentence/clause is AMBIGUOUS
    if any(p in tl for p in PLEASANTRY):
        return _mk(text, scope, "pleasantry", "true_safe_deletion", T)
    if any(p in tl for p in ATTRIBUTION) and len(_cw(residual)) <= 6:
        return _mk(text, scope, "attribution_filler", "true_safe_deletion", T)
    if _survives(text, T) >= 0.5:
        return _mk(text, scope, "redundant", "true_safe_deletion", T)
    if scope in ("sentence", "clause") and len(_cw(residual)) >= 4:
        return _mk(text, scope, "unanchored_proposition", "ambiguous", T)
    return _mk(text, scope, "expendable_detail", "true_safe_deletion", T)


def _mk(text, scope, role, label, T):
    return {"text": text[:160], "scope": scope, "role": role, "label": label,
            "epistemic": _epistemic(text), "survives": round(_survives(text, T), 2)}


def true_deletions(S, T, anchors, missing_texts):
    ss, ts = _sents(S), _sents(T)
    units = []
    region = Counter()
    certainty_conflicts = 0
    best = []
    for a in ss:
        sims = [_jac(a, b) for b in ts] or [0.0]
        j = max(range(len(sims)), key=lambda k: sims[k])
        best.append((j, sims[j]))
    for i, a in enumerate(ss):
        j, sim = best[i]
        if sim < 0.35:
            if _survives(a, T) >= 0.5:
                region["moved_or_duplicated"] += 1
                continue
            region["truly_removed_sentence"] += 1
            units.append(_classify_unit(a, "sentence", S, T, anchors, missing_texts, a))
            continue
        ws, wt = len(_toks(a)), len(_toks(ts[j]))
        region["compressed" if (ws and wt < 0.72 * ws) else "reworded" if sim < 0.9 else "preserved"] += 1
        # proposition-level certainty: epistemic in source claim, none in matched target claim
        if _epistemic(a) and not _epistemic(ts[j]):
            certainty_conflicts += 1
        toks_a = _toks(a)
        for tag, a1, a2, b1, b2 in difflib.SequenceMatcher(None, toks_a, _toks(ts[j]), autojunk=False).get_opcodes():
            if tag != "delete":
                continue
            frag = " ".join(toks_a[a1:a2])
            if len(toks_a[a1:a2]) < 3:
                region["rewrite_fragment_short"] += 1
                continue
            if _survives(frag, T) >= 0.5:
                region["rewrite_fragment_survives"] += 1
                continue
            region["truly_removed_clause"] += 1
            units.append(_classify_unit(frag, "clause", S, T, anchors, missing_texts, a))
    return units, certainty_conflicts, region


def score_system(S, T, cm):
    cov = audit_anchor_coverage(cm, T)
    missing = [str(m["text"]) for m in cov["missing"]]   # fully absent (count 0) only
    return true_deletions(S, T, cm["hard_anchors"], missing)


def missed_safe_subrole(text, T):
    tl = text.lower()
    if _is_framing(text):
        return "ai_framing"
    if any(p in tl for p in PLEASANTRY):
        return "pleasantry"
    if any(p in tl for p in ATTRIBUTION):
        return "attribution_filler"
    if _survives(text, T) >= 0.5:
        return "redundant_proposition"
    if _epistemic(text) and len(_cw(text)) <= 3:
        return "redundant_hedge"
    if len(_cw(text)) <= 2:
        return "ornamental_detail"
    return "other"


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    beemo = {}
    for line in (RESULTS / "beemo-heldout-100.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        refs = _refs(r.get("human_references"))
        if refs:
            beemo[r["record_id"]] = (str(r["source_text"]), str(refs[0]))
    outs = {"fixmyslop": {}, "humanizer": {}}
    for f in sorted(glob.glob(str(RESULTS / "policy-smoke-frozen-fix-Beemo-*.raw.json"))):
        try:
            outs["fixmyslop"].update(_parse(json.loads(Path(f).read_text(encoding="utf-8"))["content"]))
        except Exception:
            pass
    for f in sorted(glob.glob(str(RESULTS / "policy-smoke-frozen-hz-Beemo-*.raw.json"))):
        try:
            outs["humanizer"].update(_parse(json.loads(Path(f).read_text(encoding="utf-8"))["content"]))
        except Exception:
            pass
    rids = [r for r in beemo if r in outs["fixmyslop"] and r in outs["humanizer"]]
    n = len(rids)

    data = {"human": {}, "fixmyslop": {}, "humanizer": {}}
    cert = Counter()
    region_tot = Counter()
    for rid in rids:
        S, H = beemo[rid]
        cm = extract_source_content_map(S, [])
        for sysname, T in (("human", H), ("fixmyslop", str(outs["fixmyslop"][rid])), ("humanizer", str(outs["humanizer"][rid]))):
            units, cc, region = score_system(S, T, cm)
            data[sysname][rid] = units
            cert[sysname] += cc
            if sysname == "human":
                region_tot += region

    labels = ["true_safe_deletion", "true_fidelity_conflict", "ambiguous"]
    occ = lambda s, L: sum(1 for rid in rids for u in data[s][rid] if u["label"] == L)
    docf = lambda s, L: round(sum(1 for rid in rids if any(u["label"] == L for u in data[s][rid])) / n, 3)

    # span-level opportunity
    def removed(frag, text):
        return _survives(frag, text) < 0.4

    def metrics(sysname):
        out = outs[sysname]
        human_safe = [(rid, u["text"]) for rid in rids for u in data["human"][rid] if u["label"] == "true_safe_deletion"]
        human_conf = [(rid, u["text"]) for rid in rids for u in data["human"][rid] if u["label"] == "true_fidelity_conflict"]
        sys_rem = [(rid, u["text"]) for rid in rids for u in data[sysname][rid]]
        recall = round(sum(1 for rid, f in human_safe if removed(f, str(out[rid]))) / len(human_safe), 3) if human_safe else None
        prec_hit = sum(1 for rid, f in sys_rem
                       if removed(f, beemo[rid][1]) and any(_jac(f, hu["text"]) >= 0.5
                       for hu in data["human"][rid] if hu["label"] == "true_safe_deletion"))
        precision = round(prec_hit / len(sys_rem), 3) if sys_rem else None
        rej = round(sum(1 for rid, f in human_conf if not removed(f, str(out[rid]))) / len(human_conf), 3) if human_conf else None
        return {"safe_recall": recall, "safe_precision": precision, "unsafe_rejection": rej,
                "n_human_safe": len(human_safe), "n_human_conflict": len(human_conf), "n_sys_removals": len(sys_rem)}

    opp = {s: metrics(s) for s in ("fixmyslop", "humanizer")}

    # Fix's missed safe deletions by sub-role
    missed = Counter()
    for rid in rids:
        for u in data["human"][rid]:
            if u["label"] == "true_safe_deletion" and not removed(u["text"], str(outs["fixmyslop"][rid])):
                missed[missed_safe_subrole(u["text"], beemo[rid][1])] += 1

    report = {"corpus": "Beemo", "n": n,
              "human_edit_regions": dict(region_tot),
              "partition": {s: {"occ": {L: occ(s, L) for L in labels}, "doc": {L: docf(s, L) for L in labels}} for s in data},
              "certainty_conflicts_occ": dict(cert),
              "opportunity": opp, "fix_missed_safe_by_subrole": dict(missed)}
    (RESULTS / "delete-scorer-v2-beemo.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"===== Corrected delete scorer v2 (Beemo, n={n}) =====")
    print(f"human edit regions: {dict(region_tot)}")
    print(f"\n{'label':26}{'H occ':>7}{'Fix occ':>8}{'Hz occ':>8}{'H doc':>7}{'Fix doc':>8}{'Hz doc':>7}")
    for L in labels:
        print(f"{L:26}{occ('human',L):>7}{occ('fixmyslop',L):>8}{occ('humanizer',L):>8}{docf('human',L):>7}{docf('fixmyslop',L):>8}{docf('humanizer',L):>7}")
    print(f"\ncertainty_conflicts (claim-level occ): {dict(cert)}")
    print(f"\n=== SPAN-LEVEL OPPORTUNITY ===")
    for s, v in opp.items():
        print(f"  {s:11} safe_recall={v['safe_recall']}  safe_precision={v['safe_precision']}  "
              f"unsafe_rejection={v['unsafe_rejection']}  (n_safe={v['n_human_safe']}, n_conflict={v['n_human_conflict']})")
    print(f"\nFix MISSED safe deletions by sub-role: {dict(missed)}")
    print("\nwrote results/delete-scorer-v2-beemo.json")


if __name__ == "__main__":
    main()
