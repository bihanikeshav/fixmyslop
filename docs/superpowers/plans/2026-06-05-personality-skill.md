# /personality Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single Claude Code skill, `/personality`, that makes a model invent page-specific personality inside anti-slop constraints — a forced ideation process + a personality-move catalog + a merged slop manifest + researched craft guardrails + per-vibe type/color option-sets grounded in this repo's font data.

**Architecture:** A self-contained skill at `skills/personality/` (markdown + `reference/` sidecars, the same shape impeccable uses). Prose files are authored and committed. The data-backed files (`reference/type-and-color.md` + a `.json` sidecar, plus an injected "data tells" block in the slop manifest) are emitted by a generator `scripts/build-personality-skill.mjs` that reads `data/*.json`. A vitest guard validates structure and the no-self-contradiction invariant.

**Tech Stack:** Markdown (the skill), Node ESM `.mjs` (generator, matching `scripts/build-hybrid-neighbors.mjs`), vitest (`packages/pipeline`), web research tools (deep-research pass for craft principles).

**Note on TDD scope:** Most of this skill is authored prose — the deliverable's substance, not code. Those tasks ship complete content (no placeholders) and are guarded by the structural test, not unit tests. Strict red-green TDD applies to the **generator + verification test** (Tasks 5–6), ordered test-first.

**Branch:** Work continues on `personality-skill` (already created; the spec commit is there).

---

## File Structure

- Create: `skills/personality/SKILL.md` — the skill entry point (process, slop test, pointers). Tight.
- Create: `skills/personality/reference/personality-moves.md` — catalog of signature-move *types*.
- Create: `skills/personality/reference/slop-manifest.md` — merged anti-patterns (prose) + a generated data-tells block between markers.
- Create: `skills/personality/reference/craft-principles.md` — researched, cited craft DO/DON'Ts.
- Create (generated): `skills/personality/reference/type-and-color.md` — per-vibe AVOID + fresh option-sets.
- Create (generated): `skills/personality/reference/type-and-color.json` — machine-readable sidecar for the test.
- Create: `scripts/build-personality-skill.mjs` — the generator.
- Create: `packages/pipeline/src/personality-skill.test.ts` — structural + invariant guard.
- Create: `viz/personality-demo/archetype-slop.html`, `viz/personality-demo/personality.html`, `viz/personality-demo/README.md` — the before→after proof.
- Modify: project `README.md` (add a pointer) and the memory index (new memory file).

---

## Task 1: Scaffold the skill entry point (`SKILL.md`)

**Files:**
- Create: `skills/personality/SKILL.md`

- [ ] **Step 1: Create the file with this exact content**

```markdown
---
name: personality
description: Give a web page real, page-specific personality. Use when building a site/page/component and you want output that is distinctly itself, not generic AI aesthetics. Forces an ideation phase that invents a signature element grounded in the page's subject, inside anti-slop constraints.
license: Apache-2.0. Slop taxonomy adapted from impeccable.style and Anthropic's frontend-design skill; see reference/slop-manifest.md for attribution.
---

This skill makes you *design*, not decorate. The failure mode it fixes: fed the
right fonts and colors, a model still ships something that "feels off" — correct
but characterless. Character does not come from turning up randomness. It comes
from a process. Follow it.

> **Spend thinking budget here.** Before coding, raise effort or use `ultrathink`.
> Temperature is not the lever; deliberate ideation is.

## The Process (do this before any code)

1. **Absorb.** What is this page *about*? Who is it for? List 8–12 concrete nouns,
   metaphors, materials, rituals, or in-jokes from the subject's actual world.
   (A cat-lover's portfolio → cats, naps, yarn, 3am, whiskers, a light switch.)
2. **Diverge.** Brainstorm ~15 candidate "personality concepts," each tying ONE
   noun/metaphor from step 1 to a specific UI moment. Go wide and cheap. Do not
   stop at 3. (See `reference/personality-moves.md` for *types* of moves to riff on.)
3. **Ground & commit.** Critique the 15. Pick ONE cohesive direction with 2–3
   signature elements that reinforce each other. Write down the single thing a
   visitor will remember.
4. **Constrain.** Re-read `reference/slop-manifest.md` and name the specific
   defaults you are forbidding yourself on this build (e.g. "no gradient text, no
   pill CTA, no centered hero, not Inter").
5. **Build.** Now write production code, executing `reference/craft-principles.md`
   and choosing type/color from `reference/type-and-color.md`.

## Personality ≠ slop

The slop manifest flags "amateurish hand-drawn SVG" and "image hover transform."
Your cat animation and dashed pointer line are also hand-drawn SVG. The difference
is **specificity + craft + load-bearing intent**, not the technique. A generic
doodle is slop; a doodle that *is the concept of the page* is personality. Craft
the move; make it earn its place; never default to it.

## The AI-slop test

When you think you're done: *"If I showed this to someone and said an AI made it,
would they instantly believe me?"* If yes, that's the problem. A distinctive
interface makes people ask "how was this made?", not "which AI made this?"

## References
- `reference/personality-moves.md` — types of signature moves to instantiate.
- `reference/slop-manifest.md` — the anti-patterns (your constraints) + the data behind them.
- `reference/craft-principles.md` — spacing, hierarchy, contrast, motion so distinctive ≠ broken.
- `reference/type-and-color.md` — fonts/palettes: what to avoid, what to pick from (rotate; never default).
```

