/**
 * Aggregator / marketplace / distributor domains that should not be
 * used as an entry's canonical top-level `url` when the maker has an
 * official page of its own. Linking to one of these is acceptable only
 * when no official page exists anywhere (dead vendor, KVR-only
 * freeware, etc.).
 */
export const AGGREGATOR_DOMAINS: readonly string[] = [
  "kvraudio.com",
  "modulargrid.net",
  "modulargrid.com",
  "bestservice.com",
  "pluginboutique.com",
  "lootaudio.com",
  "adsrsounds.com",
  "splice.com",
  "sweetwater.sjv.io",
  "plugivery.com",
  "etsy.com",
];

/** Hostname of a URL, lowercased, without a leading "www.". */
export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isAggregatorUrl(url: string): boolean {
  const host = urlHost(url);
  if (!host) return false;
  return AGGREGATOR_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * True when an aggregator domain is actually the manufacturer's own
 * domain (e.g. the `best-service` manufacturer publishing on
 * bestservice.com). Compares the manufacturer slug, separators
 * stripped, against the registrable domain's labels.
 *
 * The registrable domain is the AGGREGATOR_DOMAINS entry the host
 * matched, when it matched one: that list already names each aggregator
 * at its registrable level, so a maker's page under one of them
 * (splice.pluginboutique.com) still reads as the aggregator's, while
 * the maker's own subdomain (tools.splice.com) reads as the maker's.
 * A host outside the list is compared on every label but the last, so a
 * multi-part TLD (bestservice.co.uk) needs no public-suffix list. Both
 * callers only consult this after isAggregatorUrl, so the wider
 * fallback never decides an audit. Measured against the dataset when the
 * subdomain case was fixed (#644), exactly one entry changed
 * (splice-astra on tools.splice.com).
 */
export function isManufacturerOwnDomain(manufacturerSlug: string, url: string): boolean {
  const host = urlHost(url);
  if (!host) return false;
  const slug = manufacturerSlug.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length === 0) return false;
  const registrable =
    AGGREGATOR_DOMAINS.find((domain) => host === domain || host.endsWith(`.${domain}`)) ?? host;
  const labels = registrable.split(".").slice(0, -1);
  return labels.some((label) => label.replace(/[^a-z0-9]/g, "") === slug);
}
