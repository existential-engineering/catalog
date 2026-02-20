# Link Type Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> to implement this plan task-by-task.

**Goal:** Restrict catalog link types to the 5 types the Studio app
supports and enforce with blocking validation.

**Architecture:** Change the `LinkSchema` Zod validator in
`validate.ts` from `z.string()` to a `.check()` with strict
enum validation (matching the pattern used for currencies,
IO categories, etc.). Remove the advisory W122 warning path
and replace with blocking E116 error. Fix all existing YAML
data files.

**Tech Stack:** TypeScript, Zod v4, YAML

**Design doc:**
`docs/plans/2026-02-20-link-type-validation-design.md`

---

### Task 1: Update schema/link-types.yaml

**Files:**
- Modify: `schema/link-types.yaml`

**Step 1: Replace 21 types with the 5 valid types**

```yaml
# Valid link types (strict - blocks CI if not matched)
#
# These must match the link types accepted by the Studio app.
# Source of truth: packages/lib/src/constants/links.ts
types:
  - affiliate
  - product
  - resource
  - review
  - support
```

**Step 2: Commit**

```bash
git add schema/link-types.yaml
git commit -m "chore: restrict link-types schema to 5 valid types"
```

---

### Task 2: Add E116 error code, remove W122

**Files:**
- Modify: `scripts/lib/error-codes.ts:23-61` (enum)
- Modify: `scripts/lib/error-codes.ts:121-243` (ERROR_INFO)

**Step 1: Add E116 to the enum**

In the `ValidationErrorCode` enum, add after `E115`:

```typescript
E116_INVALID_LINK_TYPE = "E116",
```

**Step 2: Remove W122 from the enum**

Remove this line from the advisory warnings section:

```typescript
W122_UNKNOWN_LINK_TYPE = "W122",
```

**Step 3: Add E116 to ERROR_INFO**

After the `E115_INVALID_CONNECTOR_DETAIL` entry, add:

```typescript
[ValidationErrorCode.E116_INVALID_LINK_TYPE]: {
  title: "Invalid link type",
  anchor: "e116-invalid-link-type",
},
```

**Step 4: Remove W122 from ERROR_INFO**

Remove:

```typescript
[ValidationErrorCode.W122_UNKNOWN_LINK_TYPE]: {
  title: "Unknown link type",
  anchor: "w122-unknown-link-type",
},
```

**Step 5: Commit**

```bash
git add scripts/lib/error-codes.ts
git commit -m "feat: add E116 invalid link type error, remove W122"
```

---

### Task 3: Update schema-loader.ts

**Files:**
- Modify: `scripts/lib/schema-loader.ts:54` (comment)
- Modify: `scripts/lib/schema-loader.ts:334-339` (function)

**Step 1: Update SchemaContext comment**

Change line 54 from:

```typescript
/** Known link type values (advisory) */
```

to:

```typescript
/** Valid link type values (strict) */
```

**Step 2: Rename isKnownLinkType to isValidLinkType**

Change lines 336-339 from:

```typescript
export function isKnownLinkType(type: string): boolean {
  const context = loadSchemaContext();
  return context.linkTypes.includes(type);
}
```

to:

```typescript
export function isValidLinkType(type: string): boolean {
  const context = loadSchemaContext();
  return context.linkTypes.includes(type);
}
```

**Step 3: Commit**

```bash
git add scripts/lib/schema-loader.ts
git commit -m "refactor: rename isKnownLinkType to isValidLinkType"
```

---

### Task 4: Move link type validation to blocking in validate.ts

**Files:**
- Modify: `scripts/validate.ts:88-94` (top-level constants)
- Modify: `scripts/validate.ts:293-298` (LinkSchema)
- Modify: `scripts/validate.ts:883-897` (collectWarnings)

**Step 1: Change KNOWN_LINK_TYPES to VALID_LINK_TYPES**

At line 94, change:

```typescript
const KNOWN_LINK_TYPES = new Set(schemaContext.linkTypes);
```

to:

