# Components & assets — premade parts, precise instruments, contrast

Mandatory read / hard gate. **The core correction:** Claude-hand-drawn *illustrative*
SVG (figures, scenes, objects, mascots, "spot illustrations" — writing `d="…"` to depict
a *thing*) reads amateur every time (wrong proportions, uncanny geometry). The fix is not
"draw better" — it's **never draw the thing.** Use premade icons + components; reserve
custom SVG/canvas for *computed* instruments only.

## Icons — never hand-draw glyphs
Use ONE established icon library, sized/colored to the system. All free for commercial use.
- **Lucide** (~1,600, 2px outline, ISC) — safe neutral default. `<i data-lucide="rocket"></i>`
  + `<script src="https://unpkg.com/lucide@latest"></script>` + `lucide.createIcons()`.
- **Phosphor** (~9,000, 6 weights, MIT) — when you want character (Duotone/Fill/Thin). Web font:
  `@phosphor-icons/web` CSS via jsDelivr, `<i class="ph ph-rocket">`.
- **Heroicons** (MIT, Tailwind team) · **Tabler** (~5,900, dense data UIs, MIT).
Rules: one set per page; size from the spacing scale, color via `currentColor`; bump ~1px
vs cap height; decorative icons `aria-hidden`, meaningful ones get an accessible name; never
mix sets; never recolor an outline set to fake a fill.

## When custom SVG/canvas IS allowed
**The test:** hand-authoring geometry to **depict a thing** = banned; geometry **generated
from data/a formula** = allowed. Allowed: charts, rings/gauges (`stroke-dasharray` on a
`<circle>` from a %), sparklines (`value→pixel` polyline), real-GeoJSON maps, parametric/
canvas fields, algorithm-laid-out diagrams, data-derived waveforms. Banned regardless of
brief: figures, faces, mascots, animals, objects, buildings, scenes, decorative blobs,
scratch-drawn icons/logos. If a brief truly needs illustration, that's an artist's job —
use bold type, a real photo, a CSS/`conic-gradient` form, or honest empty space instead.
For allowed instruments: drive from data (no eyeballed coordinates), `vector-effect:
non-scaling-stroke`, give a `role="img"`+`aria-label` or a visually-hidden data table.

## Accessible components (semantic HTML first)
Library/markup gives **structure**; the skill gives **identity** — restyle to your palette/
type, one border weight + radius across all; never ship the default look.
- **Card** `<article>` + real heading (stretch-link via `::after`, no nested controls) — not boxitis.
- **Table** real `<table>` + `<caption>`/`<th scope>`, `tabular-nums`, right-aligned numbers — not a div-grid.
- **Nav** `<nav aria-label><ul><a aria-current>` + real `<button aria-expanded>` toggle — not centered-logo+ghost-links+indigo-pill.
- **Form** real `<label for>` (placeholders aren't labels), errors as text via `aria-describedby`+`aria-invalid` (not color alone), inputs ≥44px, borders ≥3:1.
- **Badge** text/icon conveys status, not hue alone. **Tabs** real `role=tab/tabpanel` + arrow keys. **Accordion** native `<details>`.
- **Dialog** native `<dialog>`+`.showModal()` (free role/aria-modal/Esc/`::backdrop`); return focus on close; scrim is a tint, not pure black.
- **Toast** `aria-live="polite"`/`role=status`, icon+text, dismissable, not color/position alone.

## CSS component layer — structure, not identity
Every framework ships a **default theme that IS the slop** (Tailwind's default indigo
`#6366f1`). Use for structure; **restyle tokens to your palette/type before shipping.**
- **Tailwind Play CDN** (dev-only): set your colors in config / CSS vars; never `bg-indigo-*` or `from-indigo-* to-cyan-*`.
- **DaisyUI**: custom `[data-theme]` overriding `--p/--s/--a` — never a stock theme.
- **Pico.css** (classless semantic) / **Open Props** (token-only, most de-slop-friendly — use its sizes/easings, your own color/font tokens).
If the page reads as "default Tailwind/Daisy/Pico," you shipped slop.

## Layout patterns to PLAY with (vary across builds)
Beyond the 12 composition archetypes — structural scaffolds: **bento grid** (`grid-auto-flow:
dense`, varied cell spans), **sidebar/app-shell** (`grid-template-columns:auto 1fr`),
**dashboard** (`repeat(auto-fit,minmax(16rem,1fr))`), **sticky-rail + scrolling content**,
**magazine/editorial multi-column**, **split with sticky media**, **asymmetric feature rows**
(7fr/5fr, not mirrored 50/50), **masonry**, **command-palette (⌘K)**, **full-bleed
alternating sections**, **overlapping/layered sections**. Pick the structure the content
wants (a tool → app-shell; an essay → editorial); don't reach for centered-single-column by reflex.

## Contrast (hard floor — compute it)
AA: body **≥4.5:1**, large (≥18pt/≥14pt bold) **≥3:1**, non-text UI & focus **≥3:1**. Don't
round (4.47 fails). Recipe: pick ground L first (light ~0.96–0.99 / dark ~0.10–0.16, low real
hue, never pure #fff/#000) → step text L far from it (light-ground text L~0.20–0.30; dark-ground
text L~0.90–0.97) → accent ≥3:1 (≥4.5:1 if text sits on it). **Dark-ground pitfall (the saffron
failure):** warm-brown text on warm-umber ground = same lightness+hue ≈ 2–3:1, unreadable. On
dark/tinted grounds, contrast comes from **lightness, not chroma/vibe** — raise text lightness
and/or desaturate the ground; open the L gap and re-measure. Never convey status by color alone.

→ deep dive (CDN snippets, per-component slop/de-slop, 11 layout patterns, OKLCH+APCA, sources):
docs/design-research/components-and-ui-patterns.md
