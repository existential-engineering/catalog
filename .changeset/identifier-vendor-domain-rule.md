---
"catalog": patch
---

Write down that a maker's own domain satisfies the vendor-segment check.

catalog#863 taught `vendorSegmentMatches` to accept the host of the
manufacturer's `url` alongside the slug and display name, and only of a
root url, but left the Identifiers section describing the old two-spelling
behaviour. Anyone reading it would not know why `com.uaudio.effects.*`
passes on `universal-audio`, which is the shape of change this file exists
to stop being re-litigated. No code or data changes.
