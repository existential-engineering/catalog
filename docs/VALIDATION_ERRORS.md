# Validation Error Reference

This document describes all validation error codes used by the catalog validation system.
Each error includes an explanation, common causes, and how to fix it.

## Error Code Format

Error codes follow this naming convention:

- **E1xx** - Schema/format errors (field types, formats, values)
- **E2xx** - Reference errors (missing manufacturers, duplicates)
- **E3xx** - Content errors (markdown, URLs)
- **E4xx** - Identifier errors (bundle IDs, format validation)
- **W1xx** - Advisory warnings (non-blocking, informational)

---

## Schema Errors (E1xx)

### E100: Missing Required Field

A required field is missing from the entry.

**Common causes:**

- Forgot to add a required field
- Field name is misspelled

**Required fields by type:**

| Entry Type   | Required Fields                | Recommended Fields                            |
| ------------ | ------------------------------ | --------------------------------------------- |
| Manufacturer | `slug`, `name`                 | `url`                                         |
| Software     | `slug`, `name`, `manufacturer` | `primaryCategory`, `platforms`, `identifiers` |
| Hardware     | `slug`, `name`, `manufacturer` | `primaryCategory`, `description`              |

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

Hardware `hp` (Eurorack panel width) is a positive integer. A string carrying
the unit, a fraction, zero or a negative value each fail with this code:

```yaml
# Wrong
hp: "12HP"
hp: 12.5
hp: 0

# Correct
hp: 12
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
slug: Serum # uppercase
slug: -serum # leading hyphen
slug: serum- # trailing hyphen
slug: serum--x # double hyphen

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
url: xferrecords.com # missing protocol
url: htp://xferrecords.com # typo in protocol

# Correct
url: https://xferrecords.com
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

```text
File: data/software/serum.yaml
Slug in file: slug: serum-vst   # Should be "serum"
```

**Fix:** The slug must match the filename (without `.yaml` extension).

---

### E110: YAML Syntax Error

The YAML file has a syntax error and cannot be parsed.

**Common causes:**

- Incorrect indentation (YAML requires consistent spaces, not tabs)
- Missing colons after keys
- Unquoted special characters
- Unclosed quotes or brackets

**Example:**

```text
E110:3: bad indentation of a mapping entry
```

**Fix:** Check the YAML syntax at the indicated line number. Use a YAML validator or editor with YAML support to identify the exact issue.

---

### E111: Invalid IO Signal Flow

The `signalFlow` field in an IO entry has an invalid value.

**Valid values:** `input`, `output`, `bidirectional`

**Fix:** Use one of the valid signal flow values listed above.

---

### E112: Invalid IO Category

The `category` field in an IO entry has an invalid value.

**Valid values:** `audio`, `midi`, `digital`, `data`, `control`, `power`, `cv`

**Common mistakes:**

- `instrument` → use `audio`
- `headphone` → use `audio`
- `usb` → use `data`
- `analog` → use `audio`

**Fix:** Use one of the valid IO category values. See `schema/io-categories.yaml` for the canonical list.

---

### E113: Invalid IO Position

The `position` field in an IO entry has an invalid value.

**Valid values:** `top`, `bottom`, `left`, `right`, `front`, `rear`, `side`

**Aliases accepted:** `Back` → `rear`, `Top` → `top`, etc. (capitalized forms are accepted and normalized)

**Fix:** Use one of the valid position values.

---

### E114: Invalid Currency

The `currency` field in a price entry is not a valid ISO 4217 currency code.

**Common currencies:** `USD`, `EUR`, `GBP`, `JPY`, `CNY`

**Fix:** Use a valid ISO 4217 code. To add a new currency, add it to `schema/currencies.yaml`.

---

### E115: Invalid Connector Detail

The `connectorDetail` field in an IO entry contains an invalid value for the given connection type, or `connectorDetail` is used on a connection type that doesn't support it.

**Supported connections:** `1/4-inch`, `1/8-inch`, `2.5mm`, `barrel`, `xlr`

**Fix:** Check `schema/io-connector-details.yaml` for valid values per connection type. Remove `connectorDetail` if the connection type doesn't support it.

---

### E116: Invalid Link Type

The `type` field in a link entry is not a valid value.

**Valid types:** `product`, `resource`, `review`, `support`

**Common mistakes:**

- `specs` -> use `resource`
- `manual` -> use `resource`
- `demo` -> use `product`
- `trial` -> use `product`
- `versions` -> use `product`

**Fix:** Use one of the valid link types listed above.

---

### E117: Invalid IO Type

The `type` field in an IO entry is not in `schema/io-types.yaml`.

`type` is **what the signal is**. `connection` is **the physical connector**.
Putting a connector name in `type` is the most common mistake here: a wireless
receiver's BNC ports are `type: rf` (an antenna) with `connection: bnc` — not
`type: bnc`.

**Common mistakes:**

- `bnc`, `xlr` -> connectors, not signals. Put them in `connection` and give `type` the actual signal (`rf`, `line`, `mic`)
- `trs` -> also a connector, and not a valid `connection` value either — use `connection: 1/4-inch` (or `1/8-inch`) and name the signal in `type`
- `spdif` -> use `s/pdif`
- `aes3`, `aes-ebu` -> use `aes/ebu`
- `wordclock`, `word-clock` -> use `word clock`
- `audio`, `analog`, `digital`, `other` -> too vague to query. Name the signal (`line`, `mic`, `cv/gate`)
- `mic/line`, `mic-line` -> a combo input is `mic`; the `connection` carries `combo jack`

**Fix:** Use a value from `schema/io-types.yaml`. If a signal type is genuinely
missing, add it there. Do **not** alias it in a consumer and do not fall back to a
vague value — the vocabulary is a small closed enum on purpose, and an alias makes
the wrong value canonical forever.

---

### E118: Name Contains Scrape Artifacts

The `name` field carries mechanical junk left over from scraping a vendor
page. There is no legitimate case for any of these:

- **Trademark/legal symbols** (`™`, `®`, `©`, `℠`) — `5150® Iconic® Series` → `5150 Iconic Series`
- **HTML entities** (`&#038;`, `&amp;`) — decode them to the real character
- **Leading/trailing separators or whitespace** — `SE-DJ5000 —` → `SE-DJ5000`
- **Consecutive spaces** — usually left behind after removing a symbol

