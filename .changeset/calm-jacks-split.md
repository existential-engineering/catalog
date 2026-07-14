---
"catalog": patch
---

Fix W128 collapsed-jack IO entries across 11 hardware files: split multi-jack entries into one entry per physical jack (A&H GR4 stereo RCA inputs, Antelope Satori DB25 in/thru, Blackstar cab inputs and TV-10 speaker outputs, RME UFX III AES/EBU in/out, dbx 166XL/XS per-channel sidechain inserts) and correct Midas DL155 AES3 XLR entries to maxConnections 1 (each XLR carries 2 channels on one jack). Blackstar passive-cab/speaker entries also corrected from `line` to `speaker-level`, and the Satori entry from `1/4-inch` to `db25`.
