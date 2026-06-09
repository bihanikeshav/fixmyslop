# A/B/C test — no-skill vs /frontend-design vs our skill+API

Same briefs + same output spec (single self-contained HTML, hero + section). Only the
*method* varies. Objective score = structural severity (lower = better) from `api.mjs audit`.

| brief | no-skill control | /frontend-design | **our skill+API** |
|---|---|---|---|
| PitchPerfect | sev 12 (9 issues) | sev **24** (17) | **7** (3) |
| film festival | — | sev 11 (9) | **2** (1) |
| observability | — | sev 12 (11) | **9** (5) |
| coffee | — | sev 10 (8) | **2** (3) |
| board-game | — | sev 18 (13) | **3** (2) |

**Findings**
- **Our skill+API wins every brief, 3–8×** on measured slop (treatment sev 2–9 vs fd 10–24
  vs control 12). All 5 treatments end at `audit` PASS (a couple with a minor warm-color note).
- **`/frontend-design` is NOT measurably less sloppy than the naive baseline.** It produces
  handsome, considered pages, but keeps hitting the same tells: Playfair/Fraunces/DM Sans
  slop fonts, `opacity:0`+IntersectionObserver (broken without JS), bento/pill, dark+glow,
  and even hand-drawn SVG + emojis (boardgame-fd sev 18; pitchperfect-fd sev 24 with a
  HARD-BANNED cyan glow + 10 emojis). "Looks designed" ≠ "dodges the measured slop."
- **Visual read matches the scores:** PitchPerfect — control = tasteful-slop (Fraunces/cream/
  amber), fd = AI-dark-slop (near-black + teal glow + Fraunces + rings), ours = a real
  warm-umber + vermillion **raga piano-roll instrument** ("The Swara Rail"). Our treatments
  consistently ship a genuine *instrument* (roast curve, span waterfall, game-finder shelf,
  swara rail) rather than a marketing card.

**Files:** treatments — `ab/pitchperfect-treatment.html`, `ex-{filmfest,observability,coffee,
boardgame}.html`; control — `ab/pitchperfect-control.html`; fd arm — `ab/*-fd.html`. Shots in
`ab/shots/`.

**Next experiment (4th arm):** `/frontend-design` design + our `audit --fix` treatment on top
(`*-fdtx.html`) — keep fd's composition, strip the slop. See if hybrid beats pure-treatment.