- [ ] **Step 2: Verify the file is well-formed**

Run: `node -e "const f=require('fs').readFileSync('skills/personality/SKILL.md','utf8'); if(!/^---[\s\S]*name: personality[\s\S]*---/.test(f)) throw new Error('frontmatter missing'); if(!f.includes('## The Process')) throw new Error('process missing'); console.log('ok, '+f.length+' chars')"`
Expected: `ok, <n> chars`

- [ ] **Step 3: Commit**

```bash
git add skills/personality/SKILL.md
git commit -m "Add /personality skill entry point (process + slop test)"
```

---

## Task 2: Author the personality-move catalog

**Files:**
- Create: `skills/personality/reference/personality-moves.md`

- [ ] **Step 1: Create the file with this exact content**

```markdown
# Personality moves

Not designs to copy — *types* of signature moves. In step 2 of the process, riff
on these and instantiate them from THIS page's subject (step 1 nouns). Pick one
primary move plus 1–2 supporting; more than 3 fights itself.

For each move: what it is · when it earns its place · how to keep it craft, not doodle.

1. **Physical-object metaphor for a control.** A real object stands in for a UI
   control (a pull-chain that toggles theme, a dial that filters). Earns its place
   when the object belongs to the subject's world. Craft: real easing, real
   affordance, a sound or wobble — not a flat icon.
2. **A mascot/character with a reason to exist.** A small creature or avatar tied
   to the brand's story, reacting to state. Earns it when it carries meaning
   (guides, reacts, celebrates), not as filler. Craft: a few intentional poses,
   consistent line weight; never a generic stock blob.
3. **Hand-annotation / marginalia.** Dashed pointer lines, circled words, arrows,
   sticky notes that explain or wink. Earns it when it adds a human voice over the
   layout. Craft: consistent stroke, slight irregularity, points at something real.
4. **A cursor that means something.** Custom cursor that changes by context
   (a magnet over draggables, a brush in the gallery). Earns it when it signals
   affordance. Craft: subtle, fast, never a laggy gimmick.
5. **A signature page-load gesture.** ONE orchestrated entrance (a staggered
   reveal, a curtain, a typewriter wordmark). Earns it as the first impression.
   Craft: one well-timed sequence beats scattered micro-animations.
6. **A subject-tied easter egg.** A hidden reaction to a real action (Konami code,
   long-press, scroll-to-bottom payoff). Earns it as delight for the curious.
   Craft: rewards exploration, never blocks the main path.
7. **A tactile / skeuomorphic control.** A toggle, knob, or switch with real
   weight and feedback. Earns it when the metaphor clarifies the action. Craft:
   physical motion + state that's obvious at a glance.
8. **Ambient motion tied to the theme.** Background life that reflects the subject
   (drifting particles for a space brand, a slow tide). Earns it when it sets mood.
   Craft: low contrast, respects `prefers-reduced-motion`, never competes with content.
9. **A deliberately "wrong" choice, owned.** Break a rule on purpose with
   confidence (a hero that's mostly empty, type that runs off-canvas, a brutal
   palette). Earns it when the break IS the statement. Craft: intentional and
   consistent, not an accident.
10. **Type-as-image.** The wordmark or headline *is* the hero illustration —
    sculpted, animated, or arranged so the letters carry the concept. Earns it
    when the words are the strongest visual. Craft: real typographic care, custom
    spacing, not a filter on a default font.

If a chosen move appears in the slop manifest (e.g. hand-drawn SVG, image hover),
that is allowed — but only when it is specific, crafted, and load-bearing per the
"Personality ≠ slop" rule. Generic instances are still slop.
```

