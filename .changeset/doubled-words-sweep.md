---
"catalog": patch
---

Remove 31 doubled words from entry prose

Sweeps the backlog reported in catalog-submissions #24. Widening the grep from
eight function words to seventeen finds 46 hits, of which only 31 are genuine
repeats. The other 15 are correct as written (`plug-in in`, `in in-ear`,
`that that`, `a a-a` for the Alfred Arnold bandoneon, `the THE ORCHESTRA`, and
`the The Plex`), so every hit was reviewed in context rather than fixed by a
blanket regex, which would have broken all fifteen. Eleven of the genuine ones
are a single Echo Fix boilerplate paragraph repeated across sibling entries.
Two were near-repeats rather than adjacent ones (`as well as as a standalone
application`), which the `duplicated-word` rule cannot see, so whether
prose-lint should gain a near-repeat rule stays open on that issue.
