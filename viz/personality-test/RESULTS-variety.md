# Variety test — same brief (bookstore) built 5× through the hardened skill

Goal: does the v3 skill (forbid-the-median + layout/type/boldness mandates) make
independent builds of ONE brief actually *differ*? Identical prompts; only the skill
can create variety. Files: `var-bookstore-1..5.html` (+ `-full.png`).

## Objective results
- **Slop floor: 5/5 pass** (no regression).
- **Diversity reporter:** distinct fonts 7 (v2 had 4); distinct layouts **4** (v2 had 2);
  **range-slider standout 0/5** (v2 had 3/5); accent hues bucketed 2 but effectively all
  oxblood/red; standout kinds clustered temporal.
  (Reporter's "italic-accent 5/5" is a coarse false-positive — it flags *any*
  `font-style:italic` incl. body staff-note quotes; none used the retired headline
  italic-accent word.)

## What improved (real)
- **Layout variety:** broken/asymmetric grid · full-bleed poster ×2 · single hero object
  (dark) · two-zone. They look like 5 different bookstores, not one template ×5.
- **Type variety + boldness:** Big Shoulders Display, Bebas Neue, Boska, Barlow Condensed —
  characterful display faces at poster scale; an outline/hollow word; all-caps stacked
  lockups. Zero safe-grotesques (Outfit/Cabinet), zero Playfair/cream, zero headline italic.
- **Standout cliché retired:** the v2 slider→number widget is gone (0/5).
- **Boldness up:** poster-scale type, a dark forest-green outlier, a multicolor generative shelf.

## What still converged (honest)
- **Accent color: ~4/5 oxblood/stamp-red.** "Mine the subject's real material" → every
  agent independently found *rubber-stamp ink* → all red. (Build 4 differs via a dark-green
  ground; build 5 via multicolor spines.)
- **Standout concept: 4/5 temporal** (Shelf Clock / Genre Clock / Nook Clock / day-seeded
  pick). The obvious computable hook for a bookstore is time→genre, so blind runs cluster on
  it. (Build 5's date-seeded multicolor "Living Shelf" is the one that escaped.)

## The lesson
Forbidding the #1 median **relocates** the cluster to the #2 idea rather than dispersing
it. A single skill text cannot make 5 *blind, identical* runs pick 5 different colors or
5 different standout concepts — they converge on the next-best answer together. Real
per-option variety is an **orchestration** problem: assign each run a different layout
archetype + standout archetype + forbidden accent (or generate N and pick the best/most
different). The skill reliably makes ONE bold, non-median, distinctive page; producing N
*mutually* distinct options needs a seed per run.
