"""Adapter for WQ/WQRM preference pairs."""

from __future__ import annotations

from pathlib import Path

from .base import Adapter, AdapterError, as_text, first, load_objects, normalized_record


class WQAdapter(Adapter):
    dataset = "WQ"

    def adapt(self, path: Path, split: str | None = None, limit: int | None = None) -> list[dict[str, object]]:
        records = []
        for raw in load_objects(path):
            raw_split = as_text(first(raw, "split", "subset", "partition")) or "unspecified"
            if split and raw_split != split:
                continue
            prompt = as_text(first(raw, "prompt", "instruction", "question")) or ""
            chosen = as_text(first(raw, "chosen", "preferred", "response_a", "candidate_a"))
            rejected = as_text(first(raw, "rejected", "less_preferred", "response_b", "candidate_b"))
            if not chosen or not rejected:
                continue
            source = prompt or chosen
            records.append(normalized_record(
                dataset=self.dataset,
                source_text=source,
                record=raw,
                record_id=first(raw, "id", "uid", "example_id"),
                split=raw_split,
                candidates=[{"label": "chosen", "text": chosen}, {"label": "rejected", "text": rejected}],
                metadata={
                    "prompt": prompt,
                    "preference": first(raw, "preference", "label", "winner", default="chosen"),
                    "source_dataset": first(raw, "dataset", "source"),
                },
            ))
            if limit and len(records) >= limit:
                break
        if not records:
            raise AdapterError("No WQ-like preference pairs found. Expected prompt plus chosen/rejected or response_a/response_b fields.")
        return records
