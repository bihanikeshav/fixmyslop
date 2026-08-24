"""Adapter for Beemo human/machine/expert-edited records."""

from __future__ import annotations

from pathlib import Path

from .base import Adapter, AdapterError, as_text, first, list_text, load_objects, normalized_record


GROUPING_KEYS = (
    "prompt_id",
    "source_id",
    "document_id",
    "conversation_id",
    "writer_id",
    "author_id",
)


def _grouping_metadata(raw: dict[str, object], prompt: object) -> dict[str, object]:
    """Preserve Beemo's explicit ids, using its prompt as the source-item group."""
    grouping_ids = {
        key: as_text(raw.get(key))
        for key in GROUPING_KEYS
        if raw.get(key) not in (None, "")
    }
    source = next(iter(grouping_ids), None)
    group_id = grouping_ids.get(source) if source else as_text(prompt)
    if source is None and group_id:
        source = "prompt"
        grouping_ids["prompt"] = group_id
    return {
        "group_id": group_id,
        "group_source": source,
        "grouping_ids": grouping_ids,
    }


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
            prompt = first(raw, "prompt", "instruction", "task")
            candidates = []
            if human:
                candidates.append({"label": "human", "text": human[0]})
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
                    "prompt": prompt,
                    "use_case": first(raw, "use_case", "category", "task_type"),
                    "source_model": first(raw, "model", "source_model"),
                    "llm_edit": first(raw, "llm_edit", "machine_edit"),
                    **_grouping_metadata(raw, prompt),
                },
            ))
            if limit and len(records) >= limit:
                break
        if not records:
            raise AdapterError("No Beemo-like records found. Expected machine/generated/response plus optional human/expert fields.")
        return records
