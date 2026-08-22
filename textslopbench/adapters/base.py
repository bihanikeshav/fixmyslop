"""Shared local file loading and normalized record schema."""

from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable


class AdapterError(ValueError):
    pass


def load_objects(path: Path) -> list[dict[str, Any]]:
    files = (sorted(path.rglob("*.jsonl")) + sorted(path.rglob("*.ndjson")) + sorted(path.rglob("*.json")) + sorted(path.rglob("*.csv")) + sorted(path.rglob("*.parquet"))) if path.is_dir() else [path]
    objects: list[dict[str, Any]] = []
    for file_path in files:
        if file_path.suffix.lower() in {".jsonl", ".ndjson"}:
            for line in file_path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    value = json.loads(line)
                    if isinstance(value, dict):
                        objects.append(value)
        elif file_path.suffix.lower() == ".parquet":
            try:
                import pyarrow.parquet as parquet
            except ImportError as exc:  # pragma: no cover - depends on local dataset runtime
                raise AdapterError("Reading parquet requires pyarrow") from exc
            table = parquet.read_table(file_path)
            objects.extend(row for row in table.to_pylist() if isinstance(row, dict))
        elif file_path.suffix.lower() == ".csv":
            with file_path.open("r", encoding="utf-8", newline="") as handle:
                objects.extend(dict(row) for row in csv.DictReader(handle))
        else:
            value = json.loads(file_path.read_text(encoding="utf-8"))
            if isinstance(value, list):
                objects.extend(item for item in value if isinstance(item, dict))
            elif isinstance(value, dict):
                for key in ("records", "items", "data", "examples", "rows"):
                    if isinstance(value.get(key), list):
                        objects.extend(item for item in value[key] if isinstance(item, dict))
                        break
                else:
                    objects.append(value)
    return objects


def first(mapping: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        value = mapping.get(key)
        if value is not None and value != "":
            return value
    return default


def as_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def list_text(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [text for text in (as_text(item) for item in value) if text]
    text = as_text(value)
    return [text] if text else []


def stable_id(dataset: str, source: str, supplied: Any = None) -> str:
    if supplied is not None and str(supplied).strip():
        return str(supplied)
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()[:16]
    return f"{dataset}:{digest}"


def normalized_record(
    *,
    dataset: str,
    source_text: str,
    record: dict[str, Any],
    record_id: Any = None,
    split: Any = None,
    human_references: Iterable[str] = (),
    candidates: Iterable[dict[str, Any]] = (),
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "dataset": dataset,
        "record_id": stable_id(dataset, source_text, record_id),
        "split": as_text(split) or "unspecified",
        "source_text": source_text,
        "human_references": [text for text in human_references if text],
        "candidates": list(candidates),
        "metadata": metadata or {},
    }


class Adapter:
    dataset = "unknown"

    def adapt(self, path: Path, split: str | None = None, limit: int | None = None) -> list[dict[str, Any]]:
        raise NotImplementedError

    def write_manifest(self, path: Path, records: list[dict[str, Any]]) -> None:
        manifest = {
            "dataset": self.dataset,
            "source_path": str(path),
            "records": len(records),
            "splits": sorted({record["split"] for record in records}),
            "raw_text_policy": "not copied by the adapter; caller controls redistribution and license compliance",
        }
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
