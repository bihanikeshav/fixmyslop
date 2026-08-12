# fixmyslop reference — Ship checklist

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Pre-ship checklist**
Structure — one primary job per screen? Grayscale-readable hierarchy? Related items grouped? Spacing on the 4/8 grid? Form matches data shape?
Interaction — hover/focus/active/disabled defined? Empty/loading/success/error designed? Progressive disclosure for secondary actions? Escape hatches (search/skip/cancel/back)? Feedback on destructive/async actions?
Visual — one type family, limited size steps? Neutrals dominate, accent scarce, semantics correct? AA contrast? One icon set, no emoji chrome? Radius/shadow language consistent? Dark mode retuned if offered? Run `audit_system` over the tokens.
Content — copy specific and short, CTAs match destinations? Product-true visuals? Motion removable? No dead cards or duplicated vanity KPIs?

**Surface recipes**
- SaaS dashboard: sidebar spine + object list/table + 1–2 real charts with ranges; layered neutrals, one accent, semantic statuses; first-run empty state; account card, not gradient-letter avatar.
- Marketing landing: hero = specific promise + product visual + one CTA; section variety; matching CTA labels; motion after structure.
- Mobile app: bottom nav ≤5, thumb-friendly targets; swipe for secondary; one onboarding action at a time.
- AI tool: prompt box first, context chips, streaming output; steps/sources for trust; inline refine, progressive advanced controls.
- Settings/billing: two-column or tabbed, no dead cards; honest price hierarchy, show discounts, fewer plans, payment method visible.

When in doubt: reduce color, strengthen hierarchy, finish the flow, make the next action obvious.
