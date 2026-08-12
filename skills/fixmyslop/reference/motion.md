# fixmyslop reference — Motion

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

Motion is feedback and delight AFTER structure works — never a substitute. Every transition must clarify state, causality, hierarchy, or spatial relationship. Tokens via `motion_tokens`; verify with `check_motion`.

**One shared motion language**
- Centralize a small tier ladder: fast for local hover/focus/fades, moderate for controls and small overlays, slow for large dialogs, drawers, or stepped flows. Map travel distance and object mass to a tier; no component invents private timing.
- Use the engine's spring tokens for entry and movement. Interruption must be natural: a reversal continues from the current value instead of finishing, snapping back, or restarting.
- Exits are crisp and final: use no bounce and finish roughly one tier faster than the corresponding entry.

**Motion communicates relationships**
- Hover previews intent; press confirms contact; a shared selection background shows grouping; an expanding panel reveals where content came from. If the relationship is already obvious, prefer color/opacity over movement.
- Animate transform and opacity where possible. Never animate `top`, `left`, `width`, or `height` frame-by-frame when a transform or layout animation can express the same change.
- Animated variable-font weight can reflow labels. Prefer a non-layout treatment; if weight motion is essential, reserve the maximum width with an invisible ghost copy and keep the accessible name singular.

**Micro-interactions**
- Hover/press may shift color, weight, shadow, or a few pixels of transform. Keep the effect local and subordinate to focus-visible and selected states.
- Toasts enter quickly and exit faster, with undo when appropriate. Tooltips use a short deliberate delay.
- Loading uses skeletons, streamed tokens, determinate progress, or a step trail matched to expected wait time — not a frozen spinner.

**Restraint**
- Ease-out, feedback ≤500ms; no linear robotic fades. Identical fade-ins everywhere are a tell.
- One signature motion may carry a page; ordinary components share the quiet token ladder.
- Parallax and ornaments live in spacious margins, never on the message. Scroll storytelling only when it explains value and degrades cleanly.
- Multi-item reveals get a deliberate choreography: `cascade`, `wave`, or `simultaneous`; never add a uniform stagger by reflex.
- Text reveals per word/character belong only to narrative surfaces and never gate core copy. Numbers can count up when the change itself matters.

**Reduced motion is reduced displacement**
- Preserve instant state feedback through opacity, color, outline, and content changes. Remove positional travel, scale, parallax, and layout shifts.
- Disable proximity and magnetic attraction under reduced motion and on coarse pointers. Nothing stays hidden, inaccessible, or ambiguous.

**Never**
- Motion that blocks navigation or delays the next action.
- `opacity: 0` until scroll — core content ships visible in markup.
- Purpose-free complexity or multiple competing signature motions.

_Patterns distilled from Fluid Functionalism's [motion guidance](https://github.com/mickadesign/fluid-functionalism/blob/main/motion-guidelines.md); keep the shared principles while using this engine's generated tokens._
