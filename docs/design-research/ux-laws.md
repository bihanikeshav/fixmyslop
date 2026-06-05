# UX Laws & Heuristics — Reference Guide

> A curated set of psychological and design principles that explain how people perceive, decide, remember, and act — grounding every UI decision in how minds actually work.

---

## Why it matters

Interfaces built on psychological reality outperform ones built on taste alone. These laws are not metaphors: most originate in empirical research (cognitive psychology, information theory, behavioral economics) and their effects have been reproduced in controlled studies and large-scale A/B tests. Knowing *which* law governs *which* design decision lets you argue choices with evidence, predict where users will stumble, and prioritize effort — instead of relying on aesthetic intuition that varies by designer and culture.

---

## Core laws

**1. Hick's Law** (William Edmund Hick & Ray Hyman, 1952)
Decision time grows logarithmically with the number of choices: **RT = a + b·log₂(n)**, where *n* is the number of equally probable alternatives, *a* is baseline reaction time, and *b* ≈ 0.155 s per bit of information. Adding choices always costs time, but the penalty is sub-linear — doubling options adds a constant increment, not a doubling of time.
*UI implication:* Prune navigation menus, reduce checkout steps, and collapse rare options under progressive disclosure. [[lawsofux.com/hicks-law](https://lawsofux.com/hicks-law/) | [Wikipedia](https://en.wikipedia.org/wiki/Hick%27s_law)]

**2. Fitts's Law** (Paul Morris Fitts, 1954)
The time to move to and select a target is **MT = a + b·log₂(D/W + 1)** (Shannon formulation; the original 1954 form uses log₂(2D/W)), where *D* is distance from cursor to target and *W* is target width. The log term is the Index of Difficulty (ID), measured in bits. Closer and wider targets are always faster to acquire.
*UI implication:* Make primary buttons large and position them near the user's likely cursor location; place destructive actions far away and small. [[Wikipedia – Fitts's law](https://en.wikipedia.org/wiki/Fitts%27s_law) | [York University HCI papers](https://www.yorku.ca/mack/hci1992.html)]

**3. Miller's Law** (George Miller, 1956)
"The average person can only keep 7 (plus or minus 2) items in their working memory." Miller's original paper, *"The Magical Number Seven, Plus or Minus Two"*, demonstrated that both absolute judgment and immediate memory span converge near 7 chunks. Crucially, the *chunk* — not the raw item — is the unit; familiar patterns (phone numbers, menu categories) can each count as one chunk regardless of internal complexity.
*UI implication:* Chunk navigation into groups of 5–7 labels; break multi-field forms into sections; don't use the number as an excuse to arbitrarily limit options. [[lawsofux.com/millers-law](https://lawsofux.com/millers-law/)]

**4. Jakob's Law** (Jakob Nielsen, c. 2000)
"Users spend most of their time on *other* sites. This means that users prefer your site to work the same way as all the other sites they already know." Users arrive with mental models built from every product they have ever used; violating those models forces relearning and erodes trust even when the novel design is objectively better.
*UI implication:* Follow platform conventions for icon placement, link color, form layouts, and navigation patterns; innovate on value, not on paradigm. [[lawsofux.com/jakobs-law](https://lawsofux.com/jakobs-law/)]

**5. Tesler's Law — Conservation of Complexity** (Larry Tesler, Xerox PARC, mid-1980s)
"For any system there is a certain amount of complexity which cannot be reduced." Complexity is conserved, not destroyed: whatever the designer removes from the UI must be handled somewhere — either absorbed into the product's internals or pushed back onto the user. Tesler's corollary: engineers should spend extra time so that millions of users don't have to.
*UI implication:* When a flow feels complex, ask *where* the complexity has gone — into documentation, into configuration screens, or into silent edge-case failures. [[lawsofux.com/teslers-law](https://lawsofux.com/teslers-law/)]

**6. Postel's Law — Robustness Principle** (Jon Postel, RFC 793, 1981)
"Be liberal in what you accept, and conservative in what you send." Originally a guideline for TCP implementations, the principle transfers directly to UI design: accept varied, imprecise, or non-standard input gracefully; emit output that is clean, predictable, and consistent.
*UI implication:* Accept phone numbers with or without dashes and parentheses; accept email in mixed case; auto-format rather than reject. [[lawsofux.com/postels-law](https://lawsofux.com/postels-law/)]

**7. Doherty Threshold** (Walter J. Doherty & Ahrvind J. Thadani, IBM Systems Journal, 1982)
"Productivity soars when a computer and its users interact at a pace (<400 ms) that ensures that neither has to wait on the other." The threshold shifted the prior industry benchmark from 2 seconds; below 400 ms, interactions feel instantaneous and users enter a state of flow. Above it, attention drifts and re-engagement costs additional time.
*UI implication:* Optimistic UI updates, skeleton screens, and perceived-performance tricks (progress animations) keep users below the threshold even when actual latency is higher. [[lawsofux.com/doherty-threshold](https://lawsofux.com/doherty-threshold/)]

**8. Peak-End Rule** (Kahneman, Fredrickson, Schreiber & Redelmeier, 1993)
"People judge an experience largely based on how they felt at its peak and at its end, rather than the total sum or average of every moment." The rule derives from Kahneman's broader work on the *experiencing self* vs. the *remembering self*; the remembering self weights the most emotionally intense moment and the final moment far above the rest.
*UI implication:* Obsess over error and empty states (negative peaks) and over confirmation/success screens (the end); a great onboarding exit impression outweighs a mediocre middle. [[lawsofux.com/peak-end-rule](https://lawsofux.com/peak-end-rule/)]

**9. Serial Position Effect** (Hermann Ebbinghaus, 19th century; named by subsequent researchers)
"Users have a propensity to best remember the first and last items in a series." The **primacy effect** encodes early items into long-term memory through rehearsal; the **recency effect** keeps late items in working memory. Middle items receive neither advantage.
*UI implication:* Place the most important navigation links at the far left (primary) and far right (recency) of a nav bar; bury low-priority options in the middle. [[lawsofux.com/serial-position-effect](https://lawsofux.com/serial-position-effect/)]

**10. Zeigarnik Effect** (Bluma Zeigarnik, 1920s)
"People remember uncompleted or interrupted tasks better than completed tasks." Zeigarnik demonstrated this in her doctoral research: waiters who had not yet delivered a bill remembered the order perfectly; after settling the bill, they forgot it rapidly. Open cognitive loops demand resolution.
*UI implication:* Progress bars, step indicators, and "X% complete" nudges exploit the Zeigarnik tension to pull users through multi-step flows. [[lawsofux.com/zeigarnik-effect](https://lawsofux.com/zeigarnik-effect/)]

**11. Aesthetic-Usability Effect** (Masaaki Kurosu & Kaori Kashimura, Hitachi Design Center, 1995)
"Users often perceive aesthetically pleasing design as design that's more usable." In the original study (252 participants, 26 ATM interface variants), aesthetic ratings correlated more strongly with *perceived* usability than with *measured* usability — demonstrating that beauty actively shapes the user's model of a product's quality.
*UI implication:* A polished visual layer provides a tolerance buffer: users forgive minor friction in beautiful products that they would reject in ugly ones — but it can also mask real usability problems in research. [[lawsofux.com/aesthetic-usability-effect](https://lawsofux.com/aesthetic-usability-effect/)]

**12. Law of Proximity** (Max Wertheimer, Gestalt psychology, 1923)
"Objects that are near, or proximate to each other, tend to be grouped together." Part of Wertheimer's foundational paper *"Laws of Organization in Perceptual Forms"* (Psychologische Forschung, 4, 1923), proximity is the strongest Gestalt grouping cue and operates pre-attentively — users group before they consciously look.
*UI implication:* Use whitespace to separate unrelated elements and tight spacing to signal belonging; form field labels should be closer to their input than to the field above. [[lawsofux.com/law-of-proximity](https://lawsofux.com/law-of-proximity/)]

**13. Law of Common Region** (extension of Gestalt grouping principles)
"Elements tend to be perceived as a group if they share an area with a clearly defined boundary." Where proximity uses distance alone, common region uses an explicit enclosure — a card, a panel, a background fill — to communicate grouping even when elements are spatially separated.
*UI implication:* Use card containers, bordered sections, or background-color bands to cluster related controls; don't rely on spacing alone when functional grouping must be unambiguous. [[lawsofux.com/law-of-common-region](https://lawsofux.com/law-of-common-region/)]

**14. Parkinson's Law** (Cyril Northcote Parkinson, The Economist, 19 November 1955)
"Any task will inflate until all of the available time is spent." Parkinson stated this originally as a satirical observation on British bureaucracy, but the underlying mechanism — work expands to fill available capacity — applies equally to user-facing time: if a form allows 10 minutes, users will take 10 minutes.
*UI implication:* Constrain task duration through autofill, smart defaults, and saved payment methods; set visible time estimates that anchor and motivate completion. [[lawsofux.com/parkinsons-law](https://lawsofux.com/parkinsons-law/) | [Wikipedia](https://en.wikipedia.org/wiki/Parkinson%27s_law)]

**15. Occam's Razor — Law of Parsimony** (William of Ockham, c. 1287–1347; *lex parsimoniae*)
"Among competing hypotheses that predict equally well, the one with the fewest assumptions should be selected." The Latin original — *pluralitas non est ponenda sine necessitate* ("plurality should not be posited without necessity") — predates the term "Occam's Razor" by centuries.
*UI implication:* Every UI element must justify its presence; if removing a control does not degrade functionality, remove it. Treat visual completion as the state where nothing more can be taken away. [[lawsofux.com/occams-razor](https://lawsofux.com/occams-razor/) | [IxDF](https://www.interaction-design.org/literature/article/occam-s-razor-the-simplest-solution-is-always-the-best)]

**16. Goal-Gradient Effect** (Clark Hull, 1932/1934)
"The tendency to approach a goal increases with proximity to the goal." Hull's original animal experiments showed rats running faster as they neared food; the effect transfers to human motivation — effort and engagement accelerate as completion nears, which is why loyalty programs give "headstart" stamps.
*UI implication:* Show progress early; "3 of 5 steps complete" motivates more than "2 steps remaining" because it frames the user as already ahead rather than behind. [[lawsofux.com/goal-gradient-effect](https://lawsofux.com/goal-gradient-effect/)]

**17. Von Restorff Effect — Isolation Effect** (Hedwig von Restorff, 1933)
"When multiple similar objects are present, the one that differs from the rest is most likely to be remembered." Von Restorff, a German psychiatrist, demonstrated this in memory studies: an isolated item in a homogeneous list is recalled disproportionately well.
*UI implication:* Reserve visual distinctiveness (color contrast, size, shape) for the single most important CTA per screen; using it on three elements means none of them stand out. [[lawsofux.com/von-restorff-effect](https://lawsofux.com/von-restorff-effect/)]

---

## Nielsen's 10 usability heuristics

Formulated by Jakob Nielsen and first published by Nielsen Norman Group; the canonical reference is the 1994 paper co-authored with Rolf Molich. [NN/g: [nngroup.com/articles/ten-usability-heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)]

1. **Visibility of system status** — Always inform users about what is happening through timely feedback.
2. **Match between system and the real world** — Use words, concepts, and conventions the user already knows.
3. **User control and freedom** — Provide clearly marked "emergency exits" for unwanted actions.
4. **Consistency and standards** — Follow platform conventions so users aren't surprised by synonyms or alternate patterns.
5. **Error prevention** — Design to prevent problems in the first place, before any error message is needed.
6. **Recognition rather than recall** — Make options visible; don't force users to remember information across screens.
7. **Flexibility and efficiency of use** — Support power-user shortcuts alongside the default path.
8. **Aesthetic and minimalist design** — Remove irrelevant or rarely needed information; every extra element competes for attention.
9. **Help users recognize, diagnose, and recover from errors** — Error messages: plain language, problem identification, constructive fix.
10. **Help and documentation** — When necessary, make documentation easy to search and focused on concrete tasks.

---

## How to apply (web UI)

**Navigation & information architecture**
- DO reduce top-level nav to ≤7 labeled items; use mega-menus or progressive disclosure for depth (Hick's Law, Miller's Law).
- DO place the primary CTA and the most-visited link at the left or right ends of nav bars (Serial Position Effect).
- AVOID hiding all secondary paths behind hamburger menus on desktop — recognition beats recall (Heuristic 6).

**Layout & visual grouping**
- DO use tight spacing (≤8 px) between a label and its input; use ≥24 px between unrelated form fields (Proximity).
- DO use card containers or background fills when spatial proximity alone is insufficient to signal grouping (Common Region).
- DO make the primary action visually distinct from all others on the screen; use that distinction once (Von Restorff Effect).

**Target sizing & placement**
- DO make primary buttons at least 44 × 44 px on touch, 32 px tall on desktop, placed near the natural end of a flow (Fitts's Law).
- AVOID placing destructive actions (delete, cancel) adjacent to confirmatory ones at the same size (Fitts's Law).

**Performance & feedback**
- DO provide visible feedback within 400 ms; use optimistic updates and skeleton screens to maintain perceived responsiveness (Doherty Threshold).
- DO show real or artificial progress bars in multi-step flows to trigger completion motivation (Zeigarnik Effect, Goal-Gradient Effect).

**Inputs & acceptance**
- DO accept phone numbers, postal codes, and dates in any common format; normalize server-side rather than rejecting at input (Postel's Law).
- DO use smart defaults and autofill wherever possible to shrink the time available for scope creep (Parkinson's Law).

**Aesthetics & trust**
- DO invest in visual polish — it increases tolerance for minor usability flaws and elevates perceived quality (Aesthetic-Usability Effect).
- AVOID over-polishing to the point of hiding real usability problems from your own team during testing (Aesthetic-Usability Effect).

**Endings & peak moments**
- DO design confirmation screens, empty states, and error states with the same care as the primary flow (Peak-End Rule).
- AVOID truncating the final step — a weak success state leaves the user's last memory negative (Peak-End Rule).

---

## Anti-patterns

1. **Choice avalanche** — Presenting 20 filter options simultaneously in a sidebar; violates Hick's Law and floods working memory (Miller's Law). Fix: collapsed facets, with the top 3–5 pre-expanded.

2. **Small touch targets on mobile** — Icon-only 24 × 24 px buttons far from thumb's natural resting position; directly violates Fitts's Law. Fix: minimum 44 × 44 px tappable area with adequate spacing.

3. **Snowflake navigation** — Renaming standard patterns ("Treasure Chest" for shopping cart, "My Universe" for profile) to seem playful; violates Jakob's Law and forces relearning. Fix: use familiar labels; innovate on content and value, not vocabulary.

4. **Progress theater without progress** — A spinner that runs for 8 seconds with no indication of state; violates Doherty Threshold and Heuristic 1 (visibility of status). Fix: incremental progress, percentage estimates, or step labels.

5. **Flat visual hierarchy** — Every button the same size and color so nothing reads as primary; negates the Von Restorff Effect. Fix: one dominant CTA per screen, secondary actions visually subordinate.

6. **Mid-flow complexity dump** — Asking for billing address, shipping preferences, VAT number, and gift message on a single unscrolled checkout screen; violates Tesler's Law (complexity pushed to user) and Miller's Law. Fix: multi-step checkout with chunked sections.

7. **Forgetting the ending** — A beautifully crafted onboarding flow that terminates on a generic "You're all set." in monochrome gray; violates the Peak-End Rule. Fix: celebrate completion with a moment of delight — illustration, animation, a specific next-step prompt.

8. **Orphaned labels** — A form where each label sits equidistant between two inputs, exploiting neither proximity nor common region to signal which input it belongs to. Fix: labels flush-above or flush-left of their own input, with increased gap between field groups.

---

## Sources

All URLs verified at time of writing (June 2026).

| Claim | Source |
|---|---|
| Hick's Law (1952), RT = a + b·log₂(n) | [lawsofux.com/hicks-law](https://lawsofux.com/hicks-law/) · [Wikipedia – Hick's law](https://en.wikipedia.org/wiki/Hick%27s_law) |
| Fitts's Law (1954), MT = a + b·log₂(D/W + 1) | [Wikipedia – Fitts's law](https://en.wikipedia.org/wiki/Fitts%27s_law) · [York Univ. HCI paper](https://www.yorku.ca/mack/hci1992.html) |
| Miller's Law (1956), 7±2 chunks | [lawsofux.com/millers-law](https://lawsofux.com/millers-law/) |
| Jakob's Law | [lawsofux.com/jakobs-law](https://lawsofux.com/jakobs-law/) |
| Tesler's Law (Xerox PARC, mid-1980s) | [lawsofux.com/teslers-law](https://lawsofux.com/teslers-law/) |
| Postel's Law (RFC 793, 1981) | [lawsofux.com/postels-law](https://lawsofux.com/postels-law/) |
| Doherty Threshold (IBM Systems Journal, 1982) | [lawsofux.com/doherty-threshold](https://lawsofux.com/doherty-threshold/) |
| Peak-End Rule (Kahneman et al., 1993) | [lawsofux.com/peak-end-rule](https://lawsofux.com/peak-end-rule/) |
| Serial Position Effect (Ebbinghaus) | [lawsofux.com/serial-position-effect](https://lawsofux.com/serial-position-effect/) |
| Zeigarnik Effect (1920s) | [lawsofux.com/zeigarnik-effect](https://lawsofux.com/zeigarnik-effect/) |
| Aesthetic-Usability Effect (Kurosu & Kashimura, 1995) | [lawsofux.com/aesthetic-usability-effect](https://lawsofux.com/aesthetic-usability-effect/) |
| Law of Proximity (Wertheimer, 1923) | [lawsofux.com/law-of-proximity](https://lawsofux.com/law-of-proximity/) · [Classics in History of Psychology](https://psychclassics.yorku.ca/Wertheimer/Forms/forms.htm) |
| Law of Common Region | [lawsofux.com/law-of-common-region](https://lawsofux.com/law-of-common-region/) |
| Parkinson's Law (The Economist, 1955) | [lawsofux.com/parkinsons-law](https://lawsofux.com/parkinsons-law/) · [Wikipedia – Parkinson's law](https://en.wikipedia.org/wiki/Parkinson%27s_law) |
| Occam's Razor (William of Ockham, c. 1287–1347) | [lawsofux.com/occams-razor](https://lawsofux.com/occams-razor/) · [IxDF – Occam's Razor](https://www.interaction-design.org/literature/article/occam-s-razor-the-simplest-solution-is-always-the-best) |
| Goal-Gradient Effect (Hull, 1932/1934) | [lawsofux.com/goal-gradient-effect](https://lawsofux.com/goal-gradient-effect/) |
| Von Restorff Effect (1933) | [lawsofux.com/von-restorff-effect](https://lawsofux.com/von-restorff-effect/) |
| Nielsen's 10 Usability Heuristics | [nngroup.com/articles/ten-usability-heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) |
| lawsofux.com (Jon Yablonski, aggregator) | [lawsofux.com](https://lawsofux.com) |

**Note on uncertain claims:** The exact year Jakob Nielsen coined "Jakob's Law" is not pinned in the public record; lawsofux.com lists it without a year and the NN/g article does not specify the original publication date. The mid-1980s dating for Tesler's Law comes from secondary sources; no primary Xerox PARC publication date was locatable. All formulas (Hick, Fitts) are sourced from Wikipedia and York University papers and match the standard HCI literature.
