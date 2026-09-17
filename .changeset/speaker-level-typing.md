---
"catalog": patch
---

Correct the signal type on 227 passive-speaker ports across 139 entries

Every Marshall, PRS and EVH cabinet input, and most amplifier speaker outputs,
were typed `line` when they carry an amplified signal. CLAUDE.md has required
`speaker-level` for these since the field existed, but nothing checked it, so
Studio drew them with the colour and shape it gives a low-voltage preamp jack.
Added `pnpm speaker-level-audit` to report them and `pnpm speaker-level:apply`
to write a reviewed list. Speaker-emulated and cabinet-simulated outputs really
are line level and are excluded.
