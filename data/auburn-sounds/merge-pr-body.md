## Merge plan

| Bucket       | Count                                   |
| ------------ | --------------------------------------- |
| new          | 0                                       |
| updated      | 10 (of which 10 have field conflicts)   |
| discontinued | 0                                       |
| unchanged    | 0                                       |

> ⚠️ **HIGH CONFLICT RATE**: All 10 update candidates carry conflicts.
> Safe-add fields (images, versions) were applied automatically.
> All conflict fields are left untouched — resolve by hand before merging.

## Applied changes (safe-add only)

- **Couture** — added `images` (CDN URL), `versions: [{name: "1.10"}]`
- **Graillon** — added `images` (CDN URL), `versions: [{name: "3.2"}]`
- **Renegate** — added `images` (CDN URL), `versions: [{name: "1.6"}]`
- **Panagement** — added `images` (CDN URL), `versions: [{name: "2.8"}]`
- **Inner Pitch** — added `images` (CDN URL), `versions: [{name: "2.1"}]`
- **Lens** — added `images` (CDN URL), `versions: [{name: "1.4"}]`
- **Selene** — added `images` (CDN URL), `versions: [{name: "1.1"}]`
- **GFM Distort** — added `versions: [{name: "1.0"}]` (no image — too small)
- **GFM Koch** — added `versions: [{name: "1.0"}]` (no image — too small)
- **GFM Psypan** — added `versions: [{name: "1.0"}]` (no image — too small)

## Conflicts requiring human review

Apply the resolution by hand (`Edit` the YAML) before merging this PR.

---

### `data/software/auburn-sounds-couture.yaml`

- **`primaryCategory`**
  - existing: `"saturation"`
  - extracted: `"transient-shaper"`

- **`categories`**
  - existing: `["distortion", "dynamics", "compressor", "effect"]`
  - extracted: `["plugin", "effect", "transient-shaper", "distortion",
    "saturation", "dynamics"]`

- **`formats`** (order only)
  - existing: `["vst", "aax", "au", "lv2"]`
  - extracted: `["vst", "au", "aax", "lv2"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 29}]`
  - extracted: adds `type` and `label` fields to each entry

- **`description`**
  - existing: `"Dynamics-preserving distortion and transient shaper plugin
    offering exquisite control over dynamics and attacks with
    volume-independent saturation."`
  - extracted: `"Couture is a distortion audio plug-in with preceding
    transient shaper. It operates in a level-independent manner."`

- **`details`** — extracted version is shorter/less detailed; existing
  preferred

- **`specs`** — extracted version is format/platform list, not feature
  list; existing preferred

---

### `data/software/auburn-sounds-graillon.yaml`

- **`primaryCategory`**
  - existing: `"autotune"`
  - extracted: `"pitch"`

- **`categories`**
  - existing: `["pitch", "pitch-shifter", "vocoder", "effect", "creative"]`
  - extracted: `["plugin", "pitch", "pitch-shifter", "autotune", "effect",
    "vocoder"]`

- **`formats`** — extracted adds `"clap"` (new format support in v3.2)
  - existing: `["vst", "aax", "au", "lv2"]`
  - extracted: `["vst", "au", "aax", "clap", "lv2"]`

- **`platforms`** (order only)
  - existing: `["mac", "windows", "linux"]`
  - extracted: `["windows", "mac", "linux"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 29}]`
  - extracted: only `[{amount: 29, type: "one-time", edition: "Full
    Edition"}]` — missing free tier

- **`description`** — extracted is longer/different framing

- **`details`** — extracted shorter summary vs existing detailed version

- **`specs`** — extracted is format/platform list, existing is feature list

---

### `data/software/auburn-sounds-renegate.yaml`

- **`categories`**
  - existing: `["dynamics", "effect"]`
  - extracted: `["plugin", "gate", "dynamics"]`

- **`platforms`** (order only)
  - existing: `["mac", "windows", "linux"]`
  - extracted: `["windows", "mac", "linux"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 29}]`
  - extracted: adds `label` fields

- **`description`** — extracted is much shorter

- **`details`** — similar content, different framing

- **`specs`** — extracted is format/version list, existing is feature list

---

### `data/software/auburn-sounds-panagement.yaml`

- **`primaryCategory`**
  - existing: `"spatial"`
  - extracted: `"panning"`

- **`categories`**
  - existing: `["stereo-widener", "reverb", "effect", "creative"]`
  - extracted: `["plugin", "effect", "panning", "auto-pan", "spatial",
    "stereo", "stereo-widener", "reverb", "binaural", "delay"]`

- **`formats`** (order only)
  - existing: `["vst", "aax", "au", "lv2"]`
  - extracted: `["vst", "au", "aax", "lv2"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 29}]`
  - extracted: adds `edition` labels

- **`description`** — extracted is shorter/simpler

- **`details`** — extracted shorter; existing preferred

- **`specs`** — extracted more comprehensive feature list; worth reviewing

---

### `data/software/auburn-sounds-inner-pitch.yaml`

