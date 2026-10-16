/**
 * Entries that collide with another entry of the same collection.
 *
 * Two kinds of collision, both exact after normalisation and neither
 * fuzzy. A product catalog is full of model-number families
 * ("Bassysm-F" beside "Bassysm-J") that edit-distance matching would
 * flag by the thousand, so the question asked here is the narrow one:
 * is this the same product filed twice?
 *
 * - A **name** collides when the collection, the manufacturer and the
 *   normalised name all agree ("Pro-Q 3" and "ProQ3" under fabfilter).
 * - A **url** collides when two entries in a collection point at the
 *   same page, read without scheme, `www.` or a trailing slash.
 *
 * `pnpm validate` reports each group once (W134, W135) and
 * `pnpm dataset:audit` carries the same groups into the monthly issue,
 * from this one implementation so the two never disagree about a pair.
 * Reviewers used to be asked to spot both by eye, one import PR at a
 * time, which is how 150 url groups came to sit on `main`.
 */

export interface DuplicateCandidate {
  collection: string;
  /** Repo-relative path, the way the report names it. */
  file: string;
  name?: string;
  manufacturer?: string;
  url?: string;
}

export interface DuplicateGroup<T extends DuplicateCandidate = DuplicateCandidate> {
  collection: string;
  /** The value the group shares, as the first member spells it. */
  value: string;
  entries: T[];
}

/** Collapse a display name to a comparable key (lowercase, alphanumerics only). */
export function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      // A "+" marks a distinct SKU, so preserve it as a "plus" token instead of
      // stripping it. This covers both a trailing "+" (ProFX10v3 vs ProFX10v3+,
      // Prime 4 vs Prime 4+) and an internal "+" that precedes more of the name
      // (Vision+ Console vs Vision Console, SPS-1UW+ MKII vs SPS-1UW MKII).
      .replace(/\+/g, "plus")
      .replace(/[^a-z0-9]+/g, "")
  );
}

/** A url without the parts that vary between two spellings of one page. */
export function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function groupBy<T extends DuplicateCandidate>(
  entries: readonly T[],
  keyOf: (entry: T) => string | undefined,
  sharedValue: (entry: T) => string
): DuplicateGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (!key) continue;
    const list = buckets.get(`${entry.collection}\u0000${key}`) ?? [];
    list.push(entry);
    buckets.set(`${entry.collection}\u0000${key}`, list);
  }
  const groups: DuplicateGroup<T>[] = [];
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    groups.push({ collection: group[0].collection, value: sharedValue(group[0]), entries: group });
  }
  return groups;
}

/**
 * Groups sharing collection, manufacturer and normalised name. An entry
 * with no manufacturer (a manufacturer file) never groups, because the
 * name alone is not enough to say two files are one product.
 */
export function findDuplicateNameGroups<T extends DuplicateCandidate>(
  entries: readonly T[]
): DuplicateGroup<T>[] {
  return groupBy(
    entries,
    (entry) => {
      if (!entry.name || !entry.manufacturer) return undefined;
      const norm = normalizeName(entry.name);
      return norm ? `${entry.manufacturer}\u0000${norm}` : undefined;
    },
    (entry) => entry.name ?? ""
  );
}

/** Groups sharing a collection and a normalised `url`. */
export function findDuplicateUrlGroups<T extends DuplicateCandidate>(
  entries: readonly T[]
): DuplicateGroup<T>[] {
  return groupBy(
    entries,
    (entry) => (entry.url ? normalizeUrl(entry.url) || undefined : undefined),
    (entry) => entry.url ?? ""
  );
}
