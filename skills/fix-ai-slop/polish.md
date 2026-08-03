# fix-ai-slop — polish

Understand the stage before touching tokens — near-ship or early draft, which
surfaces need finishing, whether prefers-reduced-motion is already handled; ask
only if not obvious from the target.

Run the finishing tools: `radius_scale` / `check_radius` (concentric nesting),
`shadow` / `check_shadow` (layered, tinted — never a flat default), `motion_tokens`
/ `check_motion` (ease-out, ≤500ms feedback, reduced-motion respected, nothing
hidden behind opacity:0-until-scroll). Control sizing and radii read as one family.
Re-run `audit_system` if a fuller token set is available.

Self-check: shadows layered and tinted, not flat? Motion degrades cleanly under
prefers-reduced-motion, no content hidden pre-JS?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