```typescript
const VALID_LINK_TYPES = new Set(schemaContext.linkTypes);
```

**Step 2: Add strict validation to LinkSchema**

Change LinkSchema (lines 293-298) from:

```typescript
const LinkSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  url: z.url(),
  description: z.string().optional(),
});
```

to:

```typescript
const LinkSchema = z.object({
  type: z.string().check((ctx) => {
    if (!VALID_LINK_TYPES.has(ctx.value)) {
      let message = `Invalid link type '${ctx.value}'.`;
      const suggestion = findClosestMatch(
        ctx.value,
        schemaContext.linkTypes
      );
      if (suggestion) {
        message += ` Did you mean '${suggestion}'?`;
      }
      message += ` Valid types: ${formatValidOptions(
        VALID_LINK_TYPES
      )}`;
      ctx.issues.push({
        code: "custom",
        message,
        input: ctx.value,
      });
    }
  }),
  title: z.string().optional(),
  url: z.url(),
  description: z.string().optional(),
});
```

**Step 3: Remove link type check from collectWarnings**

In the `collectWarnings` function (lines 883-897), remove the
entire link type advisory check block:

```typescript
  // Check link types (advisory)
  if (Array.isArray(data.links)) {
    for (let i = 0; i < data.links.length; i++) {
      const link = data.links[i];
      if (link.type && !KNOWN_LINK_TYPES.has(link.type)) {
        const line = getLineForPath(document, lineCounter, ["links", i, "type"]);
        warnings.push({
          code: ValidationErrorCode.W122_UNKNOWN_LINK_TYPE,
          message: `Unknown link type '${link.type}'. Consider adding to schema/link-types.yaml if valid.`,
          path: `links[${i}].type`,
          line: line ?? undefined,
        });
      }
    }
  }
```

Also remove `links` from the `WarningContext` interface
(line 840):

```typescript
interface WarningContext {
  io?: Array<{ name: string; type: string; connection: string }>;
}
```

**Step 4: Update the mapZodErrorToCode function**

Find the section in `mapZodErrorToCode` that handles
currency errors (~line 153) and add a link type matcher
before or after it:

```typescript
if (message.includes("invalid link type")) {
  return ValidationErrorCode.E116_INVALID_LINK_TYPE;
}
```

**Step 5: Run validation to confirm it catches bad types**

```bash
pnpm validate
```

Expected: Validation fails with E116 errors for all YAML
files that still have invalid link types. This confirms the
blocking validation works before we fix the data.

**Step 6: Commit**

```bash
git add scripts/validate.ts
git commit -m "feat: promote link type validation to blocking E116"
```

---

### Task 5: Fix all YAML data files

**Files:**
- Modify: ~30 YAML files in `data/hardware/` and `data/software/`

Apply the migration mapping from the design doc. For each file:

**Map to `resource`:**
`specs`, `manual`, `document`, `release-notes`, `changelog`,
`installation`, `downloads`

**Map to `product`:**
`demo`, `trial`, `family`, `related`, `software`, `versions`

**Map to `support`:**
`community`, `warranty`

**Remove entirely (delete the link entry):**
`video` (2 links: `resing.yaml:65-67`, `axe-io-one.yaml:141-143`)

**Complete list of files to fix:**

Hardware files:
- `data/hardware/x-vibe.yaml` — `family` -> `product`
- `data/hardware/uno-synth-pro.yaml` — already valid (product)
- `data/hardware/x-space.yaml` — already valid (product)
- `data/hardware/tonex-one.yaml` — `specs` -> `resource`,
  `software` -> `product`
- `data/hardware/irig-stomp-io.yaml` — already valid (product)
- `data/hardware/x-drive.yaml` — `specs` -> `resource`
- `data/hardware/axe-io-one.yaml` — `specs` -> `resource`,
  `video` -> REMOVE
- `data/hardware/tonex-cab.yaml` — already valid (product)
- `data/hardware/uno-synth-pro-x.yaml` — `specs` -> `resource`,
  `downloads` -> `resource`
