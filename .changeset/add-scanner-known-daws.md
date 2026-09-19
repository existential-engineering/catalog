---
"catalog": patch
---

Add the 16 DAWs and notation apps Studio's scanner recognises but the catalog did not carry

Studio's DAW scanner ships a per-platform table of products it identifies by
bundle id, `.desktop` entry or uninstall key. Diffing that table against the
catalog found 16 products with no entry at all, so a user with any of them
installed got a scan result the catalog could not resolve.

Added: WaveLab, Mixbus, Waveform, Samplitude, Sibelius, Dorico, Finale,
MuseScore, LMMS, Qtractor, Rosegarden, Hydrogen, Hindenburg PRO, VirtualDJ,
djay Pro and n-Track Studio, with nine new manufacturers (Boris FX, LMMS,
rncbc, Rosegarden, Hydrogen, Hindenburg Systems, Atomix Productions,
Algoriddim, n-Track Software).

Three entries carry a decision worth a reviewer's eye. Samplitude is filed
under a new `boris-fx` manufacturer rather than MAGIX, because Boris FX
acquired it with Sequoia and Music Studio in August 2025 and borisfx.com is
the only live official page, the MAGIX product page having gone to a redirect.
Finale takes the `discontinued` category, MakeMusic having sunset it in August
2024. Hindenburg PRO is stored as `name: PRO` under Hindenburg Systems,
following the same stripping the catalog already applies to Bitwig Studio and
Serato DJ Pro, with the composed form in `searchTerms`.

Prices are omitted throughout. Every one of these sells either a multi-tier
lineup or a subscription that could not be read off a maker's own store page,
and a single figure would misrepresent the product.
