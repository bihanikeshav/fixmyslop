# fix-ai-slop reference — Motion

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

Motion is feedback and delight AFTER structure works — never a substitute. Tokens via `motion_tokens`; verify with `check_motion`.

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

Under prefers-reduced-motion, everything works and nothing stays hidden.
