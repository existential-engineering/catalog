---
"catalog": patch
---

Add per-format identifiers and current versions for 34 software entries.

Homebrew's cask index was matched to the catalog by vendor domain and
name (30 entries), and the 37 macOS installers it and the Open Audio
Stack registry link to were read by the installer introspection lane,
which yielded exact bundle ids for every FabFilter plugin's VST, CLAP
and AAX builds, plus Audio Hijack, Engine DJ, Platinum Notes, Focusrite
Control and Bome Network. Every entry gains a versions entry for the
release the installer carries. Two existing values the installers
contradict are corrected: Pro-MB's CLAP id is spelled Clap.1 like every
other FabFilter id, and FabFilter One's ids carry its major version 3.
