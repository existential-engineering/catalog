/**
 * The shape of an entry's `id`.
 *
 * `pnpm assign-ids` writes a 21-character nanoid (URL-safe alphabet:
 * letters, digits, `-` and `_`), and nothing else is meant to write the
 * field at all. Until this existed the validator checked only that the
 * value was a non-empty string, so a hand-typed `id: 1`, a slug pasted
 * into the field or a truncated paste validated, built and shipped, and
 * Studio's `supersedes` and image lookups keyed on it. The corpus was
 * clean when the pattern was introduced, which is why it is an error
 * (E129) rather than a staged warning.
 */
export const ENTRY_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;
