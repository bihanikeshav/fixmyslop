# fix-ai-slop reference — Components

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Buttons**
- Primary / secondary / tertiary obvious and consistent product-wide; one primary per region.
- Same destination ⇒ same CTA label. Destructive = danger color + confirm when irreversible.
- Dense toolbars may reveal secondary actions on hover.

**Cards, lists, tables**
- Form matches the data. Cards: identity → title → meta → actions.
- Tables: right-align numbers, chips for enums, truncate long text, shade inactive rows. Lists beat bordered card stacks for density and empty states.
- Time series → timeline/line chart, not a table. Bulk actions on multi-select.

**Icons**
One library (Lucide, Phosphor, Feather), consistent stroke width, SVG. Emoji as system chrome is a vibe-code tell unless Notion-intentional.

**AI surfaces**
- Prompt box as the primary object; context chips for mode/files/code/drive.
- Compress large pastes into code blocks. Stream tokens; short loaders or a step trail, not a frozen spinner.
- Inline refine (rewrite/shorten), not only full regeneration. Show steps/sources when trust matters. Progressive disclosure for advanced controls and token cost.
