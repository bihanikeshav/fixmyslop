# Fidelity guardrails

Protect these spans before editing:

- verbatim quotations and quoted testimony;
- fenced and inline code, commands, API paths, file paths, and identifiers;
- URLs, email addresses, citations, version strings, and structured values;
- numbers, units, dates, durations, percentages, currencies, and sample sizes;
- proper names, product names, speaker labels, and user-supplied terminology;
- Markdown links, HTML/XML tags, and UI button labels when exact text matters.

After rewriting, check exact presence of protected spans, dates, numbers, URLs, and
capitalized entities. Also inspect for dropped qualifications, stronger causality,
new sentiment, invented detail, and large unexplained length changes. Embedding or
lexical overlap can flag drift but cannot prove fidelity.

The bundled deterministic audit additionally rejects a bounded set of high-precision
mutations: negation and modality changes, known polarity opposites, explicit numeric-range
reversals, comparative-direction reversals, and cause/effect reversal in a few explicit
clause frames. It recognizes conventional month-first, day-first, and numeric dates while
excluding the month or proper name `May` from modal analysis. These checks are regression
guardrails, not a general entailment model; unsupported qualifiers and causal constructions
still require source-aware review.

If a candidate fails an exact check, restore the affected source span and rerun the
audit. If the meaning is uncertain, prefer the source wording and report the limit.

The default typography policy applies only to editable prose. A protected quote may
retain its original curly quotation marks or dash punctuation.
