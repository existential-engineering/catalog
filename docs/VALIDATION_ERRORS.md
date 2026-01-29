# Validation Error Reference

This document describes all validation error codes used by the catalog validation system.
Each error includes an explanation, common causes, and how to fix it.

## Error Code Format

Error codes follow this naming convention:

- **E1xx** - Schema/format errors (field types, formats, values)
- **E2xx** - Reference errors (missing manufacturers, duplicates)
- **E3xx** - Content errors (markdown, URLs)
- **E4xx** - Identifier errors (bundle IDs, format validation)

---

## Schema Errors (E1xx)

### E100: Missing Required Field

A required field is missing from the entry.

**Common causes:**

- Forgot to add a required field
- Field name is misspelled

**Required fields by type:**

| Entry Type   | Required Fields                | Recommended Fields                              |
| ------------ | ------------------------------ | ----------------------------------------------- |
| Manufacturer | `slug`, `name`                 | `website`                                       |
| Software     | `slug`, `name`, `manufacturer` | `primaryCategory`, `platforms`, `identifiers`   |
| Hardware     | `slug`, `name`, `manufacturer` | `primaryCategory`, `description`                |

**Fix:** Add the missing field to your YAML file.

---

### E101: Invalid Field Type

A field has the wrong data type (e.g., string instead of array).

**Examples:**

```yaml
# Wrong - platforms should be an array
platforms: mac

# Correct
platforms:
  - mac
  - windows
```

**Fix:** Check the expected type for the field and correct it.

---

### E102: Invalid Slug Format

The slug doesn't match the required pattern.

**Rules:**

- Lowercase letters and numbers only
- Hyphens allowed between characters
- No leading or trailing hyphens
- Pattern: `^[a-z0-9][a-z0-9-]*[a-z0-9]$` (or single character `^[a-z0-9]$`)

**Examples:**

```yaml
# Wrong
slug: Serum          # uppercase
slug: -serum         # leading hyphen
slug: serum-         # trailing hyphen
slug: serum--x       # double hyphen

# Correct
slug: serum
slug: massive-x
slug: pro-tools
```

**Fix:** Update the slug to follow the format rules.

---

### E103: Invalid URL Format

A URL field is malformed.

**Examples:**

```yaml
# Wrong
website: xferrecords.com           # missing protocol
website: htp://xferrecords.com     # typo in protocol

# Correct
website: https://xferrecords.com
```

**Fix:** Ensure URLs include `https://` or `http://` protocol.

---

### E104: Invalid Category

A category value is not in the approved list.

**Common causes:**

- Typo in category name
- Using a deprecated or non-existent category
- Forgetting to check `schema/categories.yaml`

**Fix:** Check `schema/CONTEXT.md` for the list of valid categories. The error message will suggest the closest match if available.

---

### E105: Invalid Platform

A platform value is not in the approved list.

**Valid platforms:** `mac`, `windows`, `linux`, `ios`, `android`

**Fix:** Use only the valid platform values listed above.

---

### E106: Invalid Format

A plugin format value is not in the approved list.

**Valid formats:** `au`, `vst`, `vst2`, `vst3`, `aax`, `rtas`, `tdm`, `clap`, `lv2`, `standalone`

**Fix:** Use only the valid format values listed above.

---

### E107: Invalid Locale

A translation locale code is not in the approved list.

**Approved locales:** `de`, `es`, `fr`, `ja`, `ko`, `pt-BR`, `zh`

**Fix:** Use only approved locale codes. To add a new locale, first add it to `schema/locales.yaml`.

---

### E108: Invalid Date Format

A date field is not in the correct format.

**Valid formats:**

- Full date: `YYYY-MM-DD` (e.g., `2024-01-15`)
- Year only: `YYYY` (e.g., `2024`)

**Fix:** Use ISO 8601 date format.

---

### E109: Slug Filename Mismatch

The slug in the YAML file doesn't match the filename.

**Example:**

```
File: data/software/serum.yaml
Slug in file: slug: serum-vst   # Should be "serum"
```

