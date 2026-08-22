"""Adapter for Baumler personal_style_postedit participant logs."""

from __future__ import annotations

from pathlib import Path

from .base import Adapter, AdapterError, as_text, first, load_objects, normalized_record


class BaumlerAdapter(Adapter):
    dataset = "BaumlerPersonalStyle"

    def adapt(self, path: Path, split: str | None = None, limit: int | None = None) -> list[dict[str, object]]:
        records = []
        for raw in load_objects(path):
            user_info = raw.get("user_info") if isinstance(raw.get("user_info"), dict) else {}
            participant = first(raw, "participant_id", "user_id", "id") or first(user_info, "participant_id", "user_id", "id")
            responses = raw.get("responses") if isinstance(raw.get("responses"), dict) else None
            if responses is None:
                responses = {str(first(raw, "task_id", "scenario", "id", default="record")): raw}
            for task_id, task in responses.items():
                if not isinstance(task, dict):
                    continue
                task_split = as_text(first(task, "split", "subset", default=first(raw, "split", "subset"))) or "unspecified"
                if split and task_split != split:
                    continue
                draft = as_text(first(task, "model_generation", "draft", "llm_output"))
                final = as_text(first(task, "final_version", "human_edit", "edited"))
                shown = bool(first(task, "model_generation_shown", "shown", default=False))
                if not draft or not final:
                    continue
                records.append(normalized_record(
                    dataset=self.dataset,
                    source_text=draft,
                    record=task,
                    record_id=f"{participant}:{task_id}",
                    split=task_split,
                    human_references=[final],
                    metadata={
                        "participant_id": participant,
                        "task_id": task_id,
                        "scenario": first(task, "scenario"),
                        "details": first(task, "details"),
                        "model_generation_shown": shown,
                        "independent_control": not shown,
                        "edit_log": first(task, "edits"),
                    },
                ))
                if limit and len(records) >= limit:
                    return records
        if not records:
            raise AdapterError("No Baumler logs found. Expected participant JSON with responses[*].model_generation and final_version.")
        return records
