---
"catalog": minor
---

Add a `capabilities` field to hardware entries recording what a product does, covering 768 effects entries

`capabilities` is a closed, single-dimension vocabulary
(`schema/capabilities.yaml`) describing the audio processing operations a
product performs. It exists because `categories` cannot answer whether two
products overlap: 26% of hardware carries `discontinued`, 12% `analog`, 12%
`rack-mount`, while the functional tags sit under 1% each, so the frequent
values are lifecycle, form factor and technology rather than function.

Validation is strict — E119 for an unknown value, E205 for a duplicate, and no
aliases. A guard test fails the build if the vocabulary picks up a value from a
non-functional category group. Built into SQLite as `hardware_capabilities`,
and reported by `pnpm capability-coverage`.

Also recategorises 21 dbx entries out of `multi-effect`: the 16 DriveRack
loudspeaker-management processors move to a new `speaker-management` category,
and five others move to what they actually are (`reverb`, `dynamics`, `flanger`,
and `utility` for a remote-control panel that processes no audio).