**Fix:** Clean the name in place. The rest of the title (taglines, brand
prefixes) is covered by the advisory warnings W129/W130.

---

### E119: Invalid Capability

A value in `capabilities` is not in `schema/capabilities.yaml`.

`capabilities` answers one question: **what audio processing operation does
this product perform?** It is deliberately a different axis from `categories`,
which also carries lifecycle (`discontinued`), form factor (`rack-mount`,
`pedal`), technology (`analog`, `digital`) and era (`vintage`). That mixing is
fine for browsing and useless for comparison — two entries sharing
`discontinued` have told you nothing about whether they overlap.

**Common mistakes:**

- `rack-mount`, `pedal`, `outboard`, `modular` -> form factor. These belong in `categories`
- `discontinued`, `legacy`, `vintage` -> lifecycle and era. `categories`
- `analog`, `digital` -> how it is built, not what it does. `categories`
- `guitar`, `vocal` -> what it is used on. `categories`
- `multi-effect` -> not an operation. List the operations it performs
- `shimmer`, `auto-tune`, `neural capture` -> product or algorithm names.
  Describe the operation: `reverb` + `pitch-shift`, `pitch-correction`,
  `amp-modeling`

**Fix:** Use a value from `schema/capabilities.yaml`. If a product genuinely
performs an operation the vocabulary lacks, add it there in the same PR (the
same convention `io-types.yaml` follows). There are no aliases on this field
by design: a synonym would reintroduce exactly the ambiguity that makes
`categories` uncomparable.

Omit the field entirely rather than guessing. An absent `capabilities` means
"not yet assessed", which `pnpm capability-coverage` reports as such; a
speculative list is indistinguishable from a verified one.

This code also covers `capabilities: []`, which fails with "capabilities must
not be empty". An empty array is not the same claim as an absent field: it says
the product performs no audio operation at all, which is never what an author
means. Delete the key instead.

---

### E120: Storage Media Slot as IO

An io entry's name identifies a storage media slot (SD, microSD, SDHC/SDXC,
CompactFlash, Memory Stick, SmartMedia, xD).

