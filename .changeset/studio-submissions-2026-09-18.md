---
"catalog": patch
---

Apply the Studio submission batch and correct the IR-Live identifier

Added 31 observed versions and one new identifier (Phase Fiasco Tape Fiasco 2)
from catalog-submissions #25-57. The 29 Universal Audio items already carried
their exact identifier, so what the batch actually contributed was version data
for entries that had none.

IR-Live carried `com.WavesAudio.IR-L`, which belongs to IR-L. That made IR-Live
unmatchable by its own id, and a real install fell through to name matching and
landed on Mixed In Key's "Live" entry instead. IR-Live now carries the observed
`com.WavesAudio.IRLive`, and IR-L takes the id that was sitting on its sibling.
The sonible smart:reverb submission was withheld: its version places it in the
original smart:reverb, which the catalog does not carry, not in smart:reverb 2.
