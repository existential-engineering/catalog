---
"catalog": patch
---

Back-fill seven identifiers from Studio telemetry, and let a maker's own
domain satisfy the vendor-segment check.

The vendor-segment guard compared a reverse-domain identifier against the
manufacturer's slug and display name only. A bundle id is built from the
maker's domain rather than its name, and the two need not resemble each
other: Universal Audio ships `com.uaudio.effects.*` from `uaudio.com`,
which matches neither `universal-audio` nor `Universal Audio`, so every
identifier for that maker's 156 entries was refused as naming somebody
else. `vendorSegmentMatches` now also accepts the host of the
manufacturer's url, and only of a root url, because a brand whose url is a
deep path on another company's domain is hosted there rather than the
owner of it (`bock-audio` sits on `uaudio.com/pages/microphones`).

The seven rows are in `docs/reviews/2026-09-identifier-backfill-telemetry.tsv`
with the rejections and the reason each was declined. Six entries gain an
identifier they had none for. The seventh, the API Vision Channel Strip
Collection, already held the right id under `default` and listed no formats
at all, so the build wrote it onto no row and the matcher could not reach
it; it gains `formats: [vst3]`, the format actually observed.
