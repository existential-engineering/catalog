# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and changelog generation.

## Adding a Changeset

When making changes to the catalog, add a changeset to document your changes:

```bash
pnpm changeset
```

This will prompt you to:
1. Select the type of change (major/minor/patch)
2. Provide a summary of the change

### Version Guidelines

- **patch**: Updates to existing entries (correcting information, adding metadata)
- **minor**: Adding new entries (software, hardware, DAWs, manufacturers)
- **major**: Schema changes that affect data structure

## For Data Contributors

When adding new catalog entries, use:

```bash
pnpm changeset add
```

Example changeset for adding software:

```md
---
"catalog": minor
---

Added Serum by Xfer Records (wavetable synthesizer)
```

## Releasing

Releases are automated via GitHub Actions when changesets are merged to main.




