---
"catalog": patch
---

Remove storage media card slots (SD, microSD) from hardware io, 44 entries across 44 files. Card slots hold media, not cables, so the setup graph cannot use them, the same reasoning as Bluetooth and Wi-Fi. New validation error E120 blocks reintroducing them by name while leaving option and expansion card bays legal.
