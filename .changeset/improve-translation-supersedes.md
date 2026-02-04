---
"catalog": minor
---

Add product lineage tracking and improve translation handling

- Add `supersedes` field for tracking product version upgrades (e.g., Pro-L 2 supersedes Pro-L)
- Add predecessor entries for existing versioned products (Pro-L, Pro-C 2/3, AmpliTube 4, Transit, Infinity EQ, MPC Live/III)
- Move locale-specific links to translations sections (Satin, Diva)
- Change unapproved locale translations from errors to warnings for forward compatibility
- Support string arrays for `details` and `specs` fields
