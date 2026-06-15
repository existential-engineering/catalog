## Merge plan

| Bucket       | Count                                    |
| ------------ | ---------------------------------------- |
| new          | 1                                        |
| updated      | 15 (of which 15 have field conflicts)    |
| discontinued | 0                                        |
| unchanged    | 0                                        |

### Changes applied

**New entry:**
- `data/software/black-salt-audio-instinct-eq.yaml` — Instinct EQ (four-band
  EQ with Surgery notch module, $59)

**Safe-add fields applied to all 15 existing entries:**
- `images` — product screenshots/logos from blacksaltaudio.com
- `videos` — YouTube demos (where found on product pages)
- BSA Delays additionally received `specs` and `versions: [{name: "1.1.1"}]`

### Conflicts requiring human review

All 15 update candidates have conflicts. The majority are semantic ordering
differences in the `formats` field (e.g., `[vst3, au, aax]` vs
`[au, vst3, aax]`) — these are functionally equivalent and can be resolved
by choosing either order (the existing ordering is fine to keep).

The substantive conflicts that warrant human judgment:

- `data/software/black-salt-audio-bsa-delays.yaml` field `primaryCategory`
  - existing: `"effect"`
  - extracted: `"delay"`

- `data/software/black-salt-audio-clipper.yaml` field `primaryCategory`
  - existing: `"limiter"`
  - extracted: `"clipper"` ⚠️ **Note: `clipper` is not a valid catalog
    primaryCategory — keep the existing `limiter`**

- `data/software/black-salt-audio-cr-1.yaml` field `primaryCategory`
  - existing: `"distortion"`
  - extracted: `"compressor"`

- `data/software/black-salt-audio-dsr.yaml` field `primaryCategory`
  - existing: `"dynamics"`
  - extracted: `"de-esser"`

- `data/software/black-salt-audio-oxygen.yaml` field `primaryCategory`
  - existing: `"effect"`
  - extracted: `"exciter"`

- `data/software/black-salt-audio-reviver.yaml` field `primaryCategory`
  - existing: `"effect"`
  - extracted: `"transient-shaper"`

- `data/software/black-salt-audio-silencer.yaml` field `primaryCategory`
  - existing: `"dynamics"`
  - extracted: `"gate"`

- `data/software/black-salt-audio-telos-bass.yaml` field `primaryCategory`
  - existing: `"dynamics"`
  - extracted: `"channel-strip"`

- `data/software/black-salt-audio-telos-drums.yaml` field `primaryCategory`
  - existing: `"dynamics"`
  - extracted: `"channel-strip"`

- `data/software/black-salt-audio-telos-guitars.yaml` field `primaryCategory`
  - existing: `"dynamics"`
  - extracted: `"channel-strip"`

- `data/software/black-salt-audio-telos-vocals.yaml` field `primaryCategory`
  - existing: `"dynamics"`
  - extracted: `"channel-strip"`

- `data/software/black-salt-audio-escalator.yaml` field `prices`
  - existing: `[{amount: 59}, {amount: 35.4}]` (promotional price)
  - extracted: `[{amount: 59}]` (promo no longer live on site)

- `data/software/black-salt-audio-low-control.yaml` field `prices`
  - existing: `[{amount: 79}, {amount: 47.4}]` (promotional price)
  - extracted: `[{amount: 79}]` (promo no longer live on site)

- `data/software/black-salt-audio-oxygen.yaml` field `prices`
  - existing: `[{amount: 79}, {amount: 47.4}]` (promotional price)
  - extracted: `[{amount: 79}]` (promo no longer live on site)

- `data/software/black-salt-audio-telofi.yaml` field `prices`
  - existing: `[{amount: 59}]`
  - extracted: `[{amount: 59, type: "perpetual", label: "Perpetual License"}]`
    (extra fields not in catalog schema — keep existing)

Apply resolutions by hand (Edit the YAML directly) before merging this PR.

### Audit trail

- Inventory snapshot:
  `scripts/catalog-import/data/black-salt-audio/inventory.json`
- Merge plan:
  `scripts/catalog-import/data/black-salt-audio/merge-plan.json`
- Extracted envelopes:
  `scripts/catalog-import/data/black-salt-audio/extracted/`
