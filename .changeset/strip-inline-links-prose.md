---
"catalog": patch
---

Remove inline links (URLs, `www.` domains, bare domain mentions, and email addresses) embedded in `description`/`details`/`specs` prose across 22 entries. These auto-linked at build time (GFM autolinks) and duplicated the dedicated `url`/`links` fields; the prose now reads cleanly with the links removed.
