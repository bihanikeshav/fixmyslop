# Onboarding & Empty States: Designing the Path to First Value

> Onboarding is the deliberate design of a new user's journey from signup to the moment they experience meaningful product value — and empty states are the most underused surface within it.

---

## Why It Matters

First impressions in digital products form within milliseconds, long before users consciously evaluate a feature set. Research from Nielsen Norman Group shows that a new user who hits a blank, unexplained screen is as likely to leave as to continue — the absence of guidance reads as the absence of product. Activation (the moment a user first experiences core value) is the single strongest predictor of long-term retention: users who do not activate in their first session rarely return regardless of how good the product becomes. Conversely, onboarding flows that reduce time-to-value measurably improve free-to-paid conversion; Appcues benchmarks top-performing SaaS companies at 20–40% free-to-paid conversion with optimized onboarding against much lower baselines. Every empty state, every coachmark, and every default datum is either shortening or lengthening the distance between signup and that first win.

---

## Core Principles

**1. Time-to-Value (TTV) as the North Star**
Time-to-value measures how quickly a new user reaches the moment they get something meaningful from the product. Shorter TTV correlates directly with day-1, day-7, and day-30 retention: users who experience value in their first session are reportedly 2–3× more likely to become retained customers [Appcues, *User Onboarding Best Practices*]. Onboarding should be ruthlessly organized around collapsing this gap — every step that does not move the user toward their first success is a step to defer or delete.

**2. The Aha Moment (Activation)**
The aha moment is the pivotal point at which a new user first understands what the product does for *them specifically* — not a feature demo, but a felt outcome. Samuel Hulick, who has teardown-analyzed hundreds of onboarding flows at useronboard.com, frames the distinction sharply: you cannot manufacture an aha moment by talking about it; you can only clear the path so users reach it by doing [Hulick, *useronboard.com*, empty-states pattern library]. Appcues notes that three-step guided tours have a 72% completion rate, while seven-step tours drop to 16% — the implication being that every step added before the aha moment is a compounding dropout risk [Appcues, *Aha Moment Guide*].

**3. Benefits-Led vs. Action-Led Onboarding**
Benefits-led onboarding shows users what they will gain before asking them to act — screenshots, value propositions, social proof. Action-led onboarding skips the pitch and puts users immediately into a task that generates value. Neither is universally correct. Benefits-led works for products where outcomes are not self-evident (complex B2B tools); action-led works where the core action is simple and instantly rewarding (Calendly: create a scheduling link, get your first booking). The design choice should follow the product's activation shape: if users can *do the thing* in under two minutes, get them doing it; if the thing requires prior framing, earn their attention with a tight value case first [Appcues, *Product-Led Onboarding*; Eleken, *Product-Led Onboarding*].

**4. Progressive Onboarding Over Front-Loaded Tours**
Progressive onboarding reveals features incrementally, mapped to user readiness: core task on session one, supporting features in week one, advanced capabilities in month one. Front-loaded product tours — the modal parade shown on first login — violate what NN/g calls the *paradox of the active user*: people want to use the product immediately, not study it. Upfront tours present information out of context, forcing users to memorize steps for situations they have not yet encountered; working memory fades in approximately 20 seconds [NN/g, *Onboarding Tutorials vs. Contextual Help*; NN/g, *Instructional Overlays and Coach Marks*]. Progressive onboarding respects this by surfacing guidance only when the user is at the exact moment they need it.

**5. Contextual / Just-in-Time Guidance**
NN/g distinguishes *push revelations* (tours that fire on page load regardless of user intent) from *pull revelations* (help triggered by user signals — hovering over an icon, entering a specific view, pausing on an empty container). Pull revelations are consistently more effective because the information is both timely and immediately applicable [NN/g, *Onboarding Tutorials vs. Contextual Help*]. A tooltip that appears when a user first opens the reporting dashboard teaches the dashboard; the same tooltip shown in a welcome modal teaches nothing, because the user is not in the dashboard.

**6. Empty States as the Most-Missed Onboarding Surface**
An empty state is any UI container that has no user-generated content — the blank project list, the unconnected integration panel, the dashboard before the first transaction. NN/g classifies three meaningful scenarios: *first-use empty states* (never populated), *user-cleared empty states* (content was deleted or completed), and *error/no-results states* (a search or filter returned nothing) [NN/g, *Designing Empty States in Complex Applications*]. Each requires different treatment. First-use states carry the highest onboarding weight: they are the natural moment to guide users toward their activation step. Leaving them blank is the most common and most costly onboarding omission [Appcues, *Product-Led Onboarding*; Hulick, *useronboard.com*].

