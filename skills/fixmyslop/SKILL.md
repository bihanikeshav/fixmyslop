---
name: fixmyslop
description: Fix AI-slop design. Staggered skill — this index carries the two rules that break most AI UIs plus a map of passes you load on demand. Use when building or reviewing any UI, page, or component with the fixmyslop MCP tools.
license: Apache-2.0. Adapted from impeccable.style, the personality skill, tasteskill.dev (Leonxlnx/taste-skill), and the UI/UX Design Index (Kole Jain, Juxtopposed, Mizko, DesignCourse, Jesse Showalter, Charli Marie, Flux Academy).
---

# fixmyslop — index

The `fixmyslop` MCP judges and generates non-slop design tokens (color, fonts,
spacing, radius, shadow, layout, motion) with deterministic math. For a real
subject brief, prefer the connected one-shot tools: they carry the subject into
the same gated genome and make display/body pairing a deliberate compatibility
decision. Route every deterministic decision to a tool; the ONE bold centrepiece
stays yours.

## TL;DR — the three that matter most
1. **One element wins** each view; the rest recede. Prove it — blur the render (`filter: blur(8px)`), your primary must still dominate.
2. **Body in a readable face**, never a display/novelty font (`pairing.body` from `suggest_fonts`).
3. **Layout via the `container` tokens** (maxWidth + paddingInline from `layout`); never re-add margin on `inner`.

Then pick the **mode** — it changes every rule below: **landing** (convert — big type, one hero, whitespace) · **dashboard** (operate — dense, small type, usually no hero) · **docs** (read — measure + rhythm) · **profile/marketing** (persuade). Building a dashboard like a landing (or vice-versa) is itself slop.

## Always apply
- **Fonts & layout** — the TL;DR two; the most common breakages.
- **Composition** — weight must resolve, detail must be earned. Subtract, don't decorate (a border/card/eyebrow is additive signal, not a default). Encode each status once (color OR dot OR word). Space by grouping — related tight, unrelated loose, never uniform. Columns share baselines/edges; height is content-driven, never a fixed frame content can't fill (trapped whitespace + empty multi-column are tells). Depth in `design-law.md`.

## Hard implementation handoff — never trust a name or a path

- **Fonts are load contracts, not family names.** Call `connected_style_genome` (or
  `suggest_fonts`), then require `pairing.assets.display.available` and
  `pairing.assets.body.available`. Run `check_font` on both roles and require the
  selected role to pass `roleSuitability`. Copy the returned asset paths into the
  project, emit `@font-face` with the exact family/weight, then await
  `document.fonts.ready` and verify `document.fonts.check()` before visual QA. A
  fallback font is a failed validation, not an acceptable implementation detail.
- **Pairing is deliberate contrast.** Keep display and body distinct, but do not
  pair by category alone: preserve the MCP pair score/evidence, compare x-height,
  aperture, counter size, contrast, and register. Candidate Instagram/research
  pairings are inspiration only until rendered; `humanValidation: pending` is not
  ground truth.
- **SVG is gated before use.** Run `check_svg` on every LLM-authored SVG. Require
  `PASS`, a positive `viewBox`, finite geometry, unique IDs, no scripts,
  `foreignObject`, external URLs, or broken `url(#id)` references. Use one vetted
  icon library for chrome. Raw illustrative SVG is rejected by default; use a
  reviewed asset or explicit provenance. Animate the host element with CSS/GSAP,
  not embedded SVG animation.
- **Render specimens before page polish.** Show a real headline, a 65–75ch body
  paragraph, and labels in the selected fonts at desktop and mobile. If line wraps,
  clipped glyphs, missing weights, overflow, or contrast fail, return to the
  recommendation gate instead of compensating with CSS.

## Load a pass on demand
Read only the file(s) the request needs — or invoke the matching MCP prompt. Run one
pass or chain several in order; decide from what the user actually asked for.