Storage slots hold media, not cables, so the setup graph can do nothing with
them: no cable ever runs from a card slot to another device. This is the same
reasoning that keeps `bluetooth` and `wifi` out of the io type vocabulary.
Mention the slot in `description`, `details`, or `specs` instead.

Deliberately narrow: option and expansion card bays (Dante/MADI option cards,
console expansion slots) accept cards that present their own connectors, so
"Option Card Slot" and similar names stay legal, as do `connection: card-slot`
entries for those bays.

**Fix:** Delete the io entry and note the slot in the entry's prose fields.

---

### E121: Key Not in the Schema

`pnpm validate` found a key no collection schema declares, at the top level or
inside `prices`, `versions`, `variants`, `io`, `links` or `videos`.

Zod strips a key it does not declare, so the entry validated, built and shipped while
the value never reached the database. `prices[].type`, `versions[].notes`, a
top-level `note` and the `discontinued: true` flag behind catalog#689 all arrived
this way. The check began as the advisory W132 while 337 entries on `main` predated
it; those were backfilled in catalog#716 and it has been a hard error on every run
since. `--strict-unknown-keys` is still accepted and changes nothing. One key is
caught earlier and reported differently: a top-level `images` block is E199, because
product images live in R2 keyed by id and the block is rejected on the raw object
before any schema runs.

**Fix:** Remove the key, or move the value where the schema keeps it (`discontinued`
is a category, a price term is `term`, a version note is `description`). If the
value is genuinely new data, add it to the schema in the same PR.

---

### E122: IO Layout Hint Is Not a Positive Integer

An io entry's `rowPosition` or `columnPosition` is present but is not a 1-based
integer: zero, a negative number, a fraction, or a string. Both hints are grid
coordinates Studio reads as-is, so a value it would have to coerce is an error
rather than a value to round.

**Fix:** Count from 1. Column 1 is the leftmost jack and row 1 the topmost, viewing
that face head-on. Remove the hint if the layout is not known.

---

### E123: IO Layout Hint Without Its Partner

An io entry carries `rowPosition` without `columnPosition`, or the reverse. A
single-column stack still has a column, so the pair is always set together. The
three Black Lion patchbays carried `rowPosition` alone before AUREO-1115; they now
carry `columnPosition: 1` as well.

**Fix:** Set both fields, or neither. A single-row edge uses `rowPosition: 1` on
every port and a single-column edge uses `columnPosition: 1`.

---

### E124: IO Layout Cell Occupied Twice

Two io entries on the same `position` edge carry the same `(rowPosition,
columnPosition)`. One cell holds one jack; a second jack in it is a numbering
mistake, most often a copied port whose column was not advanced.

**Fix:** Give each port on the edge its own cell. Stacked jacks share a
`columnPosition` and differ by `rowPosition`.

---

### E125: IO Edge Only Partly Hinted

On a `position` edge where at least one io entry carries a layout hint, another
entry carries none. Studio's `computeHandleGrid` takes a side with any hint down the
grid path and back-fills the unhinted ports row-major, so a partly hinted edge
renders a layout nobody drew.

**Fix:** Hint every port on that edge, or none of them. Hints come from
`pnpm enrich-io <slug>` or `/io-enrich` against a photo or manual, never from a
bulk import.

---

### E126: Control Character in a String Value

A string value carries a control character: a C0 or C1 code, a DEL, a Unicode line
or paragraph separator, or — in a single-line field — a newline, carriage return or
tab. Newlines and tabs stay legal inside the prose fields (`description`, `details`,
`specs`, and the same fields under `translations`), because that is how those are
written.

Nothing rejected these before, and `z.url()` in particular accepts a URL with a
newline, a NUL, a pipe or a backtick in it. That matters because catalog values
leave the repository as text in line-oriented places: `url-health.yml` lays a broken
URL out as a Markdown table row, and a newline inside the value ends the row, so an
accepted URL could restructure a bot-generated report or change whose name appeared
to have written it. The workflows encode each table cell now, which is the fix at the
sink; this keeps the value single-line where it is authored, so every other consumer
inherits that rather than each one having to remember.

**Fix:** Remove the character. A value that genuinely needs paragraphs is prose and
belongs in `description`, `details` or `specs` as a `|-` block scalar.

---

