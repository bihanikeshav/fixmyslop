# Interaction Design: Affordances, Signifiers & Mental Models

> Good interaction design makes the right actions discoverable and the system's current state legible — eliminating the need to guess, remember, or read a manual.

## Why it matters

Users do not read interfaces; they act on them. Whether someone taps a button, drags a slider, or abandons a task in confusion depends entirely on whether the design communicated what was possible and what happened next. Don Norman's framework — assembled across the 1988 and 2013 editions of *The Design of Everyday Things* and refined in his jnd.org writing — gives designers a precise vocabulary for diagnosing and fixing that communication. For digital product teams the stakes are measurable: Nielsen Norman Group eyetracking research found users spent 22% more time on pages with weak signifiers and generated 25% more eye fixations before acting, with some page variants showing target-link noticeability dropping from 86% to 50% when strong visual cues were stripped away (NN/g, 2015).

---

## Core principles

**Affordance (Gibson's original sense)**
James Gibson coined "affordance" in *The Ecological Approach to Visual Perception* (1979) to describe action possibilities inherent in the relationship between an organism and its environment — "what it offers the animal, what it provides or furnishes." Crucially, a Gibsonian affordance exists whether or not the actor perceives it; it is an objective relational property, not a mental event. A ledge affords standing-on for a human regardless of whether the human notices the ledge.

**Affordance (Norman's design adaptation)**
Norman imported the term into HCI in the 1988 edition of *The Design of Everyday Things* but shifted its meaning toward perception: what matters to a designer is not what the object can do but what the user *believes* it can do. Norman later acknowledged this divergence explicitly — "I used affordance to mean perceived affordance" — and from the 2013 revised edition onward he recommends reserving "affordance" for the actual capability and using **signifier** for the perceivable cue (Norman, DOET revised ed., 2013; Norman, "Signifiers, not affordances," jnd.org, 2008). The practical upshot: on a flat screen, clicking is universally possible everywhere, so "adding an affordance" by placing an icon is a conceptual error — the designer is adding a *signifier* that points to an existing affordance.

**Signifier**
A signifier is any perceptible signal — deliberate or accidental — that communicates what actions are possible and how to perform them. Norman extends this to *social signifiers*: culturally interpreted cues such as a queue of people signalling "wait here," a desire path through a lawn indicating the preferred route, or a scrollbar indicating both document length and current position (Norman, jnd.org, 2008). Signifiers are more important to designers than affordances because they are the layer designers actually control. A button with a raised 3-D shadow is not a different affordance from a flat rectangle — both can be clicked — but only one *signals* its clickability. A 1995 study cited by NN/g found a 416% increase in clicks when buttons moved from flat to 3-D styling (NN/g, "Beyond Blue Links," nngroup.com, 2015).

**Feedback**
Every action must produce an immediate, informative response confirming the system received the input and indicating what state it is now in. Feedback closes the loop between the user's act and their understanding of its result. Nielsen's first usability heuristic states: "The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time" (Nielsen, "10 Usability Heuristics," nngroup.com). In interactive UI, this translates to hover states that respond on cursor entry, active/pressed states that compress visually on click, progress indicators during network operations, and success/error confirmations after form submission. Without feedback, users repeat actions, lose trust, and form incorrect mental models.

**Mapping and natural mapping**
Mapping is the relationship between controls and their effects. *Natural mapping* exploits spatial, metaphorical, or behavioral similarity so the relationship needs no labels or instructions. Norman's canonical example — stove burner controls arranged in the same spatial pattern as the burners they govern — eliminates the need for diagrams. NN/g identifies three types of natural mapping: spatial (macOS display arrangement mirrors desk layout), conceptual/metaphorical (iOS brightness slider uses "up = more" reinforced by white fill), and behavioral (a smartwatch wrist-raise-to-wake mirrors natural watch-checking behavior). Unnatural mappings force users to memorize arbitrary pairings, inflating cognitive load and error rates (NN/g, "Natural Mappings and Stimulus-Response Compatibility," nngroup.com, 2018).

**Constraints**
Constraints limit the action space, guiding users toward correct operations and blocking errors before they occur. Norman identifies three types: *physical* constraints are impossible to violate (a USB-A plug cannot be inserted upside-down, though USB-C removed even this); *logical* constraints are deducible from reasoning (a greyed-out "Submit" button signals that required fields are incomplete without any text explanation); *cultural* constraints are learned conventions shared within a community (scroll direction, colour semantics, the hamburger menu). Cultural constraints are powerful but fragile: they depend on shared prior experience and break when conventions diverge across platforms or audiences (Norman, DOET, 2013; Norman, "Affordance, Conventions and Design," jnd.org).

**Conceptual model (mental model)**
A conceptual model is the user's internal representation of how a system works — what it does, how its parts relate, and what to expect from each action. Users derive their conceptual model from affordances, signifiers, feedback, and mapping; designers shape it through those same channels plus documentation and onboarding. The goal is not accuracy but *predictive usefulness*: a conceptual model that lets users correctly anticipate the outcome of unseen actions is sufficient. When a system's actual behavior diverges from the user's model — as with the Windows 10 Bluetooth toggle that moved *toward* "Off" to turn Bluetooth *on* — errors are inevitable (NN/g, "The Two UX Gulfs," nngroup.com). Norman's principle: "The designer cares more about what actions the user perceives to be possible than what is true" (Norman, jnd.org).

**Gulf of Execution**
The gulf of execution is the gap between a user's intention and the actions the system makes available. It is wide when controls are hidden, labelled with system jargon rather than user goals, or require a sequence of steps the user has no reason to anticipate. Bridging it requires visible affordances and signifiers, natural mapping, and clear information architecture that surfaces the right controls at the right moment. The term was coined by Ed Hutchins, Jim Hollan, and Don Norman in 1986 in their paper on direct manipulation.

**Gulf of Evaluation**
The gulf of evaluation is the gap between the system's actual state and the user's ability to perceive and understand that state. A system that processes a request with no visible progress indicator, or that changes state without an on-screen confirmation, leaves the user unable to evaluate whether their action succeeded. Norman's seven-stage action cycle frames evaluation as three sub-steps: *perceive* the state, *interpret* the perception, *evaluate* it against the original goal. A wide gulf of evaluation forces repeated attempts and erodes trust (Norman, DOET, 2013; Wikipedia, "Seven stages of action").

**The seven stages of action**
Norman's full action cycle comprises: (1) form the goal, (2) form the intention, (3) specify the action, (4) execute, (5) perceive the resulting state, (6) interpret that state, (7) evaluate against the goal. Stages 1–4 traverse the gulf of execution; stages 5–7 traverse the gulf of evaluation. The cycle is a design checklist: every interface must provide signifiers and mapping for stages 2–4, and feedback for stages 5–7. Failures at any stage produce characteristic errors — wrong action (stage 3), no action (stage 4), misread state (stage 6), false sense of completion (stage 7) (Norman, DOET, 2013).

**Discoverability**
Discoverability is the meta-property that emerges when affordances, signifiers, constraints, mappings, and feedback are working together: users can figure out what to do without prior instruction. Norman distinguishes it from *understanding* (knowing why something works the way it does). A design can be usable without being fully understood — discoverability is the minimum bar. Its inverse, hidden functionality, is the primary cause of the "I never knew it could do that" class of usability failure.

---

## How to apply (web UI)

**DO: Give interactive elements a visually distinct resting state.** Buttons should look pressable — via border, background fill, or subtle shadow — not identical to surrounding text or decorative elements.

**DO: Change cursor to `pointer` on all clickable non-link elements.** The cursor change is a zero-latency signifier that costs nothing and significantly reduces click uncertainty on custom components.

**DO: Implement four interactive states for every control: default, hover, active/pressed, focus.** Each state confirms the user's action at a different stage of the interaction and is required for keyboard and assistive-technology users.

**DO: Communicate loading and processing with a visible indicator within 1 second of the triggering action.** Spinners, skeleton screens, and progress bars all bridge the gulf of evaluation during async operations. A blank or frozen UI reads as failure.

**DO: Confirm destructive or irreversible actions with a distinct confirmation step** — either a modal or inline confirmation — so the constraint is logical (only possible after consent) not just physical.

**DO: Keep labels on icons in navigation.** Icon-only navigation is mystery-meat navigation; users must hover or click to discover destination, forcing an extra cycle through the action stages.

**DO: Arrange form controls spatially to match the order users naturally think about the data** — natural mapping applied to form sequence (name before email, city before postal code).

**DO: Disable states must explain why and how to enable.** A greyed control without a tooltip or explanatory text provides a logical constraint but not the information needed to act. Show the condition: "Add an item to continue."

**AVOID: Ghost buttons (outline-only) as primary calls to action.** Their weak signifier depresses conversions; reserve ghost style for secondary actions where visual hierarchy demands less emphasis.

**AVOID: Colour alone to convey state.** Error red and success green are cultural constraints that fail for colour-blind users; pair colour with icon and text.

**AVOID: Removing underlines from body-copy links entirely** without an alternative strong signifier (colour contrast ratio ≥ 3:1 against surrounding text per WCAG). The underline is one of the most durable clickability signifiers on the web.

**AVOID: Hover-dependent discoverability.** Any feature reachable only via hover is invisible to touch users and screen readers; hover can *reinforce* a signifier, never be its only expression.

**AVOID: Reusing the same visual treatment for interactive and non-interactive elements.** If product cards, section headers, and navigation items share identical appearance, users must experiment to discover which are clickable — widening the gulf of execution.

---

## Anti-patterns

**Flat design stripping affordances.** Prolonged exposure to flat interfaces with minimal visual distinction "has been slowly reducing user efficiency" — NN/g longitudinal research found users who regularly encountered weak signifiers took more time and fixations to act even on familiar sites (NN/g, "Long-Term Exposure to Flat Design," nngroup.com, 2017). The Flat 2.0 response — subtle shadows, elevation layers, Google's Material Design — recovers signifier clarity within a modern aesthetic.

**No feedback on action.** Buttons that do not change state when clicked, forms that submit silently, and toggles that animate but never confirm the persisted value all leave the gulf of evaluation wide open. Users click again, submit duplicate requests, or assume failure and abandon.

**Mystery-meat navigation.** Coined by web designer Vincent Flanders in 1998, the term describes navigation composed of unlabeled icons or abstract graphics whose purpose is revealed only on hover or click. This forces users through an extra action-cycle loop (execute → perceive → evaluate) to discover what they already needed to know before deciding to click.

**False affordances.** Underlined text that is not a link, blue-coloured spans that lead nowhere, card layouts with subtle shadows applied to non-interactive elements — each trains users to mistrust the signifiers they rely on. Once false affordances appear in a system, users must test every element they wish to use, multiplying cognitive load across the entire interface.

**Progressive disclosure without a signifier.** Hiding advanced options is a valid use of constraint and logical affordance, but collapsible sections need a visible caret, chevron, or "Show more" label. A plain heading with no indicator that sub-content exists provides no signifier for the accordion behaviour; users never discover the feature.

**Ignoring disabled-state communication.** A greyed submit button satisfies the logical constraint (you cannot proceed until the form is valid) but fails discoverability if the user cannot determine which field is incomplete. The constraint must be paired with the signifier that explains it.

---

## Sources

| Citation | URL |
|---|---|
| Norman, D. *The Design of Everyday Things* (revised ed., 2013), Basic Books | (book, no canonical URL) |
| Norman, D. "Signifiers, not affordances," *jnd.org*, 2008 | <https://jnd.org/signifiers-not-affordances/> |
| Norman, D. "Affordance, Conventions and Design (Part 2)," *jnd.org* | <https://jnd.org/affordance-conventions-and-design-part-2/> |
| Norman, D. "Gestural Interfaces: A Step Backwards in Usability," *jnd.org* | <https://jnd.org/gestural-interfaces-a-step-backwards-in-usability/> |
| Gibson, J.J. *The Ecological Approach to Visual Perception* (1979), Houghton Mifflin | (book, no canonical URL) |
| Nielsen, J. "10 Usability Heuristics for User Interface Design," *nngroup.com* | <https://www.nngroup.com/articles/ten-usability-heuristics/> |
| Laubheimer, P. "The Two UX Gulfs: Evaluation and Execution," *nngroup.com* | <https://www.nngroup.com/articles/two-ux-gulfs-evaluation-execution/> |
| Whitenton, K. "Beyond Blue Links: Making Clickable Elements Recognizable," *nngroup.com*, 2015 | <https://www.nngroup.com/articles/clickable-elements/> |
| Pernice, K. "Flat UI Elements Attract Less Attention and Cause Uncertainty," *nngroup.com*, 2015 | <https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/> |
| Fessenden, T. "Flat Design: Its Origins, Its Problems, and Why Flat 2.0 Is Better for Users," *nngroup.com* | <https://www.nngroup.com/articles/flat-design/> |
| NN/g. "Long-Term Exposure to Flat Design: How the Trend Slowly Makes Users Less Efficient," *nngroup.com*, 2017 | <https://www.nngroup.com/articles/flat-design-long-exposure/> |
| Sherwin, K. "Natural Mappings and Stimulus-Response Compatibility," *nngroup.com*, 2018 | <https://www.nngroup.com/articles/natural-mappings/> |
| NN/g. "Visibility of System Status (Heuristic #1)," *nngroup.com* | <https://www.nngroup.com/articles/visibility-system-status/> |
| Wikipedia. "Seven stages of action" | <https://en.wikipedia.org/wiki/Seven_stages_of_action> |
| Interaction Design Foundation. "Affordances" | <https://www.interaction-design.org/literature/book/the-encyclopedia-of-human-computer-interaction-2nd-ed/affordances> |
