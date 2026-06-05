# Accessibility & Inclusive Design for the Web

> The practice of designing and building digital products so that people with disabilities — and everyone else — can perceive, operate, understand, and use them without barriers.

## Why it matters

An estimated 1.3 billion people — 16% of the global population, roughly 1 in 6 — live with a significant disability [WHO, "Disability and Health," 2023]. That number is conservative; it excludes temporary impairments (a broken arm, post-surgery recovery) and situational ones (bright sunlight washing out a screen, a parent holding a newborn while navigating one-handed). Legal exposure is real and growing: the ADA is interpreted by U.S. courts to cover websites, the EU's European Accessibility Act entered enforcement on 28 June 2025 and requires WCAG 2.1 AA compliance across most private-sector digital products, and Section 508 binds all U.S. federal agencies to WCAG 2.0 AA — with more than 4,000 U.S. accessibility lawsuits filed annually [Level Access, "International Accessibility Laws," 2026]. Beyond compliance, accessibility is a quality multiplier: every design constraint that makes a product usable for someone with a disability almost always improves usability for everyone, a phenomenon called the curb-cut effect [TestParty, "The Curb Cut Effect," 2024].

---

## Core principles

**1. POUR — the four pillars of WCAG.**
The Web Content Accessibility Guidelines (WCAG), published by W3C/WAI, organize all success criteria under four properties: Perceivable, Operable, Understandable, and Robust. Anything that fails one of these four cannot be considered accessible. WCAG 2.2, published as a W3C Recommendation on 12 December 2024, adds nine new success criteria to the 78 in WCAG 2.1 (and removes 4.1.1 Parsing, which was never reliably testable), bringing the total to 87 [W3C, WCAG 2.2, https://www.w3.org/TR/WCAG22/]. WCAG 2.2 is fully backward-compatible: content conforming to 2.2 also conforms to 2.1 and 2.0.

**2. Perceivable — text contrast and sensory alternatives.**
Information must be presentable in at least one form every user can detect. SC 1.4.3 (AA) requires normal body text to meet a **4.5:1** contrast ratio against its background; large text (≥18 pt, or ≥14 pt bold) requires **3:1** [WebAIM, "Contrast and Color Accessibility," https://webaim.org/articles/contrast/]. SC 1.4.11 (AA, introduced in WCAG 2.1) extends the 3:1 rule to non-text UI components — borders of text inputs, icon-only buttons, focus indicators, chart elements — and graphical objects needed to understand content [Deque, "1.4.11 Non-Text Contrast," https://dequeuniversity.com/resources/wcag2.1/1.4.11-non-text-contrast]. The AAA tier demands 7:1 for body text and 4.5:1 for large text. Contrast ratios cannot be rounded: a 4.47:1 ratio fails the 4.5:1 minimum. SC 1.1.1 (A) requires all non-text content — images, icons, charts, audio — to carry a text alternative; decorative images take `alt=""` so screen readers skip them [The A11Y Project checklist, https://www.a11yproject.com/checklist/].

**3. Perceivable — resize and reflow.**
SC 1.4.4 (AA) requires text to be resizable to **200%** without loss of content or functionality, which means avoiding `px`-locked font sizes in CSS. SC 1.4.10 (AA, WCAG 2.1) requires Reflow: content must be presented without two-dimensional scrolling at a viewport width equivalent to **320 CSS pixels** (equivalent to 400% zoom on a 1280 px desktop screen) — the practical mandate for responsive design [W3C Understanding 1.4.10, https://www.w3.org/WAI/WCAG21/Understanding/reflow.html].

**4. Operable — keyboard accessibility.**
SC 2.1.1 (A) requires that all functionality is operable via a keyboard interface, with no requirement for specific timing between keystrokes. Native HTML interactive elements (`<a>`, `<button>`, `<input>`, `<select>`) are keyboard-accessible by default; anything built with `<div>` or `<span>` is not and requires explicit `tabindex`, event handling, and ARIA. SC 2.1.2 (A) adds No Keyboard Trap: focus must never become locked inside a component with no way out (e.g., a modal that cannot be dismissed with Escape).

**5. Operable — focus visibility.**
SC 2.4.7 (AA) requires a visible focus indicator on all interactive elements reached by keyboard [W3C Understanding 2.4.7, https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html]. This is the criterion developers most often violate by writing `outline: none` or `outline: 0` without providing an equivalent replacement. WCAG 2.2 added SC 2.4.11 Focus Not Obscured (AA), which requires the focused component to be at least partially visible (not hidden behind a sticky header or cookie banner). SC 2.4.13 Focus Appearance (AAA, 2.2) specifies the indicator must be at least 2 CSS pixels thick with a 3:1 contrast ratio between focused and unfocused states [W3C, "What's New in WCAG 2.2," https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/].

**6. Operable — target size.**
SC 2.5.8 Target Size Minimum (AA, WCAG 2.2) requires pointer targets to be at least **24 × 24 CSS pixels**, or positioned so that undersized targets have sufficient spacing such that a 24 px circle centered on each target does not intersect another target or the target's spacing offset [W3C, "What's New in WCAG 2.2"]. Apple's Human Interface Guidelines set the practical design floor higher — a minimum **44 × 44 pt** touch target — which reduces motor errors and benefits anyone using a finger rather than a precision pointer [Apple Developer Documentation, Accessibility, https://developer.apple.com/design/human-interface-guidelines/accessibility].

**7. Understandable — semantic HTML and information structure.**
SC 1.3.1 (A) Info and Relationships requires that structure, relationships, and meaning conveyed visually are also available programmatically — to assistive technology via the DOM and accessibility tree. The primary tool is semantic HTML: `<nav>`, `<main>`, `<header>`, `<footer>`, `<section>`, `<article>`, `<h1>`–`<h6>`, `<ul>`, `<table>`. Headings must form a logical sequence without skipping levels; each page should have exactly one `<h1>`. SC 1.3.3 (A) Sensory Characteristics forbids instructions that rely solely on shape, position, size, or color ("click the green button").

**8. Understandable — ARIA: powerful when correct, harmful when wrong.**
ARIA (Accessible Rich Internet Applications) adds roles, states, and properties to the accessibility tree when native HTML cannot express them — e.g., `role="dialog"`, `aria-expanded`, `aria-live`. The first rule of ARIA is: "If you can use a native HTML element or attribute with the semantics and behavior you require already built in, instead of re-purposing an element and adding an ARIA role, state or property, then do so" [W3C ARIA Authoring Practices, via MDN, https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA]. The WAI corollary is: "No ARIA is better than bad ARIA." The WebAIM Million 2025 report confirms this empirically: pages with ARIA present averaged **57 errors** versus **27 errors** on pages without ARIA, because developers add ARIA without implementing the required keyboard behaviors or dynamic state updates [WebAIM Million 2025, https://webaim.org/projects/million/2025].

**9. Understandable — accessible forms.**
SC 1.3.1 and 3.3.2 (A) require every form input to be associated with a visible `<label>` via matching `for`/`id` attributes; `aria-label` or `aria-labelledby` are acceptable when a visual label is not possible. SC 3.3.1 (A) requires errors to be identified in text — not only by color or icon — and SC 3.3.3 (AA) requires error suggestions where known. SC 3.3.7 Redundant Entry (A, WCAG 2.2) prohibits asking for the same information twice in a session unless re-entering is essential. Placeholder text is not a substitute for a label: it disappears on focus, has low contrast by default, and is not always announced by screen readers [The A11Y Project checklist].

**10. Operable — color independence.**
SC 1.4.1 (A) Use of Color requires that color is never the sole means of conveying information, indicating an action, or distinguishing a visual element. Error states must pair color with an icon, border change, or text message. Charts must use pattern fills or direct labels in addition to hue. This is especially critical given that approximately 8% of men and 0.5% of women have some form of color vision deficiency [WebAIM, "Contrast and Color Accessibility"].

**11. Operable — motion and seizure safety.**
SC 2.3.1 (A) Three Flashes or Below Threshold: content must not flash more than three times per second, or the flash must fall below general and red flash thresholds, to avoid triggering photosensitive seizures. SC 2.2.2 (A) Pause, Stop, Hide requires that moving, blinking, or scrolling content that lasts more than five seconds can be paused, stopped, or hidden by the user. SC 2.3.3 Animation from Interactions (AAA, WCAG 2.1) requires motion triggered by interaction to be disableable. The CSS `prefers-reduced-motion` media query is the implementation mechanism: it reads the OS-level "reduce motion" preference and lets you eliminate or substitute animations [W3C Technique C39, https://www.w3.org/WAI/WCAG21/Techniques/css/C39; MDN, "prefers-reduced-motion," https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion].

**12. Robust — conformance levels and programmatic determinism.**
WCAG defines three conformance levels: **Level A** (minimum, covers severe blockers), **Level AA** (the standard target required by most laws, including the EAA and ADA DOJ guidance), **Level AAA** (enhanced, not always achievable for all content). SC 4.1.2 (A) Name, Role, Value requires that for all UI components, name and role can be determined programmatically, states/properties that users can set can be set programmatically, and changes are notified to assistive technology. This is the catch-all criterion that bespoke JavaScript widgets most frequently fail.

**13. Inclusive Design — Microsoft's three principles.**
Microsoft's Inclusive Design methodology extends accessibility thinking to a design philosophy with three principles: (1) **Recognize Exclusion** — acknowledge that mismatches between people and experiences create exclusion by design, not by accident; (2) **Learn from Diversity** — center the people most affected by exclusion throughout the design process because their perspective reveals constraints invisible to the majority; (3) **Solve for One, Extend to Many** — designing for a person with a permanent disability produces solutions that benefit people with temporary or situational impairments too [Microsoft Inclusive Design, https://inclusive.microsoft.design/]. This is the curb-cut effect made explicit: curb cuts serve wheelchair users, but also parents with strollers, travelers with roller bags, and delivery workers with handcarts. On the web: closed captions, originally mandated for deaf users, now drive comprehension in noisy offices; keyboard navigation built for motor-impaired users serves power users; high-contrast modes built for low-vision users help anyone in bright sunlight [TestParty, "The Curb Cut Effect"; Konabos, "The Curb-Cut Effect: From Sidewalks to Source Code," https://konabos.com/blog/the-curb-cut-effect-from-sidewalks-to-source-code].

---

## How to apply (web UI)

1. **DO use semantic HTML first.** Reach for `<button>` not `<div onclick>`, `<nav>` not `<div class="nav">`, `<table>` for tabular data, `<h2>` for section headings. Native elements give you keyboard access, ARIA roles, and focus management for free.
2. **DO test color contrast with a tool.** Verify body text at 4.5:1, large text and UI components at 3:1. Use browser DevTools, WebAIM Contrast Checker, or Figma plugins before shipping. Don't round — 4.47:1 fails.
3. **DO provide a visible focus indicator.** Never write `outline: none` without replacing it. A custom outline that meets 3:1 contrast against surrounding colors (ideally 2 px solid offset) is better than none.
4. **DO associate every form input with a `<label>`.** Use matching `for`/`id` pairs. Never use placeholder text as a substitute for a label.
5. **DO write meaningful alt text for images.** Describe what the image communicates, not what it depicts ("Chart showing revenue grew 40% in Q3" not "bar chart"). Use `alt=""` for decorative images.
6. **DO make all interactive functionality keyboard-operable.** Test by unplugging your mouse: Tab, Shift-Tab, Enter, Space, Escape, and arrow keys should cover all interactions.
7. **DO respect `prefers-reduced-motion`.** Wrap non-essential animations in `@media (prefers-reduced-motion: no-preference)` so they only run when the user has not requested reduced motion.
8. **DO set `lang` on `<html>`.** Screen readers use the language attribute to select the correct pronunciation engine; missing it is one of the top six failure types in the WebAIM Million.
9. **DO size touch targets to at minimum 24 × 24 px (WCAG 2.5.8 AA); aim for 44 × 44 px** (Apple HIG) for primary interactive elements.
10. **DO use `rem` or `em` for font sizes** so that browser-level text zoom at 200% scales content without breaking layout.
11. **DO test reflow.** At 320 CSS px viewport width (or 400% zoom in DevTools), content should scroll in one direction only with no information loss.
12. **AVOID conveying meaning through color alone.** Always pair color with a text label, icon, border, or pattern.
13. **AVOID adding ARIA without implementing the required keyboard and state management.** If using `role="dialog"`, manage focus into the dialog on open, trap it inside, and return it on close.
14. **AVOID flashing content faster than 3 times per second** — this is a seizure risk, not just a style concern.
15. **AVOID hiding content with `visibility: hidden` or `display: none` while leaving it keyboard-focusable**; this strands keyboard users on invisible ghost elements.

---

## Anti-patterns

**Low contrast text.** Detected on 79.1% of home pages in the WebAIM Million 2025 report — the single most common failure. Small gray-on-white body copy and light placeholder text are the usual culprits. [WebAIM Million 2025]

**Removing focus outlines without replacement.** Writing `*:focus { outline: none; }` is the accessibility equivalent of hiding all signage in a building. Sighted keyboard users — not only screen reader users — lose their only location indicator.

**`<div>` and `<span>` as interactive controls.** A `<div onclick>` is not a button: it has no role, no keyboard events, no activation on Space/Enter, and no accessible state. Every fake button or fake link must manually replicate what `<button>` and `<a href>` provide for free. This is both fragile and a maintenance liability.

**Placeholder text as a label.** Placeholder disappears on focus or input, fails WCAG contrast thresholds at the default browser styling, and is not reliably announced by all screen reader/browser combinations. It may supplement a label but never replace one.

**Color as the only signal.** Red border on an error field communicates nothing to a user who cannot distinguish red from gray. The error must also announce itself through text (e.g., "Email is required") and ideally through an icon or changed border weight.

**Autoplay video and motion.** Autoplay video with sound violates SC 1.4.2 (Audio Control). Parallax scrolling, looping background animations, and entrance animations that fire automatically can trigger vestibular disorders and violate SC 2.2.2. Using `prefers-reduced-motion` and avoiding autoplay audio are both trivially implementable.

**Inaccessible modals and overlays.** Modal dialogs that do not trap focus allow keyboard users to interact with content behind the overlay (which is visually obscured), and screen readers will read out-of-view content in DOM order. A correct modal: moves focus to the first focusable element inside on open, traps Tab/Shift-Tab within it, closes on Escape, and returns focus to the trigger element on close.

---

## Sources

All URLs verified at time of writing (June 2026).

- W3C/WAI — WCAG 2.2 (Recommendation, 12 December 2024): https://www.w3.org/TR/WCAG22/
- W3C/WAI — WCAG 2.1: https://www.w3.org/TR/WCAG21/
- W3C/WAI — What's New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- W3C/WAI — Understanding SC 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- W3C/WAI — Understanding SC 1.4.10 Reflow: https://www.w3.org/WAI/WCAG21/Understanding/reflow.html
- W3C/WAI — Understanding SC 2.4.7 Focus Visible: https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- W3C/WAI — Understanding SC 2.4.13 Focus Appearance: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- W3C/WAI — Technique C39 prefers-reduced-motion: https://www.w3.org/WAI/WCAG21/Techniques/css/C39
- WebAIM — Contrast and Color Accessibility: https://webaim.org/articles/contrast/
- WebAIM — The WebAIM Million 2025: https://webaim.org/projects/million/2025
- MDN Web Docs — ARIA: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA
- MDN Web Docs — prefers-reduced-motion: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- The A11Y Project — Checklist: https://www.a11yproject.com/checklist/
- Microsoft Inclusive Design: https://inclusive.microsoft.design/
- Apple Developer Documentation — Accessibility (HIG): https://developer.apple.com/design/human-interface-guidelines/accessibility
- WHO — Disability and Health (fact sheet): https://www.who.int/news-room/fact-sheets/detail/disability-and-health
- Deque — 1.4.11 Non-Text Contrast (WCAG 2.1): https://dequeuniversity.com/resources/wcag2.1/1.4.11-non-text-contrast
- TestParty — The Curb Cut Effect: https://testparty.ai/blog/inclusive-design-benefits-everyone
- Konabos — The Curb-Cut Effect: From Sidewalks to Source Code: https://konabos.com/blog/the-curb-cut-effect-from-sidewalks-to-source-code
- Level Access — International Accessibility Laws 2026: https://www.levelaccess.com/blog/navigating-international-accessibility-laws/
