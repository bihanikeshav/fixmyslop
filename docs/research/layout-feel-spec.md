# Layout "Feel" Spec — the numbers that make a layout read as intentional

Synthesized from 4 parallel research passes (spacing systems · grids & proportions · style-specific
signatures · human-vs-AI tells). Purpose: give the LayoutGenome engine concrete, per-style numbers so
generated pages stop feeling "in harmony but unintentional." Every value here is meant to be encoded.

---

## 0. The one-line diagnosis

A layout reads as *designed by a human* when three things are true, and AI defaults violate all three:

1. **Hierarchy is not compressed** — the biggest thing is ≥2.5–3× the body, not everything at 18–32px.
2. **Spacing is relational, not uniform** — related things are close, unrelated things are far, at a
   deliberate ratio (~1:2.5). AI spaces everything equally, so nothing groups.
3. **Density varies for rhythm** — dense → airy → dense across sections. AI keeps every section the
   same density and the same vertical padding, which reads as a template.

Everything below is the numeric backing for those three.

---

## 1. Universal rules (apply to every style)

| Rule | Value |
|---|---|
| Base unit | 8px (4px for fine detail). All spacing quantized to multiples — no stray 18/22/29px. |
| Spacing scale (linear) | 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128 |
| Spacing scale (modular 1.25) | 16, 20, 25, 31, 39, 49, 61, 76, 95, 119 |
| **Intra- vs inter-group gap** | related ≈ 8–12px, unrelated/section ≈ 24–32px+. **Ratio ~1:2.5** |
| **Heading spacing (asymmetric)** | space **above** ≈ 1.75× line-height, **below** ≈ 0.5×. **~3:1** |
| Body measure (line length) | 50–75 chars, **66 ideal** → **600–780px** at 16px. Never full-width. |
| Container max-width | 1200–1280px; side margins ≥ 5vw (≈72px @1440) |
| Grid | 12-col, 24px gutters desktop / 16px mobile |
| Line-height | body 1.5–1.6, headings 1.2–1.3, UI 1.4–1.5 |
| Vertical rhythm | baseline = font-size × line-height (16×1.5 = 24px); all vertical spacing = multiples |
| Responsive scale | mobile padding ≈ 0.4× desktop, tablet ≈ 0.6× |
| Type-scale contrast | **largest text ≥ 2.5× body (target 3–4.5×)**; each tier ≥ 1.25× the previous |
| Focal point | **exactly one dominant element per section**, made dominant by ≥2 methods (size+isolation, size+color) |
| Component padding | proportional to content: card padding ≈ 0.5–1× line-height (NOT flat 32px on a 3-line card) |
| Button padding | ≈ 0.625em vertical, 1em horizontal (scales with its own font-size); min touch target 44px |
| Icon size | 1.2–1.5× its label's font-size |

---

## 2. Per-style profiles — the numbers CHANGE with the style

This is the core of the user's point: there is no single "perfect" layout. The engine must switch
these profiles on the declared style.

| Metric | Brutalist | Swiss / Editorial | Minimalist / Luxury | Dashboard / Dense | Modern SaaS |
|---|---|---|---|---|---|
| Section padding (vert) | 8–16px | 20–40px | 64–120px | 8–16px | 48–96px |
| Side margin | 0–8px | 20–40px | 60–100px | 16–24px | 24–48px |
| Border-radius | 0 (always) | 0–2px | 0–8px | 4–8px | 8–16px |
| Element gap | 4–8px | 8–20px | 32–64px | 8–16px | 24–32px |
| Section gap | 4–8px | 12–24px | 40–80px | 16–24px | 64–96px |
| Border weight | 2px | 0–1px | 0–1px | 0–1px | 0–1px |
| Type-scale ratio | 1.8× | 1.35× | 1.618× | 1.125× | 1.4× |
| Container width | full / asymmetric | 900–1000px | 800–1000px | 1024–1280px | 1200–1400px |
| Elements / viewport | 3–5 | 2–4 | 0.5–2 | 8–20 | 1–4 |
| Whitespace ratio | 20–30% | 35–45% | 50–65% | 15–25% | 40–55% |
| Card padding | 4–8px | 12–20px | 24–40px | 8–16px | 16–32px |
| Button pad (y/x) | 8-12 / 16-24 | 12-16 / 20-32 | 16-24 / 32-48 | 8-12 / 12-20 | 12-16 / 24-32 |

