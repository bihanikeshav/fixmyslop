# Distinctiveness: Designer & developer portfolios

> Personal portfolios are the one category where a single individual's sensibility can saturate every pixel — yet the default is a near-identical dark bg / Inter / green accent / GitHub timeline template that signals "developer" without saying anything about the actual person. The ones worth studying replace the template with a thesis.

---

## Exemplars

### Bruno Simon — bruno-simon.com
- **Signature:** The entire site is a drivable 3D car game rendered in WebGL (Three.js). Navigation — projects, social links, contact — happens by driving a tiny car to signpost objects on a stylized island. A full day–night cycle, seasons, and weather run in real time. Hidden achievements unlock vehicle skins; a daily leaderboard and "Whispers" system add multiplayer texture without shared physics. The whole thing is built in Blender with naming conventions that drive collision shapes and respawn points, then exported as DRACO-compressed GLTF under 2 MB. Original music was commissioned.
- **Transferable technique:** Make the navigation mechanism *be* the concept — one bold experiential gimmick that treats visitors as players rather than viewers. The form of interaction carries the personal brand more powerfully than any "about" paragraph.
- **Don't copy (slop if literal):** Copying the car or 3D island. The vehicle is already shorthand for Bruno Simon; a second one just signals imitation. The deeper lesson is conceiving a gimmick uniquely yours — not recycling his.

---

### Lynn Fisher — lynnandtonic.com
- **Signature:** A total visual redesign every year, starting from a blank CSS file. Each version uses a single CSS or layout constraint as its entire structural premise. The 2019 version: resizing the browser horizontally peels apart nested illustration faces like a matryoshka — each face splits into halves that slide outward using `100vw`-relative positioning and CSS masking. The 2023 version: a single four-layer SVG (exported from Illustrator) responds to `ResizeObserver` — shrinking reveals a grungy street; growing reveals a bright one — with a frame-animated walking sprite and a TV-glitch transition on direction change. The redesigns function as annual public research into what the browser can do.
- **Transferable technique:** Constraint-driven design as a creative engine. Choosing one specific, unfamiliar technology or CSS feature and building the entire site's concept around proving it out. The annual cadence also creates a body of public case studies.
- **Don't copy (slop if literal):** Copying any specific year's visual trick. The real method is the discipline of annual reinvention and the habit of picking one constraint that forces invention.

---

### Brittany Chiang — brittanychiang.com
- **Signature:** The definitive single-page dev portfolio — a long dark-themed scroll with numbered sections, a sticky left-side nav, Calibre + SF Mono typefaces, teal-green accents, a tabbed work-history carousel, and a "load more projects" transition. Every interactive state has a micro-animation. The design is clean enough to be deeply cloned (the v4 GitHub repo has thousands of forks), which is both its achievement and its trap.
- **Transferable technique:** Systematic micro-interaction polish across every state — hover, focus, load, transition. The discipline of making every interactive surface feel considered, not default. A single typeface pairing (serif-adjacent display + monospace) reinforces the dev-meets-design identity.
- **Don't copy (slop if literal):** This exact combination — dark bg, teal/green, Calibre, numbered sections, GitHub link in nav — has become the canonical "dev portfolio template." Cloning it signals you couldn't make your own choices.

---

### Robb Owen — robbowen.digital
- **Signature:** A portfolio that bleeds its side-project aesthetic directly into its own design language. Owen created SynthWave '84 — the neon-glow VS Code theme with over two million installs — and his portfolio applies the same high-contrast, atmospheric palette to his own presentation. Built-from-scratch tools (Tornis, which watches viewport state including cursor position, scroll, and gyroscope; Rekishi for history-API page transitions) are wired into the portfolio itself, so the site *runs on* tools he wrote for it. Motion and color do the heavy lifting; copy is spare.
- **Transferable technique:** Let a signature side project's aesthetic pervade the portfolio. If you made something the world uses, wear it. The portfolio becomes evidence, not résumé.
- **Don't copy (slop if literal):** Generic neon-on-dark "synthwave" styling without the accompanying craft that earns it. Decoration divorced from creation is just a theme download.

---

### Cassie Evans — cassie.codes
- **Signature:** Every page element is animated as if the site itself is the demo reel. SVG character animation (GSAP MotionPath + morphing) is embedded directly in the hero: a hand-drawn cartoon self-portrait performs idle animations and reacts to scroll and interaction. Blog posts are illustrated with bespoke animated diagrams rather than screenshots. The site's stated mission — "making the web more whimsical again" — is not rhetoric; the design is the argument. Evans is a GSAP core team member and the site functions as a living proof-of-concept for GSAP + SVG capabilities.
- **Transferable technique:** Use the portfolio itself as the primary demo of your speciality — not just a list of projects but a working specimen. If you teach animation, animate everything. The medium is the message.
- **Don't copy (slop if literal):** Generic "bouncy CSS animations on hover" as a substitute for actual motion design. Whimsy without craft reads as noise.

---

### Rauno Freiberg — raunofreiberg.com
- **Signature:** The site is conceived as a minimal desktop operating system. A persistent dock (with satisfying click animations and interface sounds that play on navigation) sits at the bottom. The main canvas displays an atmospheric abstract background. A horizontal side-scrolling feed surfaces projects, experiments, and photography — each category its own gallery. Dark mode and light mode toggle with a dock-click; the mode-switch animation is itself notable. The design enacts his obsession with tactile, polished micro-interactions rather than describing it.
- **Transferable technique:** Give the portfolio a single coherent spatial metaphor — one that maps naturally to the kind of work you do — and commit to all its conventions (sounds, transitions, spatial logic) rather than stopping at surface decoration.
- **Don't copy (slop if literal):** The OS/dock metaphor itself, which has now been widely replicated as a portfolio trope. The underlying principle — pick a metaphor and build all interactions from it — remains transferable.

