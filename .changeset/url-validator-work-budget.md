---
"catalog": patch
---

`pnpm validate-urls --changed-only` is now bounded, so a PR file cannot hold
the runner open indefinitely (CWE-400).

The changed-file path checked every unique URL a file declared with no limit,
and a HEAD that timed out was followed by another ten-second GET, so N slow
URLs cost up to N×20s. It now carries a work budget: at most 100 unique URLs
per file and 500 per run, with a file over budget reported as broken rather
than checked, and a five-minute aggregate deadline shared by every request
through one `AbortSignal`, so URLs still queued when it fires report instead
of starting more work. A timed-out or aborted HEAD is no longer retried with
GET, since that failure is deterministic; the 401/403/405 GET retry is
unchanged. Scheduled full-catalog runs stay unbudgeted, and both workflow
jobs gain an explicit `timeout-minutes` backstop.
