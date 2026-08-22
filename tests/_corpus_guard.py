"""Shared skip guard for tests that need the external benchmark corpora.

The corpora (Beemo/LAMP/Baumler) are fetched locally into ``textslopbench/results/``
and are NEVER committed to this public repo (Baumler has no license; LAMP redistribution
is unconfirmed — see docs/textslop/DATASET_ADAPTER_PLAN.md). Tests that build population
models from them therefore skip on a fresh public checkout and run in full only where the
corpora have been fetched (e.g. the private research archive)."""
import pathlib
import pytest

RESULTS = pathlib.Path(__file__).resolve().parents[1] / "textslopbench" / "results"
CORPUS_FILES = ("beemo-heldout-100.jsonl", "lamp-heldout-100.jsonl", "baumler-corpus.jsonl")
CORPORA_PRESENT = all((RESULTS / f).exists() for f in CORPUS_FILES)

requires_corpora = pytest.mark.skipif(
    not CORPORA_PRESENT,
    reason="benchmark corpora not fetched into textslopbench/results/ "
           "(see docs/textslop/DATASET_ADAPTER_PLAN.md)")