### E127: Price Amount Is Negative or Not a Finite Number

A `prices[].amount` is below zero, or is `NaN`/`Infinity`. Nothing a maker charges
produces such a value, so this is a hard error with no legacy corpus behind it.

Zero is deliberately **not** an error here. It is the catalog's only way to say a
product is free, and Studio reads it that way. An unverified zero is reported as the
advisory W133 instead.

**Fix:** Write the real amount, or drop the price. An amount the import could not
read is omitted, never written as a placeholder.

---

### E128: URL Scheme Is Not http or https

A `url` field (the entry's own, a link's, a version's, a manufacturer's) carries a
scheme other than `http` or `https`: `javascript:`, `data:`, `file:`, `ftp:` and so
on. `z.url()` accepts any of them, because the URL parser does, and nothing
rejected them before. A `url` is a page Studio sends a person to, so a
`javascript:` or `data:` value is a payload rather than an address once a client
opens it, and the catalog's signature would be vouching for it.

The same rule applies to a link written inside prose (`[text](javascript:...)` in
`description`, `details` or `specs`): the build renders those with marked, and a
link it refuses is rendered as its text alone.

**Examples:**

```yaml
# Wrong
url: javascript:alert(1)
links:
  - type: resource
    title: White paper
    url: ftp://ftp.example.com/paper.pdf

# Correct
url: https://example.com/product
```

**Fix:** Point the field at the maker's http(s) page. A document only reachable
over another scheme has no place in `links`; mention it in `details` instead.

---

### E129: Id Is Not a 21-Character Nanoid

The `id` field is not the 21-character nanoid `pnpm assign-ids` writes
(letters, digits, `-` and `_`). Nothing else is meant to write the field: a
hand-typed `id: 1`, a slug pasted into it or a truncated paste used to
validate, build and ship, and Studio keys `supersedes` and product images on
the value.

**Fix:** Remove the hand-written `id` and let CI assign one. An entry may
leave the field out entirely; `assign-ids.yml` fills it on the pull request.

---

### E130: Unknown IO Connection

The `connection` field in an IO entry is not in the known connections list.
This was the advisory W121 until the corpus carried a single unknown value
(`sc`, the duplex fibre connector optical MADI uses, now in the schema), so
an unknown value is the same hard error an unknown `type` is (E117).

**Known connections are listed in:** `schema/io-connections.yaml`

**Fix:** If the value is a real connector, add it to
`schema/io-connections.yaml` in the same PR, verified against the manual or a
photo. If it names a signal (`line`, `midi`), it belongs in `type`. `trs` is
not a connection: the schema models the jack size (`1/4-inch`, `1/8-inch`)
and a stereo jack is one entry.

---

### E131: IO Entry Collapses Several Physical Jacks

An IO entry sets `maxConnections` greater than 1 on a single-jack connection
(`1/4-inch`, `1/8-inch`, `2.5mm`, `xlr`, `mini-xlr`, `rca`, `5-pin din`,
`7-pin din`). Those connectors carry one physical link each, so a value above
1 is several jacks collapsed into one entry, the mistake bulk imports made
most. This was the advisory W128 until the corpus carried no hit.

**Fix:** Model each physical jack as its own `io` entry with
`maxConnections: 1` (the Eventide H90 is the worked example: fourteen
discrete jacks). If the entry really is an aggregate on a connector that
carries several links (a D-sub snake, ADAT), use that `connection` instead.

