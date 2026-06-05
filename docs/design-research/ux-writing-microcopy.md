# UX Writing & Microcopy: Words as Interface

> UX writing is the practice of crafting every word a user encounters in a digital product — labels, buttons, errors, empty states, helper text — so that the interface guides without friction, builds trust, and reflects a consistent human voice.

---

## Why it matters

Interface copy is not decoration. Nielsen Norman Group defines microcopy as "copy shorter than three sentences" that users scan more often than any other text on screen, making it the most-read content on most pages [NN/g, 3 I's of Microcopy]. When copy is vague, blaming, or misaligned with the user's mental model, it creates friction that compounds — a confusing button label means a wrong click, which means an error, which means a frustrated user reading a poorly-written error message. The inverse is also true: well-crafted copy reduces support volume, increases task completion, and builds the sense that someone competent is on the other side of the screen. Mailchimp's content strategy team makes the case plainly: "Educate our users about our products without patronizing or confusing them, so they can get their work done and move on." [Mailchimp Content Style Guide]

---

## Core principles

**1. Voice is constant; tone shifts by context.**
Voice is your product's personality — the stable set of values and characteristics that remain consistent across every surface. Tone is the emotional register you bring to any specific moment, and it must shift. As the Mailchimp Content Style Guide states: "You have the same voice all the time, but your tone changes." A friendly, plain-spoken voice can still use a quieter, more neutral tone on an error screen and a warmer, more celebratory tone on a success screen — what stays constant is the underlying character [Mailchimp, Voice and Tone]. Yifrah's framework for microcopy similarly treats brand personality and voice as a foundation from which contextual tone adjustments are made, not arbitrary decisions [Kinneret Yifrah, *Microcopy: The Complete Guide*, book — no canonical URL].

**2. Clarity is the first obligation.**
No amount of charm compensates for a user who does not understand what an element does. NN/g's 3 C's of informational microcopy place clarity first, defining it as copy that "delivers the key information clearly and usefully" — covering signposting (where am I?), information scent (where am I going?), relevance (why does this apply to me?), and appropriate terminology (does the audience know this word?) [NN/g, 3 C's of Microcopy]. The Mailchimp guide reinforces this as an absolute: "It's always more important to be clear than entertaining" [Mailchimp, Voice and Tone]. Shopify Polaris puts it architecturally: "Very few interfaces make sense without content. But each word and period adds noise to the experience, so every word should be weighed" [Shopify Polaris, Product Content / Fundamentals].

**3. Plain language lowers cognitive load.**
Plain language is not about dumbing down — it is about respecting the user's time and cognitive budget. The Plain Writing Act of 2010 (U.S.) established the legal basis for plain-language government communication, and the Federal Plain Language Guidelines define the goal as: "content written for its specific audience" that can be understood the first time it is read [Digital.gov / Federal Plain Language Guidelines]. In practice this means: active voice, common words over specialist vocabulary, sentences under 25 words, reading levels appropriate to the audience. Shopify Polaris targets a 7th-grade reading level for product interfaces [Shopify Polaris, Product Content / Fundamentals]. Apple's Human Interface Guidelines reinforce the directive: "Choose words that are easily understood and convey the right thing. Check each word to be sure it needs to be there. If you can use fewer words, you should." [Apple HIG, Writing].

**4. Concision: every word earns its place.**
NN/g's 3 C's framework names concision the second obligation, noting that "every word must serve a purpose" and that brevity enables scanning — the dominant behavior for interface copy [NN/g, 3 C's of Microcopy]. The WHO's navigation example in that same piece illustrates the point efficiently: removing "the" from "The Vaccination Information Hub" to get "Vaccination Information Hub" loses no meaning while reducing truncation risk. Shopify Polaris uses a Jenga analogy: remove words until removing another would cause the meaning to collapse [Shopify Polaris, Product Content / Fundamentals]. Mailchimp's TL;DR is direct: "Keep words and sentences short. Eliminate unnecessary modifiers." [Mailchimp TL;DR].

**5. Button and CTA labels must describe the outcome.**
Generic labels like "Submit" or "OK" force the user to infer what will happen. Every button label should answer the question: "What will this do for me?" The action verb plus the object is the standard pattern: "Save draft," "Delete account," "Send invoice." Mailchimp states: "Buttons should always contain actions" [Mailchimp TL;DR]. Apple's HIG advises: "When labeling buttons and links, it's almost always best to use a verb" [Apple HIG, Writing]. Shopify Polaris specifies imperative mood — "add apps" rather than "you can add apps" — and sentence case throughout: "Create purchase order," not "Create Purchase Order" [Shopify Polaris, Grammar and Mechanics]. Yifrah emphasizes that CTAs should communicate what the user gains, not what the system does [Kinneret Yifrah, *Microcopy: The Complete Guide*].

**6. Error messages: explain, don't accuse.**
NN/g's error message guidelines establish four requirements: use human-readable language, describe the exact problem, offer constructive next steps, and never blame the user [NN/g, Error-Message Guidelines]. The principle behind no-blame copy is that "the proper usage of any system lies with its creators" — if users are making a mistake, the design permitted it. Avoid words like "invalid," "illegal," or "incorrect," which carry implicit judgment. Passive constructions can soften attribution: "The email address wasn't recognised" rather than "You entered the wrong email." Apple's HIG is succinct: "It's always best to help people avoid errors. When an error message is necessary, it should avoid blame and be clear about what someone can do to fix it." [Apple HIG, Writing]. Wix's internal UX team documented this as "write like a person, not a machine" — use the language of a helpful colleague, not an error log [Wix UX, Medium, "When life gives you lemons, write better error messages"].

**7. Empty states are onboarding moments.**
An empty state — an inbox with no messages, a project with no tasks — is the product's first real teaching opportunity. NN/g describes it as a "teachable moment." [NN/g — referenced in raw.studio synthesis "Empty States, Error States & Onboarding"]. Copy for empty states should answer three questions: why is it empty, what should the user do first, and what value will result from that action. "No items" is not an empty state — it is an error of omission. "You haven't created any projects yet. Start one to track your team's work." is a starting point for onboarding. Pre-populated sample data (Asana's approach) takes the teaching even further by letting users see the product in action before investing their own content [LogRocket, "Empty states in UX done right"].

**8. Helper text and labels: just-in-time, not redundant.**
Form labels and helper text exist to remove uncertainty at the moment of action, not to re-explain what the label already says. Helper text should add information the label cannot carry: format requirements ("DD/MM/YYYY"), scope restrictions ("We'll only contact you about your order"), or security reassurances ("Your card number is never stored"). The Shopify Polaris approach to progressive disclosure applies here: reveal complexity incrementally rather than front-loading every caveat [Shopify Polaris, Product Content / Fundamentals]. NN/g's 3 C's notes the role of "relevance" in informational microcopy — explaining applicability, not restating the obvious [NN/g, 3 C's of Microcopy].

**9. Conversational but not cute.**
The goal is natural, human language — contractions are fine ("don't" over "do not"), first and second person is preferred, and reading aloud is a valid quality test: "Does this sound like something a human would say?" [Shopify Polaris, Product Content]. But conversational does not license forced whimsy. Mailchimp on humor: "We're weird but not inappropriate, smart but not snobbish." And critically: "Don't force humor. Forced humor is worse than none at all." [Mailchimp, Voice and Tone]. Cuteness that prioritises wit over comprehension actively undermines usability — if a user must pause to decode a clever metaphor, the copy has failed. Yifrah frames this as the difference between microcopy that motivates action and microcopy that performs personality [Kinneret Yifrah, *Microcopy: The Complete Guide*].

**10. Accessible copy is not optional.**
The W3C Web Accessibility Initiative (WAI) Writing Guidelines specify that link text must be descriptive in isolation, because screen reader users commonly navigate by listening to a list of links extracted from the page [W3C WAI, Writing for Web Accessibility]. "Click here" and "Read more" are inaccessible — they convey nothing out of context. Write: "Download the 2025 annual report (PDF, 1.2 MB)." Headings must reflect document hierarchy and carry semantic meaning (WCAG 2.4.6); they are the primary navigation mechanism for screen reader users. Error messages must identify the field and describe the fix — not merely signal that something failed [W3C WAI, Writing for Web Accessibility]. NN/g notes that relying on color alone to communicate an error excludes approximately 350 million people with color-vision deficiency [NN/g, Error-Message Guidelines].

**11. Consistency through content style guides.**
Ad hoc copy decisions at sprint pace produce inconsistent terminology that confuses users and erodes trust. A content style guide codifies decisions once so every writer and designer on the team makes the same calls without negotiating each time. Mailchimp publishes its full Content Style Guide under Creative Commons; Shopify's Polaris system covers voice, grammar, error messages, naming, alt text, and inclusive language; Apple's HIG writing section covers capitalization, punctuation, and tone norms. The Mailchimp guide defines the scope of such a guide: "Tone, terminology, button-label patterns, error structure, confirmations, and empty-state patterns should be standardized so teams aren't reinventing language every sprint." [Mailchimp Content Style Guide overview]. Consistency is the minimum bar for feeling professional.

**12. Jargon and marketing language destroy trust.**
Mailchimp's writing principles describe their audience as living "in a world muddled by hyperbolic language" — and that Mailchimp's job is to strip it away [Mailchimp, Writing Goals and Principles]. Jargon operates on two failure modes: technical jargon excludes non-expert users (use "loading" not "buffering," "sign in" not "authenticate"), while marketing jargon ("innovative," "seamless," "best-in-class," "leverage") signals insincerity without adding information. NN/g's research on web credibility has repeatedly found that promotional language triggers skepticism, as users have learned to treat buzzword-heavy copy as a reliability signal for unreliable claims. Shopify Polaris calls the underlying test a "human check": read the copy aloud — if it sounds like something no real person would say, revise it [Shopify Polaris, Product Content].

---

## How to apply (web UI)

**Buttons and CTAs**
- DO: Use verb + object: "Save changes," "Delete project," "Send message." Never "Submit," "OK," or "Click here."
- DO: Name the outcome from the user's perspective, not the system's action.
- AVOID: Verb-free labels ("New," "Settings") unless the noun is unambiguous in context.
- AVOID: All-caps buttons — they read as shouting and reduce legibility.

**Error messages**
- DO: State what happened, why (if known), and what to do next — three-part structure.
- DO: Use second person passively or neutrally: "This email isn't registered" rather than "You entered a wrong email."
- AVOID: Blame words: "invalid," "illegal," "incorrect," "failed."
- AVOID: Raw system codes or stack traces visible to end users.

**Voice and tone**
- DO: Use contractions in conversational contexts ("can't," "you're," "it's").
- DO: Shift tone by emotional context: quieter on errors, warmer on success, neutral on system information.
- AVOID: Treating tone shifts as voice changes — the personality stays constant.
- AVOID: Forced humor in high-stakes or repeated-error contexts.

**Concision**
- DO: Read every sentence and ask "which word can I cut?" — then cut it.
- DO: Lead with the most important information; put qualifications after the core message.
- AVOID: Filler phrases: "Please note that," "In order to," "At this point in time."

**Empty states**
- DO: Explain why the space is empty, prompt the first action, hint at the payoff.
- AVOID: Silence — no label at all is not a neutral choice; it reads as broken.

**Accessibility**
- DO: Write link text that makes sense read aloud in isolation.
- DO: Use headings as navigation landmarks, not just visual styling.
- AVOID: "Click here," "learn more," "read this" as standalone link text.

---

## Anti-patterns

**1. Vague button labels ("Submit," "Click here," "Proceed").**
These force users to infer outcomes, increasing hesitation and error rates. Every button must answer "What will happen?" in its label.

**2. Blaming error messages.**
"You entered an invalid password" frames the system's inflexibility as the user's failure. Blame increases frustration and abandonment. Use neutral or passive constructions; always offer a resolution path.

**3. Jargon and buzzwords.**
"Leverage our seamless, innovative onboarding experience" communicates nothing and signals marketing copy masquerading as UI text. Technical jargon ("authenticate," "parse," "endpoint") blocks non-expert users. Replace with plain equivalents every time.

**4. Cute over clear.**
Whimsical copy that requires interpretation adds cognitive load exactly where users need speed. Humor is a garnish, not a substitute for information. A 404 page can be clever; a checkout error cannot afford to be.

**5. Walls of helper text.**
Packing every form field with three lines of instructions signals distrust of the design. If the form requires that much explanation, the form needs redesigning. Reveal detail progressively; surface only the most decision-critical information inline.

**6. Generic link text ("here," "this page," "more").**
These are invisible to screen reader users navigating by link list, meaningless in search results, and vague to all users scanning a page. Describe the destination or action specifically.

**7. Inconsistent terminology.**
Calling the same thing "workspace," "project," and "team space" in different screens trains users to distrust the interface. Pick one term, define it in a style guide, and enforce it. Consistency is a form of reliability.

**8. Omitting empty states entirely.**
A blank screen with no copy communicates malfunction. Every zero-content state needs at minimum: a reason, a prompt, and if applicable a CTA. Silence is not neutral design.

---

## Sources

| Citation | URL / Note |
|---|---|
| NN/g — "The 3 I's of Microcopy: Inform, Influence, and Interact" | https://www.nngroup.com/articles/3-is-of-microcopy/ |
| NN/g — "The 3 C's of Informational Microcopy" | https://www.nngroup.com/articles/3-cs-microcopy/ |
| NN/g — "UX Copy Sizes: Long, Short, and Micro" | https://www.nngroup.com/articles/ux-copy-sizes/ |
| NN/g — "Error-Message Guidelines" | https://www.nngroup.com/articles/error-message-guidelines/ |
| NN/g — UX Writing topic hub | https://www.nngroup.com/topic/ux-writing/ |
| Mailchimp Content Style Guide — Voice and Tone | https://styleguide.mailchimp.com/voice-and-tone/ |
| Mailchimp Content Style Guide — Writing Goals and Principles | https://styleguide.mailchimp.com/writing-principles/ |
| Mailchimp Content Style Guide — TL;DR | https://styleguide.mailchimp.com/tldr/ |
| Mailchimp Content Style Guide — home | https://styleguide.mailchimp.com/ |
| Shopify Polaris — Product Content / Fundamentals | https://polaris.shopify.com/content/product-content |
| Shopify Polaris — Grammar and Mechanics | https://polaris-react.shopify.com/content/grammar-and-mechanics |
| Apple Human Interface Guidelines — Writing | https://developer.apple.com/design/human-interface-guidelines/writing |
| W3C WAI — Writing for Web Accessibility | https://www.w3.org/WAI/tips/writing/ |
| Digital.gov — Federal Plain Language Guidelines (redirected from plainlanguage.gov) | https://digital.gov/guides/plain-language |
| Plain Writing Act of 2010 | https://digital.gov/resources/federal-plain-language-guidelines |
| Kinneret Yifrah — *Microcopy: The Complete Guide* (2nd ed.) | Book — no canonical URL; ISBN 978-9655727944 |
| Wix UX — "When life gives you lemons, write better error messages" | https://wix-ux.com/when-life-gives-you-lemons-write-better-error-messages-46c5223e1a2f |
| LogRocket — "Empty states in UX done right: 4 inspiring examples" | https://blog.logrocket.com/ux-design/empty-states-ux-examples/ |
| raw.studio — "Empty States, Error States & Onboarding" | https://raw.studio/blog/empty-states-error-states-onboarding-the-hidden-ux-moments-users-notice/ |
