---
"catalog": patch
---

Upgrade to pnpm 11.

- Move build allowlist from `package.json` `pnpm.onlyBuiltDependencies` to `pnpm-workspace.yaml` `allowBuilds` (pnpm 11 no longer reads the `pnpm` field in `package.json`).
- Pin transitive `vite` to `>=7.3.2` via pnpm override to clear GHSA-v2wj-q39q-566r and GHSA-p9ff-h696-f583 (pnpm 11 now correctly fails `pnpm audit --audit-level=high`, which pnpm 10 silently ignored).
- Bump dev dependencies.
