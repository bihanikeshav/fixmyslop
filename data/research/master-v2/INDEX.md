# Master research/data expansion v2

Generated 2026-08-08. JSON/NDJSON are canonical; Markdown is a handoff index only.

## Gallery corpus

- `data/layout-crawl/master-v2/harvest.gallery-leads.v1.ndjson` — 1,659 harvested destination records across the bounded gallery-source expansion.
- `data/layout-crawl/master-v2/site-list.gallery-master-v2.json` — 552 registered new hosts; the existing site list was extended with accurate gallery provenance.
- `data/geometry-crawl-raw.gallery.master-v2.ndjson` — versioned rich-capture raw records; 552 records, desktop 1440×900 and mobile 390×844 attempts.
- `data/layout-crawl/screenshots-master-v2/` — capture artifacts.
- `data/layout-crawl/layout-genome-manifest.master-v2.ndjson` and `data/layout-crawl/layout-genomes.master-v2.ndjson` — 543 v3-derived interpretable genomes.
- `data/layout-crawl/master-v2/good-hosts.gallery-master-v2.ndjson` — 378 kept hosts with paired screenshots and genome references.
- `data/layout-crawl/master-v2/dropped-hosts.gallery-master-v2.ndjson` — 174 drops with evidence; `gallery-master-v2-summary.json` has per-source conversion.
- `data/research/master-v2/source-conversion.master-v2.json` — harvest/crawl/keep/drop conversion by source, including robots reports.
- `data/layout-crawl/master-v2/family-prevalence.master-v2.json` — prevalence evidence for all 18 frozen families.
- `data/layout-crawl/master-v2/family-proposals.master-v2.json` — three data-only crawl-derived family proposals; no engine merge.

## Font, color, material, component, expression data

- `data/research/master-v2/font-space.v2.json` — enriched catalogue-space record; reuses existing font index, visual/deep embeddings, and neighbor data; no font recrawl.
- `data/research/master-v2/font-role-metrics.v2.json`, `font-pair-judgments.v2.ndjson`, `font-system-examples.v2.ndjson` — role usage, candidate pair evidence, social references, and pending human validation.
- `data/research/master-v2/color-scene-space.v2.json` and `material-texture-space.v2.json` — palette scenes with texture/material as a separate channel.
- `data/research/master-v2/component-personality.v1.json` and `component-observations.v1.ndjson` — button/control/material personality observations; interaction-state replay remains pending.
- `data/research/master-v2/expression-treatments.v1.json`, `expression-compatibility.v1.json`, and `expression-observations.v1.ndjson` — cursor, scroll, GSAP-like motion, type treatment, texture, and mobile/reduced-motion constraints.

## Labels and skill knowledge

- `data/research/master-v2/quality-labels.v2.ndjson`, `slop-labels.v2.ndjson`, `uncertain-labels.v2.ndjson` — upgraded existing human-reviewed sets with independent provenance.
- `data/research/master-v2/quality-review-queue.master-v2.ndjson`, `slop-review-queue.master-v2.ndjson`, `uncertain-review-queue.master-v2.ndjson` — new corpus review queues; not ground truth.
- `data/research/master-v2/skill-knowledge-index.v1.json` — extracted Impeccable/Taste/Impeccable-style workflow knowledge and installability checks.
- `data/research/master-v2/installation-compatibility.v1.json` — local skill/MCP path and schema audit; clean-install smoke test remains open.
- `data/research/master-v2/competitive-rule-audit.v2.json`, `workflow-assets.v1.json`, `design-review-protocol.v1.json`, `rule-conflicts.v1.json`, `integration-proposals.v1.json` — structured integration handoff for the primary skill and MCP.
- `data/research/master-v2/user-site-presence.v1.json` — audit of the 24 destination hosts supplied in the research thread.

## Controls

- `data/tmp/master-v2/current-state.v2.json` — baseline counts and frozen-interface hashes.
- `data/tmp/master-v2/run-manifest.v2.json` — run scope and raw-data policy.
- `data/tmp/master-v2/research-questions.v1.json` — research-question inventory.
- `data/tmp/master-v2/validation-report.gallery-master-v2.json` and `data/tmp/master-v2/validation-report.v2.json` — generated validation reports.

Frozen engine/worker interfaces were not edited. Frequency, positive quality, slop, and uncertainty remain separate dimensions. The layout embedding remains a future re-ranker, not the sole representation.
