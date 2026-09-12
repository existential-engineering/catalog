---
"catalog": minor
---

Make `default` and `bundle` identifiers reach `software_formats`.

An entry holding its identifier under `identifiers.default` (208
entries) or `identifiers.bundle` (5) built to a NULL identifier on every
format row, because the build looked each format up by name and nothing
else. Studio's plugin matcher reads only that column, so 217 of the 247
entries with identifiers could never match a scanned plugin. The build
now resolves each listed format as its own key, then `default`, then
`bundle` for `au` and `standalone`. Rows with a non-null identifier go
from 46 to 822. Additive, so `schema_version` is unchanged.
