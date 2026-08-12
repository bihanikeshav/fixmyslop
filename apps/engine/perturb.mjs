// apps/engine/perturb.mjs — Subsystem 3b: deterministic, seeded parametric perturbation of a
// composed LayoutGenome (pure math, no AI, no Math.random, no Date.now — runs in a Cloudflare
// Worker, the browser, and the CLI). Implements spec §2 (docs/layout-explorer-spec.md).
//
// `perturbGenome(genome, family, streamSeed, iv, amplitude=1)` nudges a composed genome along 12
// named parameters so that two users whose intent resolves to the same family don't get a
// byte-identical skeleton (spec §0 sameness leak #1). `validatePerturbed` re-checks every gate
// after perturbation and bounds a reroll loop so this NEVER throws and NEVER returns an
// out-of-gate genome.
//
// DETERMINISM CONTRACT `PERTURB_V1`: every parameter below consumes its RNG draws from the
// mulberry32(streamSeed) stream in the FIXED order listed, EVERY TIME — even when the parameter
// ends up skipped (probability gate failed) or its result is clamped away. This means adding a
// new parameter later, or a family changing which options are available to it, never shifts the
// stream for parameters that already exist — the fixed draw *count* per parameter is what makes
// two runs with the same streamSeed byte-identical, not the number of parameters that "did
// something." If you add a 13th parameter, append it — never insert.

import { mulberry32 } from "./engine.mjs";
import { canonicalRole } from "./role-aliases.mjs";

const clamp01 = (n, fallback = 0.5) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(1, Math.max(0, x));
};
const clampRange = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

const TOOL_KINDS = new Set(["dashboard", "data-admin", "app"]);
const FOCAL_ROTATE = ["left", "center", "right"];

// Roles that §2 rule 5/6/7/11 never touch, regardless of family.
const PROTECTED_ROLES = new Set(["nav", "hero", "cta", "footer"]);
function isProtectedRole(role) {
  // Raw-role protection (literal nav/hero/cta/footer strings used by many families) PLUS
  // canonical protection (bespoke roles that alias to nav/hero/cta/footer, e.g. "marquee"→hero,
  // "cta-band"→cta) — "never role implied by requiredContent; never nav/hero/cta/footer" (§2 #6).
  if (PROTECTED_ROLES.has(role)) return true;
  return PROTECTED_ROLES.has(canonicalRole(role));
}

// requiredContent is prose ("thesis","supportingEvidence"...), not a role id. Best-effort guard
// for §2 rule 6 ("never role implied by requiredContent"): refuse a drop if the role name and a
// requiredContent entry share a normalized token — catches evidence/proof/pricing-style overlaps
// without requiring a formal role↔requiredContent mapping (none exists in the corpus schema).
function impliedByRequiredContent(role, requiredContent) {
  if (!Array.isArray(requiredContent) || !requiredContent.length) return false;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "");
  const r = norm(role);
  if (!r) return false;
  return requiredContent.some((rc) => {
    const c = norm(rc);
    return c.includes(r) || r.includes(c);
  });
}

/**
 * perturbGenome(genome, family, streamSeed, iv, amplitude=1) → perturbed genome (new object;
 * input genome is never mutated). `genome` is a composed LayoutGenome candidate as produced by
 * layout-families.mjs `composeGenome` (has .macro, .sectionGrammar, .hierarchy). `family` is the
 * LAYOUT_FAMILIES entry it came from (carries authored macro, optionalSections, swappableAdjacent,
 * requiredContent). `iv` is the same intent-values bag suggestLayout builds
 * ({layoutVariance, contentDensity, materiality, energy, contrastPreference, craft}).
 */
