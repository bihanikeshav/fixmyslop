// apps/engine/explore.mjs — Subsystem 3d: the §4 explore wiring (pure math, no AI, no
// Math.random, no Date.now — deterministic; runs in a Cloudflare Worker, the browser, and the
// CLI). Implements spec §4 (docs/layout-explorer-spec.md).
//
// `exploreDirections(engine, intentInput, { seed, recentFingerprints, count })` assembles `count`
// (default 4) genuinely divergent StyleGenome directions from ONE intent in ONE call — closing
// spec §0 sameness leak #2 (the old explore.md loop threaded style_genome 4× by hand and silently
// produced one idea recolored whenever the agent forgot a step).
//
// Shape: 3 corpus-grounded slots (greedy-diverse family picks, each perturbed + validated against
// its own family's gates) + 1 engine-synthesized slot (skeleton from the best unchosen family,
// macro stance blended 60/40 from a second family of a different pageKind, perturbed harder).
// Every slot is assembled via `styleGenome`'s `{layout}` override (genome.mjs) so font/palette
// retrieval still runs through the same gates every other caller gets.

import { resolveIntent, hashToUint32 } from "./intent.mjs";
import { suggestLayout, LAYOUT_FAMILIES } from "./layout-families.mjs";
import { perturbAndValidate, validatePerturbed } from "./perturb.mjs";
import { styleGenome } from "./genome.mjs";
import { deriveBackground } from "./background.mjs";
import { deriveMotion } from "./motion.mjs";
import { distance, withinSetOk, vsRecentOk, RELAXED_FLOOR_D } from "./fingerprint.mjs";
import {
  backgroundFingerprint, backgroundAxisDistance, BACKGROUND_AXIS_FLOOR,
  motionFingerprint, motionAxisDistance, MOTION_AXIS_FLOOR,
} from "./divergence.mjs";
import { retrieveLayouts, intentToQuery } from "./retrieval.mjs";

const FAMILY_BY_NAME = new Map(LAYOUT_FAMILIES.map((f) => [f.name, f]));
const MOD9 = 0x9E3779B9;
const MOD2 = 0x2545F491;

// ── layout retrieval channel (docs/layout-explorer-spec.md §4 extension, retrieval.mjs) ─────────
// Integration decision (a) full crawl-genome→family conversion vs (b) retrieval-INFORMED
// selection+parametrization of the existing curated families: we do (b). The 210-host clean-tier
// crawl genomes have no requiredContent/antiPatterns/optionalSections/swappableAdjacent/
// dialCompatibility — the contract perturb.mjs's gates (sectionsValid/macroValid/hierarchyValid)
// and composeGenome depend on — and their sectionGrammar roles are the raw 10-role crawl vocabulary
// (nav/hero/features/.../unknown), not the ~30 bespoke rendering roles the hand-authored families
// use. Converting one wholesale would mean either inventing missing contract fields (shaky fidelity
// — TODO for a future pass once the crawl schema grows those fields) or bypassing perturb.mjs's
// validation entirely (unsafe). So retrieval instead GROUNDS an already-selected, already-gated
// family's macro numbers toward its nearest real neighbor (groundMacroToNeighbor below), reusing
// perturb.mjs's own validatePerturbed so a grounded direction can never leave the family's gates —
// curated families stay the structural skeleton; retrieval supplies the real-world macro target.
const TOOL_KINDS = new Set(["dashboard", "data-admin", "app"]);
const RETRIEVAL_N = 5; // candidates pulled per slot before excluding already-used hosts
const RETRIEVAL_GROUND_WEIGHT = 0.3; // blend toward the real host; never overwrite family character

// retrieveForSlotBase(base, usedHosts) → nearest un-used real-corpus neighbor to `base` (a composed
// LayoutGenome — has .macro/.hierarchy/.sectionGrammar/.pageKind) or null (empty/absent index, or
// every candidate within RETRIEVAL_N already used by an earlier slot this call).
function retrieveForSlotBase(base, usedHosts) {
  const queryVector = intentToQuery(null, base);
  if (!queryVector) return null;
  const [top] = retrieveLayouts(queryVector, RETRIEVAL_N, { exclude: usedHosts });
  return top || null;
}

