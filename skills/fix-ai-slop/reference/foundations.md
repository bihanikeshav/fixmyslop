# fix-ai-slop reference — Foundations

_Craft knowledge to draw on, not a template. The gates in design-law.md are the only hard rules — invent for THIS subject and diverge freely._

UI is a language: a stranger reads relationships, availability, and priority with no manual.

**Signifiers & affordances**
- Show function AND state: containers, contrast, active fills. Related items share a container; selected sets get a distinct fill or outline.
- Inactive = reduced contrast, never primary-clickable.
- Four states per control: default, hover/focus, pressed, disabled — missing states is the loudest beginner tell (`check_motion`).
- Obscure icons: ~1s-delayed tooltip. Universal ones (home, search, user) stand alone.
- Spatial relationships (from → to): icon + alignment beats wordy labels.

**Hierarchy is contrast**
- Deliberate difference: size, weight, position, color, space, isolation.
- One primary job per region, made strongest; meta (dates, helpers) smaller, quieter.
- If everything is bold, nothing is — must survive grayscale before color.
- Marketing may run large display type; product UI text stays ≤ ~24px.

**Whole house**
Map entry, skip, search, error, return. Design empty/loading/error/success, not just the demo frame. Reuse components. No dead clickable-looking chrome; no nav without an active state.
