"""Adapter for LAMP-style raw AI -> professional edit records."""

from __future__ import annotations

import json
import hashlib
import re
from pathlib import Path

from .base import Adapter, AdapterError, as_text, first, list_text, load_objects, normalized_record


class LAMPAdapter(Adapter):
    dataset = "LAMP"

    def adapt(self, path: Path, split: str | None = None, limit: int | None = None) -> list[dict[str, object]]:
        parse_repaired = False
        try:
            raw_records = load_objects(path)
        except json.JSONDecodeError:
            # The released LAMP.json snapshot contains a missing comma between two
            # fine_grained_edits objects. Repair only adjacent JSON objects in memory;
            # never overwrite the source file, and surface the repair in metadata.
            raw_text = path.read_text(encoding="utf-8")
            repaired = re.sub(r"(?<=\})\s*(?=\{)", ",\n", raw_text)
            value = json.loads(repaired)
            raw_records = value if isinstance(value, list) else []
            parse_repaired = True
        records = []
        for raw in raw_records:
            raw_split = as_text(first(raw, "split", "subset", "partition")) or "unspecified"
            if split and raw_split != split:
                continue
            source = as_text(first(raw, "source_text", "raw_text", "original", "preedit", "llm_output", "response", "text"))
            if not source:
                continue
            references = list_text(first(raw, "human_edit", "human_edits", "edited", "postedit", "expert_edit", "expert_edits", "final_version", "reference"))
            edit_categories = list_text(first(raw, "edit_categories", "categories", "taxonomy"))
            source_model = first(raw, "model", "source_model", "llm", "source")
            supplied_id = first(raw, "id", "uid", "example_id")
            source_digest = hashlib.sha256(source.encode("utf-8")).hexdigest()[:10]
            record_id = f"{supplied_id}:{source_model}:{source_digest}" if supplied_id is not None and source_model else f"LAMP:{source_digest}"
            records.append(normalized_record(
                dataset=self.dataset,
                source_text=source,
                record=raw,
                record_id=record_id,
                split=raw_split,
                human_references=references,
                metadata={
                    "instruction": first(raw, "instruction", "prompt", "task"),
                    "source_model": source_model,
                    "genre": first(raw, "genre", "domain", "type"),
                    "edit_categories": edit_categories,
                    "edit_log": first(raw, "edits", "edit_operations", "fine_grained_edits"),
                    "source_parse_repaired": parse_repaired,
                },
            ))
            if limit and len(records) >= limit:
                break
        if not records:
            raise AdapterError("No LAMP-like records found. Expected raw/original/response plus optional human_edit/final_version fields.")
        return records
