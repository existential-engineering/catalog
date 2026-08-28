---
"catalog": minor
---

Add hardware_io.signal_flow_raw carrying the unflattened
YAML signal flow, and stamp schema_version into catalog_meta
for Studio's reader-compatibility gate. Additive only, the
flattened signal_flow column is unchanged.
