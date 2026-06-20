---
"catalog": minor
---

Remove bundle entries and strip purchase links.

Removed 13 Drumforge bundle entries (7 software, 6 content). A bundle
is a commercial SKU, not a discrete installable product — what exists
on disk and syncs is the individual plugins/packs, which remain as
their own entries.

Stripped purchase/buy/store links from the `links` arrays across the
catalog (186 links in 174 files). The canonical `url` already points
users to the product, so retailer/cart links were redundant.
App-store / play-store download links were preserved.
