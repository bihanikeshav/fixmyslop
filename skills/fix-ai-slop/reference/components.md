# fix-ai-slop reference — Components

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Component contract**
- Start with the semantic primitive and preserve its keyboard behavior, focus visibility, accessible name, disabled semantics, and ARIA relationships. Motion never substitutes for semantics.
- Define the full state matrix before polish: resting, hover, focus-visible, pressed, selected/open, disabled, loading, error, success, and empty where relevant. State must read without color alone.
- Keep component geometry stable across states. Loading preserves the label width; validation does not make fields jump; active indicators do not reflow neighboring labels.
- Expose named slots for replaceable icons and supporting content. Use one icon library and one stroke language instead of per-component SVG inventions.

**Preview intent before commitment**
- In a contiguous group such as tabs, menu rows, accordions, or table rows, let the nearest eligible item receive a faint preview before click. The selected item remains unmistakable.
- Scope proximity feedback to the group, keep it subordinate to hover/focus/selection, and enable it only for `(hover: hover) and (pointer: fine)`. Never make controls chase the pointer across the page.
- Use shared geometry to show relationships: a merged selection background, sliding tab indicator, or expanding panel should explain which item became active and where its content came from.

**Density is a region decision**
- Offer a small, coherent density ladder instead of arbitrary per-control sizes. A useful desktop starting pair is 36px default and 28px compact; keep touch targets at least ~44px on touch surfaces.
- Scale control height, type, icons, horizontal padding, and gaps together. Compact is for a dense region, not one randomly tiny button.
- Pass density through context and portals so a select trigger, popover, menu rows, and nested controls inherit the same rhythm.

**Surfaces lift relative to their substrate**
- Model a bounded elevation stack. A popover inside a dialog must lift from the dialog, not reuse a global card color that collapses the layers.
- In light mode, higher levels may converge toward a light surface while shadow carries depth. In dark mode, higher levels usually become slightly lighter with disciplined layered shadows.
- Derive hover and selected treatments from the current substrate, not one universal translucent overlay. Verify contrast at every nesting level.

**Buttons, forms, lists, and tables**
- Primary / secondary / tertiary remain obvious product-wide; allow one primary per region. Same destination ⇒ same CTA label. Confirm irreversible destructive actions.
- Inputs keep labels persistent, errors adjacent, and help text stable. Groups, selects, and dialogs inherit size and surface context across portals.
- Form matches the data. Cards: identity → title → meta → actions. Lists beat bordered card stacks for density and empty states.
- Tables right-align numbers, truncate long text accessibly, support keyboard row actions, and reveal bulk actions only after selection. Time series → timeline/line chart, not a table.

**AI surfaces**
- Prompt box as the primary object; context chips for mode/files/code/drive.
- Compress large pastes into code blocks. Stream tokens; use short loaders or a step trail with complete / active / pending states, not a frozen spinner.
- Inline refine (rewrite/shorten), not only full regeneration. Show steps/sources when trust matters. Progressive disclosure for advanced controls and token cost.

**Pre-ship composition check**
Test each component alone, adjacent to peers, inside a compact region, inside a nested overlay, at 200% zoom, with keyboard only, with touch, and under reduced motion. Interaction quality that survives composition is the bar.

_Patterns distilled from [Fluid Functionalism](https://www.fluidfunctionalism.com/docs) and its [MIT-licensed source](https://github.com/mickadesign/fluid-functionalism): take the interaction principles, not the visual skin or component code._
