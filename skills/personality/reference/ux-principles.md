# UX & interaction principles

Terse, skill-ready rules for designing behavior, flows, and interaction. The deep
essays carry the full reasoning and citations.

## Affordances, signifiers & feedback
- Make interactive elements look interactive: give buttons a distinct resting state (border, fill, or shadow) — flat-vs-3D styling alone shifted clicks +416%.
- Implement four states on every control: default, hover, active/pressed, focus. Set `cursor: pointer` on clickable non-links.
- Give feedback within ~1s of any action; show a spinner, skeleton, or progress bar during async work. A frozen or silent UI reads as failure.
- Confirm destructive or irreversible actions with a distinct step (modal or inline) — make the constraint logical, not just physical.
- Keep labels on nav icons; icon-only is mystery-meat navigation. Never hide a feature behind hover alone (invisible to touch and screen readers).
- Disabled states must say why and how to enable ("Add an item to continue") — pair every logical constraint with the signifier that explains it.
- Never convey state by color alone (fails for color-blind users); pair color with icon and text.
- Avoid false affordances: underlines/shadows/blue text on non-interactive elements train users to distrust real signifiers.
→ deep dive: docs/design-research/affordances-signifiers.md

## UX laws (apply them)
- Fitts: make frequent/primary targets big (≥44×44px touch) and close; place destructive actions small and far, never adjacent to confirm at equal size.
- Hick: fewer choices = faster decisions. Prune menus, sequence and group choices so each decision point is small.
- Jakob: follow platform conventions (link color, icon placement, nav patterns); innovate on value, not paradigm. Don't rename standard patterns.
- Tesler: complexity is conserved — when a flow feels simple, check the removed complexity didn't get pushed onto the user or into silent edge-case failures.
- Postel: accept input liberally (phone with/without dashes, mixed-case email); normalize server-side instead of rejecting.
- Doherty: keep response under 400ms; use optimistic updates and perceived-performance tricks to hold flow.
- Peak-End: design error, empty, and success/confirmation states with the same care as the happy path — the peak and the ending dominate memory.
- Serial position: put top-priority nav links at the far left and far right; bury low-priority ones in the middle.
- Von Restorff: reserve standout treatment (color, size) for the single most important CTA per screen — use it once or nothing stands out.
- Goal-gradient + Zeigarnik: show progress early ("3 of 5 complete") to pull users through multi-step flows.
→ deep dive: docs/design-research/ux-laws.md

## Cognitive load & attention
- Working memory is ~4 chunks (Cowan), 7±2 ceiling (Miller). Group flat lists of >5 ungrouped items into labeled sections.
- Strip extraneous load (clutter, redundant steps, inconsistent labels); leave capacity for the task itself.
- Prefer recognition over recall: use menus, autocomplete, dropdowns, toggles wherever the answer set is bounded; show recent items and carry data forward between screens.
- Progressive disclosure: show only what the current step needs; defer advanced/rare options behind accordions, "More options," or a settings page.
- One primary CTA per screen; multiple equal-weight actions split attention and inflate decision time.
- Set smart, user-serving defaults (country from IP, recommended plan pre-selected) — defaults are the de facto choice. Never weaponize them (pre-checked opt-ins).
- Place feedback adjacent to its trigger; avoid change blindness (don't change a far region) and banner blindness (don't put critical info in ad-like top/right positions).
- Don't front-load mandatory tours — the active-user paradox means they're skipped. Surface help contextually, at the moment of need.
→ deep dive: docs/design-research/cognitive-load.md

## Information architecture & navigation
- Define structure (categories, hierarchy, labels) in a sitemap before designing any nav UI — structure constrains visuals, not the reverse.
- Organize by user tasks and mental models, never by internal org chart, team, or backend data model.
- Maximize information scent: labels must be specific, mutually exclusive, in user vocabulary. Kill vague labels ("Resources," "Solutions," "Explore").
- Optimize for scent at each decision point, not fewest clicks — the three-click rule is a myth; a five-click path with clear scent beats a two-click path with vague labels.
- Keep global nav to 5–7 destinations; favor broad-and-shallow over deep. Cap persistent hierarchy at ~3 levels; surface deep pages via contextual links, search, or hubs.
- Show persistent global nav on desktop — hidden/hamburger nav costs ~39% slower and 20%+ less findability. Reserve hamburger for tertiary/overflow.
- Use mega menus when a top-level item has 10+ subcategories; add breadcrumbs (hierarchy-based, not history) on sites with 3+ levels.
- Validate before building: open card sort (15–30 users) for structure, then tree test for >70% first-click accuracy on top tasks.
→ deep dive: docs/design-research/information-architecture.md

## Forms & input
- Earn every field via question protocol ("what will we do with this answer?"); cut the rest. Optimal checkout is 7–8 fields, not the 11+ average.
- Single-column layout, top-aligned labels (~50ms saccade vs ~500ms for left-aligned). Exception: inseparable short fields (City/State/ZIP).
- Always use a visible `<label for>`; never let placeholder text be the label (it vanishes on keystroke, fails contrast, breaks screen readers).
- Validate on blur, not keystroke (premature validation is hostile); clear the error on keystroke the moment the value becomes valid.
- Error messages: specific, adjacent to the field, instructive — "Enter your email as name@example.com," never "Invalid email." Never reset/clear input on error.
- Never signal errors by color alone: add icon/text plus `aria-invalid="true"` and `aria-describedby`.
- Mark optional fields "(optional)"; drop required-asterisks. Keep ≤2 optional fields.
- Pre-fill known data and ask users to confirm; match field width to expected input; set `autocomplete`, `type`, and `inputmode` (e.g. numeric for OTP/CVV) for usable mobile entry.
- Split complex forms into 3–5 steps, one topic per page, with a progress indicator; label the action "Continue," not bare "Submit."
→ deep dive: docs/design-research/forms-input.md

## Onboarding & empty states
- Organize everything around collapsing time-to-value; front-load only the single action that leads to the aha moment, defer secondary features to week one+.
- Treat every first-use empty state as onboarding: headline (name what belongs here) + one-sentence explanation + one primary CTA. Never ship a blank "No data" container.
- Write distinct copy for first-use, user-cleared, and no-results empty states; keep illustrations subordinate to instruction (two parts instruction, one part delight).
- Deliver value before high-commitment asks — no credit card, long profile, or setup wizard gating the first win.
- Use just-in-time guidance triggered by user behavior (entering a view, hovering), not page-load tours; make every tip dismissable and re-findable.
- Never launch a sequential coachmark tour or UI-blocking modal carousel on first login — reserve coachmarks for non-obvious interactions.
- Keep onboarding checklists ≤5 steps and pre-mark 1–2 done (endowed progress: ~82% higher completion) with a persistent progress indicator.
- Pre-populate clearly-labeled sample data for blank-canvas tools; branch flows from a 2–3 question welcome survey (role/goal) — one-size onboarding serves no one.
→ deep dive: docs/design-research/onboarding-empty-states.md