export function perturbGenome(genome, family, streamSeed, iv, amplitude = 1) {
  const rand = mulberry32(streamSeed >>> 0);
  const amp = Number.isFinite(Number(amplitude)) ? Number(amplitude) : 1;
  const u = () => rand() * 2 - 1; // uniform [-1,1], ALWAYS draws one random

  const macro = { ...genome.macro };
  const hierarchy = { ...genome.hierarchy };
  const sectionGrammar = genome.sectionGrammar.map((s) => ({ ...s }));
  const authoredMacro = family.macro || {};
  const authoredSplit = Number.isFinite(authoredMacro.splitRatio) ? authoredMacro.splitRatio : 0.5;
  const requiredContent = family.requiredContent || [];
  const optionalSections = family.optionalSections || [];
  const swappableAdjacent = family.swappableAdjacent || [];

  // ── 1. macro.splitRatio — ±0.06·amp, clamp [0.34,0.78], never cross 0.5 if authored≠0.5 ──────
  {
    const draw = u();
    let v = macro.splitRatio + draw * 0.06 * amp;
    v = clampRange(v, 0.34, 0.78);
    if (authoredSplit !== 0.5) {
      const sameSide = (x) => (x - 0.5) * (authoredSplit - 0.5) >= 0;
      if (!sameSide(v)) v = 0.5 + Math.sign(authoredSplit - 0.5) * 0.001;
    }
    macro.splitRatio = round(v, 4);
  }

  // ── 2. macro.whitespace — ±0.08·amp, clamp [0.2,0.85], |ws-(1-density)|≤0.35 ──────────────────
  {
    const draw = u();
    let v = macro.whitespace + draw * 0.08 * amp;
    v = clampRange(v, 0.2, 0.85);
    const density = Number.isFinite(macro.contentDensity) ? macro.contentDensity : 0.5;
    const target = 1 - density;
    if (Math.abs(v - target) > 0.35) v = target + Math.sign(v - target) * 0.35;
    v = clampRange(v, 0.2, 0.85);
    macro.whitespace = round(v, 4);
  }

  // ── 3. macro.contentWidthShare — ±0.05·amp, clamp [0.6,1.0]; TOOL_KINDS floor 0.9 ─────────────
  {
    const draw = u();
    let v = macro.contentWidthShare + draw * 0.05 * amp;
    const floor = TOOL_KINDS.has(family.pageKind) ? 0.9 : 0.6;
    v = clampRange(v, floor, 1.0);
    macro.contentWidthShare = round(v, 4);
  }

  // ── 4. macro.columnCount — ±1 step, p=0.3, only if authored∈[2,6]; never land on 1 or 12 ──────
  {
    const gate = rand();      // ALWAYS draws the p-gate
    const dir = rand();       // ALWAYS draws the direction, even if the gate/eligibility fails
    const authoredCols = authoredMacro.columnCount;
    const eligible = Number.isFinite(authoredCols) && authoredCols >= 2 && authoredCols <= 6;
    if (eligible && gate < 0.3) {
      const step = dir < 0.5 ? -1 : 1;
      let v = macro.columnCount + step;
      if (v === 1 || v === 12 || v < 1) v = macro.columnCount; // regime extremes load-bearing
      macro.columnCount = v;
    }
  }

  // ── 5. sectionGrammar[].heightShare — ×(1+u·0.18·amp) per section, renormalize Σ=1 ────────────
  // nav/footer excluded; no share<0.04; nav≤0.10; footer≤0.18; hero keeps max non-footer share if
  // it had it; hero within [0.6×,1.5×] authored.
  {
    const authoredByRole = new Map(family.sectionGrammar.map((s) => [s.role, s.heightShare]));
    const nonFooterMax = family.sectionGrammar
      .filter((s) => s.role !== "footer")
      .reduce((m, s) => Math.max(m, s.heightShare), 0);
    const heroHadMax = family.sectionGrammar.some((s) => s.role === "hero" && s.heightShare === nonFooterMax);

    const draws = sectionGrammar.map(() => u()); // ALWAYS one draw per section, fixed order
    sectionGrammar.forEach((s, i) => {
      if (s.role === "nav" || s.role === "footer") return; // excluded from the jitter itself
      const factor = 1 + draws[i] * 0.18 * amp;
      let v = Math.max(0.04, s.heightShare * factor);
      const authored = authoredByRole.get(s.role);
      if (s.role === "hero" && Number.isFinite(authored)) {
        v = clampRange(v, authored * 0.6, authored * 1.5);
      }
      s.heightShare = v;
    });
    // gates on the untouched roles
    for (const s of sectionGrammar) {
      if (s.role === "nav") s.heightShare = Math.min(s.heightShare, 0.10);
      if (s.role === "footer") s.heightShare = Math.min(s.heightShare, 0.18);
    }
    if (heroHadMax) {
      const hero = sectionGrammar.find((s) => s.role === "hero");
      if (hero) {
        const otherMax = sectionGrammar
          .filter((s) => s.role !== "footer" && s.role !== "hero")
          .reduce((m, s) => Math.max(m, s.heightShare), 0);
        if (hero.heightShare < otherMax) hero.heightShare = otherMax + 0.001;
      }
    }
    renormalize(sectionGrammar);
  }

  // ── 6. Optional-section drop — drop ONE role from optionalSections, p=0.35 ─────────────────────
  // never role implied by requiredContent; never canonical nav/hero/cta/footer; renormalize.
  {
    const gate = rand();          // ALWAYS draws the p-gate
    const pick = rand();          // ALWAYS draws the index-pick random, even with 0/1 candidates
    const candidates = optionalSections.filter((role) => {
      if (!sectionGrammar.some((s) => s.role === role)) return false;
      if (isProtectedRole(role)) return false;
      if (impliedByRequiredContent(role, requiredContent)) return false;
      return true;
    });
    if (gate < 0.35 && candidates.length && sectionGrammar.length - 1 >= 3) {
      const idx = Math.min(candidates.length - 1, Math.floor(pick * candidates.length));
      const dropRole = candidates[idx];
      const i = sectionGrammar.findIndex((s) => s.role === dropRole);
      if (i >= 0) {
        sectionGrammar.splice(i, 1);
        renormalize(sectionGrammar);
      }
    }
  }

  // ── 7. Adjacent-order swap — swap ONE pair from swappableAdjacent, p=0.3 ────────────────────────
  // nav first, footer last, hero before non-nav — only swaps a human editor would accept.
  {
    const gate = rand();
    const pick = rand();
    const candidates = swappableAdjacent.filter(([a, b]) => {
      const ia = sectionGrammar.findIndex((s) => s.role === a);
      const ib = sectionGrammar.findIndex((s) => s.role === b);
      if (ia < 0 || ib < 0 || Math.abs(ia - ib) !== 1) return false; // must still be adjacent
      const lo = Math.min(ia, ib);
      if (lo === 0 && sectionGrammar[0].role !== "nav") { /* fine — nav isn't in this pair anyway */ }
      // nav must stay first, footer must stay last, hero must stay before any non-nav section:
      const wouldBreakNavFirst = (ia === 0 && sectionGrammar[0].role === "nav") || (ib === 0 && sectionGrammar[0].role === "nav");
      const lastIdx = sectionGrammar.length - 1;
      const wouldBreakFooterLast = (ia === lastIdx && sectionGrammar[lastIdx].role === "footer") || (ib === lastIdx && sectionGrammar[lastIdx].role === "footer");
      const heroIdx = sectionGrammar.findIndex((s) => s.role === "hero");
      const wouldBreakHeroPos = heroIdx >= 0 && (ia === heroIdx || ib === heroIdx) && Math.min(ia, ib) > 0 && heroIdx === Math.min(ia, ib);
      // moving hero later (swapping it with the section right after it) breaks "hero before
      // non-nav" only if hero would land AFTER something that used to follow it — i.e. any swap
      // that moves hero's index up is disallowed.
      if (wouldBreakNavFirst || wouldBreakFooterLast) return false;
      if (heroIdx >= 0 && (ia === heroIdx || ib === heroIdx)) return false; // never move hero itself
      return true;
    });
    if (gate < 0.3 && candidates.length) {
      const idx = Math.min(candidates.length - 1, Math.floor(pick * candidates.length));
      const [a, b] = candidates[idx];
      const ia = sectionGrammar.findIndex((s) => s.role === a);
      const ib = sectionGrammar.findIndex((s) => s.role === b);
      [sectionGrammar[ia], sectionGrammar[ib]] = [sectionGrammar[ib], sectionGrammar[ia]];
    }
  }

  // ── 8. focalPoint of ONE mid section — rotate {left,center,right}, p=0.3; never hero/nav/footer ─
  {
    const gate = rand();
    const pick = rand();
    const rotate = rand();
    const midCandidates = sectionGrammar.filter((s) => !isProtectedRole(s.role));
    if (gate < 0.3 && midCandidates.length) {
      const idx = Math.min(midCandidates.length - 1, Math.floor(pick * midCandidates.length));
      const target = midCandidates[idx];
      const curr = FOCAL_ROTATE.indexOf(target.focalPoint);
      const step = rotate < 0.5 ? 1 : -1;
      const next = ((curr >= 0 ? curr : 0) + step + FOCAL_ROTATE.length) % FOCAL_ROTATE.length;
      target.focalPoint = FOCAL_ROTATE[next];
    }
  }

  // ── 9. hierarchy.headingScaleRatio — ±0.25·amp, clamp [1.4,3.8], floor 1.35 ─────────────────────
  {
    const draw = u();
    let v = hierarchy.headingScaleRatio + draw * 0.25 * amp;
    v = Math.max(1.35, clampRange(v, 1.4, 3.8));
    hierarchy.headingScaleRatio = round(v, 3);
  }

  // ── 10. hierarchy.focalAreaShare/ctaProminence — ±0.04 / ±0.08, existing clamps ────────────────
  {
    const draw1 = u();
    const draw2 = u();
    hierarchy.focalAreaShare = round(clampRange(hierarchy.focalAreaShare + draw1 * 0.04 * amp, 0.1, 0.5), 3);
    hierarchy.ctaProminence = round(clampRange(hierarchy.ctaProminence + draw2 * 0.08 * amp, 0.2, 0.95), 3);
  }

  // ── 11. Dark-band inversion — mark 0-2 sections surface:"inverted"; never nav; never adjacent ──
  {
    const countRoll = rand();
    const pickA = rand();
    const pickB = rand();
    const eligible = sectionGrammar.filter((s) => s.role !== "nav");
    let n = countRoll < 0.5 ? 0 : countRoll < 0.85 ? 1 : 2;
    n = Math.min(n, eligible.length);
    const chosen = [];
    if (n >= 1 && eligible.length) {
      const idxA = Math.min(eligible.length - 1, Math.floor(pickA * eligible.length));
      chosen.push(eligible[idxA]);
    }
    if (n >= 2 && eligible.length > 1) {
      const globalIdxOf = (s) => sectionGrammar.indexOf(s);
      const forbidden = new Set();
      for (const c of chosen) {
        const gi = globalIdxOf(c);
        forbidden.add(gi - 1); forbidden.add(gi); forbidden.add(gi + 1);
      }
      const remaining = eligible.filter((s) => !forbidden.has(globalIdxOf(s)));
      if (remaining.length) {
        const idxB = Math.min(remaining.length - 1, Math.floor(pickB * remaining.length));
        chosen.push(remaining[idxB]);
      }
    }
    for (const s of sectionGrammar) delete s.surface; // start clean each perturb (pure fn of input)
    for (const c of chosen) {
      const target = sectionGrammar.find((s) => s.role === c.role);
      if (target) target.surface = "inverted";
    }
  }

  // ── 12. macro.grid.gutterShare/outerMarginShare — ±20% rel; gutterShare clamp [0.01,0.05] ──────
  {
    const draw1 = u();
    const draw2 = u();
    const grid = { ...(macro.grid || { gutterShare: 0.02, outerMarginShare: 0.06 }) };
    grid.gutterShare = round(clampRange(grid.gutterShare * (1 + draw1 * 0.2 * amp), 0.01, 0.05), 4);
    grid.outerMarginShare = round(Math.max(0.01, grid.outerMarginShare * (1 + draw2 * 0.2 * amp)), 4);
    macro.grid = grid;
  }

  return {
    ...genome,
    macro,
    hierarchy,
    sectionGrammar,
    quality: { ...genome.quality, provenance: [...(genome.quality?.provenance || []), "perturbed"] },
  };
}

