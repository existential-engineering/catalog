## Merge plan

| Bucket       | Count                                         |
| ------------ | --------------------------------------------- |
| new          | 0                                             |
| updated      | 8 (of which 8 have field conflicts)           |
| discontinued | 0                                             |
| unchanged    | 0                                             |

### Safe-adds applied

All 8 existing entries were enriched with missing fields:

- **images** — 3 product images per entry (24 total), sourced from
  `alyjameslab.com/content/`
- **videos** — YouTube playlist per entry (8 total)
- **links** — manufacturer manual PDFs (5 entries: ClapTrap 2, FMDrive,
  Super PSG, VProm 3, VSDSX)
- **versions** — version history added to all 8 entries
- **releaseDate** — added to 6 entries (ClapTrap 2: 2019, Elastic Bender:
  2014, OB-Xtreme: 2014, VProm: 2025, VSDSX: 2014, SY-4X: via version
  dates); FMDrive and Super PSG had no clear release year

### Conflicts requiring human review

All conflicts below are between the existing high-quality catalog entries and
raw web-scraped extraction. The existing values are preferred in almost every
case. Apply changes by hand before merging this PR.

#### `data/software/aly-james-lab-claptrap-20.yaml`

- field `name`
  - existing: `"ClapTrap 2.0"`
  - extracted: `"ClapTrap 2"` — minor; keep existing
- field `categories`
  - existing: `["virtual-instrument","emulation","analog"]`
  - extracted: adds `"vintage"` — consider whether "vintage" is warranted
- field `url`
  - existing: `"https://alyjameslab.com/alyjameslabclaptrap.html"`
  - extracted: `"https://www.alyjameslab.com/alyjameslabclaptrap.html"`
    (www prefix) — either works; keep existing
- field `description` / `details` / `specs`
  - existing entries are curated; extracted is raw page copy — keep existing

#### `data/software/aly-james-lab-elastic-bender-20.yaml`

- field `name`
  - existing: `"Elastic Bender 2.0"`
  - extracted: `"Elastic Bender"` — keep existing
- field `primaryCategory`
  - existing: `"creative"`
  - extracted: `"pitch-shifter"` — both defensible; keep existing
- field `categories`
  - existing: `["effect","modulation","delay","chorus","flanger"]`
  - extracted: `["pitch","effect","delay","chorus","flanger","modulation"]` —
    reordering + "pitch"; keep existing
- field `url` — www vs non-www; keep existing
- field `description` / `details` / `specs` — keep existing (curated)

#### `data/software/aly-james-lab-fmdrive.yaml`

- field `categories`
  - existing: `["synthesizer","virtual-instrument","emulation","digital"]`
  - extracted: same but possibly reordered — keep existing
- field `url` — www vs non-www; keep existing
- field `description` / `details` / `specs` — keep existing (curated)

#### `data/software/aly-james-lab-ob-xtreme-30.yaml`

- field `name`
  - existing: `"OB-Xtreme 3.0"`
  - extracted: `"OB-Xtreme 3"` — keep existing
- field `primaryCategory`
  - existing: `"analog"`
  - extracted: `"synthesizer"` — keep existing
- field `categories`
  - existing: `["synthesizer","virtual-instrument","emulation"]`
  - extracted: adds `"plugin"`, `"subtractive"` — keep existing
- field `url` — www vs non-www; keep existing
- field `description` / `details` / `specs` — keep existing (curated)

#### `data/software/aly-james-lab-super-psg-spsg.yaml`

- field `name`
  - existing: `"Super PSG (SPSG)"`
  - extracted: `"Super PSG"` — keep existing
- field `primaryCategory`
  - existing: `"emulation"`
  - extracted: `"synthesizer"` — keep existing
- field `categories`
  - existing: `["synthesizer","virtual-instrument","digital"]`
  - extracted: adds `"plugin"` — keep existing
- field `url` — www vs non-www; keep existing
- **field `prices` — PRICING CHANGE**
  - existing: `[{"amount": 20, "currency": "EUR"}]`
  - extracted: `[{"amount": 15, "currency": "EUR"}]`
  - **Action required**: The site now shows €15 minimum (pay-what-you-want).
    Verify on [the product page](https://www.alyjameslab.com/alyjameslabsuperpsg.html)
    and update if confirmed.
- field `description` / `details` / `specs` — keep existing (curated)

#### `data/software/aly-james-lab-sy-4x-syncussion.yaml`

- field `categories`
  - existing: `["virtual-instrument","synthesizer","emulation","analog"]`
  - extracted: adds `"physical-modeling"` — keep existing
- field `url` — www vs non-www; keep existing
- field `description` / `details` / `specs` — keep existing (curated)

#### `data/software/aly-james-lab-vprom-30.yaml`

- field `name`
  - existing: `"VProm 3.0"`
  - extracted: `"VPROM"` — keep existing
- field `categories`
  - existing: `["virtual-instrument","emulation","sampler"]`
  - extracted: adds `"plugin"`, `"vintage"` — keep existing
- field `url` — www vs non-www; keep existing
- field `description` / `details` / `specs` — keep existing (curated)

#### `data/software/aly-james-lab-vsdsx-20.yaml`

- field `name`
  - existing: `"VSDSX 2.0"`
  - extracted: `"VSDSX"` — keep existing
- field `categories`
  - existing: `["virtual-instrument","synthesizer","emulation","analog"]`
  - extracted: adds `"plugin"` — keep existing
- field `url` — www vs non-www; keep existing
- field `description` / `details` / `specs` — keep existing (curated)

### Audit trail

- Inventory snapshot:
  `scripts/catalog-import/data/aly-james-lab/inventory.json`
- Merge plan:
  `scripts/catalog-import/data/aly-james-lab/merge-plan.json` (in racks repo)
- Extracted envelopes:
  `scripts/catalog-import/data/aly-james-lab/extracted/`
