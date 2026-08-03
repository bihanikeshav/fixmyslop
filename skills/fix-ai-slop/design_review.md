# fix-ai-slop — design_review

Before any tool call, ask the user what "good" means for this page — what audience,
what the page is trying to make someone do, and whether there's a known problem area
(readability, color, layout) they already suspect. If a target was provided, skim it
first so your questions are pointed rather than generic.

Then audit systematically: run `audit_system` over the page's current tokens if they
can be extracted, and `check_color` / `check_palette`, `check_font`, `check_type`,
`check_spacing`, `check_radius`, `check_shadow`, `check_layout`, `check_motion`
individually over whatever is actually shipped. Flag any banned-band color, any
display font used as body text, any margin stacked on top of a layout-provided
inner/container, any content hidden behind opacity:0-until-scroll, and any
missing standout (atmosphere/mood with no functional component). For each finding,
name the concrete fix — re-run `suggest_fonts` or `generate_palette` where needed, not
just a verdict.

Self-check: does every finding cite a tool verdict, not just an opinion? Did you check
the font-as-body and layout-margin bugs specifically? Is the fix list concrete enough
to hand to an implementer with no follow-up questions?

_The hard gates, forbid-the-median, and the ONE-standout bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