**Fix:** The slug must match the filename (without `.yaml` extension).

---

## Reference Errors (E2xx)

### E200: Manufacturer Not Found

A software or hardware entry references a manufacturer that doesn't exist.

**Fix:**

1. Check if the manufacturer slug is correct
2. Create the manufacturer first if it doesn't exist
3. Use the `/add-entry` command to create both together

---

### E201: Duplicate Slug

The slug is already used by another entry.

**Note:** Slugs must be unique across ALL collections (manufacturers, software, hardware).

**Fix:** Choose a different, unique slug. Check `.slug-index.json` to see existing slugs.

---

### E202: Duplicate Category

The same category appears in both `primaryCategory` and `categories` array.

**Example:**

```yaml
# Wrong - synthesizer appears twice
primaryCategory: synthesizer
categories:
  - synthesizer
  - wavetable

# Correct
primaryCategory: synthesizer
categories:
  - wavetable
```

**Fix:** Remove the duplicate from the `categories` array.

---

### E203: Parent Company Not Found

A manufacturer references a parent company that doesn't exist.

**Fix:** Create the parent company manufacturer first, or correct the slug.

---

### E204: I/O Translation Mismatch

A hardware I/O translation references a port that doesn't exist in the base entry.

**Example:**

```yaml
io:
  - name: Headphone Out
    # ...

translations:
  de:
    io:
      - originalName: Headphones Out  # Wrong - doesn't match "Headphone Out"
        name: Kopfhörerausgang
```

**Fix:** Ensure `originalName` exactly matches a port name in the base `io` array.

---

## Content Errors (E3xx)

### E300: Invalid Markdown

The markdown content is malformed.

**Fix:** Check for syntax errors in your markdown content.

---

### E301: YouTube URL Format

YouTube URLs must use the canonical format.

**Canonical format:** `https://www.youtube.com/watch?v=VIDEO_ID`

**Examples:**

```yaml
# Wrong
url: https://youtu.be/abc123
url: https://youtube.com/watch?v=abc123
url: https://www.youtube.com/embed/abc123

# Correct
url: https://www.youtube.com/watch?v=abc123
```

**Fix:** Convert YouTube URLs to the canonical format.

---

### E302: Unclosed Code Block

A markdown code block (triple backticks) is not properly closed.

**Example:**

````yaml
# Wrong
description: |
  Here's some code:
  ```javascript
  console.log("hello")
  # Missing closing ```
````

**Fix:** Ensure all code blocks have matching opening and closing triple backticks.

---

### E303: Unbalanced Backticks

Inline code backticks are not balanced.

**Example:**

```yaml
# Wrong
description: Use the `foo command to run it

# Correct
description: Use the `foo` command to run it
```

**Fix:** Ensure inline code has matching opening and closing backticks.

---

## Identifier Errors (E4xx)

### E400: Invalid Identifier Format

A plugin identifier doesn't match the expected format.

**Expected formats:**

| Format | Pattern                         | Example                        |
| ------ | ------------------------------- | ------------------------------ |
| `au`   | Reverse domain                  | `com.xferrecords.Serum`        |
| `vst3` | Reverse domain                  | `com.native-instruments.Massive` |
| `aax`  | 4-letter PACE code              | `XfRc`                         |
| `clap` | Reverse domain                  | `com.u-he.Diva`                |

**Fix:** Update the identifier to match the expected format for that plugin type.

---

### E401: Missing Identifier

A software entry is missing recommended identifiers.

**Note:** This is a warning, not an error. Identifiers help with plugin scanning and matching.

**Fix:** Add bundle identifiers for the formats the plugin supports.

---

## Running Validation

To validate your entries:

```bash
# Validate all entries
pnpm validate

# Check formatting
pnpm format:check

# Fix formatting
pnpm format
```

## Getting Help

If you encounter an error not listed here, or need clarification:

1. Check `schema/CONTEXT.md` for valid values
2. Look at existing entries in `data/` for examples
3. Open an issue on GitHub
