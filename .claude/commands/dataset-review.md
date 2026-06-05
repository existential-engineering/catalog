---
description: LLM review of the whole-dataset audit's flagged findings (Tier 2)
---

Run an LLM review over the **flagged subset** of the deterministic dataset audit. Unlike `/data-review` (which
reviews a branch diff), this reviews cross-entry issues across the *entire* catalog — but only the bounded handful
the audit could not resolve on its own. Cost is proportional to the flagged list, not the 12k+ total entries.

This is Tier 2 of the layered review. Tier 1 is the deterministic `pnpm dataset:audit` script; Tier 3 is the monthly
`dataset-audit.yml` workflow that opens a tracking issue. See `scripts/dataset-audit.ts` for the check definitions.

## Process

### Phase 1: Run the audit

1. Run `pnpm dataset:audit --json` and parse the JSON. The shape is `{ summary, coverage, findings[], flagged[] }`.
2. The `flagged[]` array is the work list — these are findings with `needsLlmReview: true` (duplicate-name groups and
   thin descriptions), capped and sorted by severity. If `flagged` is empty, report that the dataset is clean and stop.
3. Note the `coverage` block (per-collection description/url/price/verification rates) — call out any collection that
   has notably thin coverage in the final summary.

### Phase 2: Review the flagged findings (parallel agents)

Distribute the `flagged[]` entries across a **small fixed pool of agents** (e.g. 3–4), each handling a slice. Do NOT
spawn one agent per finding, and do NOT read entries outside `flagged[]`. Each agent reads the full YAML of the files
named in its findings and renders a verdict:

**For `duplicate-name` findings** (the most important case): two or more entries under the same manufacturer share a
normalized name. Read both files and decide which it is:

- **True duplicate** — same product filed twice. Recommend merging into one entry and deleting the other (note which
  file to keep, usually the more complete one).
- **Cosmetic variant** — identical hardware/capabilities differing only in finish/color/edition. Recommend folding the
  second into the first entry's `variants` array (per CLAUDE.md "Hardware Variants").
- **Distinct products** — genuinely different despite the name collision, often because punctuation was stripped during
  normalization (e.g. "DriveRack PA" vs "DriveRack PA+", a model with a "+" suffix). Recommend a `searchTerms` or name
  tweak to disambiguate, or just confirm it's a false positive.

**For `thin-description` findings**: read the entry and judge whether the short description is acceptable (some products
genuinely have little to say) or should be expanded. Suggest a better description only when you can do so from facts in
the entry — do not invent specs.

### Phase 3: Synthesize

Collect agent verdicts, de-duplicate, and present a prioritized report. Resolve disagreements yourself by reading the
files if needed.

## Output Format

```text
## Dataset Review (flagged: N)

### Summary
[1-2 sentences: dataset size, how many flagged, headline findings]

### Coverage Watch
[Any collection with notably low description/url/price/verification coverage from the audit's `coverage` block]

### Duplicates — MERGE (true duplicates)
1. `data/software/foo.yaml` + `data/software/foo-2.yaml` — same product. Keep `foo.yaml` (more complete); delete the other.

### Duplicates — FOLD INTO variants (cosmetic)
1. `data/hardware/x-black.yaml` → fold into `data/hardware/x.yaml` `variants` as "Black".

### Duplicates — DISTINCT (false positives / disambiguate)
1. `data/hardware/driverack-pa.yaml` vs `data/hardware/driverack-pa-plus.yaml` — distinct models; "+" stripped by
   normalization. No action, or add a searchTerm.

### Thin Descriptions
| File | Current | Recommendation |
|------|---------|----------------|

### Overall Assessment
[Is the dataset healthy? What, if anything, needs follow-up.]
```

## Notes

- The audit is deterministic and cheap; re-run it freely. The expensive part is this LLM pass, so keep it scoped to
  `flagged[]`.
- Deterministic findings the audit already resolved (broken `compatibleWith`, orphan manufacturers) are in `findings[]`
  but NOT `flagged[]` — they don't need LLM judgment. Mention their counts from `summary.byCheck`, but fixing them is a
  data edit, not a review task.
- Do not auto-apply merges/deletions. This command produces recommendations; the user decides what to change.
