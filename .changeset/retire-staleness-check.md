---
"catalog": patch
---

Retire the inert monthly staleness-check workflow. The fields it
reported on (verification.lastVerified, prices[].asOf) are populated
in zero entries, so every run filed the same meaningless issue.
Freshness detection now happens in the racks repo (AUREO-890).
