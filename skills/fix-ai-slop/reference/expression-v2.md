# fix-ai-slop reference — Connected v2 expression

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

Use the connected v2 fields to make interaction, materials, and typography feel like
one authored language. They are constrained recommendations, not a menu to exhaust.

## Read the output

- `type.display` carries identity and headings.
- `type.body` carries paragraphs and sustained reading.
- `type.accent` is optional and only for short accents, labels, pull quotes, or one
  highlighted word. Never use it for body copy.
- `material.component` selects a control dialect and supplies button states plus
  resting, hover, and active shadow behavior.
- `material.texture` selects a surface dialect or explicitly withholds texture when the
  page is dense, low-power, or utility-first.
- `expression` selects at most one high-commitment centrepiece and may add one quiet
  texture treatment. Always carry `responsive` and `reducedMotion` into the build.

## Treatment rules

- Magnetic cursors are desktop-only and belong to portfolios, agencies, galleries, or
  experimental campaigns. Keep the native pointer as the fallback.
- Image trails belong to galleries/portfolios and must be removed on touch and reduced
  motion. Do not use them on trust-heavy or dense product surfaces.
- Scroll reveal is a low-cost polish; it must not hide content before JavaScript runs.
- Sticky narrative stacks and asymmetric split pinning need a normal-flow mobile order.
- Horizontal gallery pans need native horizontal scrolling on mobile and must not become
  the primary reading path.
- Grain, paper, film, mesh, and filtered surfaces are material channels. Keep opacity low,
  place them deliberately, and remove or lighten them for dense/low-power surfaces.
- Outline, mask/crop, and kinetic type are display treatments only. Never apply them to
  paragraphs, forms, error messages, or localization-heavy copy.

## Budget

Prefer one centrepiece. A quiet texture can support it. Do not combine a cursor trail,
kinetic type, pinned scroll, heavy texture, and bouncy controls merely because each is
available. The v2 compatibility data encodes this as a hard rule and the runtime marks
human interaction replay as pending, so verify hover, focus, press, keyboard, touch, and
reduced-motion states in the actual page.