**7. Empty-State Anatomy**
A functional empty state has three layers: (1) a **headline** that names what belongs here and why the space is empty — not "No data yet" but "Your dashboards will appear here"; (2) an **explanation** that teaches the feature's purpose in one sentence; (3) a **primary action** that takes the user directly to the creation flow or next step [NN/g, *Designing Empty States in Complex Applications*; Pencil & Paper, *Empty State UX*]. An illustration is optional and should only be added if it reinforces the message — Hulick cites designer Tamara Olson's heuristic: *two parts instruction, one part delight*, and warns explicitly that a cute illustration with no next step is "endearing, but a dead end all the same" [Hulick, *useronboard.com*].

**8. Blank-Slate Design and Sample/Demo Data**
When a user's first experience is a completely empty canvas (a new CRM, a new project management tool), cognitive load spikes because they must simultaneously understand what the product does, learn its data model, and create something from nothing. Sample data solves this: pre-populated content gives users something to interact with, poke, and understand before they commit their own data [InnerTrends, *Blank State Examples*]. Airtable pre-populates bases with examples relevant to the user's stated use case. Trello loads a sample board. Basecamp fills the dashboard with representative content. The distinction between *default data* (functional, stays until replaced) and *sample data* (clearly demo content, deleted once real use begins) matters — users should always understand which they are looking at.

**9. Endowed Progress Effect**
Joseph Nunes and Xavier Drèze demonstrated in a 2006 Journal of Consumer Research study that providing artificial advancement toward a goal increases the likelihood of completion. In their car-wash loyalty card experiment, customers given a 10-stamp card with 2 pre-filled stamps (needing 8 more) were 82% more likely to complete it than customers given an 8-stamp card starting from zero — despite requiring the same real effort [Nunes & Drèze, *The Endowed Progress Effect*, JCR 2006]. Applied to onboarding: mark one or two setup steps as already complete (e.g., "Account created ✓") before presenting the checklist. The user starts with momentum rather than from zero.

**10. Goal-Gradient Effect and Zeigarnik Effect**
Clark Hull's goal-gradient hypothesis (1932) states that effort accelerates as proximity to a goal increases — people move faster the closer they are to finishing. Bluma Zeigarnik's 1920s research demonstrated that incomplete tasks hold more cognitive prominence than completed ones; the brain keeps them "open" [lawsofux.com, *Zeigarnik Effect*]. Together these effects explain why visible progress indicators sustain onboarding completion: a checklist that shows 3 of 5 steps done triggers both effects simultaneously — the user feels pulled toward closure and accelerates. Appcues reports 15–25% higher completion rates when visible progress indicators are present [Appcues, *User Onboarding Personalization*].

**11. Personalization and Segmentation**
Onboarding that treats all new users identically is onboarding designed for no one. A lightweight welcome survey (2–3 questions maximum: role, primary goal, use case) enables branching flows where a "marketing manager" sees different first steps than a "developer." Canva exemplifies this: one entry-point question about intended use case shapes the templates, feature visibility, and tutorial content that follows. The signal a personalized flow sends — that the product was built for someone like this user — is itself a retention mechanism. Appcues notes that behavioral triggers (firing a message when a user completes step one but is absent for 48 hours) outperform time-based messages sent to all users on day three regardless of what they did [Appcues, *User Onboarding Personalization*].

**12. Coachmarks and Tooltips Done Right**
Coachmarks and tooltips are not inherently bad; they are widely abused. NN/g's guidelines for instructional overlays specify: address one unfamiliar interaction at a time, appear at the moment the user enters the relevant context (not on page load), be easily dismissable, and be retrievable after dismissal [NN/g, *Instructional Overlays and Coach Marks for Mobile Apps*, Aurora Harley, 2014]. The failure mode is a sequential overlay tour that covers the entire UI on first load, presenting five to ten coachmarks in a row. This forces the user to memorize every tip before they have any context for them, increases cognitive load, and is almost universally dismissed. Reserve coachmarks for non-obvious, non-standard interactions; skip them for anything a user can discover through normal exploration.

---

## How to Apply (Web UI)

**DO** treat every first-use empty state as an onboarding touchpoint: headline + one-sentence explanation + one primary CTA.

**DO** limit onboarding checklist items to 5 or fewer; pre-mark 1–2 items complete (account creation, email confirmation) to trigger endowed progress.

**DO** show a visible progress indicator (e.g., "3 of 5 steps complete") within the first session and keep it persistently accessible, not buried.

**DO** front-load only the one action that leads to the aha moment; defer all secondary features to week one or later.

**DO** use a 2–3 question welcome survey to branch users into role- or goal-specific flows before they reach the main UI.

**DO** pre-populate sample or default data for complex tools where a blank canvas creates confusion — label it clearly as example content.

**DO** trigger contextual tooltips from user behavior (entering a view for the first time, hovering over an unfamiliar control), not from page load.

**DO** distinguish between first-use, user-cleared, and no-results empty states and write different copy for each — they signal different situations to the user.

**DO** keep empty-state illustrations subordinate to instruction; if the illustration does not reinforce the next action, cut it.

