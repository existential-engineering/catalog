---
"catalog": patch
---

Canonicalize IO connection values and expand the connection vocabulary. Adds `ethercon`, `hdmi`, `db9`, `idc`, `pin-header`, `card-slot`, and `iec-c6` to `schema/io-connections.yaml`, and normalizes ~300 near-miss connection values across 100+ hardware files (`trs`/`ts`/`trs-male`/`trs-female` → `1/4-inch`, `xlr-male`/`xlr-female` → `xlr`, `phoenix` → `euroblock`, `rj45` → `ethernet`, `etherCON` → `ethercon`, `d-sub-9` → `db9`, Eurorack bus power `proprietary` → `idc`, plus casing/singleton fixes), resolving the W121 warning backlog. Also splits the ME-1/ME-500 collapsed Network entries into their physical Link In / Link Out EtherCON ports and corrects the KEF Reference 8b passive inputs to `type: speaker-level`.