**Signature move (the instant tell) per style:**
- **Brutalist** — hard offset shadow (`4px 4px 0 #000`), 0 radius everywhere, 2px visible borders, extreme size jumps.
- **Swiss** — text baselines lock to a visible baseline grid; asymmetric-but-intentional 12-col.
- **Minimalist/Luxury** — one element floating in 60–120px of margin; whitespace *is* the design.
- **Dashboard** — 8px baseline visible in every gap; 32–40px compact rows; 240–280px sidebar.
- **SaaS** — 64–96px section gaps ("double what feels enough"); mono + one accent; 8–16px radius.

**Key nuance:** Brutalist and SaaS share a 4–8px base unit but use it *oppositely* — brutalist for
tight high-contrast grids, SaaS for generous section gaps. Same tokens, opposite deployment.

---

## 3. Hero proportions

- Height: full 100vh (svh on mobile) / standard 60–80vh / thin banner 30–40vh.
- Text-vs-visual split: **55/45 or 60/40, not 50/50** (asymmetry reads as designed).
- CTA sits 60–70% down the hero; ≥24–32px isolation around it; move higher (40–50%) on mobile.

---

## 4. The 20-point layout-slop checklist (machine-checkable on a render)

Each is a binary pass/fail an automated critic can measure. This is the spec for a self-healing pass.

**Hierarchy & scale**
1. Largest text ≥ 2.5× body? 2. Every type tier ≥ 1.25× previous? 3. One clear focal element per
section? 4. Focal element dominant via ≥2 methods? 5. Secondary elements visibly de-emphasized?

**Spacing & density**
6. All spacing multiples of 4/8px? 7. Section-to-section spacing varies (not all equal)? 8. At least
one dense AND one airy section? 9. Component padding proportional to content (no empty oversized cards)?

**Contrast & emphasis**
10. Body text ≥ 4.5:1 contrast? 11. ≥1 supporting text visibly lighter? 12. Palette not default-theme?

**Layout intention**
13. Layout asymmetric / breaks uniform grid? 14. ≥1 unexpected size or position (oversized headline,
sidebar)? 15. NOT purely centered-stacked-equal-column throughout?

**Component sizing**
16. Touch targets ≥ 44px? 17. Button padding scales with font-size? 18. Icon 1.2–1.5× its label?

**Optical**
19. Not perfectly mathematically centered (optical adjustment present)? 20. Nothing centered-but-visually-off-balance?

---

## 5. How this maps to our current G*/H* renders

| Observed flaw (from neutral critique) | Rule violated |
|---|---|
| G1 pull-quote card: huge padding around 3 lines of text ("sized for content that isn't there") | Card padding ≈ 0.5–1× line-height (§1); checklist #9 |
| Pages "in harmony but layout feels off" | Uniform density + symmetric heading spacing (§0, §1); checklist #7, #8, #19 |
| Stat block (H3) "undersold, same weight as labels" | Focal-point / hierarchy contrast (§1); checklist #3, #4 |
| Evidence paragraphs running wide | Body measure 600–780px (§1) |
| Everything centered & equal | Asymmetry / 55-45 splits (§3); checklist #13, #15 |
| H0 empty full-height bands | (separate render-reliability bug, not a numbers issue) |

---

## 6. Encoding priority for the engine

1. Add a **per-style layout profile** table (§2) keyed off the StyleGenome's declared style.
2. Enforce the **universal ratios** (§1): 1:2.5 group spacing, 3:1 heading asymmetry, ≥2.5× type
   contrast, body measure cap, one-focal-point-per-section.
3. Add **density variation** across sections (dense/airy/dense) rather than uniform padding.
4. Wire the **20-point checklist** (§4) as an automated post-render critic that flags violations →
   feeds the self-healing re-render loop.