Not flagged: names describing an intentional aggregate ("All Slots", "Bank
A"), and entries whose `primaryCategory` is `patch-bay`, where a 48-point row
is one `io` entry by design.

**Triage tip:** `pnpm io-quality` lists the wider, lower-precision worklist
(collapsed-pair names, missing I/O, layout coverage gaps).

---

### E199: Validation Error

A generic validation error that doesn't fall into a more specific category.

**Fix:** Review the error message for details about what validation rule was violated. This error typically indicates an issue with the data structure or format that doesn't match other specific error codes.

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
      - originalName: Headphones Out # Wrong - doesn't match "Headphone Out"
        name: Kopfhörerausgang
```

**Fix:** Ensure `originalName` exactly matches a port name in the base `io` array.

---

### E205: Duplicate Capability

The same value appears twice in a `capabilities` array.

**Example:**

```yaml
# Wrong - reverb listed twice
capabilities:
  - reverb
  - delay
  - reverb

# Correct
capabilities:
  - reverb
  - delay
```

**Fix:** Remove the duplicate. Capability lists are compared as sets, so a
repeat carries no extra meaning and inflates the list length used in
similarity scoring.

---

### E206: Unknown compatibleWith Reference

A `compatibleWith` slug on a software or content entry matches no file in
`data/software/` or `data/hardware/`.

The entry builds and ships either way, but Studio cannot resolve the slug, so the
compatibility is silently lost. `kontakt` in place of `native-instruments-kontakt`
reached `main` this way while the check was the advisory W123.

**Example:**

```yaml
# Wrong - no data/software/kontakt.yaml
compatibleWith:
  - kontakt

# Correct - the file name of the host's entry
compatibleWith:
  - native-instruments-kontakt
```

**Fix:** Use the slug (file name without `.yaml`) of the host's software or hardware
entry. If the host is not in the catalog yet, add it in the same PR or drop the
reference.

---

### E207: Id Claimed by Two Entries

The same `id` appears on two entries, in one collection or across two.
`pnpm assign-ids` draws every collection's ids from one pool, and product
images are served from R2 keyed by id alone, so an id shared by a hardware
entry and a manufacturer is a collision even though the two tables never
meet. The check used to be per collection.

**Fix:** Keep the id on the entry that had it first (check `git log`) and
remove it from the other; CI assigns that one a fresh id.

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

A Markdown code block (triple backticks) is not properly closed.

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

### E304: Truncated Content

The `description` ends with an ellipsis (`...`), the way a scraped page
excerpt is cut: "featuring 12 algorithms, a looper and..." is not a
description, and nothing downstream can finish it. A trailing "and more...",
"etc...", "others..." or "so on..." is a phrase rather than a cut and is not
flagged.

**Fix:** Replace the field with the complete text from the maker's page, or
end it at the last full sentence.

---

### E305: Raw HTML in Prose

A prose field (`description`, `details`, `specs`, or the same under
`translations`) contains raw HTML: a tag, a comment, an inline element. The build
renders these fields with marked, which passes HTML through unchanged by design,
and Studio displays the result as HTML. So until this rule existed, a `<script>`
or an `<img onerror=...>` in an entry's prose shipped verbatim in the signed
database, and nothing between a pull request and a release looked for it.

The check reads marked's own token stream rather than matching `<` in the text,
so it refuses exactly what the renderer would have emitted as markup and leaves
alone what the renderer reads as text (a `<The Lord's Funeral>` in a tracklist is
not a tag). The build also escapes any raw HTML it is handed, as a second layer;
this error is the one a contributor sees.

**Examples:**

```yaml
# Wrong
details: |-
  Three modes, <b>including shimmer</b>.

  <iframe src="https://example.com/embed"></iframe>

# Correct
details: |-
  Three modes, **including shimmer**.
```

**Fix:** Write Markdown. Bold is `**text**`, a list is `- item`, a link is
`[text](https://...)`. An embed or a widget has no place in prose; link to the
page that hosts it.

---

## Identifier Errors (E4xx)

### E400: Invalid Identifier Format

A plugin identifier doesn't match the expected format.

**Expected formats:**

| Format | Pattern            | Example                          |
| ------ | ------------------ | -------------------------------- |
| `au`   | Reverse domain     | `com.xferrecords.Serum`          |
| `vst3` | Reverse domain, or a 32-digit hex class id | `com.native-instruments.Massive` |
| `aax`  | 4-letter PACE code | `XfRc`                           |
| `clap` | Reverse domain     | `com.u-he.Diva`                  |

`default` and `bundle` take the reverse-domain pattern too, because the build
writes them onto format rows (see E401 below). A key with no pattern, such as
`productId`, accepts any value.

**Fix:** Update the identifier to match the expected format for that plugin type.

---

### E401: Missing Identifier

A software entry is missing recommended identifiers.

**Note:** This is a warning, not an error. Identifiers help with plugin scanning and matching.

**Fix:** Add bundle identifiers for the formats the plugin supports.

A `default` key covers every listed format at once, and is the right
choice when the plugin ships one bundle id across AU, VST3 and AAX (most
JUCE-built plugins do). The build resolves each format in this order:

