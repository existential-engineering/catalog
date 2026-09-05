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
 * stripped, against each host label except the last: a subdomain
 * (`tools.splice.com`) and a multi-part TLD (`bestservice.co.uk`) both
 * carry the maker's label somewhere other than second-from-the-right,
 * and concatenating every label read both as somebody else's site.
 * Measured against the dataset when this changed, the wider match
 * exempted exactly one entry (splice-astra on tools.splice.com).
 */
export function isManufacturerOwnDomain(manufacturerSlug: string, url: string): boolean {
  const host = urlHost(url);
  if (!host) return false;
  const slug = manufacturerSlug.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length === 0) return false;
  const labels = host.split(".").slice(0, -1);
  return labels.some((label) => label.replace(/[^a-z0-9]/g, "") === slug);
}