// groundMacroToNeighbor(genome, family, neighborSummary) → genome with macro.{splitRatio,
// whitespace, contentWidthShare, columnCount} nudged RETRIEVAL_GROUND_WEIGHT of the way toward the
// retrieved real host's macro numbers, then re-validated with perturb.mjs's OWN validatePerturbed
// against `family`'s gates (split-side preservation, whitespace/density coupling, TOOL_KINDS
// contentWidthShare floor, 1/12-column guards) — reuses the existing invariants rather than
// duplicating them. Falls back to the un-grounded genome, silently, if grounding would leave the
// family's gates (never emits an out-of-gate genome).
function groundMacroToNeighbor(genome, family, neighborSummary) {
  const nm = neighborSummary && neighborSummary.macro;
  if (!nm) return genome;
  const w = RETRIEVAL_GROUND_WEIGHT;
  const macro = { ...genome.macro };
  const authoredSplit = Number.isFinite(family.macro?.splitRatio) ? family.macro.splitRatio : 0.5;

  if (Number.isFinite(nm.splitRatio)) {
    let v = macro.splitRatio * (1 - w) + nm.splitRatio * w;
    v = Math.min(0.78, Math.max(0.34, v));
    if (authoredSplit !== 0.5 && (v - 0.5) * (authoredSplit - 0.5) < 0) v = macro.splitRatio;
    macro.splitRatio = Math.round(v * 10000) / 10000;
  }
  if (Number.isFinite(nm.whitespace)) {
    let v = macro.whitespace * (1 - w) + nm.whitespace * w;
    const density = Number.isFinite(macro.contentDensity) ? macro.contentDensity : 0.5;
    const target = 1 - density;
    if (Math.abs(v - target) > 0.35) v = target + Math.sign(v - target) * 0.35;
    macro.whitespace = Math.min(0.85, Math.max(0.2, Math.round(v * 10000) / 10000));
  }
  if (Number.isFinite(nm.contentWidthShare)) {
    const floor = TOOL_KINDS.has(family.pageKind) ? 0.9 : 0.6;
    let v = macro.contentWidthShare * (1 - w) + nm.contentWidthShare * w;
    v = Math.min(1.0, Math.max(floor, v));
    macro.contentWidthShare = Math.round(v * 10000) / 10000;
  }
  if (Number.isFinite(nm.columnCount)) {
    const authoredCols = family.macro?.columnCount;
    let v = Math.round(macro.columnCount * (1 - w) + nm.columnCount * w);
    if (v === 1 && authoredCols !== 1) v = macro.columnCount;
    if (v === 12 && authoredCols !== 12) v = macro.columnCount;
    macro.columnCount = v;
  }

  const grounded = { ...genome, macro };
  const { ok, genome: validated } = validatePerturbed(grounded, family, genome);
  return ok ? validated : genome;
}

function ivFromIntent(intent) {
  return {
    layoutVariance: intent.layoutVariance,
    contentDensity: intent.contentDensity,
    materiality: intent.materiality,
    energy: intent.energy,
    contrastPreference: intent.contrastPreference,
    craft: intent.craft,
  };
}

