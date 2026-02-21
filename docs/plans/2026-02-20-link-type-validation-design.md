# Link Type Validation

Restrict catalog link types to the 5 types the Studio app supports
and enforce with blocking validation.

## Context

The catalog YAML data uses 18 different link types, but the Studio
app only accepts 5: `affiliate`, `product`, `resource`, `review`,
`support`. These are defined in `@racks/lib` constants and enforced
by the parser (Bedrock AI extraction). However, hand-authored YAML
files bypass the parser and use unsupported types like `specs`,
`versions`, `manual`, etc.

Current validation treats unknown link types as advisory warnings
(W122) that don't block CI. This allows invalid data to ship.

## Valid Link Types

Source of truth: `packages/lib/src/constants/links.ts`

- `affiliate` - Purchase/affiliate links
- `product` - Product pages, related products
- `resource` - Documentation, manuals, specs
- `review` - Product reviews
- `support` - Support pages, community, warranty

## Migration Mapping

| Old type | Action | Rationale |
|---|---|---|
| `specs` | `resource` | Documentation |
| `manual` | `resource` | Documentation |
| `document` | `resource` | Documentation |
| `release-notes` | `resource` | Documentation |
| `changelog` | `resource` | Documentation |
| `installation` | `resource` | Documentation |
| `downloads` | `resource` | Download page |
| `demo` | `product` | Product demo page |
| `trial` | `product` | Product trial/download |
| `family` | `product` | Related product family |
| `related` | `product` | Related product |
| `software` | `product` | Companion software |
| `versions` | `product` | Versions/pricing page |
| `community` | `support` | Community support |
| `warranty` | `support` | Warranty info |
| `video` | **Remove** | Media gallery pages, not embeddable |
| `social` | Drop from schema | Not used in any YAML |

## Changes

### Catalog repo (`catalog/`)

1. **`schema/link-types.yaml`** - Replace 21 types with 5 valid
   types.

2. **`scripts/lib/error-codes.ts`** - Add `E116_INVALID_LINK_TYPE`
   as a blocking error. Remove `W122_UNKNOWN_LINK_TYPE`.

3. **`scripts/validate.ts`** - Change link type check from W122
   advisory warning to E116 blocking error with auto-fix
   suggestions.

4. **`scripts/lib/schema-loader.ts`** - Update comment from
   `(advisory)` to `(strict)`. Rename `isKnownLinkType` to
   `isValidLinkType`.

5. **`docs/VALIDATION_ERRORS.md`** - Add E116 docs, remove W122.

6. **~30 YAML data files** - Apply migration mapping. Remove 2
   video-typed links entirely.

### No changes needed in racks repo

- `@racks/lib` constants already correct (5 types)
- `CatalogLink` type already correct
- Parser already constrains to 5 types
