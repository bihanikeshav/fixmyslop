"""Adapter for the TETRA corpus: human draft -> professional editor revision (ACL papers).

TETRA (Ito et al., 2022; github.com/chemicaltree/tetra, CC BY 4.0) gives document-level revisions
of ACL papers by human experts — the *human -> human-editor* distribution, complementing LAMP/Beemo's
*AI -> human-editor*. XML per paper×editor: sections contain interleaved <text> (unchanged) and
<edit type="a;b" crr="corrected" comments="rationale">ORIGINAL</edit>. We reconstruct the pre-edit
draft (S = text + edit bodies) and the revised text (H = text + crr), and carry each edit's
type(s), mapped aspect(s), and rationale in metadata.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from .base import Adapter, normalized_record

# edit type -> shared aspect (from the repo's aspect_edit-type_map.txt).
TETRA_ASPECT = {
    "grammar": "Grammar", "spelling": "Grammar", "capitalization": "Grammar", "hyphenation": "Grammar",
    "accuracy": "Grammar", "agreement": "Grammar", "tense": "Grammar",
    "word choice": "WordChoice", "word order": "WordChoice", "natural english": "WordChoice",
    "natrural english": "WordChoice", "usage": "WordChoice", "word usage": "WordChoice",
    "clarity": "Clarity", "tone": "Style", "style": "Style",
    "readability": "Readability", "parallelism": "Readability", "punctuation": "Readability",
    "repetitiveness": "Redundancy", "redundancy": "Redundancy", "redundant": "Redundancy",
    "conciseness": "Redundancy", "consistency": "Consistency", "flow": "Consistency",
}


def aspects_for(edit_type: str) -> list[str]:
    out = []
    for t in str(edit_type or "").split(";"):
        t = t.strip().lower()
        if t:
            out.append(TETRA_ASPECT.get(t, "Other"))
    return sorted(set(out)) or ["Other"]


def _join(parts: list[str]) -> str:
    return " ".join(p.strip() for p in parts if p and p.strip())


class TETRAAdapter(Adapter):
    dataset = "TETRA"

    def adapt(self, path: Path, split: str | None = None, limit: int | None = None) -> list[dict[str, object]]:
        path = Path(path)
        files = sorted(path.glob("*.xml")) if path.is_dir() else [path]
        records = []
        for xml in files:
            try:
                root = ET.fromstring(xml.read_text(encoding="utf-8"))
            except ET.ParseError:
                continue
            pre, post, edits = [], [], []
            for section in root:
                for node in section:
                    if node.tag == "text":
                        if node.text:
                            pre.append(node.text); post.append(node.text)
                    elif node.tag == "edit":
                        original = node.text or ""
                        crr = node.get("crr", "") or ""
                        if original:
                            pre.append(original)
                        if crr:
                            post.append(crr)
                        etype = node.get("type", "")
                        edits.append({"type": etype, "aspects": aspects_for(etype),
                                      "original": original, "crr": crr, "comments": node.get("comments", "")})
            source = _join(pre)
            if not source:
                continue
            records.append(normalized_record(
                dataset=self.dataset, source_text=source, record=None,
                record_id=f"{root.get('id')}-{root.get('editor')}", split=split or "all",
                human_references=[_join(post)],
                metadata={"origin": "human", "editor": root.get("editor"), "format": root.get("format"),
                          "region": root.get("region"), "position": root.get("position"), "edits": edits},
            ))
            if limit and len(records) >= limit:
                break
        if not records:
            raise ValueError(f"No TETRA records parsed from {path}")
        return records
