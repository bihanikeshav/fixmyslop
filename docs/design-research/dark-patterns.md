# Dark Patterns (Deceptive Patterns) & Ethical Design

> A dark pattern — now more precisely called a **deceptive pattern** — is a user-interface design that has been deliberately crafted to mislead, coerce, or obstruct users into taking actions that benefit the service at the user's expense.

---

## Why it matters

Deceptive patterns are not aesthetic choices; they are trust transactions cashed against the future. Research by Dovetail (2023) found that 56 % of users lost trust in a platform after encountering manipulative design, and 43 % stopped buying from the offending retailer entirely. Beyond brand damage, the legal environment has shifted materially: the EU's Digital Services Act (Article 25), GDPR consent guidelines, the California Privacy Rights Act (CPRA), and multi-hundred-million-dollar FTC enforcement actions against Epic Games, Vonage, and Amazon have made "we boosted conversions" an insufficient defense. For any quality-focused builder, avoiding these patterns is simultaneously an ethical obligation and a risk management requirement.

---

## The taxonomy (patterns to avoid)

The canonical list comes from Harry Brignull's deceptive.design (founded 2010), cross-referenced against Mathur et al.'s automated 2019 crawl of 11,000 shopping sites ("Dark Patterns at Scale"), which found 1,818 instances across 15 types on roughly 11 % of the sites surveyed [Brignull, deceptive.design; Mathur et al. 2019].

**1. Sneaking / Sneak into basket**
An item — a warranty, charity donation, or add-on — is silently added to the cart without the user choosing it. Pre-ticking the box or auto-adding at a low price is the canonical form.
*Honest alternative:* Never pre-select paid or recurring items; present optional extras as explicit, unchecked opt-ins. [Brignull, deceptive.design; Mathur et al. 2019]

**2. Hidden costs / Drip pricing**
A low headline price is shown throughout the funnel; taxes, service fees, or mandatory add-ons only appear at the final checkout step after the user has invested time and intent.
*Honest alternative:* Show the total price — inclusive of all fees — on the first pricing screen. [Brignull, deceptive.design; FTC 2022]

**3. Hidden subscription**
A one-off purchase or free trial silently converts to a recurring charge; the billing frequency is buried in small print or omitted from the confirmation email.
*Honest alternative:* State the billing amount, frequency, and renewal date in the primary CTA label before the user clicks. [Brignull, deceptive.design; Mathur et al. 2019]

**4. Hard to cancel (Roach motel)**
Sign-up is one click; cancellation requires a phone call during business hours, a multi-step "retention funnel," or a buried menu path. Named after the slogan "You can check in but you can't check out."
*Honest alternative:* Cancellation must be reachable from the same account screen used to subscribe and complete in the same number of steps as sign-up. [Brignull, deceptive.design; FTC 2022]

**5. Fake urgency**
A countdown timer or "Offer ends in 12:00:00" message implies a real deadline that either resets on page reload or is wholly invented.
*Honest alternative:* Use timers only for genuinely time-bounded promotions; if the offer resets, remove the timer. [Brignull, deceptive.design; Mathur et al. 2019 — "Countdown Timer," 393 instances]

**6. Fake scarcity**
"Only 2 left in stock!" or "3 people are viewing this right now" messages are either fabricated or dynamically inflated by third-party scripts to manufacture urgency.
*Honest alternative:* Show real stock figures only when genuinely limited; suppress the message when supply is ample. [Brignull, deceptive.design; Mathur et al. 2019 — "Low-stock Message," 632 instances]

**7. Fake social proof**
Testimonials of uncertain origin, purchased reviews, or fictional activity feeds ("Sarah from London just bought this") mislead users about popularity and quality.
*Honest alternative:* Display verified reviews from authenticated purchasers only; clearly label the source and date. [Brignull, deceptive.design; Mathur et al. 2019 — "Testimonials of Uncertain Origin"]