function renormalize(sectionGrammar) {
  const sum = sectionGrammar.reduce((a, s) => a + s.heightShare, 0);
  if (!Number.isFinite(sum) || sum <= 0) return;
  for (const s of sectionGrammar) s.heightShare = round(s.heightShare / sum, 5);
  // fix any rounding drift on the largest section so Σ stays ~1
  const drift = 1 - sectionGrammar.reduce((a, s) => a + s.heightShare, 0);
  if (Math.abs(drift) > 1e-9) {
    let biggest = sectionGrammar[0];
    for (const s of sectionGrammar) if (s.heightShare > biggest.heightShare) biggest = s;
    biggest.heightShare = round(biggest.heightShare + drift, 5);
  }
}

// ── validatePerturbed — re-check every gate; bounded reroll (§2). Never throws. ───────────────
const NEVER_PERTURBED_INVARIANTS = (base, candidate) =>
  base.pageKind === candidate.pageKind
  && base.responsive?.mobileTransform === candidate.responsive?.mobileTransform;

function sectionsValid(genome, family) {
  const sg = genome.sectionGrammar;
  if (!sg.length) return false;
  const sum = sg.reduce((a, s) => a + s.heightShare, 0);
  if (Math.abs(sum - 1) > 0.01) return false;
  for (const s of sg) {
    if (!(s.heightShare >= 0.04 - 1e-6)) return false;
    if (s.role === "nav" && s.heightShare > 0.10 + 1e-6) return false;
    if (s.role === "footer" && s.heightShare > 0.18 + 1e-6) return false;
  }
  // nav first / footer last preserved if present in the base family
  const baseRoles = family.sectionGrammar.map((s) => s.role);
  if (baseRoles[0] === "nav" && sg[0]?.role !== "nav") return false;
  if (baseRoles[baseRoles.length - 1] === "footer" && sg[sg.length - 1]?.role !== "footer") return false;
  // no two adjacent inverted sections; nav never inverted
  for (let i = 0; i < sg.length; i++) {
    if (sg[i].surface === "inverted") {
      if (sg[i].role === "nav") return false;
      if (i > 0 && sg[i - 1].surface === "inverted") return false;
      if (i < sg.length - 1 && sg[i + 1].surface === "inverted") return false;
    }
  }
  return true;
}

