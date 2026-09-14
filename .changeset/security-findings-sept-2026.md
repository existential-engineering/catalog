---
"catalog": patch
---

Close the eight open CodeRabbit security findings (four medium, four low).

**SSRF, `scripts/lib/url-guard.ts` (CWE-918).** `fetchPublic` resolved a
hostname, approved the answer, and then handed the _hostname_ to native
`fetch`, which resolved it again. The two answers need not agree, so a host
an attacker controls could answer publicly for the guard's lookup and
privately for fetch's — the file's own doc comment called this "the
residual gap". It now requests through an undici dispatcher whose
`connect.lookup` is `guardLookup`, so the socket can only reach an address
that passed; the hostname still travels for the Host header and TLS
verification. A refusal raised inside the lookup arrives wrapped as
`TypeError: fetch failed`, so `isPrivateDestinationError` follows the
`cause` chain and `fetchPublic` rethrows the guard error in place of the
wrapper, keeping "private destination refused for x" in reports instead of
"fetch failed". The regression test runs the real fetch against a resolver
that flips between lookups and fails on the old implementation.

**Unverified download, `.github/workflows/release.yml` (CWE-494).**
`curl -sL … | tar xz` ran an executable straight out of a release URL, in
the step that also held `CATALOG_SIGNING_KEY`. Installing minisign is now
its own step, with no secrets in scope, that downloads to a file and checks
it against a SHA-256 pinned in the workflow before extracting. The digest
was taken from the archive upstream signs with the minisign public key
published in its README, whose detached `.minisig` is on the same release.

**Prettier config discovery, `scripts/format-yaml.ts` (CWE-829).** Explicit
targets could sit anywhere, and Prettier loads configuration from the
target's directory — importing a `.prettierrc.js` there as code. Targets
are now confined to regular non-symlink files under `data/`, and Prettier
is invoked with `--config` naming this repository's `.prettierrc` plus
`--no-editorconfig`. A full run reformats nothing.

**Command injection, `scripts/migrate-content.ts` (CWE-78).** Filenames
from `data/software/` were interpolated into an `execSync` `git mv`;
double quotes leave `$(...)` and backticks live. Now `execFileSync` with an
argument array and `--`, and filenames that are not slug-shaped are skipped.

**Path traversal, `scripts/promote-canonical-urls.ts` (CWE-22).** A
`--from-mapping` entry's `file` was joined to `DATA_DIR` unchecked, then
reused for the write under `--apply`. It must now match
`<collection>/<slug>.yaml` and pass containment, re-checked immediately
before writing.

**Unbounded read, `scripts/validate-urls.ts` (CWE-400).** The changed-file
path matched the git pathname lexically and then followed it, so a symlink
committed at `data/software/x.yaml` redirected the validator to whatever it
pointed at. Both the file list and the read itself now go through the new
`checkContainedRegularFile`, which refuses symlinks, non-regular files and
anything resolving outside `data/`.

**Slow-drip request, `scripts/promote-canonical-urls.ts` (CWE-400).**
`requestOnce` had only an inactivity timeout, which a byte every ten
seconds resets forever, and drained the whole body after collecting its
4 KB sample. It now carries a 30s wall-clock deadline that destroys request
and response, and stops reading once the sample is full.

**Markdown injection, `.github/workflows/url-health.yml` (CWE-116).** A
catalog URL went raw into a Markdown table row. The workflow's `cell()`
encoder now collapses control characters, escapes table, code-span and
link metacharacters and defuses `@mentions`; the same hardening lands in
`dataset-audit.yml` and `discontinued-check.yml`, whose weaker `cell()`
escaped pipes only. Link delimiters (`[`, `]`, `(`, `)`, `!`) are in the
set because an unescaped `[text](url)` renders as a live link that a
bot-authored report appears to vouch for — the same "apparent authorship"
problem as a raw `@mention`, caught by review on the first pass. The other half is new validation: `z.url()` accepts a
URL containing a newline, a NUL or a pipe, so **E126** now rejects control
characters in single-line values (newlines stay legal in `description`,
`details` and `specs`, which are prose). The full catalog passes as-is.

Adds `undici` as a devDependency, a `checkContainedRegularFile` helper in
`scripts/lib/utils.ts`, `scripts/lib/control-characters.ts` with tests, and
the conventions behind each fix to CLAUDE.md. No data changes.