- [ ] **Step 2: Verify**

Run: `node -e "const f=require('fs').readFileSync('skills/personality/reference/personality-moves.md','utf8'); if((f.match(/^\d+\. \*\*/gm)||[]).length<10) throw new Error('need >=10 moves'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add skills/personality/reference/personality-moves.md
git commit -m "Add personality-move catalog"
```

---

## Task 3: Author the slop manifest (prose + generated-block markers)

**Files:**
- Create: `skills/personality/reference/slop-manifest.md`

This is the merged anti-pattern taxonomy (impeccable.style's 49 rules + frontend-design DON'Ts). It ends with empty generator markers; Task 6 fills the data-tells block between them.

- [ ] **Step 1: Create the file with this exact content**

```markdown
# Slop manifest

The fingerprints of AI-generated UIs (2024–2025). In step 4 of the process, turn
the relevant ones into hard constraints for your build. Sources: the public
taxonomy at impeccable.style/slop (49 rules), the DON'Ts in Anthropic's and
impeccable's frontend-design skills, and this repo's own measured signal (the
generated block at the bottom). uupm.cc (UI/UX Pro Max) is cited as corroboration:
even a popular design database defaults to these (its SaaS palette is #2563EB, its
Micro-SaaS palette indigo #6366F1, its first pairings Inter/Poppins/Open Sans) —
which is exactly why they read as generic.

## Typography
- Flat hierarchy — sizes too close; no clear order.
- Icon tile stacked above every heading — the universal AI feature-card template.
- Oversized italic serif hero headline — the universal AI-startup hero.
- Hero eyebrow / pill chip — tiny uppercase tracked label above a giant headline.
- Repeated section kicker labels — tracked uppercase labels above every section.
- Oversized hero headline that eats the whole viewport.
- Crushed letter spacing past where glyphs keep their shape.
- Overused fonts — Inter, Geist, Space Grotesk, Instrument Serif feel generic now.
- One font for the entire page.
- All-caps body text (we read by word shape; caps removes it).

## Color & contrast
- The AI palette — purple/violet gradients, cyan-on-dark.
- Dark mode with glowing colored box-shadow accents as the default "cool" look.
- Gradient text on headings/metrics — decorative, not meaningful.
- Gray text on colored backgrounds — washed out; use a shade of the bg.
- Cream/beige "tasteful" page background reached for by reflex.
- Pure #000 / #fff — always tint; they don't occur in nature.

## Layout & space
- Hero metric layout — big number, small label, three stats, gradient accent.
- Identical card grids — same-size icon+heading+text cards, endlessly.
- Monotonous spacing — one value everywhere; no rhythm.
- Nested cards (cards inside cards).
- Numbered section markers (01 / 02 / 03) as editorial scaffolding.
- Line length over ~80 characters.
- Centering everything — left-aligned + asymmetry reads more designed.
- Wrapping everything in a card; not everything needs a container.

## Visual details
- Glassmorphism everywhere — blur/glass/glow as decoration, not layering.
- Thick accent border on one side of a rounded card — the most recognizable tell.
- Hairline border + wide diffuse shadow ("ghost card").
- Repeating-gradient stripes as surface decoration.
- Extreme border-radius (24px+ on a small card) — everything becomes a soft blob.
- Rounded rectangles with generic drop shadows — safe, forgettable.
- Sparklines / tiny charts as decoration that convey nothing.
- Modals when anything else would do.

## Motion
- Bounce/elastic easing — dated; use ease-out-quart/quint/expo.
- Animating layout props (width/height/padding/margin) — jank; use transform/opacity.
- Image hover scale/rotate — a recurring generated-UI signature.

## Copy
- Em-dash overuse in body copy.
- Marketing buzzwords — streamline, empower, supercharge, world-class, enterprise-grade.
- Aphoristic manufactured-contrast cadence ("It's not X. It's Y.").
- "Theater" framing as a dismissive tic.

## General quality (these are bugs, not style)
- Cramped padding / text touching the container or viewport edge.
- Justified text without hyphenation (rivers of white).
- Contrast below WCAG AA (4.5:1 body, 3:1 large).
- Skipped heading levels (h1→h3).
- Line-height below 1.3 (use 1.5–1.7 for body).
- Body text below 14px (16px ideal).
- Letter-spacing above 0.05em on body text.
- Broken/placeholder images shipping as broken boxes.

## The AI-slop test
If someone would instantly believe "an AI made this," it's slop. Aim for "how was
this made?"

<!-- GENERATED:data-tells:start -->
<!-- (populated by scripts/build-personality-skill.mjs) -->
<!-- GENERATED:data-tells:end -->
```

