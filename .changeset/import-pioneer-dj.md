---
"catalog": minor
---

Import Pioneer DJ (451 hardware/software/accessory entries).

Headless catalog import. Spans Pioneer's full DJ product
lineup: CDJ multi-players, DJM mixers, DDJ controllers,
XDJ all-in-one systems, HDJ headphones, DM/VM/XPRS
monitors and PA, PLX turntables, RMX/EFX effectors, the
Toraiz production trio (SP-16, AS-1, Squid), and ~166
accessories (cases, cables, replacement parts).

Roughly 60% of entries are tagged `discontinued` —
detected via Pioneer's per-region `archived` status in
the page's Next.js data payload.

IO data on hardware entries is intentionally minimal:
Pioneer hosts detailed port lists only in linked PDFs,
which the import pass does not parse. Spec PDF URLs are
captured in `links[]` for later enrichment.
