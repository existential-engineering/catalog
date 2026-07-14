---
"catalog": minor
---

Standardize `io[].type` across the catalog and enforce the vocabulary. Widen
`schema/io-types.yaml` with 10 real port types that were missing (`rf`, `hdmi`,
`gpio`, `insert`, `clock`, `bluetooth`, `wifi`, `video`, `ground`,
`proprietary`), canonicalize 371 ports across 78 hardware entries, and promote
unknown types from an advisory warning to a hard validation error (E117).
