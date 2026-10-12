---
"catalog": patch
---

Reject `javascript:`, `data:` and other non-http(s) schemes in every `url` field (E128) and raw HTML in prose (E305); the build now escapes markup it is handed. The one `ftp://` link (dbx 160A) is removed.