| For | Load | Or prompt |
|---|---|---|
| Show the user several genuinely different design directions to pick from, grounded in their intent. | `explore.md` | `/fixmyslop:explore` |
| Full flow: audit the current design and rebuild it distinctive + readable. | `improve_design.md` | `/fixmyslop:improve_design` |
| Audit an existing page for slop and give fixes. | `design_review.md` | `/fixmyslop:design_review` |
| Generate one coherent token system from a brief. | `theme.md` | `/fixmyslop:theme` |
| Palette work: judge and generate gate-passing colors. | `colorize.md` | `/fixmyslop:colorize` |
| Typography, spacing and layout math. | `typeset.md` | `/fixmyslop:typeset` |
| Finishing pass: motion, shadow, radius, controls. | `polish.md` | `/fixmyslop:polish` |

## Connected one-shot path

When the brief names a real subject, use `connected_style_genome` for one coherent
direction, `connected_explore_directions` for alternatives, and
`connected_build_spec` when the agent needs the markdown implementation handoff.
Pass the verbatim brief as `sourceBrief` (aliases are tolerated), plus
`recentFingerprints` when re-rolling. These tools preserve the engine's bounded
thin-pool warnings; a smaller candidate set is an honest corpus limitation, not a
reason to invent arbitrary styles. The connected result includes `connected.profile`,
`type.pairing`, and the same palette/type/layout/material/motion gates as the core
tools.

The connected v2 result also carries the empirical expression layer:

- `type.accent` is optional and reserved for short display accents, labels, pull quotes,
  or one highlighted word. `type.body` remains the only running-text face.
- `type.pairing.v2` exposes font-space usage/evidence and explicitly marks human pairing
  validation as pending; candidate evidence may break ties but never overrides readability.
- `color.scene` describes temperature, lightness, contrast, accent ratio, and texture
  reference. `material.texture` is density-gated, not a default overlay.
- `material.component` gives a button/component dialect plus resting, hover, active, focus,
  disabled, loading, success, and error behavior. Use the selected dialect consistently.
- `expression` contains at most one high-commitment centrepiece plus an optional quiet
  texture treatment, with native-mobile and reduced-motion fallbacks. Cursors are desktop
  only; scroll hijacking is never implied.

For deliberate control, pass `accentMode`, `texturePreference`, or an
`expressionPreference` treatment id. The runtime still applies density, readability,
surface, compatibility, mobile, and reduced-motion gates.

For the complete design law (all five gates, forbid-the-median, the ONE-centrepiece
bar) load `design-law.md`. Unsure which pass? Load `improve_design.md` — it runs the
full flow.

## Reference — pull a topic only when you want depth
Craft knowledge, not law. Load one of these ONLY if the task needs that depth;
otherwise ship against the gates, and prefer your own subject-grounded invention
over any example here.

| Topic | Load |
|---|---|
| Foundations — signifiers, affordances, hierarchy, control states | `reference/foundations.md` |
| Layout & structure — grids, spacing, section rhythm, density vs air | `reference/layout.md` |
| Typography — type scales, roles, product vs marketing type | `reference/typography.md` |
| Color systems — ramps, semantics, dark mode, 60-30-10 in apps | `reference/color.md` |
| Components — buttons, cards, tables, forms, interaction states, density, nested surfaces, AI surfaces | `reference/components.md` |
| Professional product UI — the craft behind Linear/Vercel/Stripe/Cloudflare — restraint, density, interaction, without cloning | `reference/product-ui.md` |
| Dashboards & data UI — sidebar + object list + charts, density, statuses | `reference/dashboards.md` |
| Landing & marketing — hero, craft levels, narrative, CTAs | `reference/landing.md` |
| Technical product landing — developer tools, APIs, AI infrastructure, technical catalog/editorial pages with real product proof | `reference/technical-product.md` |
| Mobile & gestures — targets, bottom nav, thumb reach, swipe | `reference/mobile.md` |
| Motion — micro-interactions, spring tiers, interruption, meaningful transitions, reduced motion | `reference/motion.md` |
| Connected v2 expression — accent type, component dialects, texture, cursor/scroll treatments, fallbacks | `reference/expression-v2.md` |
| Fluid Functionalism dashboards — dashboard layout math, Fluid registry components, data-dense product personality | `reference/fluid-dashboards.md` |
| Failure modes — the recognizable AI-slop tells + concrete fixes | `reference/failure-modes.md` |
| Ship checklist — the master pre-ship checklist + surface recipes | `reference/checklist.md` |

Keep this index in context; pull detail only when you act on it.
