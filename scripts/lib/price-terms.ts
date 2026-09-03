/**
 * Price terms.
 *
 * A software entry can legitimately carry several prices in one currency
 * (a perpetual licence, a monthly plan, a yearly plan), and before this
 * field existed the Price shape could not say which was which. Importers
 * then either dropped prices to satisfy a duplicate-price review finding
 * or shipped an ambiguous pair. `term` is the discriminator, optional so
 * the 74 entries that predate it keep validating.
 */

export const PRICE_TERMS = ["perpetual", "monthly", "yearly", "rent-to-own"] as const;
export type PriceTerm = (typeof PRICE_TERMS)[number];

/** The subset of a price this module reads. */
export interface PriceLike {
  currency?: string;
  term?: string;
}

/** A currency that carries several prices and cannot tell them apart. */
export interface UntermedGroup {
  currency: string;
  /** Indexes into the prices array that carry no `term`. */
  untermed: number[];
  /** Indexes that share a term with another price in the same currency. */
  repeated: number[];
}

/**
 * Groups of same-currency prices that a reader cannot distinguish: two or
 * more prices in one currency where at least one carries no `term`, or
 * where two carry the same term. A single price per currency never needs
 * a term, so it is never reported.
 */
/** A prices array and the path it sits at in the entry. */
export interface PriceArray {
  path: (string | number)[];
  prices: PriceLike[];
}

/** The subset of an entry that can carry price arrays. */
export interface PricedEntry {
  prices?: unknown;
  versions?: unknown;
  variants?: unknown;
}

/**
 * Every prices array the schemas accept, with its path: the entry's own,
 * then one per version and per variant. W131 reads all of them, so an
 * ambiguous pair inside a version is reported like one at the top level.
 */
export function collectPriceArrays(entry: PricedEntry): PriceArray[] {
  const out: PriceArray[] = [];
  if (Array.isArray(entry.prices)) out.push({ path: ["prices"], prices: entry.prices });
  for (const key of ["versions", "variants"] as const) {
    const list = entry[key];
    if (!Array.isArray(list)) continue;
    for (const [index, item] of list.entries()) {
      const prices = (item as { prices?: unknown } | null)?.prices;
      if (Array.isArray(prices)) out.push({ path: [key, index, "prices"], prices });
    }
  }
  return out;
}

/** `versions[1].prices[0]` for a path, the shape the other warnings use. */
export function formatPricePath(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (acc, segment) =>
      typeof segment === "number" ? `${acc}[${segment}]` : acc ? `${acc}.${segment}` : segment,
    ""
  );
}

export function findUntermedGroups(prices: readonly PriceLike[]): UntermedGroup[] {
  const byCurrency = new Map<string, number[]>();
  prices.forEach((price, index) => {
    if (typeof price.currency !== "string") return;
    const list = byCurrency.get(price.currency) ?? [];
    list.push(index);
    byCurrency.set(price.currency, list);
  });

  const groups: UntermedGroup[] = [];
  for (const [currency, indexes] of byCurrency) {
    if (indexes.length < 2) continue;
    const untermed = indexes.filter((i) => !prices[i]?.term);
    const seen = new Map<string, number>();
    const repeated: number[] = [];
    for (const i of indexes) {
      const term = prices[i]?.term;
      if (!term) continue;
      const first = seen.get(term);
      if (first === undefined) seen.set(term, i);
      else repeated.push(first, i);
    }
    if (untermed.length === 0 && repeated.length === 0) continue;
    groups.push({ currency, untermed, repeated: [...new Set(repeated)].sort((a, b) => a - b) });
  }
  return groups;
}
