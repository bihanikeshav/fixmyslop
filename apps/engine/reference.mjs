// reference.mjs — the fix-ai-slop reference library. Lean, on-demand craft knowledge
// mined from the UI/UX Design Index. Depth a design agent pulls ONLY when it wants it,
// behind a cheap index. It COMPLEMENTS the hard gates in design-law.md (PREAMBLE); it
// does not restate them. Pure: strings only (no fs, no Date.now, no Math.random).

export const REFERENCE = [
  {
    key: "foundations",
    title: "Foundations",
    when: "signifiers, affordances, hierarchy, control states",
    body: `UI is a language: a stranger reads relationships, availability, and priority with no manual.

**Signifiers & affordances**
- Show function AND state: containers, contrast, active fills. Related items share a container; selected sets get a distinct fill or outline.
- Inactive = reduced contrast, never primary-clickable.
- Four states per control: default, hover/focus, pressed, disabled — missing states is the loudest beginner tell (\`check_motion\`).
- Obscure icons: ~1s-delayed tooltip. Universal ones (home, search, user) stand alone.
- Spatial relationships (from → to): icon + alignment beats wordy labels.

**Hierarchy is contrast**
- Deliberate difference: size, weight, position, color, space, isolation.
- One primary job per region, made strongest; meta (dates, helpers) smaller, quieter.
- If everything is bold, nothing is — must survive grayscale before color.
- Marketing may run large display type; product UI text stays ≤ ~24px.

**Whole house**
Map entry, skip, search, error, return. Design empty/loading/error/success, not just the demo frame. Reuse components. No dead clickable-looking chrome; no nav without an active state.`,
  },
  {
    key: "layout",
    title: "Layout & structure",
    when: "grids, spacing, section rhythm, density vs air",
    body: `**Spacing system**
- One base, 4 or 8px; every gap a multiple — no random 13/17px (\`spacing_scale\` / \`check_spacing\`).
- Proximity groups: related closer, unrelated more air. Equal spacing = no grouping.
- Wireframe first; grayscale failure isn't saved by color. Five-second scroll test: structure alone conveys the product.

**Captivating vs chaotic**
- Guide the eye. Hold a grid rhythm; break it once, deliberately.
- Archetype/hero via \`structure_ideas\`; grid math via \`layout\` (container tokens on the outer wrapper; never re-add margin on \`inner\`).
- Vary width, media placement, density per section — no identical slabs.
- Ornaments in the margins, never on the message.

**Two densities, both legal**
- Marketing (Apple-like): big product focus, confident whitespace, one idea at a time.
- Product: real density — compact type, layered neutrals, data-first — labels still scannable.

No crammed competing sections, no decorative dead cards. Structure earns polish, never the reverse.`,
  },
  {
    key: "typography",
    title: "Typography",
    when: "type scales, roles, product vs marketing type",
    body: `**One family, many roles**
- One strong sans, several weights; hierarchy over novelty.
- Three roles: display/heading, body/paragraph, label/meta. \`suggest_fonts\` returns a pairing — \`pairing.body\` is the workhorse; verify with \`check_font\`.
- Marketing: up to ~6 size steps. Dashboards: tighter — hero sizes steal density.

**Practical scale (Mizko blueprint)**
- Small increments, often 2px. Labels and paragraphs are separate styles.
- Labels: 10 / 12 / 14 / 16, compact line-height.
- Paragraphs: 12 / 14 / 16 / 18, reading line-height.
- Build with \`type_scale\` (modular, ≤7 sizes); verify with \`check_type\`. Bind as tokens — never freehand.

**Setting details**
- Large headings: tracking −2% to −3%, line-height ~110–120%.
- Body takes more line-height than a single-line label; long measure needs air.
- Mobile headings reduce slightly from desktop.

Most-broken rule: a display or novelty face for running text reads as slop instantly.`,
  },
  {
    key: "color",
    title: "Color systems",
    when: "ramps, semantics, dark mode, 60-30-10 in apps",
    body: `**Less color, more meaning**
- Neutrals dominate; color = status, selection, brand moments. Linear, Notion, Vercel, Supabase run ~90%+ neutral with a tiny accent.
- One brand accent for primary actions. Semantics distinct: success / warning / danger / info — destructive is never playful.
- Icons mostly monochrome; color only for state. Rainbow cards fail hierarchy and a11y. Gate shipped color with \`check_color\` / \`check_palette\`.

**Why 60-30-10 breaks in apps**
- Landing pages can run 60/30/10; apps need layered surfaces.
- Neutral stack: 3–4 background elevations, 1–2 strokes, ~3 text steps. Layers: frame → chrome/sidebar → card → overlay, plus borders, text tiers, accent+states, semantics, data-viz.
- Soft near-gray borders, no pure-black hairlines. Importance maps to contrast; primary button strongest. Ramps via \`generate_palette\` / \`design_system\`.

**Ramps & dark mode**
- Brand ramp 50–900. Dark mode is retuned, not mirrored.
- Light primary: mid-dark (600/700); dark primary: lighter mid (300/400).
- Dark surfaces get LIGHTER as they elevate — double the perceptual distance; a dark card is never darker than the page.
- Dim pure white text on dark; brighten borders. Charts: separate data palette; may break brand monotony on purpose.`,
  },
  {
    key: "components",
    title: "Components",
    when: "buttons, cards, tables, forms, icons, AI surfaces",
    body: `**Buttons**
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
- Inline refine (rewrite/shorten), not only full regeneration. Show steps/sources when trust matters. Progressive disclosure for advanced controls and token cost.`,
  },
  {
    key: "dashboards",
    title: "Dashboards & data UI",
    when: "sidebar + object list + charts, density, statuses",
    body: `**Anatomy**
- Sidebar is the spine: icon + short label, grouped, rare items at the bottom, active indicator, collapsible-ready. Main canvas = the job-to-be-done.
- Charts are real: axes, numbers, legends, range controls. Data drives form: enums → chips, magnitudes → aligned numbers/bars, time → timeline/line.
- Layered neutrals, one accent, semantic statuses. Design the zero-data empty state; bulk actions on multi-select. Account card, not a gradient-letter avatar.

**Recipe:** sidebar spine + object list/table + 1–2 real charts with ranges. Usually NO hero-sized centrepiece — it steals density.

**Optimistic UI:** low-risk frequent actions update immediately, reconcile async — toast + undo. Never optimistic-delete without undo.

**Three tells**
- Widget-dump dashboards with no primary job.
- The same KPI strip on every page (vanity spam).
- Context-blind layouts — analytics widgets on a settings page.

Density where power users live; air where newcomers decide. \`check_layout\` for the grid, \`check_palette\` for statuses.`,
  },
  {
    key: "landing",
    title: "Landing & marketing",
    when: "hero, craft levels, narrative, CTAs",
    body: `**Craft levels**
- L1 template: alternating slabs, stock art, flat nav, vague copy, mismatched CTAs.
- L2 cohesive: layout variety, matching CTAs, basic motion, tighter type.
- L3 crafted: product-true visuals, strong hierarchy, intentional transitions.
- L4 captivating: narrative scroll, one signature motion, exploratory-but-gridded composition.

**Checklist (decisions, not defaults)**
- One primary conversion path; nav emphasizes it. Hero = specific short promise + real product visual + ONE primary CTA (\`structure_ideas\`).
- Visuals show the actual product — no lorem or stock filler.
- Section variety: width, media, density; no identical slabs.
- Radius language matches between media and controls (\`radius_scale\` / \`check_radius\`).
- Motion supports the story and is removable (\`motion_tokens\`).

**Apple-like**
- Confident whitespace; one idea at a time.
- Scroll reveals that teach — core content ships in markup, never opacity:0-until-scroll.
- Gridded yet exploratory, non-templated placement.

Refuse the median landing: symmetric hero left, widget card right, three feature cards, one CTA. Ground hero and sections in THIS subject so a swap would break it.`,
  },
  {
    key: "mobile",
    title: "Mobile & gestures",
    when: "targets, bottom nav, thumb reach, swipe",
    body: `**Fundamentals**
- Thumb zones rule: primary actions at the bottom, in easy reach.
- Bottom tabs ≤5. Content-first; prefer platform conventions.
- Touch targets ~44px min. Every list and page reacts to touch.

**Gestures**
- Swipe reveals secondary actions (Reminders/Mail pattern) — remove redundant chevrons once it exists.
- Don't duplicate controls the platform already provides (e.g. back).
- Visibility follows frequency and risk: global primary always visible; secondary on swipe; a temporary tooltip teaches the next action.

**Onboarding**
- One next action at a time — not a six-bullet modal dump.
- Preset lists still need search / custom / skip.

A tap with no visual response reads as broken. Verify press/transition timing with \`check_motion\` (ease-out, ≤500ms, honor prefers-reduced-motion).`,
  },
  {
    key: "motion",
    title: "Motion",
    when: "micro-interactions, restraint, meaningful transitions",
    body: `Motion is feedback and delight AFTER structure works — never a substitute. Tokens via \`motion_tokens\`; verify with \`check_motion\`.

**Micro-interactions**
- Hover/press: slide the text, scale the press, shift the color — physical feel.
- Toasts: quick enter/exit, optional undo. Tooltips: ~1s delay.
- Loading: skeleton or streamed tokens, not a frozen spinner.

**Restraint**
- Ease-out, feedback ≤500ms; no linear robotic fades.
- Identical fade-ins everywhere is a tell. One signature motion carries the page; the rest stays quiet.
- Parallax and ornaments only in spacious margins, never on the message.
- Scroll storytelling only when it explains value; degrade cleanly.

**Never**
- Motion that blocks navigation or delays the next action.
- opacity:0-until-scroll — core content ships in markup on load.
- Purpose-free complexity — over-animation is a top AI-slop tell.

Under prefers-reduced-motion, everything works and nothing stays hidden.`,
  },
  {
    key: "failure-modes",
    title: "Failure modes",
    when: "the recognizable AI-slop tells + concrete fixes",
    body: `The ranked tells, each with a one-line fix — hunt in this order.

- **shadcn/Tailwind default kit** (slate cards, one recycled blue, uniform padding + rounding) → ground palette and structure in the subject; \`check_color\` / \`check_palette\` / \`check_layout\`.
- **AI-purple / indigo accent** → derive the accent from real material; \`check_color\`.
- **Purple→blue gradient, especially gradient-on-text** → ban outright; one committed accent.
- **Over-animation** (everything fades/floats) → keep only motion that carries meaning; \`check_motion\`.
- **Rounded-everything** at one fat radius → concentric, varied radii; \`radius_scale\` / \`check_radius\`.
- **Dark + neon glow** (near-black ground + saturated accent) → give the ground a real hue, drop the glow.
- **Emoji as icons / bullets / chrome** → one real icon set (Lucide, Phosphor, Feather).
- **Default Inter / Geist** → a subject-grounded pairing; \`suggest_fonts\` / \`check_font\`.
- **Symmetric hero + three cards + CTA** → break it with a real hero and section variety; \`structure_ideas\` / \`check_layout\`.

**Structural tells:** harsh hard shadows (use soft, tinted, large-blur — \`shadow\` / \`check_shadow\`); inconsistent radius/type/button sizes; mismatched icon sets; flat hierarchy with no empty/loading/error states; five confused pricing tiers with hidden discounts; missing real pages (billing detail, analytics, empty).

**Sterile mush vs clutter:** stripping everything leaves a dead SaaS. Add structured personality — margin ornaments, one micro-motion, product-true visuals — while text stays calm.`,
  },
  {
    key: "checklist",
    title: "Ship checklist",
    when: "the master pre-ship checklist + surface recipes",
    body: `**Pre-ship checklist**
Structure — one primary job per screen? Grayscale-readable hierarchy? Related items grouped? Spacing on the 4/8 grid? Form matches data shape?
Interaction — hover/focus/active/disabled defined? Empty/loading/success/error designed? Progressive disclosure for secondary actions? Escape hatches (search/skip/cancel/back)? Feedback on destructive/async actions?
Visual — one type family, limited size steps? Neutrals dominate, accent scarce, semantics correct? AA contrast? One icon set, no emoji chrome? Radius/shadow language consistent? Dark mode retuned if offered? Run \`audit_system\` over the tokens.
Content — copy specific and short, CTAs match destinations? Product-true visuals? Motion removable? No dead cards or duplicated vanity KPIs?

**Surface recipes**
- SaaS dashboard: sidebar spine + object list/table + 1–2 real charts with ranges; layered neutrals, one accent, semantic statuses; first-run empty state; account card, not gradient-letter avatar.
- Marketing landing: hero = specific promise + product visual + one CTA; section variety; matching CTA labels; motion after structure.
- Mobile app: bottom nav ≤5, thumb-friendly targets; swipe for secondary; one onboarding action at a time.
- AI tool: prompt box first, context chips, streaming output; steps/sources for trust; inline refine, progressive advanced controls.
- Settings/billing: two-column or tabbed, no dead cards; honest price hierarchy, show discounts, fewer plans, payment method visible.

When in doubt: reduce color, strengthen hierarchy, finish the flow, make the next action obvious.`,
  },
];

export const REFERENCE_BY_KEY = Object.fromEntries(REFERENCE.map((r) => [r.key, r]));

export function renderReference(key) {
  const r = REFERENCE_BY_KEY[key];
  if (!r) return null;
  return `# fix-ai-slop reference — ${r.title}\n\n_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._\n\n${r.body}\n`;
}
