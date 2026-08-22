# Voice Drift — human-input track (Voice Under Revision, 2026)

When a system edits **human** prose, in what stylometric direction does it drag the voice, and
how far? Voice Under Revision found LLMs pull human writing consistently: fewer contractions,
function words, first-person; more diversity, word length, punctuation — even when told to
preserve voice. `textslopbench/voice_drift.py` measures this deterministically (no judge).

- **Voice Drift** = standardized L2 distance between the source style vector and the rewrite's
  (7 markers: first-person, contractions, function words, punctuation elaboration, lexical
  diversity, word length, emotion words). Lower = better voice preservation.
- **Drift signature** = share of the movement that goes in the LLM-characteristic direction.

## Result — do-no-harm human originals (n=24)

| System | Voice Drift | Drift signature | first-person Δ | contraction Δ | function-word Δ |
|---|---:|---:|---:|---:|---:|
| **FixMySlop** | **0.00** | **0.00** | 0.0 | 0.0 | 0.0 |
| Humanizer | 3.41 | **0.64** | −3.47 | −3.52 | −26.72 |

## Reading

- **FixMySlop preserves voice perfectly here — because it declined to edit human input at all**
  (intervention 0%). That is the correct do-no-harm behavior, and the metric now *shows* it
  instead of just reporting "0% touched." (If FixMySlop does edit a human input, Voice Drift will
  register it — 0.0 is not a magic guarantee, it's the consequence of no-op on this set.)
- **Humanizer reproduces the Voice Under Revision signature on our baseline**: it drifts the
  voice (VD 3.41) and **64% of that movement is in the LLM-characteristic direction** — dropping
  contractions, first-person, and (heavily) function words. This is the documented voice damage,
  measured on real human text, with zero LLM calls.

This gives the human-input track a real purpose beyond "did it touch the text": *what did it do
to the person's voice, and was it the homogenizing direction models are known to push?*

Caveats: n=24, seed emotion lexicon (flagged for replacement), single track. Machine-readable:
`textslopbench/results/voice-drift-human-input-24.json`. Run: `python textslopbench/voice_drift.py 24`.
