## Merge plan

| Bucket       | Count                                         |
| ------------ | --------------------------------------------- |
| new          | 0                                             |
| updated      | 26 (of which 26 have at least one conflict)   |
| discontinued | 0                                             |
| unchanged    | 0                                             |
| skipped      | 2 (ddmf-iieq, ddmf-transport — invalid extraction format) |

> **WARNING**: conflictCount (28) ≥ 50% of updateCandidates (28). All conflicts
> require human review before merging.

### What was applied (safe-adds only)

- `specs: |-` block added to 24 files (not added to ddmf-iieq and ddmf-transport)
- `details: |-` block added to 2 files that lacked it (ddmf-coloureq, ddmf-endless)
- `categories`, `prices` added to ddmf-virtualaudiostream (fields were absent)

### Conflicts requiring human review

All 26 modified files have conflicts that were NOT auto-applied. The most
common conflict patterns across the DDMF catalog:

**1. `description` — wording differences (all 26 files)**

The extraction agent found slightly different description text on the live
site vs the existing catalog copy. None were applied — review each and
choose the preferred wording.

**2. `details` — format differences (all 26 files with existing details)**

Existing entries use concise bullet-style details; extracted content
contains full paragraphs from the product page. Not auto-applied.

**3. `categories` — array reordering or new values (most files)**

Many files have category arrays in different order, or the extraction
added values like `"effect"`, `"filter"`, `"stereo"`. Not auto-applied.

**4. `primaryCategory` — naming convention differences (several files)**

E.g., existing: `"equalizer"`, extracted: `"eq"`. Not auto-applied.

**5. `platforms` — `ios` added for some plugins (several files)**

E.g., ddmf-6144, ddmf-directionaleq, ddmf-iieqpro, ddmf-lp10 and others
have `"ios"` in extracted platforms (plugin available as AUv3 on iOS).
Not auto-applied — verify before adding.

**6. `formats` — minor differences (a few files)**

E.g., ddmf-bridgewize: existing has `vst`, extracted does not. Not
auto-applied.

For per-field conflict details (existing vs extracted values), see:

```text
scripts/catalog-import/data/ddmf/merge-plan.json
```

Apply resolutions by hand (`Edit` the YAML) before merging this PR.

### Files modified

```text
data/software/ddmf-6144.yaml           — specs added
data/software/ddmf-bridgewize.yaml     — specs added
data/software/ddmf-chorddetector.yaml  — specs added
data/software/ddmf-coloureq.yaml       — details + specs added
data/software/ddmf-comprezzore.yaml    — specs added
data/software/ddmf-directionaleq.yaml  — specs added
data/software/ddmf-endless.yaml        — details + specs added
data/software/ddmf-envelope.yaml       — specs added
data/software/ddmf-ers-250.yaml        — specs added
data/software/ddmf-ers-dimd.yaml       — specs added
data/software/ddmf-ers-echorek2.yaml   — specs added
data/software/ddmf-grandeq.yaml        — specs added
data/software/ddmf-iieqpro.yaml        — specs added
data/software/ddmf-lincomp.yaml        — specs added
data/software/ddmf-lp10.yaml           — specs added
data/software/ddmf-magicdeatheye.yaml  — specs added
data/software/ddmf-magicdeatheye-stereo.yaml — specs added
data/software/ddmf-magicverb.yaml      — specs added
data/software/ddmf-metaplugin.yaml     — specs added
data/software/ddmf-nolimits2.yaml      — specs added
data/software/ddmf-plugindoctor.yaml   — specs added
data/software/ddmf-stereooerets.yaml   — specs added
data/software/ddmf-superplugin.yaml    — specs added
data/software/ddmf-thestrip.yaml       — specs added
data/software/ddmf-tube-preamp.yaml    — specs added
data/software/ddmf-virtualaudiostream.yaml — categories + prices + specs added
```

### Files NOT modified (skipped)

```text
data/software/ddmf-iieq.yaml     — extraction returned object-format specs/details (invalid)
data/software/ddmf-transport.yaml — extraction returned object-format specs/details (invalid)
```

These two require manual enrichment. The extracted envelope files are at:

```text
scripts/catalog-import/data/ddmf/extracted/ddmf-iieq.json
scripts/catalog-import/data/ddmf/extracted/ddmf-transport.json
```

### Audit trail

- Inventory snapshot: `scripts/catalog-import/data/ddmf/inventory.json`
- Merge plan: `scripts/catalog-import/data/ddmf/merge-plan.json`
- Extracted envelopes: `scripts/catalog-import/data/ddmf/extracted/`
