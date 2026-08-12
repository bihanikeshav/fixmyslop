# Skill + Engine Hardening Plan (2026-08-11)

Source: 6 Haiku research subagents auditing the design-research corpus against the
engine math (fonts/color/layout/motion), plus external study of motion-primitives.com,
impeccable.style, and taste-skill. Baseline `npx vitest run apps/engine` = GREEN.

Canonical source of truth = `apps/engine/prompts.mjs` (skill index + design-law + verb
bodies) and `apps/engine/reference.mjs` (reference topics). `skills/fixmyslop/*.md`
are BUILD OUTPUTS of `scripts/build-skill.mjs`. NOTE: on branch `skill-hardening-v2`
the `.md` files were hand-edited AHEAD of the `.mjs` sources across many files, so
`build-skill.mjs` is currently unsafe (would revert hand-authored content). Write to
`.mjs` and mirror to `.md`; reconcile the drift before any rebuild.

## Guiding tension
User wants BOTH "improve the MCP" (more capability) and "keep it lean." Resolution:
add deterministic *validators/refinements* to existing tools (cheap capability, no
surface bloat); add new tools only where a whole design layer is unvalidated; distill
the skill prose to be shorter even as coverage grows.

## STATUS
- Real test command: `node --test apps/engine/*.test.mjs` (NOT vitest — files use node:test; vitest reports 0 = false green). Baseline 250 pass.
- ✅ Phase 1 done (skill lean: TL;DR top-3 + mode-awareness + consolidated composition, canonical .mjs + built .md). 250 green.
- ✅ Phase 2 done (motion math: spring presets by intensity, intensity-scaled micro durations, reveal.choreography, emphasized-accelerate exit easing; + motion guidance; + lock test). 251 tests, green.
- ✅ Phase 3 done (color: dark-mode accent desaturation, ±8° neutral tint, hue-chroma parity, harmonic split-complement accent2, surface-elevation gate; + shadeRamp + semanticColors exported & wired into designSystem; + 2 lock tests). 252 green.
- ✅ Phase 4 done (fonts: hardened x-height pairing penalty per Bringhurst; measure-aware per-role leading/tracking output in genome.type.setting; + lock test). 253 green. Deferred (lower-confidence / needs data): stress-axis flip, superfamily exclusion, opsz gating (fonts.json opsz flag unverified).
- ✅ Phase 5 done (layout: `checkComposition` in system.mjs — trapped-whitespace + swallowing-block = SLOP, monotony = advisory; 18/18 families CLEAN, catches the bad case; auto-exposed via ...SYS; + lock test). 254 green. KEY FINDING: section heightShare ≠ visual dominance — dropped the naive "one section dominates" rule (false-positived good app-shell/narrative/band layouts); focal-point stays a render-level squint test.
- ✅ Phase 6 done. Registered `check_composition` + `shade_ramp` + `semantic_colors` (3 ready engine fns) as MCP tools; added 6 new UX validators in a new pure module `apps/engine/ux.mjs` (auditMicrocopy, generateEmptyState, auditAccessibility, auditForm, checkComponentStates, checkInformationArchitecture) + registered as tools; +ux.test.mjs (7) +worker tool tests. Added 4 compact Decision→Tool rows to design-law (both .mjs + .md) for discoverability. Engine 261 green, worker 13 green.
- ALL SIX PHASES DONE. Final: `node --test apps/engine/*.test.mjs` = 261 pass; `node --test apps/worker/src/*.test.mjs` = 13 pass.
- ✅ DRIFT RECONCILED. Ported all ahead `.md` content back into `prompts.mjs` (PREAMBLE re-embedded verbatim; VERBS bodies via footer-sentinel extraction; renderSkill() rewritten to reproduce the rich SKILL.md via sentinel-templating) and `reference.mjs` (REFERENCE bodies via block-split; expression-v2's non-standard header handled). `build-skill.mjs` is now IDEMPOTENT — verified `renderX()` === built `.md` (zero drift). VERBS/REFERENCE are now JSON-formatted arrays. Ran build-skill; all 7 key ahead-content spot-checks survived. Engine 261 + worker 13 green. Going forward: edit `.mjs`, run `node scripts/build-skill.mjs`; never hand-edit `.md`.
- ✅ FABLE REVIEW PASS. Independent fable subagent found + fixed: (1) GATE HOLE — checkPalette judged colors individually so a palette forming the banned dark+neon combo passed; added a combination gate (ground L<0.2 + accent C≥0.17 → fail) and made dark-mood desaturation a true multiplicative −25% (chromaScale 0.75, was additive ~12%); (2) BUG — checkComposition false-positived roles-only grammars (heightShares sum 0 → fake "trapped whitespace"); now skips allocation gate when no heightShare present; (3) harmonic accent2 collapsed for ~⅓ of hues (only +150° tried, lands in indigo band) → fallback chain +150→−150→+120; (4) semanticColors warning read olive not amber (L band fixed to 0.72→0.55); (5) auditMicrocopy false "no next action" (recovery-verb list extended); (6) explore prompt contradiction (2–4 set vs "present the four"); (7) the 6 UX tools were unreachable from prompts → wired into design_review/polish/color reference; (8) shadeRamp neutral hue 250 (=slate slop) → 75 (warm paper) + 950 label. +7 engine lock tests, +1 system, +1 ux, extended worker test. Verified: engine 268 + worker 13 green, dark+neon gate fires, roles-only CLEAN, real trapped-whitespace still SLOP, dark+bold accent C=0.113, build-skill still idempotent (zero drift).
- ✅ PRO-UI PRINCIPLES: new loadable reference topic `product-ui` (Professional product UI — Linear/Vercel/Stripe/Cloudflare craft as PRINCIPLES: restraint-as-commitment, monochrome+scarce-accent, type-does-identity, density discipline, keyboard-first/optimistic/spring, component maturity, + an explicit anti-clone test) + an anti-CLUSTER line in the always-on law (refuse the "dark+mono+one-blue-accent+Geist/Inter" cluster wholesale — take the discipline, not the skin). build-skill idempotent; 268 green.
- ✅ COLLECTUI ENRICHMENT: added collectui.com as a permanent source in packages/crawl/src/harvest-gallery-leads.mjs; ran it (robots allowed, one page) → 32 destination leads into data/layout-crawl/master-v2/harvest.gallery-leads.v1.ndjson (mixed: design-forward portfolios + design/dev tools + some link-in-bio noise). NOTE: leads only — the rich-capture crawl into corpus.json is the separate heavy step (out of scope this session).
- ✅ GENOME → CODED PAGE: new pure module apps/engine/build-page.mjs (`renderPage(engine, genome, {viewport})`) + MCP tool `build_page`. Emits a self-contained page that EXEMPLIFIES the gates: <!doctype>+<meta charset=utf-8>, container tokens on the wrapper, neutrals-dominant + scarce accent (one CTA), one dominant hero, core content in markup, prefers-reduced-motion path; content is professional scaffold keyed to the section grammar. +5 build-page tests +1 worker test. VISUALLY VERIFIED light + dark renders in-browser — both clean, professional, non-slop (dark uses a desaturated accent, not neon). Also fixed a found engine bug: genome.mjs never passed `mood` to generatePalette, so intent.theme='dark' rendered on a LIGHT ground — now wired. Engine 273 + worker 14 green.
- ✅ SPACING FIXER: `normalizeSpacing` in system.mjs (auto-exposed via ...SYS) + MCP tool `fix_spacing`. auditSpacing/check_spacing only FLAG; this REPAIRS — snaps arbitrary padding/margin/gap/size to a 4/8px scale, collapses near-duplicates onto one shared token (15/17/18→16=s4), handles per-component box models, returns before→after map + usedTokens. +2 system +1 worker test. Engine 275 + worker 15 green.
- ✅ COLLECTUI RICH-CAPTURE done (capture+derive). Stage 1: 32 leads → data/site-list.json (2340→2372). Stage 2: `crawl-features.ts --layout-v2 --rich-capture --only-hosts <32> --raw-v2 data/geometry-crawl-raw.collectui.ndjson --screenshot-dir data/layout-crawl/screenshots-collectui` → 32/32 OK, desktop+mobile shots (26.5M raw). Stage 3: `derive-layout-data.ts --raw <collectui> --out-version collectui` → 32 LayoutGenomes in data/layout-crawl/layout-genomes.collectui.ndjson (+manifest); out-version≠v1 so canonical v1 artifacts untouched. Quality: pageKind dist {landing 15, marketing 8, portfolio 6, product-with-proof 1, pricing 1, app 1}; 15 genomes ≥4 sections (ample.studio 26, fairetype.com 19, systms.ai 13, aura.build 12), link-in-bio noise (linktr.ee etc.) derived to ≤2 sections = filterable. CAVEAT: crawl-features doesn't re-check destination robots (harvest checked the gallery); modest one-visit-per-site public crawl. NEXT (deliberate, not done — mutates canonical retrieval data): filter thin ones + merge layout-genomes.collectui.ndjson into the live retrieval index.
- ⏳ OPTIONAL FUTURE: deeper font math (stress-axis, superfamily, opsz) needs fonts.json axis data; a build_page dashboard/app content path; redeploy the worker so the live MCP serves the hardened prompts + all new tools (build_page + fix_spacing included).
- ⏳ Open thread: .md↔.mjs drift across many files means build-skill.mjs is unsafe; reconcile before any rebuild.
- LESSON: reference.mjs topic bodies are backtick template literals — escape inner markdown backticks as \` or the module won't parse.

## Phase 1 — Skill leanness pass (docs; low risk)
- TL;DR top-3 on-ramp at the very top of the index (fonts / one-element-wins / container tokens).
- Mode-aware framing: landing (convert) vs dashboard (operate) vs docs (read) vs profile (persuade) — rules differ; state it once, up top.
- Consolidate the composition/balance content already added so it's tight, not spread across index + design-law.
- One scannable 30-second detection checklist in failure-modes (replace prose where possible).
- Optional dials (layout boldness / accent ratio / spacing density / motion intensity) framed as tuning ABOVE the hard-gate floor.
- Verify external-source claims (impeccable "58 checks", taste-skill dials) before quoting; borrow the structure, not unverified specifics.

## Phase 2 — Motion math (motion.mjs; bounded, testable)
- Spring presets: stiff{170,26} responsive{100,20} snappy{120,12} gentle{80,15}; pick by intensity/energy instead of one hardcoded {100,20}.
- Easing pool 3→5 (add Material emphasized-accelerate for exits, gentle-decelerate for low-intensity reveals) to stop 4-direction collisions.
- Intensity-scaled micro durations: hover 150+15*intensity (100–400), press 100+8*intensity (80–250).
- New gate-safe treatments: text-reveal (char/word granularity, intensity≥5, narrative/landing only, not core content), stagger choreography (cascade/wave/simultaneous), scroll-progress indicator (1/page), magnetic CTA (desktop, intensity>6). All collapse under reduced-motion.

## Phase 3 — Color quick wins (engine.mjs; low risk)
- Dark-mode accent desaturation −25% C (stop neon vibration).
- Neutral tint range ±30°→±8° hue jitter.
- Hue-calibrated chroma parity scale (yellow 0.8x … purple 1.12x).
- Surface↔ground + ink↔surface contrast gate in checkPalette.
- Shade-ramp + semantic-color (error/success/warning/info) generation for design_system.
- Harmonic accent2 (triadic 120° / split-comp 150°) instead of independent fresh accent.

## Phase 4 — Font pairing math (engine.mjs/genome.mjs/connected-v2.mjs)
- Harden x-height mismatch penalty (0.8→~1.4, cap higher); add stress-axis (strokeContrast) match penalty.
- Superfamily detection + exclude siblings from the opposite role pool.
- Measure-aware body selection (tight measures favor tall x-height) + emit line-height/tracking recommendations per role.
- Optical-size (opsz) preference for display >48px; demote heavy weights at large display sizes.
- Accent contrast-diversity + short-usage enforcement.

## Phase 5 — Layout validators (layout-families.mjs/genome.mjs) — HIGHEST VALUE
Directly fixes the trapped-whitespace/no-focal-point dashboard.
- validateSectionFill: contentHeight / (heightShare*viewport) < 0.6 → trapped-whitespace flag.
- scoreWeightBalance: L/R visual weight parity; penalize asymmetry >0.65 in fitFor.
- checkFocalDominance: centrepiece must be top-3 heightShare AND first-scanned.
- Spacing hierarchy per section (intra 0.5x, inter 1.5x of whitespace) → 2:1 grouping.
- Section rhythm / anti-monotony; alignment continuity (shared edges); mobile reflow coherence.

## Phase 6 — New capability tools (tools.mjs + engine; scope expansion, user-approved)
Priority order from coverage audit:
1. audit_microcopy — error-message anatomy, outcome button labels, empty-state copy, tone, plain-language/concision.
2. generate_empty_state — headline/explanation/action three-layer; time-to-value.
3. audit_accessibility — beyond contrast: focus states, touch targets ≥44px, keyboard, semantic HTML, reduced-motion.
4. audit_form — single-column, top labels, on-blur validation, error adjacency, progressive disclosure.
5. check_component_states — full state matrix completeness (resting/hover/active/focus/disabled/loading/error/success).
6. check_information_architecture — Hick's/Miller's (≤7 top-level), chunking, jargon/snowflake labels.
Each new tool = engine pure function + worker tool registration + tests + one skill reference line.

## Invariants
- Keep `npx vitest run apps/engine` green after every phase.
- Preserve all motion hard gates (reduced-motion, transform/opacity-only, no core-content gating).
- Preserve color slop gates; new checks are additive.
- Mirror canonical .mjs edits into the built .md; do not run build-skill.mjs until drift reconciled.