- [ ] **Step 2: Verify markers present**

Run: `node -e "const f=require('fs').readFileSync('skills/personality/reference/slop-manifest.md','utf8'); if(!f.includes('GENERATED:data-tells:start')||!f.includes('GENERATED:data-tells:end')) throw new Error('markers missing'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add skills/personality/reference/slop-manifest.md
git commit -m "Add slop manifest (merged anti-patterns + generator markers)"
```

---

## Task 4: Research pass → craft principles (cited)

**Files:**
- Create: `skills/personality/reference/craft-principles.md`

This is a real research task, not a placeholder. The executor gathers craft rules from named practitioner sources and distills them into terse, cited DO/DON'T lines.

- [ ] **Step 1: Run a focused research pass**

Use the `deep-research` skill if available, otherwise WebSearch + WebFetch directly. Cover these sources and pull concrete, defensible craft rules (spacing, hierarchy, type scale, contrast, line length/height, motion easing, restraint):
- Refactoring UI (Adam Wathan / Steve Schoger) — spacing, hierarchy via weight/color not size, start-with-too-much-whitespace.
- Linear design writing / changelog — motion conveys state; restraint; density.
- Vercel / Geist design system notes — type scale, neutral tinting.
- Stripe / Anthropic design writing where relevant.
- Practical type: a modular scale + fluid `clamp()`; ~45–75ch measure; 1.5–1.7 body line-height.

Capture the source (name + URL) for each rule you keep.

- [ ] **Step 2: Write `craft-principles.md` in this format**

Each principle is one terse line tagged with a bracketed source. Target 18–25 principles across the categories. Structure:

```markdown
# Craft principles

Distilled from practitioner sources (see Sources). These keep a distinctive design
from becoming a broken one. Apply in step 5 (Build).

## Hierarchy
- Establish hierarchy with weight, size, and color — not size alone. [Refactoring UI]
- ...

## Spacing & rhythm
- Start with too much whitespace, then remove. [Refactoring UI]
- Vary spacing to group related things; equal spacing everywhere reads flat. [Refactoring UI]
- ...

## Type
- Use a modular scale with fluid clamp() sizing. [Vercel/Geist]
- Keep measure ~45–75 characters; 1.5–1.7 line-height for body. [practical typography]
- ...

## Color
- Tint neutrals toward the brand hue for subconscious cohesion. [frontend-design]
- ...

## Motion
- Motion should convey a state change, not decorate. [Linear]
- Use exponential ease-out; avoid bounce/elastic on UI. [frontend-design]
- ...

## Restraint
- Match implementation complexity to the aesthetic; minimalism needs precision. [frontend-design]
- ...

## Sources
- Refactoring UI — https://www.refactoringui.com/
- Linear — <url>
- Vercel Geist — <url>
- ... (every bracket tag above must resolve to an entry here)
```

**Acceptance:** every principle has a bracketed source tag; every tag appears in Sources; ≥18 principles; no empty sections.

- [ ] **Step 3: Verify**

Run: `node -e "const f=require('fs').readFileSync('skills/personality/reference/craft-principles.md','utf8'); const bullets=(f.match(/^- /gm)||[]).length; if(bullets<18) throw new Error('need >=18 lines, got '+bullets); if(!/## Sources/.test(f)) throw new Error('no Sources'); console.log('ok, '+bullets+' lines')"`
Expected: `ok, <n> lines`

- [ ] **Step 4: Commit**

```bash
git add skills/personality/reference/craft-principles.md
git commit -m "Add researched, cited craft principles"
```

---

## Task 5: Write the failing verification test

**Files:**
- Create: `packages/pipeline/src/personality-skill.test.ts`