**8. Confirmshaming**
The opt-out label is phrased to shame the user: "No thanks, I don't want to save money." The framing exploits social identity rather than informing a decision.
*Honest alternative:* Write both options in neutral, parallel language: "Yes" / "No thanks." [Brignull, deceptive.design; Mathur et al. 2019 — 169 instances]

**9. Trick questions / Trick wording**
Double-negatives ("Uncheck to not receive marketing") or ambiguous toggle states exploit reading shortcuts to produce consent the user did not intend to give.
*Honest alternative:* Use affirmative, single-polarity language: "Send me offers (on/off)" with a visible, unambiguous default state. [Brignull, deceptive.design; NN/g]

**10. Disguised ads**
Paid placements are styled to look indistinguishable from organic search results, editorial content, or navigation elements, so users click them without knowing they are ads.
*Honest alternative:* Label all paid content with a clearly legible "Ad" or "Sponsored" indicator that meets WCAG contrast minimums. [Brignull, deceptive.design; FTC guidelines on endorsements]

**11. Misdirection / Visual interference**
Attention is deliberately steered away from the more user-favorable option — e.g., the "Cancel subscription" button is gray and tiny while "Keep my plan" is large and primary-colored.
*Honest alternative:* Apply the same visual weight to constructive and destructive actions; let hierarchy reflect task importance, not business preference. [Brignull, deceptive.design; Mathur et al. 2019; NN/g]

**12. Preselection**
Opt-in boxes for marketing, insurance, or data-sharing arrive pre-ticked; the cognitive default does the coercing.
*Honest alternative:* All opt-ins start unchecked; no consent box may be pre-selected. This is a legal requirement under GDPR Article 7. [Brignull, deceptive.design; EDPB Guidelines 3/2022]

**13. Obstruction / Friction asymmetry**
Accessing a privacy setting, downloading your data, or deleting an account is buried inside nested menus, requires emailing support, or demands re-entry of payment details.
*Honest alternative:* Privacy controls and account closure must be accessible within two navigation steps from the account homepage. [Brignull, deceptive.design; EDPB Guidelines 3/2022]

**14. Forced action**
The user must complete an unrelated task — creating an account to view a price, enabling notifications to continue reading — before they can accomplish their primary goal.
*Honest alternative:* Gate only what genuinely requires authentication; allow guest browsing and guest checkout wherever feasible. [Brignull, deceptive.design; Mathur et al. 2019]

**15. Nagging**
Repeated, dismissible prompts — "Enable notifications," "Rate us," "Upgrade to Pro" — interrupt the primary task even after the user has previously declined.
*Honest alternative:* After a user declines a prompt twice, suppress it for a minimum of 90 days; respect stored preferences across sessions. [Brignull, deceptive.design; NN/g]

**16. Privacy Zuckering**
Users are deceived into sharing more personal data than they intended by default privacy settings set to maximum exposure, or by burying data-sharing disclosures in lengthy terms.
*Honest alternative:* Default all data-sharing settings to off (privacy by default, GDPR Article 25); surface material sharing choices before — not after — sign-up. [Brignull, deceptive.design; EDPB Guidelines 3/2022]

---

## Persuasion vs manipulation

Robert Cialdini's six principles of influence — reciprocity, commitment/consistency, social proof, authority, liking, and scarcity — describe real and legitimate cognitive tendencies [Cialdini, *Influence*, 1984]. Used transparently, they inform decisions users will later endorse: genuine scarcity helps users prioritize; real social proof helps them evaluate quality. The manipulation line is crossed when these mechanisms are invoked through false signals (fabricated stock counts, invented reviews) or through context designed to impair deliberate choice (dark-background contrast for the "No" button, a countdown timer that resets). As Brignull frames it, the diagnostic question is simple: whose interests does this design choice serve — the user's, or the business's alone? [Brignull, *Deceptive Patterns*, 2023]. An honest persuasion design makes both the promotional pitch *and the exit* equally visible.

---

## How to apply (web UI)

