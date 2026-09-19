---
name: fixmyslop
description: An inspectable evidence workbench for mechanism-first interface and prose decisions.
colors:
  instrument-ink: "#172026"
  muted-steel: "#667078"
  workbench-paper: "#f4f6f5"
  evidence-panel: "#e1e8ea"
  structural-line: "#c8d0d3"
  revision-orange: "#b5452c"
  revision-wash: "#f4d9d1"
  verified-green: "#18725d"
  verified-wash: "#d8ebe5"
  inspection-dark: "#11191e"
  inspection-panel: "#202a30"
typography:
  display:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 3.625rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.055em"
  body:
    fontFamily: "Hanken Grotesk, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "0.5625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.09em"
rounded:
  control: "2px"
  status: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  frame: "48px"
components:
  button-primary:
    backgroundColor: "{colors.revision-orange}"
    textColor: "{colors.workbench-paper}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "42px"
  button-secondary:
    backgroundColor: "{colors.workbench-paper}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "42px"
  mode-active:
    backgroundColor: "{colors.instrument-ink}"
    textColor: "{colors.workbench-paper}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "58px"
  evidence-panel:
    backgroundColor: "{colors.evidence-panel}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.control}"
    padding: "24px"
  connected-proof-diagram:
    backgroundColor: "{colors.inspection-panel}"
    borderColor: "{colors.revision-orange}"
    rounded: "{rounded.control}"
    role: "subject-specific proof object with object/state rails"
  engine-status:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    stateColors: "verified-green / revision-orange / muted-steel"
    role: "connected, loading, or fixed-acceptance truth"
---

# Design System: fixmyslop

## 1. Overview

**Creative North Star: "The Evidence Workbench"**

fixmyslop should feel like a serious instrument opened mid-decision: pale structural
surfaces, dark inspection fields, one revision signal, and evidence immediately beside
the choice it qualifies. Its confidence comes from useful density and inspectable state,
not visual theatre. The system is empirical, audacious, and explicit about uncertainty.

The interface is a product workbench even when it appears on the landing page. It must
never become a parody-first anti-slop museum, beige or cream editorial “taste,” generic AI
SaaS, a copied Impeccable/Taste/Linear skin, or a deterministic score presented as proof
of taste. Composition and behavior must break when the subject changes.

**Key Characteristics:**

- Flat structural planes divided by alignment and one-pixel rules.
- Dark inspection fields reserved for the mechanism or protected evidence.
- Revision orange used for the next consequential action, never ambient decoration.
- Compact mono metadata paired with plain, readable grotesk copy.
- Every pass, bound, rejection, and human judgment remains visible.

## 2. Colors

The palette is cool, utilitarian, and almost achromatic until a revision or verified state
needs to speak.

### Primary

- **Revision Orange:** The single high-energy signal for edits, active computation,
  primary actions, and failed protected anchors.

### Secondary

- **Verified Green:** Reserved for completed gates, preserved claims, and confirmed
  state. It never competes with the primary action.

### Neutral

- **Instrument Ink:** Primary text, active navigation, and structural button shadows.
- **Muted Steel:** Secondary explanations and metadata that must recede.
- **Workbench Paper:** The page canvas and default field surface.
- **Evidence Panel:** Supporting proof, alternatives, and action bars.
- **Structural Line:** The one-pixel grouping system.
- **Inspection Dark / Inspection Panel:** The product mechanism, trace, or protected
  evidence field—not a general dark theme.

### Named Rules

**The One Revision Signal Rule.** Revision Orange owns one consequential action or state
per view. If it becomes atmosphere, hierarchy has failed.

**The Dark Field Rule.** Dark surfaces contain inspectable product truth. They are never
empty hero backdrops, neon stages, or glass containers. The connected proof diagram puts
the mechanism ID, dominant proof object, subject objects, and current states inside this
field; a fixed acceptance diagram is only used when the local engine cannot load.

## 3. Typography

**Display Font:** Hanken Grotesk (with Segoe UI and system UI fallbacks)  
**Body Font:** Hanken Grotesk (with Segoe UI and system UI fallbacks)  
**Label/Mono Font:** Spline Sans Mono (with the platform monospace fallback)

**Character:** Hanken Grotesk keeps product language direct and untheatrical. Spline Sans
Mono makes run IDs, gates, anchors, and process state read as evidence without turning
ordinary body copy into a developer-console costume.

### Hierarchy

- **Display** (700, fluid 30–58px, 0.96): Audit and Humanize theses only.
- **Headline** (700, fluid 22–33px, 1.0): Selected direction and inspection result.
- **Title** (650–700, 14–23px, 1.15): Regions, options, and proof panels.
- **Body** (400, 12–18px, 1.45–1.5): Briefs, explanations, evidence, and editable prose;
  long reading stays below 75ch.
- **Label** (500–600, 8–10px, 0.04–0.09em, uppercase): Runs, gates, anchors, and process
  metadata only.