Test-first: this fails now because the generated artifacts (`type-and-color.json`, the filled data-tells block) don't exist yet. Task 6 makes it pass.

- [ ] **Step 1: Confirm the pipeline package runs vitest**

Run: `node -e "const p=require('./packages/pipeline/package.json'); console.log(p.scripts.test||'NO TEST SCRIPT')"`
Expected: prints `vitest run` (if it prints `NO TEST SCRIPT`, add `\"test\": \"vitest run\"` to `packages/pipeline/package.json` scripts and commit that one-line change first).

- [ ] **Step 2: Write the test with this exact content**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");           // packages/pipeline/src -> repo root
const SKILL = resolve(ROOT, "skills/personality");
const read = (p: string) => readFileSync(resolve(SKILL, p), "utf8");
const CUTOFF = 0.4;                                // matches diagnose.ts SLOP_CUTOFF

describe("personality skill", () => {
  it("has a well-formed entry point", () => {
    const s = read("SKILL.md");
    expect(s).toMatch(/name: personality/);
    expect(s).toContain("## The Process");
    expect(s.toLowerCase()).toContain("ai made this");
  });

  it("ships all non-empty reference files", () => {
    for (const f of ["personality-moves.md", "slop-manifest.md", "craft-principles.md", "type-and-color.md"]) {
      expect(existsSync(resolve(SKILL, "reference", f)), `${f} exists`).toBe(true);
      expect(read(`reference/${f}`).trim().length, `${f} non-empty`).toBeGreaterThan(200);
    }
  });

  it("filled the generated data-tells block in the slop manifest", () => {
    const m = read("reference/slop-manifest.md");
    const body = m.split("GENERATED:data-tells:start")[1]?.split("GENERATED:data-tells:end")[0] ?? "";
    expect(body).toMatch(/\d+%/);                   // contains at least one "NN%" stat
  });

  it("never recommends a saturated font (no self-contradiction)", () => {
    const data = JSON.parse(read("reference/type-and-color.json"));
    const picks = Object.values(data.freshByCat as Record<string, Array<{ family: string; sat: number }>>).flat();
    expect(picks.length).toBeGreaterThan(10);
    for (const p of picks) expect(p.sat, `${p.family} must be fresh`).toBeLessThan(CUTOFF);
    for (const a of data.avoidFonts as Array<{ family: string; sat: number }>) {
      expect(a.sat, `${a.family} must be saturated`).toBeGreaterThanOrEqual(CUTOFF);
    }
  });
});
```

- [ ] **Step 3: Run the test and verify it FAILS**

Run: `npm run test -w @fixmyslop/pipeline`
Expected: FAIL — `type-and-color.md`/`type-and-color.json` missing and the data-tells block has no `%` stat yet.

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline/src/personality-skill.test.ts
git commit -m "Add failing verification test for /personality skill"
```

---

## Task 6: Build the generator (makes the test pass)

**Files:**
- Create: `scripts/build-personality-skill.mjs`
- Modifies on run: `skills/personality/reference/type-and-color.md`, `skills/personality/reference/type-and-color.json`, and the data-tells block in `skills/personality/reference/slop-manifest.md`

- [ ] **Step 1: Create the generator with this exact content**

