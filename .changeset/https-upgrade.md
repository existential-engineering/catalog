---
"catalog": patch
---

Upgrade 292 `http://` URLs to `https://` where the site serves the same page
over https, and add `pnpm https-upgrade` to probe and apply the rest on a later
pass (AUREO-1191).
