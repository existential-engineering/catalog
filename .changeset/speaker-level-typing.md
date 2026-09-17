---
"catalog": patch
---

Correct the signal type on 193 passive-speaker ports across 129 entries

Every Marshall, PRS and EVH cabinet input, and most amplifier speaker outputs,
were typed `line` when they carry an amplified signal. CLAUDE.md has required
`speaker-level` for these since the field existed, but nothing checked it, so
Studio drew them with the colour and shape it gives a low-voltage preamp jack.
Added `pnpm speaker-level-audit` to report them and `pnpm speaker-level:apply`
to write a reviewed list. Speaker-emulated outputs and a monitor controller's
balanced line feed to powered monitors both keep `line`, and the audit excludes
them: a passive loudspeaker is never fed down an XLR or a DB25.