```javascript
// Generate the data-backed parts of the /personality skill from this repo's
// font data: per-vibe AVOID + fresh option-sets (type-and-color.md/.json) and the
// "data tells" block injected into reference/slop-manifest.md. Re-run after data changes.
//   node scripts/build-personality-skill.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DATA = resolve(ROOT, "data");
const REF = resolve(ROOT, "skills/personality/reference");
const CUTOFF = 0.4;          // matches diagnose.ts SLOP_CUTOFF
const FRESH = 0.12;          // "fresh" = clearly under-used
const read = async (f) => JSON.parse(await readFile(resolve(DATA, f), "utf8"));

const index = await read("fonts.index.json");
const sat = await read("saturation.json");
const paletteSlop = (await read("palette-slop.json")).summary ?? [];
const escapes = (await read("escape-directions.json")).runs ?? [];
let crawl = [];
try { crawl = await read("crawl-profiles.json"); } catch { /* optional */ }

const byId = new Map(index.map((f) => [f.id, f]));
const famById = (id) => byId.get(id)?.family ?? id;
const displaySat = new Map(sat.map((s) => [s.fontId, s.display ?? 0]));

// --- AVOID fonts: most display-saturated, family-named ---
const avoidFonts = [...sat]
  .filter((s) => (s.display ?? 0) >= CUTOFF)
  .sort((a, b) => (b.display ?? 0) - (a.display ?? 0))
  .slice(0, 24)
  .map((s) => ({ id: s.fontId, family: famById(s.fontId), sat: +(s.display ?? 0).toFixed(2) }));

// --- Fresh pool by category (the option-sets the model picks from) ---
const CATS = ["serif", "sans-serif", "display", "monospace", "handwriting"];
const freshByCat = {};
for (const c of CATS) {
  freshByCat[c] = index
    .filter((f) => f.category === c && (displaySat.get(f.id) ?? 0) < FRESH)
    // indie (non-google) first, then alphabetical — surfaces escape-the-default options
    .map((f) => ({ family: f.family, supplier: f.supplier ?? "google", sat: +(displaySat.get(f.id) ?? 0).toFixed(2) }))
    .sort((a, b) => (a.supplier === "google") - (b.supplier === "google") || a.family.localeCompare(b.family))
    .slice(0, 14);
}

// --- Per-intent fresh DIRECTIONS from the escape runs ---
const intents = [...new Set(escapes.map((r) => r.intent))];
const directions = intents.map((intent) => ({
  intent,
  options: escapes
    .filter((r) => r.intent === intent)
    .map((r) => ({ heading: r.headingFont, body: r.bodyFont, accent: r.accentColor, move: r.styleMove })),
}));

// --- Per-vibe AVOID palettes ---
const avoidPalettes = paletteSlop.map((v) => ({ vibe: v.vibe, slopAccent: v.slopAccent, bg: v.bg, examples: v.examples }));

// --- Data tells from the real crawl ---
const siteCount = crawl.length;
const fontSites = new Map();
for (const p of crawl) {
  const fams = new Set([p.heroFont, p.headingFont, p.bodyFont, ...((p.allFonts ?? []).map((a) => a.family))].filter(Boolean));
  for (const f of fams) fontSites.set(f, (fontSites.get(f) ?? 0) + 1);
}
const topCrawl = [...fontSites.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([f, n]) => ({ font: famById(f), pct: siteCount ? Math.round((100 * n) / siteCount) : 0, n }));

// --- Render type-and-color.md ---
const fmtFresh = (arr) => arr.map((f) => `${f.family}${f.supplier !== "google" ? ` (${f.supplier})` : ""}`).join(", ");
let md = `# Type & color

Generated from this repo's font data. **Rule: pick the option that fits THIS page's
concept; rotate across builds; never default to the first listed; step outside the
set when your concept demands it.** Listing a font here is permission, not a mandate —
defaulting to one of these is how the next Inter is born.

## Fonts to AVOID (over-used / saturated)
${avoidFonts.map((f) => `- ${f.family} — saturation ${f.sat}`).join("\n")}

## Fresh fonts to pick from (under-used; indie marked)
${CATS.map((c) => `- **${c}**: ${fmtFresh(freshByCat[c])}`).join("\n")}

## Fresh directions by intent (heading / body · accent · move)
${directions.map((d) => `### ${d.intent}\n${d.options.map((o) => `- ${o.heading} / ${o.body} · ${o.accent} · ${o.move}`).join("\n")}`).join("\n\n")}

## Palettes to AVOID by vibe
${avoidPalettes.map((p) => `- **${p.vibe}** (${p.bg} bg): ${p.slopAccent} — e.g. ${p.examples}`).join("\n")}
`;
await writeFile(resolve(REF, "type-and-color.md"), md);

// --- Machine-readable sidecar (the test asserts against this) ---
await writeFile(
  resolve(REF, "type-and-color.json"),
  JSON.stringify({ cutoff: CUTOFF, avoidFonts, freshByCat, directions, avoidPalettes, dataTells: { siteCount, topCrawl } }, null, 2),
);

// --- Inject the data-tells block into slop-manifest.md ---
const manifestPath = resolve(REF, "slop-manifest.md");
const manifest = await readFile(manifestPath, "utf8");
const block = `<!-- GENERATED:data-tells:start -->
## Measured tells (this repo's crawl of ${siteCount} AI-built sites)
The fonts most likely to make a site read as generic, by how many crawled sites use them:
${topCrawl.map((t) => `- ${t.font} — ${t.pct}% of sites (${t.n}/${siteCount})`).join("\n")}