function circularHueDiff(ha, hb) {
  const a = Number(ha), b = Number(hb);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 180;
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

// A lightweight layout-only fingerprint (no font/hue yet) used ONLY to greedily pick a diverse set
// of FAMILIES before any font/palette retrieval happens. Missing font/hue components count as
// maximally-different for every candidate equally, so they don't skew the relative ranking.
function layoutFingerprint(genome) {
  return {
    layoutFamily: genome.family,
    canonicalOrder: genome.sectionGrammar.map((s) => s.role),
    splitRatio: genome.macro.splitRatio,
    whitespace: genome.macro.whitespace,
    contentWidthShare: genome.macro.contentWidthShare,
    columnCount: genome.macro.columnCount,
    headingScaleRatio: genome.hierarchy.headingScaleRatio,
    darkBands: genome.sectionGrammar.map((s) => (s.surface === "inverted" ? "1" : "0")).join(""),
  };
}

// Greedy max-min-pairwise-distance family selection among survivors with fit >= maxFit-0.25
// (spec §4 step 3). `ranked` = suggestLayout(intent, {recentFingerprints}) output — unperturbed
// base genomes, best fit first.
function greedyDiverseFamilies(ranked, count) {
  if (!ranked.length || count <= 0) return [];
  const maxFit = ranked[0].fit;
  const eligible = ranked.filter((c) => c.fit >= maxFit - 0.25);
  const pool = eligible.length ? eligible : ranked.slice();
  const chosen = [pool[0]];
  const fps = [layoutFingerprint(pool[0])];
  while (chosen.length < count && chosen.length < pool.length) {
    let best = null, bestScore = -Infinity;
    for (const cand of pool) {
      if (chosen.includes(cand)) continue;
      const fp = layoutFingerprint(cand);
      let minD = Infinity;
      for (const cfp of fps) minD = Math.min(minD, distance(fp, cfp));
      if (minD > bestScore) { bestScore = minD; best = cand; }
    }
    if (!best) break;
    chosen.push(best);
    fps.push(layoutFingerprint(best));
  }
  return chosen;
}

// familyA = top-fit family not already chosen for a corpus slot. familyB = a second gate-passing
// family of a DIFFERENT pageKind (spec §4 step 4); null when the surface's survivor pool is a
// single pageKind (graceful-degradation trigger).
function pickSynthParents(ranked, usedNames) {
  const familyA = ranked.find((c) => !usedNames.has(c.family)) || ranked[0];
  const differentPageKind = ranked.filter((c) => c.pageKind !== familyA.pageKind);
  const familyB = differentPageKind.length
    ? (differentPageKind.find((c) => !usedNames.has(c.family) && c.family !== familyA.family) || differentPageKind[0])
    : null;
  return { familyA, familyB };
}

function buildSlots(ranked, count) {
  const corpusCount = Math.max(0, Math.min(3, count - 1));
  const chosen = greedyDiverseFamilies(ranked, corpusCount);
  const usedNames = new Set(chosen.map((c) => c.family));
  const remaining = ranked.filter((c) => !usedNames.has(c.family));
  const corpusSlots = chosen.map((base, i) => ({
    kind: "corpus", index: i, base, familyDef: FAMILY_BY_NAME.get(base.family),
  }));
  const { familyA, familyB } = pickSynthParents(ranked, usedNames);
  const synthSlot = {
    kind: "synth", index: corpusSlots.length, baseA: familyA, baseB: familyB,
    familyDefA: FAMILY_BY_NAME.get(familyA.family),
  };
  return { slots: [...corpusSlots, synthSlot].slice(0, Math.max(1, count)), remaining };
}

// Compose the perturbed LayoutGenome for one slot at a given reroll `variant`. Pure fn of
// (slot, iv, seed, variant, usedHosts) — usedHosts (real corpus hosts already grounded by earlier
// slots THIS call) is only consulted by the retrieval channel, so it doesn't disturb determinism
// of the perturbation itself (same seed/variant → same perturbed skeleton either way).
function composeSlotGenome(slot, iv, seed, variant, usedHosts = []) {
  if (slot.kind === "corpus") {
    const amplitude = 0.35 + 0.65 * iv.layoutVariance;
    const streamSeedFor = (reroll) => hashToUint32(`${seed}:${slot.familyDef.name}:${slot.index}:${reroll}:${variant}`);
    let genome = perturbAndValidate(slot.base, slot.familyDef, streamSeedFor, iv, amplitude);
    const retrieved = retrieveForSlotBase(slot.base, usedHosts);
    if (retrieved) genome = groundMacroToNeighbor(genome, slot.familyDef, retrieved.layoutSummary);
    return {
      genome, family: slot.familyDef, warnings: [],
      provenance: "corpus-grounded",
      groundedIn: retrieved ? retrieved.host : (slot.familyDef.evidence?.representativeHost ?? null),
      retrieval: retrieved ? { host: retrieved.host, distance: retrieved.distance, bucket: retrieved.bucket } : null,
    };
  }
  // synthesized slot (spec §4 step 4)
  const warnings = [];
  let blendedBase, parents, amplitude;
  if (slot.baseB) {
    const macro = { ...slot.baseA.macro };
    for (const k of ["splitRatio", "whitespace", "contentWidthShare", "columnCount"]) {
      if (Number.isFinite(slot.baseA.macro[k]) && Number.isFinite(slot.baseB.macro[k])) {
        let v = 0.6 * slot.baseA.macro[k] + 0.4 * slot.baseB.macro[k];
        if (k === "columnCount") v = Math.round(v);
        macro[k] = v;
      }
    }
    blendedBase = { ...slot.baseA, macro };
    parents = [slot.baseA.family, slot.baseB.family];
    amplitude = 1.25;
  } else {
    // Graceful degradation (spec §4 step 4 / trap): only one pageKind fits this surface — fall
    // back to a higher-amplitude perturbation of the top family instead of a two-family blend.
    blendedBase = { ...slot.baseA };
    parents = [slot.baseA.family];
    amplitude = 1.6;
    warnings.push(
      "engine-synthesis-degraded: only one pageKind survived the surface/dial gates, so the "
      + "synthesized direction could not blend a second family — used a higher-amplitude "
      + "perturbation of the top family instead",
    );
  }
  const streamSeedFor = (reroll) => hashToUint32(`${seed}:engine-synthesized:${slot.index}:${reroll}:${variant}`);
  let genome = perturbAndValidate(blendedBase, slot.familyDefA, streamSeedFor, iv, amplitude);
  const retrieved = retrieveForSlotBase(slot.baseA, usedHosts);
  if (retrieved) genome = groundMacroToNeighbor(genome, slot.familyDefA, retrieved.layoutSummary);
  return {
    genome, family: slot.familyDefA, warnings, parents,
    provenance: "engine-synthesized",
    groundedIn: retrieved ? retrieved.host : (slot.familyDefA.evidence?.representativeHost ?? null),
    retrieval: retrieved ? { host: retrieved.host, distance: retrieved.distance, bucket: retrieved.bucket } : null,
  };
}

// Assemble one full direction (layout + type + palette) via styleGenome's {layout} override,
// then override the palette so directions spread hue instead of all reproducing the same one
// (spec §4 step 6). `otherFingerprints` = every OTHER direction already finalized this call
// (used both as font-exclusion memory and as the hue-separation set).
function buildDirectionForSlot(engine, intentInput, slot, iv, seed, variant, hueBase, energyBand, otherFingerprints, otherHues, callerRecent, theme, spreadCount, usedHosts) {
  const composed = composeSlotGenome(slot, iv, seed, variant, usedHosts);
  const optionSeed = (seed + slot.index * MOD9 + variant * MOD2) >>> 0;
  const recentForCall = [...callerRecent, ...otherFingerprints];
  let genome = styleGenome(engine, intentInput, { seed: optionSeed, recentFingerprints: recentForCall, layout: composed.genome });

  let optionHue;
  if (hueBase != null) {
    optionHue = (hueBase + slot.index * 112.5) % 360;
  } else {
    let attempt = 0, candidate = 0;
    while (attempt < 8) {
      candidate = hashToUint32(`${seed}:hue:${slot.index}:${variant}:${attempt}`) % 360;
      if (otherHues.every((u) => circularHueDiff(candidate, u) >= 40)) break;
      attempt++;
    }
    optionHue = candidate;
  }
  const palette = engine.generatePalette({ energy: energyBand, seed: optionSeed, hue: optionHue });
  // Recompute the background anchored to THIS direction's separated hue (spec §4 step 6's hue
  // separation applies to the palette computed above, after styleGenome already ran with the
  // pre-separation hue) — mirrors the palette override immediately below, same reasoning: every
  // direction must carry its own hue end-to-end, not just in `color`. Same streamSeed-derivation
  // shape as the layout/palette per-slot seeds (namespaced so it never collides with them).
  // spreadIndex/spreadCount (apps/engine/divergence.mjs) — deterministic cross-axis spread so the
  // background/motion axes don't just rely on the per-direction streamSeed happening to land far
  // apart; see background.mjs's applyTreatmentSpread / motion.mjs's applyIntensitySpread+
  // applyRevealSpread for what these do.
  const bgStreamSeed = hashToUint32(`${seed}:background:${slot.index}:${variant}`);
  const background = deriveBackground(composed.family, { ...iv, theme, hue: optionHue, spreadIndex: slot.index, spreadCount }, bgStreamSeed);

  // Same reasoning, same shape, for the motion axis (docs/motion-interaction-taxonomy.md) — every
  // direction must carry its own distinct motion character end-to-end, not just in `genome.motion`
  // as first assembled by styleGenome (which ran before this direction's hue/family were final).
  const motionStreamSeed = hashToUint32(`${seed}:motion:${slot.index}:${variant}`);
  const motionDesign = deriveMotion(composed.family, { ...iv, theme, hue: optionHue, spreadIndex: slot.index, spreadCount }, motionStreamSeed);
  genome = {
    ...genome,
    color: { ...palette, source: "corpus-plus-oklch" },
    background,
    motion: { ...genome.motion, design: motionDesign },
    fingerprint: { ...genome.fingerprint, paletteHue: Math.round(palette.hue ?? optionHue) },
    provenance: { ...genome.provenance, motion: motionDesign.provenance },
  };

  const direction = {
    name: composed.family.name,
    genome,
    fingerprint: genome.fingerprint,
    fit: composed.genome.fit,
    provenance: composed.provenance,
    groundedIn: composed.groundedIn,
    retrieval: composed.retrieval ?? null,
  };
  if (composed.parents) direction.parents = composed.parents;
  return {
    direction, hue: optionHue, warnings: composed.warnings,
    bgFp: backgroundFingerprint(background), motionFp: motionFingerprint(motionDesign),
  };
}

/**
 * exploreDirections(engine, intentInput, { seed, recentFingerprints=[], count=4 }) →
 * { directions:[{name,genome,fingerprint,fit,provenance,groundedIn,parents?}×count], warnings }
 *
 * Pure fn of (intent, seed, recentFingerprints). Same inputs → identical output (determinism
 * test). Enforces §3's within-set divergence (pairwise D>=0.45 + hard rules) via a bounded,
 * deterministic reroll: re-perturb the offending direction (<=4), then swap its family (<=3 more,
 * corpus slots only), then accept once D>=0.35 with `warnings:["divergence-floor-relaxed"]`.
 */
export function exploreDirections(engine, intentInput = {}, { seed, recentFingerprints = [], count = 4 } = {}) {
  const resolved = resolveIntent(intentInput);
  const intent = resolved.intent;
  const useSeed = Number.isFinite(Number(seed)) ? Number(seed) : resolved.seed;
  const iv = ivFromIntent(intent);
  const warnings = [...resolved.warnings];

  const ranked = suggestLayout(intent, { recentFingerprints });
  if (!ranked.length) {
    return { directions: [], warnings: [...warnings, "no layout family passed the surface/dial gates for this intent — cannot explore"] };
  }

  const { slots, remaining } = buildSlots(ranked, count);
  const pool = remaining.slice();

  const hueBase = Number.isFinite(Number(intentInput.hue))
    ? (((Number(intentInput.hue) % 360) + 360) % 360)
    : null;
  const energyBand = intent.energy < 0.34 ? "muted" : intent.energy < 0.67 ? "balanced" : "bold";

  const variants = new Array(slots.length).fill(0);
  const directions = new Array(slots.length);
  const hues = new Array(slots.length);
  const bgFps = new Array(slots.length);
  const motionFps = new Array(slots.length);
  const slotWarnings = [];

  function rebuildFrom(idx) {
    for (let k = idx; k < slots.length; k++) {
      const others = directions.slice(0, k).filter(Boolean).map((d) => d.fingerprint);
      const otherHues = hues.slice(0, k).filter((h) => Number.isFinite(h));
      // Real corpus hosts already grounded by earlier slots this call — excluded from this slot's
      // retrieval so the 4 directions pull DISTINCT real neighbors (cross-axis divergence for free:
      // different neighbors carry different macro numbers).
      const usedHosts = directions.slice(0, k).filter(Boolean).map((d) => d.retrieval?.host).filter(Boolean);
      const { direction, hue, bgFp, motionFp, warnings: w } = buildDirectionForSlot(
        engine, intentInput, slots[k], iv, useSeed, variants[k], hueBase, energyBand, others, otherHues, recentFingerprints, intent.theme, slots.length, usedHosts,
      );
      directions[k] = direction;
      hues[k] = hue;
      bgFps[k] = bgFp;
      motionFps[k] = motionFp;
      if (w.length) slotWarnings.push(...w);
    }
  }
  rebuildFrom(0);

  // ── §3 bounded reroll: re-perturb (<=4) then swap family (<=3, corpus slots only) ─────────────
  const MAX_REPERTURB = 4;
  const MAX_SWAP = 3;
  const reperturbAttempts = new Array(slots.length).fill(0);
  const swapAttempts = new Array(slots.length).fill(0);

  // Cross-axis floors (apps/engine/divergence.mjs): withinSetOk already covers layout+type+hue
  // (the combined fingerprint distance + its hard rules); background/motion never feed that
  // fingerprint at all, so they need their own floor check here — feeding the SAME bounded-reroll
  // loop withinSetOk already drives (reperturb bumps bgStreamSeed/motionStreamSeed too, so a
  // background/motion collapse gets a genuine second roll, not just another layout attempt).
  function violatingIndices() {
    const v = new Set();
    for (let i = 0; i < directions.length; i++) {
      for (let j = i + 1; j < directions.length; j++) {
        if (!withinSetOk(directions[i].fingerprint, directions[j].fingerprint)) v.add(j);
        if (backgroundAxisDistance(bgFps[i], bgFps[j]) < BACKGROUND_AXIS_FLOOR) v.add(j);
        if (motionAxisDistance(motionFps[i], motionFps[j]) < MOTION_AXIS_FLOOR) v.add(j);
      }
      if (!vsRecentOk(directions[i].fingerprint, recentFingerprints)) v.add(i);
    }
    return [...v];
  }

  let bad = violatingIndices();
  let rounds = 0;
  while (bad.length && rounds < 16) {
    let progressed = false;
    for (const j of bad) {
      if (reperturbAttempts[j] < MAX_REPERTURB) {
        reperturbAttempts[j]++;
        variants[j]++;
        rebuildFrom(j);
        progressed = true;
      } else if (slots[j].kind === "corpus" && swapAttempts[j] < MAX_SWAP && pool.length) {
        swapAttempts[j]++;
        const nextBase = pool.shift();
        slots[j] = { kind: "corpus", index: j, base: nextBase, familyDef: FAMILY_BY_NAME.get(nextBase.family) };
        variants[j] = 0;
        reperturbAttempts[j] = 0;
        rebuildFrom(j);
        progressed = true;
      }
    }
    rounds++;
    if (!progressed) break;
    bad = violatingIndices();
  }

  if (bad.length) {
    // Bounded reroll exhausted — accept per spec §3's relaxed floor (D>=0.35) rather than loop
    // forever; note it honestly so callers/calibration can see how often this fires.
    warnings.push("divergence-floor-relaxed");
    let minPairwiseD = Infinity, minBg = Infinity, minMotion = Infinity;
    for (let i = 0; i < directions.length; i++) {
      for (let j = i + 1; j < directions.length; j++) {
        minPairwiseD = Math.min(minPairwiseD, distance(directions[i].fingerprint, directions[j].fingerprint));
        minBg = Math.min(minBg, backgroundAxisDistance(bgFps[i], bgFps[j]));
        minMotion = Math.min(minMotion, motionAxisDistance(motionFps[i], motionFps[j]));
      }
    }
    if (Number.isFinite(minPairwiseD) && minPairwiseD < RELAXED_FLOOR_D) {
      warnings.push("divergence-below-relaxed-floor: bounded reroll exhausted without reaching D>=0.35 for at least one pair");
    }
    if (Number.isFinite(minBg) && minBg < BACKGROUND_AXIS_FLOOR) {
      warnings.push("background-divergence-below-floor: bounded reroll exhausted without reaching the background-axis floor for at least one pair");
    }
    if (Number.isFinite(minMotion) && minMotion < MOTION_AXIS_FLOOR) {
      warnings.push("motion-divergence-below-floor: bounded reroll exhausted without reaching the motion-axis floor for at least one pair");
    }
  }

  warnings.push(...slotWarnings);
  return { directions, warnings: [...new Set(warnings)] };
}
