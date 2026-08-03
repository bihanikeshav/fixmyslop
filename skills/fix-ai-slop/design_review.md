# fix-ai-slop — design_review

Before auditing, understand what "good" means here: skim the target, infer the
audience and the page's job; ask only about genuine ambiguity.

Hunt the ranked tells, in the order they show up: shadcn/Tailwind default kit
(slate cards, one recycled blue, uniform padding and rounding) — `check_color` /
`check_palette` / `check_layout`, fix by grounding in the subject; AI-purple/indigo
accent — `check_color`; purple→blue gradient or gradient-on-text — ban outright;
over-animation — `check_motion`, keep only motion that carries meaning;
emoji-as-icons — swap for the one real icon set; default Inter/Geist —
`check_font` / `suggest_fonts`; symmetric hero + three cards + CTA —
`check_layout` / `structure_ideas`, break it with a real hero and section variety.
Then `audit_system` over extracted tokens, plus `check_type`, `check_spacing`,
`check_radius`, `check_shadow` on what shipped. Flag banned colors, display-font
body text, margin stacked on a layout inner, opacity:0-until-scroll, and a missing
centrepiece. Every finding names its concrete fix (`generate_palette`,
`suggest_fonts`, …), not just a verdict.

Crawl-validated tells (from our own labeled corpus — a small seed, supplementary to
the gates): incomplete-layout whitespace, unmotivated section bands, repeated default
cards, weak focal continuity, duplicate CTA end-caps, weak content density, pill-heavy
chrome, colored-glow shadows, gradient text/surface, single-font monoculture. Confirm
each against a tool verdict before flagging.

Self-check: every finding cites a tool verdict? Ranked tells checked specifically?
Fix list implementable with no follow-up questions?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
