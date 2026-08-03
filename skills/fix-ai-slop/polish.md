# fix-ai-slop — polish

Before any tool call, ask the user what stage this is (near-ship vs. early draft),
which surfaces most need finishing (interactive controls, elevation/depth, motion),
and whether prefers-reduced-motion support is already handled elsewhere.

Then run the finishing tools in turn: `radius_scale` / `check_radius` for concentric
corner nesting across nested elements, `shadow` / `check_shadow` for layered, tinted
elevation (never a flat default box-shadow), and `motion_tokens` / `check_motion` for
ease-out timing capped around 500ms on feedback interactions, confirming
prefers-reduced-motion is respected and nothing primary is hidden behind
opacity:0-until-scroll. Check that control sizing and corner radii read as one
family rather than several unrelated values, and re-run `audit_system` if a fuller
token set is available to catch anything the individual checks miss.

Self-check: did you ask which surfaces needed the pass before touching tokens? Do
shadows read as layered and tinted rather than flat? Does motion degrade cleanly
under prefers-reduced-motion with no content hidden pre-JS?

_The hard gates, forbid-the-median, and the ONE-standout bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
