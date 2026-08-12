# fixmyslop reference — Magic UI component grammar

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

Magic UI is most useful as a copy/paste component grammar: a focused visual anchor, a small set of deliberate variants, and motion that explains state or hierarchy. Use the current registry implementation rather than rebuilding a lookalike.

**Select by job**
- Hero/anchor: `warp-background`, `globe`, or `animated-grid-pattern` — choose one.
- Proof: `marquee`, `avatar-circles`, or `terminal` — keep claims short and truthful.
- Feature composition: `bento-grid` — vary spans to create hierarchy; do not make every tile equal.
- Text: `blur-fade`, `text-animate`, `word-rotate`, or `typing-animation` — animate short phrases, never long reading copy.
- CTA: `shiny-button`, `shimmer-button`, or `ripple-button` — one primary treatment per region.
- Ambient: `grid-pattern`, `dot-pattern`, `particles`, or `light-rays` — background-only, quiet, and removable.

**Make a component look good**
1. Start with semantic content and a real job, then choose one component family.
2. Add one supporting effect at most; the anchor must still win in grayscale or a blurred squint test.
3. Define variants as a controlled axis: density, direction, reveal, surface treatment, or static fallback — not random decoration.
4. Keep geometry stable through hover, loading, and validation; state feedback must not reflow the page.
5. Preserve native semantics, accessible names, focus-visible treatment, keyboard behavior, and 44px touch targets.
6. Test desktop, mobile, coarse pointers, 200% zoom, empty/loading/error/success, and `prefers-reduced-motion`.

**Motion budget**
- Cap high-motion work at one component per viewport and supporting effects at one.
- Autoplay pauses on hover/focus and becomes a static or wrapping layout under reduced motion.
- Pointer-following effects are fine-pointer only and never reveal essential content.
- Remove displacement and idle loops for reduced motion, but keep instant state communication.

Call `magic_ui_component` for a selected registry recipe and its variants. Call `check_magic_ui_composition` before shipping a stack; a SLOP verdict means remove competing effects or restore missing semantics. Install with the returned `npx shadcn@latest add @magicui/<slug>` command, then customize props/className before forking internals.

_Patterns distilled from [Magic UI](https://magicui.design/docs/components) and its [MIT-licensed source](https://github.com/magicuidesign/magicui). Take the theory and composition logic, not a visual clone._