**AVOID** pre-selecting any paid add-on, subscription tier, or marketing consent checkbox — unchecked is the only compliant default.

**AVOID** countdown timers that reset on page reload or session restart; every deadline shown must be real and verifiable.

**AVOID** revealing fees, taxes, or mandatory charges only at the final checkout step; total cost must appear at the first pricing touchpoint.

**AVOID** cancellation flows that require a phone call, a live chat, or more steps than the original sign-up.

**AVOID** "confirm-shaming" microcopy on opt-out labels; write both options in factual, parallel language.

**AVOID** stock or demand messages generated by third-party scripts unless they reflect verified, real-time inventory data.

**DO** apply identical visual prominence to "proceed" and "decline" actions; hierarchy should reflect task priority, not revenue priority.

**DO** store and respect user decisions about notifications, marketing, and data sharing across sessions without re-prompting.

**DO** make account deletion and data download reachable within two taps from the account settings homepage.

**DO** label every sponsored or paid content unit with a legible, high-contrast "Ad" or "Sponsored" badge.

**DO** use progressive disclosure for pricing: show the base price early and the full itemized total before any payment commitment.

**DO** default all privacy and data-sharing settings to their most restrictive state; users who want more sharing can opt in.

---

## Sources

| Citation | Verified URL |
|---|---|
| Harry Brignull — deceptive.design (founded 2010) | [https://www.deceptive.design/](https://www.deceptive.design/) |
| Brignull — full pattern taxonomy | [https://www.deceptive.design/types](https://www.deceptive.design/types) |
| Brignull — About deceptive.design | [https://www.deceptive.design/about-us](https://www.deceptive.design/about-us) |
| Mathur, Acar, Friedman, Lucherini, Mayer, Chetty, Narayanan — "Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites," *Proc. ACM Hum.-Comput. Interact.* Vol. 3, CSCW, Article 81 (Nov 2019) | [https://webtransparency.cs.princeton.edu/dark-patterns/](https://webtransparency.cs.princeton.edu/dark-patterns/) · [arXiv:1907.07032](https://arxiv.org/abs/1907.07032) |
| Nielsen Norman Group — "Deceptive Patterns in UX: How to Recognize and Avoid Them" | [https://www.nngroup.com/articles/deceptive-patterns/](https://www.nngroup.com/articles/deceptive-patterns/) |
| FTC — "Bringing Dark Patterns to Light" (Staff Report, September 2022) | [https://www.ftc.gov/reports/bringing-dark-patterns-light](https://www.ftc.gov/reports/bringing-dark-patterns-light) |
| FTC press release — "FTC Report Shows Rise in Sophisticated Dark Patterns" (Sept 15, 2022) | [https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers](https://www.ftc.gov/news-events/news/press-releases/2022/09/ftc-report-shows-rise-sophisticated-dark-patterns-designed-trick-trap-consumers) |
| European Data Protection Board — "Guidelines 3/2022 on Deceptive Design Patterns in Social Media Platform Interfaces" (adopted 14 Feb 2023) | [https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_en](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_en) |
| EU Digital Services Act — Article 25 prohibition on dark patterns (effective 2024) | [https://digital-strategy.ec.europa.eu/en/policies/digital-services-act](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act) |
| California Privacy Rights Act (CPRA) dark patterns prohibition (enforcement from March 2024) | [https://natlawreview.com/article/dark-patterns-come-to-light-california-data-privacy-laws](https://natlawreview.com/article/dark-patterns-come-to-light-california-data-privacy-laws) |
| Robert Cialdini — *Influence: The Psychology of Persuasion* (1984; 7th ed. 2021) | (book, no canonical URL) |
| Dovetail study on dark patterns trust erosion (2023) — cited in CBTW analysis | [https://cbtw.tech/insights/dark-patterns-in-ux-short-term-wins-long-term-business-risks](https://cbtw.tech/insights/dark-patterns-in-ux-short-term-wins-long-term-business-risks) |
