# fix-ai-slop — explore

Start from intent — it's what makes a design good. If a brief or target was given, read
it; otherwise, in one natural pass, get what they're building, who it's for, and a word
or reference for the feel, and offer them one line to describe the centrepiece they
picture. All of it optional — if they'd rather just see options, proceed; good
directions don't need a filled-in form, but ground each in something concrete about the
subject, never four arbitrary rolls.

Produce FOUR genuinely divergent directions — not four skins of one idea. Across the
set, forbid the median: no two may share a layout archetype, a font character, or a
palette family; if two feel interchangeable, drop one and diverge harder. Build each
from real, different tools:
- a distinct layout archetype from `structure_ideas` (editorial split, instrument,
  ledger, full-bleed diagram — a different one each);
- its own font pairing from `suggest_fonts` (`pairing.body` is the readable face; verify
  with `check_font`) — a different character per direction, never the same pairing twice;
- its own palette + background from `generate_palette`, grounded via `hue` / `energy` /
  `intent` in the subject's real material — a different hue family or energy each, verified
  with `check_palette`;
- one line on how the centrepiece lives in THIS direction — the same standout realized
  differently (an instrument here, a typographic statement there).

Present the four compactly: name each for its feel (never 'Option 1'), with its layout,
fonts, palette (accent hex), background, and centrepiece. Then ask which to build; on
their pick, hand off to improve_design (or theme) to build that one for real.

Self-check: are the four genuinely different on layout AND font AND palette — not one
idea recolored? Is each grounded in the subject or stated intent? Does each pass the
gates (`check_palette` / `check_font`)? Did you hand the user a clear pick with a real
centrepiece line for each?

_The hard gates, forbid-the-median, and the ONE-centrepiece bar live in `design-law.md` and the fix-ai-slop index — load them if they aren't already in context._