- `data/hardware/x-time.yaml` — `demo` -> `product`
- `data/hardware/tonex-pedal.yaml` — already valid (product)
- `data/hardware/tonex-plug.yaml` — `document` -> `resource`,
  `community` -> `support`, `warranty` -> `support`
- `data/hardware/irig-keys-io.yaml` — `specs` -> `resource`,
  `versions` -> `product`

Software files:
- `data/software/rc-20-retro-color.yaml` — `installation` ->
  `resource`, `release-notes` -> `resource`
- `data/software/life.yaml` — `trial` -> `product`,
  `release-notes` -> `resource`
- `data/software/addictive-trigger.yaml` — `trial` -> `product`,
  `related` -> `product`
- `data/software/dynone.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/sampletank-4.yaml` — `specs` -> `resource`,
  `document` -> `resource` (x4)
- `data/software/miroslav-philharmonik-2.yaml` —
  `specs` -> `resource`
- `data/software/modo-bass-2.yaml` — `specs` -> `resource`
- `data/software/t-racks-6.yaml` — `specs` -> `resource`,
  `demo` -> `product`
- `data/software/addictive-drums-2.yaml` — `trial` -> `product`,
  `changelog` -> `resource`
- `data/software/limitone.yaml` — `manual` -> `resource`
- `data/software/rootone.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/addictive-keys.yaml` — `trial` -> `product`,
  `release-notes` -> `resource`
- `data/software/stageone-2.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/ds-10-drum-shaper.yaml` — `trial` -> `product`,
  `release-notes` -> `resource`
- `data/software/nerve.yaml` — `demo` -> `product` (x2)
- `data/software/resing.yaml` — `versions` -> `product`,
  `video` -> REMOVE
- `data/software/lfo-tool.yaml` — `demo` -> `product` (x2)
- `data/software/transit-2.yaml` — already valid (resource)
- `data/software/smartlimit.yaml` — already valid (resource)
- `data/software/modo-drum.yaml` — already valid (product)
- `data/software/al-schmitt.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/ultravox-2.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/centerone.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/cthulhu.yaml` — `demo` -> `product` (x2)
- `data/software/joe-chiccarelli.yaml` — `manual` -> `resource`,
  `release-notes` -> `resource`
- `data/software/xo.yaml` — `trial` -> `product`
- `data/software/manny-marroquin-reverb.yaml` —
  already valid (resource)
- `data/software/super-massive.yaml` — already valid (resource)

**Step 1: Apply all type mappings**

For type replacements, use search-and-replace patterns.
For the 2 video link removals, delete the 3-line link
entry entirely (type + title + url lines).

**Step 2: Run validation**

```bash
pnpm validate
```

Expected: All files pass with no E116 errors.

**Step 3: Commit**

```bash
git add data/
git commit -m "fix: migrate link types to valid values"
```

---

### Task 6: Update docs/VALIDATION_ERRORS.md

**Files:**
- Modify: `docs/VALIDATION_ERRORS.md`

**Step 1: Add E116 documentation**

Add after the E115 section (~line 251):

```markdown
### E116: Invalid Link Type

The `type` field in a link entry is not a valid value.

**Valid types:** `affiliate`, `product`, `resource`, `review`,
`support`

**Common mistakes:**
- `specs` -> use `resource`
- `manual` -> use `resource`
- `demo` -> use `product`
- `trial` -> use `product`
- `versions` -> use `product`

**Fix:** Use one of the valid link types listed above.
```

**Step 2: Remove W122 section**

Delete the W122 section (~lines 473-479).

**Step 3: Commit**

```bash
git add docs/VALIDATION_ERRORS.md
git commit -m "docs: add E116 link type error, remove W122"
```

---

### Task 7: Final validation

**Step 1: Run full validation**

```bash
pnpm validate
```

Expected: All files pass, no E116 errors, no W122 warnings.

**Step 2: Verify the link types schema is correctly loaded**

Spot-check by temporarily adding a bad link type to a YAML
file and running `pnpm validate` to confirm it's caught as
E116. Then revert the change.