### Named Rules

**The Evidence Is Small, Not Vague Rule.** Mono labels may be compact, but their contrast
and wording must remain explicit. Never shrink uncertain copy into plausible noise.

**The One Thesis Rule.** Only Audit and Humanize use the largest display role. Generate
lets the working mechanism dominate instead.

## 4. Elevation

The system is flat by default. Depth comes from tonal planes, borders, overlap, and
content hierarchy. Ambient card shadows are prohibited. The primary action alone uses a
short hard-key shadow so it feels executable; pressing it visibly collapses that depth.

### Shadow Vocabulary

- **Executable Key** (`0 1px 0 #172026, 3px 3px 0 #172026`): The primary action at
  rest; the small top edge keeps the key legible while it grows by one pixel on hover
  and collapses to one pixel while active.
- **Verified Halo** (`0 0 0 3px #d8ebe5`): A small status dot only, never a container or
  text glow.

### Named Rules

**The Flat Until Action Rule.** A resting surface is flat. Elevation appears only to make
an action, focus state, or verified status more legible.

## 5. Components

Components are compact, squared, and state-forward. Their distinction comes from
placement, fill, and response—not a collection of unrelated radii or effects.

### Buttons

- **Shape:** Almost square with a two-pixel corner.
- **Primary:** Revision Orange fill, pale text, compact horizontal padding, and the
  Executable Key shadow.
- **Hover / Focus:** Hover shifts one pixel up and left; active collapses the shadow;
  focus always receives a two-pixel orange outline with a three-pixel offset.
- **Secondary:** Transparent or paper fill, one-pixel Instrument Ink border, no resting
  shadow.

### Chips

- **Style:** One-pixel Structural Line border, quiet neutral fill, compact mono label.
- **State:** Chips describe extracted signals or protected anchors. Missing anchors use
  Revision Orange plus a text label; color is never the only cue.

### Cards / Containers

- **Corner Style:** Two pixels or square.
- **Background:** Workbench Paper, Evidence Panel, or an earned Inspection Dark field.
- **Shadow Strategy:** Flat; use the Elevation rules only for executable actions.
- **Border:** One-pixel Structural Line, removed when a shared grid boundary already
  supplies the separation.
- **Internal Padding:** Sixteen to twenty-four pixels, with related content tighter than
  neighboring groups.

### Inputs / Fields

- **Style:** Transparent brief field with a one-pixel underline; prose editors use flat
  panel surfaces and generous reading padding.
- **Focus:** Revision Orange underline or inset two-pixel focus stroke.
- **Error / Disabled:** Missing anchors and the release status name the failure; disabled
  actions remain visible at reduced opacity.

### Navigation

The three jobs—Generate, Audit, Humanize—share one centered tab rail. The active job uses
Instrument Ink fill, pale text, and an orange step number. On narrow screens the rail
recomposes beneath the wordmark with equal touch-sized tabs.

### Decision Bench

The signature component places alternatives, the selected working mechanism, and its
proof/rejection ledger in one aligned grid. Direction changes must alter the central
object model, not just palette or font. Mobile stacks selection, mechanism, and evidence
in that order.

### Connected Runtime States

The top-right run marker is a truth surface, not decoration:

- `connected run` means the local connected engine has loaded and Generate will route the
  submitted brief through semantic profiles, mechanisms, and authored realizations.
- `engine loading` is transient while the corpus is fetched; the acceptance UI still
  paints immediately.
- `fixed acceptance` is an explicit fallback and may not be presented as a generated
  result. The notice names the failure so a benchmark or operator can investigate it.

The browser proof is intentionally bounded to anchors and claim frame. Full humanizer
corpus scoring and release gates remain in the skill/CLI, and the Humanize view says so.

## 6. Do's and Don'ts

### Do:

- **Do** put a working product object or protected claim field in the dominant dark plane.
- **Do** keep evidence, rejection conditions, and pending human judgment beside the
  decision they qualify.
- **Do** use the one-pixel structural grid and the 4/8/12/16/24/32/48 spacing rhythm.
- **Do** recompose Generate, Audit, and Humanize for touch instead of shrinking desktop.
- **Do** preserve keyboard, high-contrast, reduced-motion, and source-restoration paths.

### Don't:

- **Don't** build “a parody-first anti-slop museum that makes visitors endure bad
  interfaces before seeing the real product.”
- **Don't** use “beige or cream editorial taste,” muted rose accents, reflexive display
  serifs, or specimen-page styling as universal refinement.
- **Don't** use generic AI SaaS: centered headline stacks, purple or fintech-blue accents,
  floating screenshots, glass panels, bento grids, fake metrics, or decorative networks.
- **Don't** copy Impeccable, Taste, Linear, Vercel, Stripe, or a bookmarked reference's
  complete skin.
- **Don't** present a deterministic score as proof of taste or general superiority.
- **Don't** fill every section with an equal card; the mechanism, proof, and controls must
  have visibly different weights.