Detectors we flag deterministically: AI purple/violet gradient, gradient text,
glassmorphism (backdrop-blur), pill buttons, extreme corner radius, tight hero
tracking, uppercase headings. See packages/crawl/src/style.ts.
<!-- GENERATED:data-tells:end -->`;
const replaced = manifest.replace(/<!-- GENERATED:data-tells:start -->[\s\S]*<!-- GENERATED:data-tells:end -->/, block);
await writeFile(manifestPath, replaced);

console.log(`Wrote type-and-color.md/.json (${avoidFonts.length} avoid, ${CATS.reduce((n, c) => n + freshByCat[c].length, 0)} fresh, ${directions.length} intents) and injected ${topCrawl.length} data tells.`);
```

- [ ] **Step 2: Run the generator**

Run: `node scripts/build-personality-skill.mjs`
Expected: `Wrote type-and-color.md/.json (...) and injected N data tells.`

- [ ] **Step 3: Run the verification test and verify it PASSES**

Run: `npm run test -w @fixmyslop/pipeline`
Expected: PASS (all four `personality skill` tests green, plus the pre-existing pipeline tests).

- [ ] **Step 4: Sanity-check the generated markdown by eye**

Run: `node -e "console.log(require('fs').readFileSync('skills/personality/reference/type-and-color.md','utf8').slice(0,900))"`
Expected: AVOID fonts include Inter/Poppins-type names with saturation ≥0.4; fresh lists are populated and indie-marked.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-personality-skill.mjs skills/personality/reference/type-and-color.md skills/personality/reference/type-and-color.json skills/personality/reference/slop-manifest.md
git commit -m "Generate data-backed type/color sets + inject crawl data tells"
```

---

## Task 7: Before→after proof (`viz/personality-demo/`)

**Files:**
- Create: `viz/personality-demo/archetype-slop.html` — the generic AI hero (the thing we avoid).
- Create: `viz/personality-demo/personality.html` — the same brief run through the process.
- Create: `viz/personality-demo/README.md` — what to look at.

Brief for both: a one-page hero for a fictional subject with obvious personality potential — **"Lighthouse keeper's logbook app."** Same copy intent, two executions.

- [ ] **Step 1: Build `archetype-slop.html`** — deliberately embody the slop manifest: Inter 600, centered oversized headline, pill eyebrow chip, indigo→cyan gradient text on `#0a0a0f`, glassmorphism card, two pill CTAs, identical 3-card icon grid. This is the negative control. Keep it a single self-contained HTML file with inline CSS.

