# Aggregator-url research pass, 2026-09-07

`pnpm dataset:audit` reports 407 entries whose top-level `url` points at an
aggregator. `scripts/promote-canonical-urls.ts` found 218 of them carrying an
official link in `links` it could promote. Every one of those 218 candidate URLs
was fetched to see whether it is actually live. This file records the outcome so
the next pass does not repeat ~218 network round trips.

## Promoted (13)

Candidate returned 200, or 403 to an automated client on a domain that is plainly
the maker's own. These are now those entries' `url`.

- `software/ampl4-for-positive-grid-bias.yaml` -> https://www.ampl4.com (403)
- `software/ik-multimedia-amplitube-4-max.yaml` -> https://www.ikmultimedia.com/products/atmax/ (200)
- `software/audec-adc-stereoimage.yaml` -> https://audec-music.com/adc-stereoimage/ (200)
- `software/mra-development-a-delay.yaml` -> https://mradevelopment.com/?page_id=47 (200)
- `software/beatassisteu-afx-acoustics-frequency-xperience.yaml` -> https://www.beatassist.eu (200)
- `software/noise-makers-ambi-head.yaml` -> https://www.noisemakers.fr/ambi-head (200)
- `software/numosh-alive-beta-tester.yaml` -> https://numosh.com/ (403)
- `content/cl-projects-ambientia.yaml` -> https://www.cl-projects-sound-design.com/ambientia.html (200)
- `content/samplefino-analogue-drum-samples.yaml` -> https://samplefino.com/analogue-drum-samples/ (200)
- `content/pinknoise-studio-analog-night-kontakt-edition.yaml` -> https://kontaktbanks.com/kb_anight.html (200)
- `content/ws-pro-audio-acoustic-drum-vol-2-lite.yaml` -> https://www.wnpsounds-eng.net/product/acoustic-drum-vol-2-lite/ (200)
- `content/ws-pro-audio-acoustic-drum-special-mix.yaml` -> https://www.wnpsounds-eng.net/product/acoustic-drum-special-mix/ (200)
- `software/producernb-amp.yaml` -> https://www.producernb.com/amp/ (200)

## Left on the aggregator url deliberately: dead vendor (156)

CLAUDE.md allows an aggregator `url` when the maker has no official page anywhere
(dead vendor, KVR-only freeware). The link in `links` points at a domain that no
longer resolves at all -- NXDOMAIN from the container resolver, the agent proxy
and WebFetch alike -- so the aggregator page is the only page these products still
have. These entries are correct as they stand, and `aggregator-url` will keep
listing them.

- timbresandtones.com (130)
- www.everythingturns.com (4)
- spartan-sounds.com (2)
- www.acquitrecords.com (1)
- www.usefulnoiseonline.com (1)
- dnbapp.com (1)
- urthwurk.com (1)
- www.hercsmusicsystems.com.au (1)
- www.soulviasound.com (1)
- www.ipmsounds.com (1)
- bicubicaudio.com (1)
- 7soundware.netsons.org (1)
- www.fananteampro.com (1)
- www.wnpsounds.net (1)
- www.pluginplayers.com (1)
- www.scrubbingmonkeys.com (1)
- www.jeversi.com (1)
- hansbickel.com (1)
- www.audiobits-vst.com (1)
- kineticsoundprism.com (1)
- www.hawkvst.co.za (1)
- www.eastboundsounds.com (1)

## Candidate page is gone (33)

Host is alive but the specific product page 404s. The maker may have moved it;
these need a replacement page found by hand before anything can be promoted.

- rdgaudio.com (4)
- www.samplitude.com (3)
- nomadfactory.com (3)
- www.psytranceplugins.com (2)
- www.uaudio.com (2)
- hgsounds.com (2)
- oceanswift.net (2)
- www.sixbitdeep.com (2)
- soundsdivine.com (2)
- bitterspring.net (1)
- www.ikmultimedia.com (1)
- www.psychicmodulation.com (1)
- www.rogerlinndesign.com (1)
- www.pulsarmodular.com (1)
- wavdsp.com (1)
- www.akaipro.com (1)
- www.tubeohm.com (1)
- www.app-sound.com (1)
- www.hotmusicfactory.com (1)
- www.zensound.es (1)

## Unverified from this environment (15)

Host resolves, but neither a direct fetch nor the agent proxy could complete a
request (the proxy answered 502 to CONNECT). Not evidence either way -- recheck
from a network that can reach them.

- absolutepianos.com (4)
- tikov.com (3)
- detunized.com (2)
- www.ntsaudio.com (1)
- www.signaldust.com (1)
- www.js-synthese.de (1)
- www.minisoftmusik.de (1)
- www.interq.or.jp (1)
- www.mysteryislands-music.com (1)

## Note on the script's own live check

`promote-canonical-urls.ts` fetches with `node:https` and a custom DNS lookup, so
it does not honour `HTTPS_PROXY`. Inside a proxied sandbox its check reports
`ENOTFOUND` for hosts that are reachable through the proxy, and it under-promotes:
it passed 2 of the 13 above. It never over-promotes, since a failed check only
makes it skip the entry. Verify candidates out of band and feed them back with
`--from-mapping <file> --no-check --apply`, which is how this pass ran.
