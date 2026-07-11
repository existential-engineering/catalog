---
"catalog": minor
---

Add IO data-quality triage: `pnpm io-quality` report and warning W128.

Follow-up to the IO positioning work (#212). Adds tooling to find and prevent
bad hardware I/O data at scale:

- New `pnpm io-quality` report scores every hardware entry and prints a
  prioritized worklist: correctness smells (combine candidates, collapsed
  stereo/numbered-pair names, uniform-position imports), connectivity-category
  devices missing I/O entirely, and entries lacking column/row layout (densest
  first). Supports `--json` and `--limit`.
- New advisory validation warning **W128** flags `maxConnections > 1` on
  single-jack connections (e.g. two jacks collapsed into one entry), excluding
  intentional aggregates. Non-blocking.
- Shared heuristic in `scripts/lib/io-heuristics.ts` keeps the report and the
  validator in lockstep.
