---
"catalog": patch
---

Retype Marshall cabinet inputs and footswitch jacks, add the Thrash v2 firmware port

Seven passive Marshall cabinets (1936, 1936V, 1960AV, 1960B, 2551AV,
2551BV, Studio Vintage 2x12) recorded their 1/4-inch inputs as `line`.
They carry an amplifier's speaker output, so they are now
`speaker-level`. `speaker-level-audit` did not flag them because their
port names ("Input 1 (Mono / Stereo Left)") never say "speaker".

Nineteen Marshall amps typed their dedicated footswitch jack `line`. It
is now `expression`, per the footswitch and expression jack rule. The
two combined "Aux In / Footswitch" minijacks on the DSL1 Combo and
DSL20 Head are left alone: one jack shares an audio input and needs the
manual.

The Mackie Thrash12v2 and Thrash15v2 gain the rear USB-C port the owner's
manual documents for firmware updates.

Two Elektron sound packs (Haunted Hearts, Gutnishy Islands) carried the
date they were ingested as `releaseDate`, years after release. Both
dates are removed until a primary source gives the real one.