- [ ] **Step 2: Build `personality.html`** — apply the process for the lighthouse subject. Example committed direction (the plan's worked example, not a template to clone): a **rotating-beam** signature page-load gesture; a **pull-cord** that toggles day/night (lamp on/off) as the theme switch (physical-object metaphor); left-aligned asymmetric layout; a non-saturated serif/sans pairing chosen from `type-and-color.md` (NOT Inter); flat deep-sea palette, no gradient text, no glassmorphism. Hand-drawn dashed SVG line annotating the log entry — crafted and load-bearing per "Personality ≠ slop." Single self-contained HTML file. Respect `prefers-reduced-motion`.

- [ ] **Step 3: Write `README.md`**

```markdown
# Personality demo — before → after

Same brief ("Lighthouse keeper's logbook app"), two executions:

- `archetype-slop.html` — the generic AI hero: Inter, centered giant headline,
  pill eyebrow, indigo→cyan gradient text, glassmorphism, identical card grid.
  If you'd believe "an AI made this," that's the point.
- `personality.html` — run through the /personality process: a rotating-beam load
  gesture, a pull-cord day/night switch (physical-object metaphor), asymmetric
  layout, a non-saturated type pairing, flat deep-sea palette, a crafted dashed-SVG
  annotation. The signature element is the thing you remember.

Open both side by side. The point isn't "lighthouse" — it's that personality came
from the subject's own world, inside the anti-slop constraints.
```

- [ ] **Step 4: Verify both files open and differ structurally**

Run: `node -e "const fs=require('fs');const a=fs.readFileSync('viz/personality-demo/archetype-slop.html','utf8');const b=fs.readFileSync('viz/personality-demo/personality.html','utf8');if(!/gradient/i.test(a))throw new Error('slop file should contain a gradient');if(/-gradient\(/.test(b)&&/text/i.test(b))console.warn('check: personality file may have gradient text');if(/inter/i.test(b.match(/font-family[^;]*/i)?.[0]||''))throw new Error('personality file must not use Inter');console.log('ok')"`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add viz/personality-demo
git commit -m "Add before/after demo proving the /personality process changes output"
```

---

## Task 8: Finalize — README pointer, memory, full test run

**Files:**
- Modify: `README.md` (repo root)
- Create: `C:\Users\Keshav\.claude\projects\Z--fixmyslop\memory\personality-skill.md` + update `MEMORY.md`

- [ ] **Step 1: Add a pointer to the project README**

Add a short section to `README.md` (place after the existing feature list; match surrounding style):

```markdown
## The /personality skill

`skills/personality/` is a self-contained Claude Code skill that makes a model
invent page-specific personality inside anti-slop constraints — a forced ideation
process, a personality-move catalog, a merged slop manifest, cited craft
principles, and per-vibe type/color option-sets generated from this repo's font
data (`scripts/build-personality-skill.mjs`). See `viz/personality-demo/` for a
before→after. Regenerate the data-backed parts with
`node scripts/build-personality-skill.mjs`.
```

- [ ] **Step 2: Write the memory file**

Create `C:\Users\Keshav\.claude\projects\Z--fixmyslop\memory\personality-skill.md`:

```markdown
---
name: personality-skill
description: The /personality skill — what it is, why it exists, and how its data-backed parts are generated
metadata:
  type: project
---

`skills/personality/SKILL.md` is the project's creativity skill (a pivot from the
item-by-item diagnose/swap tool toward making the model creative). Heart: a forced
ideation process (absorb subject → diverge 15 concepts → ground & commit → constrain
→ build) + a personality-move catalog. Anti-patterns merged from impeccable.style
(49 rules), frontend-design DON'Ts, and our measured crawl tells. Craft guardrails
are researched + cited. Type/color option-sets are GENERATED by
`scripts/build-personality-skill.mjs` from data/ (avoid = saturated fonts +
palette-slop; pick-from = fresh/indie pool + escape-directions), with an
anti-convergence "rotate, never default" rule so we don't mint the next Inter.

Key facts learned: Claude Code does NOT expose temperature (no setting/env/flag);
the real creativity levers are thinking budget (effort/ultrathink), constraints,
and divergence-then-selection — not randomness. uupm.cc is anti-pattern reference
only (its own palettes/fonts are themselves slop). Spec:
docs/superpowers/specs/2026-06-05-personality-skill-design.md. Related:
[[visual-font-similarity]], [[font-sources-and-licensing]].
```

Then append one line to `C:\Users\Keshav\.claude\projects\Z--fixmyslop\memory\MEMORY.md`:

```markdown
- [The /personality skill](personality-skill.md) — the creativity skill, its forced ideation process, and how its type/color sets are generated
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all workspace tests pass (core, pipeline incl. the new `personality skill` tests, crawl).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document /personality skill in README"
```

(The memory files live outside the repo and are not committed.)

---

## Self-Review (completed by plan author)

**Spec coverage:** §4 deliverable → Tasks 1–6. §5a process → Task 1. §5b moves → Task 2. §5c slop manifest (merged + data) → Tasks 3, 6. §5d craft (researched) → Task 4. §5e type/color option-sets + anti-convergence rule → Task 6 (`type-and-color.md` header states the rotate/never-default rule). §6 research pass → Task 4. §7 data feeds skill → Task 6 generator. §8 proof → Task 7. §9 verification → Tasks 5–6, 8. §10 non-goals respected (uupm anti-pattern only — Task 3; no runtime LLM). §11 risks (convergence) → Task 6 rule. Covered.

**Placeholder scan:** Craft-principles content is research-generated with an explicit format + acceptance bar (not a placeholder). All code/test/markdown bodies are complete. No TBD/TODO.

**Type consistency:** `freshByCat`, `avoidFonts`, `directions`, `avoidPalettes`, `dataTells` are produced by the generator (Task 6) exactly as the test (Task 5) consumes them; `sat` field name and `CUTOFF`/`FRESH` thresholds match across generator and test; `GENERATED:data-tells:start/end` markers identical in Tasks 3 and 6.
```
