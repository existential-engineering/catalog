## Merge plan

| Bucket       | Count                                 |
| ------------ | ------------------------------------- |
| new          | 3                                     |
| updated      | 11 (all 11 have field conflicts)      |
| discontinued | 0                                     |
| unchanged    | 0                                     |

### Conflicts requiring human review

All 11 update-candidates carry conflicts — none were auto-applied.
Resolve by editing the existing YAMLs directly on main before merging.

- `data/software/algorithmix-classic-peq-blue.yaml` field `primaryCategory`
  - existing: `"equalizer"`
  - extracted: `"eq"`

- `data/software/algorithmix-classic-peq-blue.yaml` field `formats`
  - existing: `["vst"]`
  - extracted: `["vst2"]`

- `data/software/algorithmix-classic-peq-blue.yaml` field `description` / `details` / `specs`
  - extracted versions are substantially longer and more detailed (quality upgrade candidate)

- `data/software/algorithmix-easyrenovator.yaml` field `categories`
  - existing: `["plugin", "effect", "spectral"]`
  - extracted: `["restoration", "spectral", "plugin", "standalone"]`

- `data/software/algorithmix-easyrenovator.yaml` field `formats`
  - existing: `["vst", "standalone"]`
  - extracted: `["rtas", "standalone"]`
  - Note: RTAS = ProTools HD/Mix/LE format; existing VST may be incorrect

- `data/software/algorithmix-k-stereo-ambience-processor.yaml` field `formats`
  - existing: `["vst3"]`
  - extracted: `["vst"]`
  - Note: legacy product likely VST (not VST3); existing may be incorrect

- `data/software/algorithmix-linearphase-peq-orange.yaml` field `formats`
  - existing: `["vst"]`
  - extracted: `["vst", "vst2"]`

- `data/software/algorithmix-linearphase-peq-red.yaml` field `formats`
  - existing: `["vst"]`
  - extracted: `["vst", "vst2"]`

- `data/software/algorithmix-lp-splitcomp.yaml` field `formats`
  - existing: `["vst"]`
  - extracted: `["vst", "vst2"]`

- `data/software/algorithmix-noisefree.yaml` field `formats`
  - existing: `["vst2"]`
  - extracted: `["vst", "vst2"]`

- `data/software/algorithmix-renovator.yaml` field `platforms`
  - existing: `["windows"]`
  - extracted: `["windows", "mac"]`
  - Note: Mac support mentioned on product page; verify before applying

- `data/software/algorithmix-scratchfree.yaml` field `formats`
  - existing: `["vst2"]`
  - extracted: `["vst", "vst2"]`

- `data/software/algorithmix-sound-rescue.yaml` field `primaryCategory`
  - existing: `"restoration"`
  - extracted: `"de-click"`

Most description/details/specs conflicts are quality improvements
(extracted versions are richer). Safe to apply by replacing the existing
field value after human review.

### Safe-adds applied

- `algorithmix-easyrenovator.yaml`: added `versions` (v2.10 build 1534)
- `algorithmix-renovator.yaml`: added `versions` (v2.50 build 1690, 4 variants)
- `algorithmix-sound-laundry.yaml`: added `details` and `specs` (was empty)

### Data review

- Mode: exhaustive (6 changed files, all deep-read)
- Automated checks: `pnpm validate` 0 errors, `pnpm build` clean
- Auto-fixes applied: 1 (easy-tools `primaryCategory: plugin` → `noise-reduction`)
- Remaining notes (INFO):
  - `algorithmix-sound-laundry.yaml` has pre-existing `categories: [standalone]`
    which is a format value; consider removing in a follow-up
  - `versions` entries use full descriptive names (e.g. "v2.50 build 1690
    (Pyramix 64-bit)") rather than bare version numbers — intentional for
    legacy products where build variant matters
  - No translations present (expected for niche German DSP tools)
  - No plugin identifiers (AU/VST3/AAX) — all entries are Windows-only
    standalone or legacy DirectX/VST with no cross-platform formats

### Audit trail

- Inventory snapshot: `scripts/catalog-import/data/algorithmix/inventory.json`
- Merge plan: `scripts/catalog-import/data/algorithmix/merge-plan.json`
- Extracted envelopes: `scripts/catalog-import/data/algorithmix/extracted/`

### Deferred

None — every discovered URL was either imported or already in the catalog.

Auto-merge gate: batched human review (10 PRs at a time).