| Precedence | Key                           | Applies to                 |
| ---------- | ----------------------------- | -------------------------- |
| 1          | The format's own key (`vst3`) | That format only           |
| 2          | `default`                     | Every listed format        |
| 3          | `bundle`                      | `au` and `standalone` only |

A per-format key overrides `default` for that format; `bundle` names a
macOS app or component bundle, so it is not assumed for VST3 or AAX.
`pnpm identifier-coverage` counts a format as covered when this
resolution yields a value, matching what `software_formats.identifier`
carries. See `scripts/lib/identifier-fallback.ts` and CLAUDE.md
("Identifiers").

---

### E402: Duplicate Identifier

An identifier is claimed twice: by two software entries, twice within one
entry's `componentIdentifiers`, or in `componentIdentifiers` under the same
key that already holds it in `identifiers`.

Studio's plugin matcher resolves an identifier to one entry, so a value two
entries share matches whichever the query happens to return. `productId` is
exempt, since it feeds nothing.

**Fix:** Keep the identifier on the one entry the binary belongs to. A
collection's member plugins go in that collection's `componentIdentifiers`,
not in a second entry, and a value already in `identifiers` needs no
repeat.

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

## Advisory Warnings (W1xx)

Warnings are non-blocking — they appear in `pnpm validate` output but do not affect the exit code or CI status. They flag values that are not in the known schema but may be valid.

Retired codes: W120 (unknown io `type`) became E117, W121 (unknown io
`connection`) became E130, W123 (unknown `compatibleWith`) became E206, W128
(collapsed jacks) became E131 and W132 (unknown key) became E121. A code is
never reused.

### W124: Duplicate URL

A `links[].url` repeats the entry's own `url` or an earlier link in the same
entry. Studio renders every link, so the reader sees the same page twice.

**Fix:** Remove the duplicate link entry. If the two differ only in a fragment
or a tracking parameter, keep the plain one.

---

### W125: Link Matches Manufacturer Homepage

The entry's `url`, or one of its `links[].url`, is the manufacturer's homepage
(compared without scheme, `www.` and trailing slashes). The manufacturer file
already carries that page, and Studio shows the maker beside every product, so
the link adds nothing and a product `url` that is a homepage is not a product
page.

**Fix:** Point `url` at the product's own page, or remove it so the field
reads as unknown. Drop the redundant link.

---

### W126: Specs Line Overlaps With Structured Field

A `specs` bullet only restates what `formats` or `platforms` already declare
("- VST3, AU and AAX", "- macOS and Windows"). Studio renders both, so the
reader sees the same fact twice, and a bullet that drifts from the structured
field misleads where the field is what search filters on.

**Fix:** Delete the bullet; keep the structured field as the single source.
A bullet that says more than the field (a version requirement, a host it is
tested in) stays.

---

### W127: Entry Would Benefit From searchTerms

The name is a short all-caps acronym (`MPC`, `SM7B`, `OB-Xa`) and the entry
carries no `searchTerms`. Search composes manufacturer and name, so a reader
typing the expansion or a spaced form finds nothing.

Not flagged: ordinary words that happen to be capitalised (`BOOM`, `HALO`),
listed in `scripts/lib/acronym-exclusions.ts`.

**Fix:** Add `searchTerms` with the expansion and the forms people type
(`SM-7B`, `SM 7B`). Do not add the product's own name or the manufacturer's
display name; both are already indexed.

---

### W129: Manufacturer Name Duplicated in Product Name

The `name` field starts with the manufacturer's display name. The manufacturer is stored in its own field and indexed separately (`manufacturer_name` in FTS), so repeating it in `name` duplicates data: `dbx 286s` under manufacturer `dbx` should be `286s`.

Not flagged: self-titled host-compatibility names where stripping the brand leaves a fragment (`Ampl4 for Positive Grid Bias`), and manufacturer names shorter than 3 characters.

**Fix:** Drop the manufacturer prefix from `name`. If users commonly search the compound form, it still works — search composes the manufacturer and product name. Do NOT add the manufacturer display name to `searchTerms` (it is already indexed).

---

### W130: Name Contains a Tagline-Style Separator

