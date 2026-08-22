"""Adapter for Beemo human/machine/expert-edited records."""

from __future__ import annotations

from pathlib import Path

from .base import Adapter, AdapterError, as_text, first, list_text, load_objects, normalized_record


class BeemoAdapter(Adapter):
    dataset = "Beemo"

    def adapt(self, path: Path, split: str | None = None, limit: int | None = None) -> list[dict[str, object]]:
        records = []
        for raw in load_objects(path):
            raw_split = as_text(first(raw, "split", "subset", "partition")) or "unspecified"
            if split and raw_split != split:
                continue
            machine = as_text(first(raw, "machine_text", "machine", "llm_output", "model_output", "generated", "response", "text"))
            expert = list_text(first(raw, "expert_edit", "expert_edited", "human_edits", "human_edit", "edited", "polished"))
            human = list_text(first(raw, "human_text", "human", "human_output", "original_human"))
            if not machine:
                continue
            candidates = []
            if human:
                candidates.append({"label": "human", "text": human[0]})
            if expert:
                candidates.append({"label": "expert_edit", "text": expert[0]})
            candidates = [{"label": "human", "text": human[0]}] if human else []
            if expert:
                candidates.append({"label": "expert_edit", "text": expert[0]})
            records.append(normalized_record(
                dataset=self.dataset,
                source_text=machine,
                record=raw,
                record_id=first(raw, "id", "uid", "example_id"),
                split=raw_split,
                human_references=expert,
                candidates=candidates,
                metadata={
                    "prompt": first(raw, "prompt", "instruction", "task"),
                    "use_case": first(raw, "use_case", "category", "task_type"),
                    "source_model": first(raw, "model", "source_model"),
                    "llm_edit": first(raw, "llm_edit", "machine_edit"),
                },
            ))
            if limit and len(records) >= limit:
                break
        if not records:
            raise AdapterError("No Beemo-like records found. Expected machine/generated/response plus optional human/expert fields.")
        return records
