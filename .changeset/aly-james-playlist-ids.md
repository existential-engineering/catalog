---
"catalog": patch
---

Replace 7 YouTube playlist IDs stored as videoIds with real video IDs.

All Aly James Lab software entries (Elastic Bender, FMDrive, OB-Xtreme,
Super PSG, SY-4X Syncussion, VProm, VSDSX) stored 34-char `PL…` playlist
IDs in `videoId`, which no embed player accepts and whose thumbnails 404.
Each is replaced with the first video of that playlist plus its real
title, resolved from YouTube and verified via oEmbed.
