# fixmyslop reference — Mobile & gestures

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

**Fundamentals**
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

A tap with no visual response reads as broken. Verify press/transition timing with `check_motion` (ease-out, ≤500ms, honor prefers-reduced-motion).