function macroValid(genome, family) {
  const m = genome.macro;
  if (m.splitRatio < 0.34 - 1e-6 || m.splitRatio > 0.78 + 1e-6) return false;
  const authoredSplit = family.macro?.splitRatio;
  if (Number.isFinite(authoredSplit) && authoredSplit !== 0.5) {
    const sameSide = (m.splitRatio - 0.5) * (authoredSplit - 0.5) >= 0;
    if (!sameSide) return false;
  }
  if (m.whitespace < 0.2 - 1e-6 || m.whitespace > 0.85 + 1e-6) return false;
  if (Math.abs(m.whitespace - (1 - m.contentDensity)) > 0.35 + 1e-6) return false;
  const floor = TOOL_KINDS.has(family.pageKind) ? 0.9 : 0.6;
  if (m.contentWidthShare < floor - 1e-6 || m.contentWidthShare > 1.0 + 1e-6) return false;
  const authoredCols = family.macro?.columnCount;
  if (m.columnCount === 1 && authoredCols !== 1) return false;
  if (m.columnCount === 12 && authoredCols !== 12) return false;
  if (m.grid) {
    if (m.grid.gutterShare < 0.01 - 1e-6 || m.grid.gutterShare > 0.05 + 1e-6) return false;
  }
  return true;
}

