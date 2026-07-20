---
"catalog": minor
---

Remove Bluetooth and Wi-Fi from hardware io sections.

Wireless capabilities are not physical ports, so they don't belong in
the io graph. Removed the Bluetooth io entry from 31 hardware files and
the Wi-Fi entry from the KEF XiO, and dropped `bluetooth` and `wifi`
from the io type vocabulary so future imports fail validation instead
of reintroducing them. Wireless capabilities remain documented in
description/details/specs. Also corrected the Midas MR18's Ethernet and
ULTRANET ports, which were mislabeled as `dante`.
