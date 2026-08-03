# fix-ai-slop — explore

Start from intent — it's what makes a design good. If a brief or target was given, read
it; otherwise, in one natural pass, get what they're building, who it's for, and a word
or reference for the feel, and offer them one line for the centrepiece they picture. All
optional — if they'd rather just see options, proceed; but ground each direction in
something concrete about the subject, never four arbitrary rolls.

Turn what you learned into a StyleIntent — surface, job, and the feel expressed as dials
(energy, warmth, craft, experimentalism, layoutVariance, materiality…), with the brief
kept verbatim in sourceBrief — and normalize it with `resolve_intent`. Then produce FOUR
genuinely divergent directions by calling `style_genome` four times. THIS is the key:
pass every prior direction's fingerprint back in the recentFingerprints argument on the
next call, so the engine forces each new direction to diverge in layout family, font
pairing, and palette instead of recoloring one idea. Nudge a different dial per call
(more experimental, denser, warmer) so the four spread across the space.

Each genome returns a complete, gate-passing direction: a layout family (section grammar
+ hierarchy), a font pairing (display + a readability-gated body — never a display face
as body), a palette (accent hex, checkColor-gated), material, and motion — each with
provenance. Add one line per direction on how the centrepiece lives HERE: the same
standout realized differently (an instrument in one, a typographic statement in another).
To hand-verify, run `check_palette` / `check_font`; to swap a pairing for a nearer visual
neighbor, `font_neighbors`.

Present the four compactly: name each for its feel (never 'Option 1'), with its layout
family, fonts, palette (accent hex), background, and centrepiece line. Then ask which to
build; on their pick, hand off to improve_design (or theme) to build that one for real,
carrying that direction's genome as the spec.

Self-check: did you feed each shown direction's fingerprint into the next `style_genome`
call — the thing that actually makes the four diverge? Are they different on layout AND
font AND palette, not one idea recolored? Is each grounded in the subject or stated
intent? Did you hand the user a clear pick with a real centrepiece line for each?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
