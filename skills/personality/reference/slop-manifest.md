# Slop manifest

The fingerprints of AI-generated UIs (2024–2025). In step 4 of the process, turn
the relevant ones into hard constraints for your build. Sources: the public
taxonomy at impeccable.style/slop (49 rules), the DON'Ts in Anthropic's and
impeccable's frontend-design skills, and this repo's own measured signal (the
generated block at the bottom). uupm.cc (UI/UX Pro Max) is cited as corroboration:
even a popular design database defaults to these (its SaaS palette is #2563EB, its
Micro-SaaS palette indigo #6366F1, its first pairings Inter/Poppins/Open Sans) —
which is exactly why they read as generic.

## Typography
- Flat hierarchy — sizes too close; no clear order.
- Icon tile stacked above every heading — the universal AI feature-card template.
- Oversized italic serif hero headline — the universal AI-startup hero.
- Hero eyebrow / pill chip — tiny uppercase tracked label above a giant headline.
- Repeated section kicker labels — tracked uppercase labels above every section.
- Oversized hero headline that eats the whole viewport.
- Crushed letter spacing past where glyphs keep their shape.
- Overused fonts — Inter, Geist, Space Grotesk, Instrument Serif feel generic now.
- One font for the entire page.
- All-caps body text (we read by word shape; caps removes it).

## Color & contrast
- The AI palette — purple/violet gradients, cyan-on-dark.
- Dark mode with glowing colored box-shadow accents as the default "cool" look.
- Gradient text on headings/metrics — decorative, not meaningful.
- Gray text on colored backgrounds — washed out; use a shade of the bg.
- Cream/beige "tasteful" page background reached for by reflex.
- Pure #000 / #fff — always tint; they don't occur in nature.

## Layout & space
- Hero metric layout — big number, small label, three stats, gradient accent.
- Identical card grids — same-size icon+heading+text cards, endlessly.
- Monotonous spacing — one value everywhere; no rhythm.
- Nested cards (cards inside cards).
- Numbered section markers (01 / 02 / 03) as editorial scaffolding.
- Line length over ~80 characters.
- Centering everything — left-aligned + asymmetry reads more designed.
- Wrapping everything in a card; not everything needs a container.

## Visual details
- Glassmorphism everywhere — blur/glass/glow as decoration, not layering.
- Thick accent border on one side of a rounded card — the most recognizable tell.
- Hairline border + wide diffuse shadow ("ghost card").
- Repeating-gradient stripes as surface decoration.
- Extreme border-radius (24px+ on a small card) — everything becomes a soft blob.
- Rounded rectangles with generic drop shadows — safe, forgettable.
- Sparklines / tiny charts as decoration that convey nothing.
- Modals when anything else would do.

## Motion
- Bounce/elastic easing — dated; use ease-out-quart/quint/expo.
- Animating layout props (width/height/padding/margin) — jank; use transform/opacity.
- Image hover scale/rotate — a recurring generated-UI signature.

## Copy
- Em-dash overuse in body copy.
- Marketing buzzwords — streamline, empower, supercharge, world-class, enterprise-grade.
- Aphoristic manufactured-contrast cadence ("It's not X. It's Y.").
- "Theater" framing as a dismissive tic.

## General quality (these are bugs, not style)
- Cramped padding / text touching the container or viewport edge.
- Justified text without hyphenation (rivers of white).
- Contrast below WCAG AA (4.5:1 body, 3:1 large).
- Skipped heading levels (h1→h3).
- Line-height below 1.3 (use 1.5–1.7 for body).
- Body text below 14px (16px ideal).
- Letter-spacing above 0.05em on body text.
- Broken/placeholder images shipping as broken boxes.

## Deceptive patterns (never — these are unethical, increasingly illegal)
- Confirmshaming — guilt-trip decline copy ("No, I hate saving money"). Use a neutral decline.
- Hidden costs / drip pricing — fees appear only at checkout. Show the full price at the first pricing screen.
- Hidden subscription — free trial silently converts to recurring charge. State amount, frequency, and renewal date in the CTA.
- Hard to cancel (roach motel) — sign-up is one click; cancellation requires a phone call. Match cancellation steps to sign-up steps.
- Fake urgency — countdown timer that resets on reload. Use timers only for real, verifiable deadlines.
- Fake scarcity — fabricated "Only 2 left!" Stock messages must reflect real inventory.
- Fake social proof — invented testimonials or activity feeds. Show verified reviews from authenticated purchasers only.
- Trick questions — double-negatives or ambiguous toggles that produce unintended consent. Use affirmative, single-polarity language.
- Preselection — opt-in boxes pre-ticked for marketing, insurance, or data-sharing. All opt-ins must start unchecked (GDPR Article 7).
- Disguised ads — paid placements styled as organic content. Label every sponsored unit with a legible "Ad" or "Sponsored" badge.
- Misdirection — "Cancel subscription" is gray and tiny; "Keep plan" is large and primary. Apply equal visual weight to both directions.
- Obstruction / friction asymmetry — privacy settings or account deletion buried in nested menus. Two steps from account home, maximum.
- Forced action — require account creation to view a price. Allow guest browsing and guest checkout wherever feasible.
- Privacy Zuckering — default settings expose maximum data. Default all sharing to off; users opt in to more.

→ deep dive: docs/design-research/dark-patterns.md

## The AI-slop test
If someone would instantly believe "an AI made this," it's slop. Aim for "how was
this made?"

<!-- GENERATED:data-tells:start -->
## Measured tells (this repo's crawl of 44 AI-built sites)
The fonts most likely to make a site read as generic, by how many crawled sites use them:
- Inter — 45% of sites (20/44)
- JetBrains Mono — 20% of sites (9/44)
- Plus Jakarta Sans — 9% of sites (4/44)
- Geist Mono — 7% of sites (3/44)
- Playfair Display — 5% of sites (2/44)
- DM Sans — 5% of sites (2/44)
- Lato — 5% of sites (2/44)
- Pacifico — 2% of sites (1/44)
- Bricolage Grotesque — 2% of sites (1/44)
- Albert Sans — 2% of sites (1/44)

Detectors we flag deterministically: AI purple/violet gradient, gradient text,
glassmorphism (backdrop-blur), pill buttons, extreme corner radius, tight hero
tracking, uppercase headings. See packages/crawl/src/style.ts.
<!-- GENERATED:data-tells:end -->
