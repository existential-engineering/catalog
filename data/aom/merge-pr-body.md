## Merge plan

| Bucket       | Count                                                          |
| ------------ | -------------------------------------------------------------- |
| new          | 0                                                              |
| updated      | 14 applied (16 candidates; 2 had no schema-valid safe-adds)    |
| discontinued | 0                                                              |
| unchanged    | 0                                                              |

> `aom-invisible-limiter` and `aom-tranquilizr` had no schema-valid
> safe-adds to apply. The extracted `type` and `images` fields are not
> in the software schema (`additionalProperties: false`). Files
> unchanged.

## Changes applied (safe-adds only)

All 14 modified files received one or more of:

- `releaseDate` — first release date sourced from official product pages
- `videos` — official YouTube demos/tutorials (7 entries)
- `links` — support documentation links (4 entries)

No existing field values were overwritten. All conflicts were preserved
for human review below.

## Conflicts requiring human review

All 16 update candidates have conflicts. The sections below cover the
ones requiring active decisions. Resolve by editing the YAML files
directly on this branch or after merge.

### primaryCategory changes (5 entries)

| File | Existing | Extracted |
|------|----------|-----------|
| `data/software/aom-cyclic-panner.yaml` | `utility` | `panning` |
| `data/software/aom-sakura-dither.yaml` | `mastering` | `dither` |
| `data/software/aom-stereo-imager-d.yaml` | `utility` | `stereo-widener` |
| `data/software/aom-total-bundle.yaml` | `multi-effect` | `suite` |
| `data/software/aom-triple-fader.yaml` | `utility` | `gain` |

The extracted values better reflect each product's primary function.
Apply if the new categories exist in `schema/categories.yaml`.

### Prices (15 entries — keep existing)

Existing entries have 2–4 price points (base perpetual + upgrade
extension prices). Extracted data has only the base perpetual price.
The upgrade/extension prices in existing entries are valid data and
should be kept — the extracted snapshot missed them.

Example — `aom-cyclic-panner.yaml`:

- existing: `[{amount: 70, currency: USD}, {amount: 52, currency: USD}]`
- extracted: `[{amount: 70, currency: USD}]`

**Recommended action:** keep existing prices as-is (no change needed).

### Categories (16 entries)

Extracted entries include `plugin` as an explicit top-level category.
Existing entries don't have this. Whether to add `plugin` is a catalog
convention question — all AOM products are plugins by definition.

### Description, details, specs (16 entries)

All 16 entries have different wording from re-extraction. The existing
copy is generally higher quality. A full field-by-field comparison is
in the merge plan JSON (linked below in Audit trail).

Key differences:
- Existing `details` for Nu Compressor is marked `safe-keep` (extracted
  version was shorter/lower quality).
- Existing `specs` for most entries are more concise; extracted versions
  include platform/OS requirement bullets that may not belong in specs.

### Format order (10 entries — no action needed)

Extracted `formats` lists have different ordering (e.g. `au, vst2, vst3`
vs `vst2, vst3, au`). Same values, different order — functionally
identical. No action needed.

## Audit trail

- Inventory snapshot: `scripts/catalog-import/data/aom/inventory.json`
- Merge plan: `scripts/catalog-import/data/aom/merge-plan.json`
- Extracted envelopes: `scripts/catalog-import/data/aom/extracted/`