function hierarchyValid(genome) {
  const h = genome.hierarchy;
  if (h.focalAreaShare < 0.1 - 1e-6 || h.focalAreaShare > 0.5 + 1e-6) return false;
  if (h.headingScaleRatio < 1.35 - 1e-6 || h.headingScaleRatio > 3.8 + 1e-6) return false;
  if (h.ctaProminence < 0.2 - 1e-6 || h.ctaProminence > 0.95 + 1e-6) return false;
  return true;
}

/**
 * validatePerturbed(genome, family, base) → { ok, genome } — checks §2's dial-coherence + gates.
 * `base` (optional) is the unperturbed genome, used only for the pageKind/mobileTransform
 * never-perturbed invariant check; if omitted that check is skipped (still safe — those fields
 * are never touched by perturbGenome).
 */
export function validatePerturbed(genome, family, base = null) {
  const ok = sectionsValid(genome, family) && macroValid(genome, family) && hierarchyValid(genome)
    && (base ? NEVER_PERTURBED_INVARIANTS(base, genome) : true);
  return { ok: !!ok, genome };
}

/**
 * perturbAndValidate(baseGenome, family, streamSeedBase, iv, amplitude, {rerollFrom=0}) →
 * perturbed+validated genome. Wraps perturbGenome+validatePerturbed with the §2 bounded reroll:
 * redraw with rerollCount+1 (new streamSeed per §2's `...:${rerollCount}` contract) up to 4
 * times, then fall back to the unperturbed base genome — NEVER throws.
 * `streamSeedFor(rerollCount)` is a caller-supplied fn (family.mjs derives it via hashToUint32 so
 * the reroll salt lives with the seed derivation, per spec §2/§4, not duplicated here).
 */
export function perturbAndValidate(baseGenome, family, streamSeedFor, iv, amplitude = 1) {
  if (amplitude <= 0) return baseGenome; // no-seed / amplitude-0 path — byte-identical passthrough
  for (let reroll = 0; reroll <= 4; reroll++) {
    if (reroll === 4) return baseGenome; // bounded reroll exhausted — return unperturbed base
    const seed = streamSeedFor(reroll);
    const candidate = perturbGenome(baseGenome, family, seed, iv, amplitude);
    const { ok, genome } = validatePerturbed(candidate, family, baseGenome);
    if (ok) return genome;
  }
  return baseGenome;
}