**DO** make every onboarding element dismissable and re-findable; users who skip a tooltip should be able to find the same help via a help icon or tooltip trigger later.

**AVOID** showing a blank container with no copy — the user cannot distinguish "empty because nothing exists" from "broken" without explicit status text.

**AVOID** launching a sequential coachmark tour covering more than one or two features on first login.

**AVOID** gating the product behind a multi-step setup wizard before the user has experienced any value.

**AVOID** using "No data yet" or "Nothing here" as standalone empty-state copy — always add context and a next step.

**AVOID** applying the same onboarding flow to every user segment regardless of role, goal, or technical sophistication.

---

## Anti-Patterns

**The Upfront Feature Tour**
A modal carousel or sequential coachmark sequence shown on first login before the user has done anything. It presents information out of context, exploits 20-second working memory, is reflexively dismissed, and cannot be replayed without hunting through settings. NN/g documents this as among the most consistent failures in onboarding UX [NN/g, *Onboarding Tutorials vs. Contextual Help*].

**The Blank "No Data" Screen**
An empty container with no explanation. Users face three equally plausible interpretations: the feature is broken, the page is still loading, or they need to do something to populate it. None of these interpretations moves them forward. NN/g classifies this as a failure to communicate system status — the first and most fundamental usability obligation [NN/g, *Designing Empty States in Complex Applications*].

**Asking Too Much Before Delivering Any Value**
Requiring credit card entry, lengthy profile completion, or organizational setup before showing the user anything the product can do. The activation event should always precede a high-commitment request. Airbnb demonstrates the inverse: users browse listings, fall for a property, and create an account only when they are ready to book — the value comes before the ask [Appcues, *Aha Moment Guide*].

**Generic Empty States**
Copy that reads identically across all empty states regardless of which feature is empty ("Add something to get started"). This misses the dual opportunity of explaining what the feature does and directing the user toward the specific action that populates it. Empty states in onboarding should read like micro-documentation: context-specific, instructive, and action-oriented.

**Progress Indicators Without Endowed Progress**
An onboarding checklist that starts at 0% and demands five or more steps before the user sees anything move. Without an artificially advanced starting point, the user perceives a long road with no sense of momentum. The Nunes/Drèze finding — 82% higher completion with artificial head start — is among the most reliable effects in the onboarding literature [Nunes & Drèze, JCR 2006].

**Tours That Block the UI**
Modal overlays that must be dismissed before the user can interact with any part of the interface. These trade onboarding completeness for user resentment. Any overlay that requires dismissal before exploration teaches the user one thing: dismiss overlays on sight.

**One-Size Onboarding**
Routing every user through an identical flow regardless of prior experience, job role, or stated goal. A developer integrating an API and a non-technical marketer configuring a campaign have nothing in common at signup, and an undifferentiated flow serves neither. Segmentation at entry is the minimum viable personalization.

---

## Sources

- [NN/g — Designing Empty States in Complex Applications: 3 Guidelines](https://www.nngroup.com/articles/empty-state-interface-design/)
- [NN/g — Onboarding Tutorials vs. Contextual Help](https://www.nngroup.com/articles/onboarding-tutorials/)
- [NN/g — Instructional Overlays and Coach Marks for Mobile Apps (Aurora Harley, 2014)](https://www.nngroup.com/articles/mobile-instructional-overlay/)
- [Samuel Hulick — Onboarding UX Patterns: Empty States, useronboard.com](https://www.useronboard.com/onboarding-ux-patterns/empty-states/)
- [Appcues — User Onboarding Best Practices](https://www.appcues.com/blog/user-onboarding-best-practices)
- [Appcues — Product-Led Onboarding: The Complete Guide](https://www.appcues.com/blog/product-led-onboarding)
- [Appcues — Aha Moment Guide](https://www.appcues.com/blog/aha-moment-guide)
- [Appcues — User Onboarding Personalization: 5 Ways](https://www.appcues.com/blog/user-onboarding-personalization)
- [lawsofux.com — Zeigarnik Effect](https://lawsofux.com/zeigarnik-effect/) *(page confirmed reachable; goal-gradient URL returned 404 — principle sourced via Coglode and Appcues blog instead)*
- [Nunes, J. C. & Drèze, X. — "The Endowed Progress Effect: How Artificial Advancement Increases Effort," Journal of Consumer Research, 32(4), 2006](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=991962) *(SSRN preprint URL confirmed; full text behind Oxford Academic paywall)*
- [Pencil & Paper — Empty State UX Examples & Best Practices](https://www.pencilandpaper.io/articles/empty-states)
- [InnerTrends — 13 Blank State Examples You Can Use to Improve Onboarding](https://www.innertrends.com/blog/blank-state-examples)
- [Coglode — Goal Gradient Effect](https://www.coglode.com/research/goal-gradient-effect) *(verified reachable; used for Hull 1932 attribution)*