- **`categories`**
  - existing: `["pitch", "creative", "effect"]`
  - extracted: `["plugin", "pitch", "pitch-shifter", "effect", "harmonizer"]`

- **`formats`** (order only)
  - existing: `["vst", "aax", "au", "lv2"]`
  - extracted: `["vst", "au", "aax", "lv2"]`

- **`platforms`** (order only)
  - existing: `["mac", "windows", "linux"]`
  - extracted: `["windows", "mac", "linux"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 29}]`
  - extracted: `[{amount: 0, edition: "Free"}, {amount: 38.67, edition:
    "Full"}]` — price differs ($29 → $38.67)

- **`description`** — extracted different phrasing

- **`details`** — similar content, extracted slightly shorter

- **`specs`** — extracted is format/feature list, existing is feature-only

---

### `data/software/auburn-sounds-lens.yaml`

- **`primaryCategory`**
  - existing: `"dynamics"`
  - extracted: `"multiband"`

- **`categories`**
  - existing: `["compressor", "equalizer", "mastering", "effect"]`
  - extracted: `["plugin", "multiband", "compressor", "dynamics",
    "equalizer", "spectral"]`

- **`formats`** — extracted adds `"clap"`, `"vst2"`, `"vst3"`; removes plain
  `"vst"`
  - existing: `["vst", "aax", "au", "lv2"]`
  - extracted: `["au", "vst2", "vst3", "aax", "clap", "lv2"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 49}]`
  - extracted: adds `label` fields (amounts match)

- **`description`** — similar meaning, slightly different wording

- **`details`** — extracted adds system requirements (Win 7+, macOS 10.15+,
  Ubuntu 22.04+, M1 native); worth merging manually

- **`specs`** — extracted is format/platform spec list, existing is feature
  list

---

### `data/software/auburn-sounds-selene.yaml`

- **`categories`**
  - existing: `["effect"]`
  - extracted: `["plugin", "effect", "reverb"]`

- **`formats`** (order only)
  - existing: `["vst", "aax", "au", "lv2"]`
  - extracted: `["vst", "au", "aax", "lv2"]`

- **`prices`**
  - existing: `[{amount: 0}, {amount: 29}]`
  - extracted: adds `type` and `label` fields

- **`description`** — extracted adds "pristine adaptive sound" phrase

- **`details`** — existing version more detailed; extracted shorter summary

- **`specs`** — extracted is format/platform spec list, existing is feature
  list

---

### `data/software/auburn-sounds-gfm-distort.yaml`

- **`categories`**
  - existing: `["saturation", "effect"]`
  - extracted: `["plugin", "effect", "distortion", "saturation",
    "discontinued"]`
  - Note: extracted includes `"discontinued"` category tag

- **`formats`** (order only)
  - existing: `["vst", "au"]`
  - extracted: `["au", "vst"]`

- **`prices`**
  - existing: `[{amount: 0}]`
  - extracted: `[{amount: 0, type: "free"}]`

- **`description`** — extracted shorter

- **`details`** — similar, extracted slightly more concise

---

### `data/software/auburn-sounds-gfm-koch.yaml`

- **`categories`**
  - existing: `["virtual-instrument"]`
  - extracted: `["plugin", "synthesizer", "physical-modeling",
    "virtual-instrument", "discontinued"]`
  - Note: extracted includes `"discontinued"` and `"physical-modeling"` tags

- **`formats`** (order only)
  - existing: `["vst", "au"]`
  - extracted: `["au", "vst"]`

- **`prices`**
  - existing: `[{amount: 0}]`
  - extracted: `[{amount: 0, type: "free"}]`

- **`description`**
  - existing: descriptive paragraph
  - extracted: `"GFM Koch is a deprecated physical-model synth plug-in from
    2012."` — very terse

- **`details`** — extracted uses original marketing copy from the product
  page; existing is a curated summary

---

### `data/software/auburn-sounds-gfm-psypan.yaml`

- **`primaryCategory`**
  - existing: `"spatial"`
  - extracted: `"panning"`

- **`categories`**
  - existing: `["stereo-widener", "utility", "effect"]`
  - extracted: `["plugin", "effect", "panning", "spatial", "binaural",
    "stereo", "stereo-widener", "discontinued", "legacy"]`
  - Note: extracted includes `"discontinued"` and `"legacy"` tags

- **`formats`** (order only)
  - existing: `["vst", "au"]`
  - extracted: `["au", "vst"]`

- **`prices`**
  - existing: `[{amount: 0}]`
  - extracted: `[{amount: 0, edition: "Free"}]`

- **`description`** — extracted shorter/simpler

- **`details`** — extracted more detailed (mentions HRTF, ITD, headphone
  context explicitly)

- **`specs`** — extracted more explicit about features and formats

---

## Audit trail

- Inventory snapshot:
  `scripts/catalog-import/data/auburn-sounds/inventory.json`
- Merge plan:
  `scripts/catalog-import/data/auburn-sounds/merge-plan.json`
- Extracted envelopes:
  `scripts/catalog-import/data/auburn-sounds/extracted/`
