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
 * bestservice.com). Compares the manufacturer slug against the
 * domain's registrable label with separators stripped.
 */
export function isManufacturerOwnDomain(manufacturerSlug: string, url: string): boolean {
  const host = urlHost(url);
  if (!host) return false;
  const label = host.split(".").slice(0, -1).join("");
  const slug = manufacturerSlug.toLowerCase().replace(/[^a-z0-9]/g, "");
  return slug.length > 0 && label.replace(/[^a-z0-9]/g, "") === slug;
}
