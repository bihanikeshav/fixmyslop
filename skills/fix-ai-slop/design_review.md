# fix-ai-slop — design_review

Understand what "good" means for this page before auditing: skim the target if one
was given, work out the audience and what the page is trying to make someone do, and
ask only about whatever is genuinely ambiguous — a suspected problem area, an
audience you can't infer — rather than reciting a fixed list.

Then hunt the real-world slop tells, in roughly the order they actually show up: the
shadcn/Tailwind default kit (slate-gray cards, one recycled blue accent, uniform
padding, rounded corners on every element) — check with `check_color` /
`check_palette` and `check_layout`, fix by grounding the palette in the subject's
material and varying radius/elevation on purpose; AI-purple/indigo as the reflexive
accent — `check_color`, replace with an accent derived from the subject; a
purple→blue gradient or any gradient-on-text — `check_color`, ban outright; too many
hover/scroll animations moving things for no reason — `check_motion`, cut to the ones
that carry meaning; emoji standing in for icons — swap for the one real icon set in
use; Inter or Geist reached for by default — `check_font` / `suggest_fonts`, pick a
pairing that actually fits the subject; and the symmetric hero + three feature cards
+ CTA template — `check_layout` / `structure_ideas`, break it with a real hero and
section rhythm with variety. Beyond the tells, run `audit_system` over the page's
current tokens if they can be extracted, and `check_type`, `check_spacing`,
`check_radius`, `check_shadow` individually over whatever is actually shipped. Flag
any banned-band color, any display font used as body text, any margin stacked on top
of a layout-provided inner/container, any content hidden behind
opacity:0-until-scroll, and any missing centrepiece (atmosphere/mood with no
functional component). For each finding, name the concrete fix — re-run
`suggest_fonts` or `generate_palette` where needed, not just a verdict.

Self-check: does every finding cite a tool verdict, not just an opinion? Did you
check for the ranked slop tells specifically, not just the general gates? Is the fix
list concrete enough to hand to an implementer with no follow-up questions?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