---

### Josh Comeau — joshwcomeau.com
- **Signature:** A blog-forward portfolio that makes its interactive teaching style into the design identity. Every article embeds custom React components — live manipulable playgrounds, animated explainers — built in MDX. The site uses a custom cartoon avatar (rendered in both light and dark variants) rather than a photograph. Sound effects can be toggled; the site emits satisfying audio cues on certain interactions. The color palette is warm and inviting against dark. There is no template or component library — the site is hand-built to reflect the pedagogical philosophy: understanding comes from playing, not reading.
- **Transferable technique:** Make the design philosophy of your work visible *in* the portfolio's own construction. If you teach interactivity, make the site interactive. Custom illustrations in place of photos are cheap to produce and dramatically raise perceived originality.
- **Don't copy (slop if literal):** Dropping in emojis and a cartoon avatar as if those alone provide personality. The distinctiveness comes from the *interactive MDX articles*, not the decoration layer.

---

### Adam Argyle — nerdy.dev
- **Signature:** A feed-style blog/portfolio structured like a personal social network. Multiple authored "personas" (atom@argyleink, dad@pops, webmaster@admin) each have distinct avatars — 8-bit animated, evil cyborg, family snapshot — creating a layered identity instead of a single professional mask. A hotpink accent color on a neutral background runs throughout. Content is filterable by type (css, ai, js, html, tools, talks). The design surface is deliberately approachable and playful — skull imagery, banjo references, neologisms — while the substance (GUI Challenges, open-props, VisBug) is technically authoritative.
- **Transferable technique:** Faceted persona navigation — organizing a portfolio by the different *modes* or *voices* of a person rather than by project type — is a genuinely different information architecture that acknowledges complexity of identity.
- **Don't copy (slop if literal):** Hotpink + skull iconography as aesthetic shorthand for "I'm not a boring developer." Without the underlying body of open-source work and teaching, the styling is just costume.

---

## Category pattern

What separates memorable portfolios from the templated middle is a single strong thesis — Bruno's car, Lynn's annual constraint, Rauno's OS metaphor, Cassie's site-as-specimen — that pervades every design decision rather than being layered on top. The most effective portfolios *demonstrate* the person's sensibility rather than *describing* it. Typography, color, and interaction are corollaries of the thesis, not the thesis itself.

The recurring technique is commitment: picking a concept strange enough to be unmistakable and following all its implications through to the edges (sounds, transition logic, metaphor consistency). Half-committed concepts read as awkward; fully-committed ones read as mastered.

This category is the closest analogue to genuine page personality — a portfolio site has the fewest external constraints (no brand police, no product requirements) and thus most nakedly exposes whether a designer made a *choice* or fell back on convention.

The category slop is the dark/Inter/green/GitHub-stats/numbered-sections timeline — a template so widely cloned from Brittany Chiang's v4 that it now signals absence of judgment rather than technical competence. The irony is that Brittany's original had craft behind it; the copies have only the form.

---

## Sources

- [Bruno Simon — Awwwards Case Study](https://www.awwwards.com/brunos-portfolio-case-study.html) — verified
- [Bruno Simon — Awwwards Site of the Month](https://www.awwwards.com/bruno-simon-portfolio-wins-site-of-the-month.html) — verified
- [Lynn Fisher — Case Study 2019 refresh](https://lynnandtonic.com/thoughts/entries/case-study-2019-refresh/) — verified
- [Lynn Fisher — Case Study 2023 refresh](https://lynnandtonic.com/thoughts/entries/case-study-2023-refresh/) — verified
- [Lynn Fisher — About](https://lynnandtonic.com/about/) — verified
- [Rach Smith — The incredible websites of Lynn Fisher](https://rachsmith.com/the-incredible-websites-of-lynn-fisher/) — verified
- [web.dev — Community highlight: Lynn Fisher](https://web.dev/blog/community-highlights/lynn-fisher) — verified
- [Brittany Chiang — One Page Love award](https://onepagelove.com/brittany-chiang) — verified
- [Robb Owen — SynthWave '84 VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=RobbOwen.synthwave-vscode) — verified (2M+ downloads confirmed Oct 2024)
- [Robb Owen — robbowen.digital](https://robbowen.digital/) — verified
- [Rauno Freiberg — Killer Portfolio feature](https://www.killerportfolio.com/by/rauno-freiberg) — verified; OS/dock/sounds details sourced here
- [Rauno Freiberg — ui.land interview](https://ui.land/interviews/rauno-freiberg) — verified
- [Rauno Freiberg — raunofreiberg.com](https://raunofreiberg.com/) — verified
- [Cassie Evans — WebExpo interview](https://webexpo.net/blog/animating-the-impossible-cassie-evans-gsap/) — verified
- [Cassie Evans — cassie.codes](https://www.cassie.codes/) — URL confirmed; direct fetch failed (TLS); design details sourced from multiple secondary references
- [Josh Comeau — joshwcomeau.com](https://www.joshwcomeau.com/) — verified
- [Adam Argyle — nerdy.dev](https://nerdy.dev/) — verified