The `name` contains an en/em dash or pipe with surrounding spaces — the signature of a scraped page-title tagline (`Toolbox – Sequencer and Function Generator`) or a storefront brand suffix (`Groth | Wavelet Audio`).

Plain hyphens are not flagged (`AmpHub - Mizar Dist Plus Model` is a real product name), and pipes without spaces are real model numbers (Crown `CDi 4|600`).

**Fix:** Keep only the product name; move descriptive text to `description`. If a product sold through a storefront carries the real developer's brand as a suffix, set `manufacturer` to that developer instead. If the separator is part of the official product name (Spitfire's `Alex Epton — Entropy`), add the slug to `TAGLINE_EXCLUSIONS` in `scripts/lib/name-hygiene.ts`.

---

### W131: Several Prices in One Currency Without a Term

The entry carries two or more `prices` in the same currency and at least one of them
has no `term`, or two share a term. A reader cannot tell a perpetual licence from a
monthly plan, and an importer that met this as a duplicate-price finding used to
drop prices to satisfy it.

**Fix:** Set `term` on each price (`perpetual`, `monthly`, `yearly`, `rent-to-own`),
or keep one price per currency. One price per currency never needs a term.

---

### W133: Free Price Is Missing Source or asOf

A `prices[].amount` is `0` and the price is missing `source`, `asOf`, or both. The
warning clears only when **both** are present: a `source` with no `asOf` cannot say
the price was checked recently, and an `asOf` with no `source` cannot say what was
checked.

Zero means "this product is free", and Studio treats it as a fact: `isFreeProduct`
renders "Free" rather than `$0.00`, keeps the item out of the G.A.S. spend ratio, and
suppresses affiliate purchase links. It is also exactly what an import writes when a
product page leads with a free trial and the extractor finds no price. The value
cannot tell the two apart, so provenance does: a giveaway somebody checked carries
`source` and `asOf` like any other price.

This is how 154 entries came to claim they were free while their makers charged for
them, every Joey Sturgis Tones plugin but one among them.

It is advisory rather than an error because 286 entries predate the rule, the same
staging E121 took through W132. A green run is not evidence that a zero was verified.

**Fix:** Confirm the price on the maker's own page. If it really is free, add both
`source` and `asOf`. If it is not, write the real amount. If you cannot tell, remove
the `prices` block: absent means "unknown", which is honest, where zero asserts free.

---

### W134: Name Shared With Another Entry of the Same Maker

Two or more entries in one collection share a manufacturer and a name, compared
after lowercasing and dropping everything but letters and digits (`Pro-Q 3` and
`ProQ3`; a trailing `+` survives as `plus`, so `Prime 4+` is not `Prime 4`). That
is the same product filed twice, a cosmetic variant that belongs in one entry's
`variants`, or two distinct products whose names need disambiguating. Reported
once per group, on the first file, naming the others.

Reviewers used to be asked to spot this by eye on every import PR. It is
advisory while `main` carries 66 groups; the monthly dataset audit lists the
same groups for review.

**Fix:** Merge the entries (keep the older id, see E207), fold a colour or
finish into `variants`, or give distinct products distinct names.

---

### W135: URL Shared With Another Entry in the Collection

Two or more entries in one collection carry the same `url`, compared without
scheme, `www.` and trailing slashes. A product page belongs to one product, so
this is usually one product filed twice, and occasionally a vendor whose entries
all point at the storefront, which is a `url` to fix rather than entries to
merge. Reported once per group. Advisory while `main` carries 150 groups.

**Fix:** Merge duplicates, or point each entry at its own product page. A
product with no page of its own leaves `url` out.

---

### W136: Hardware or Accessory Entry Has No Description

A hardware or accessory entry carries no `description`, or an empty one.
CLAUDE.md has always required the field on both collections ("Hardware
requires: name, manufacturer, primaryCategory, description"), and the schema
never did; 33 entries on `main` carry none, so the check is staged as a warning
rather than E100 until those are filled.

**Fix:** Write one or two sentences from the maker's page in flow scalar
format. Do not paste the maker's tagline as the description.

---

## Getting Help

If you encounter an error not listed here, or need clarification:

1. Check `schema/CONTEXT.md` for valid values
2. Look at existing entries in `data/` for examples
3. Open an issue on GitHub
