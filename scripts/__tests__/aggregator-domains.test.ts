import { describe, expect, it } from "vitest";
import {
  AGGREGATOR_DOMAINS,
  isAggregatorUrl,
  isManufacturerOwnDomain,
  urlHost,
} from "../lib/aggregator-domains.js";

describe("AGGREGATOR_DOMAINS", () => {
  it("holds bare registrable hostnames, not urls or wildcards", () => {
    // isAggregatorUrl matches on host equality plus a "." suffix, so a
    // scheme, path or leading dot in an entry would silently never match.
    for (const domain of AGGREGATOR_DOMAINS) {
      expect(domain).toBe(domain.toLowerCase());
      expect(domain).not.toMatch(/^\.|\/|:|\*/);
      expect(domain).toContain(".");
    }
  });

  it("has no duplicates", () => {
    expect(new Set(AGGREGATOR_DOMAINS).size).toBe(AGGREGATOR_DOMAINS.length);
  });

  it("lists no entry already covered by another entry's suffix rule", () => {
    for (const domain of AGGREGATOR_DOMAINS) {
      const covered = AGGREGATOR_DOMAINS.filter((d) => d !== domain && domain.endsWith(`.${d}`));
      expect(covered, `${domain} is redundant with ${covered.join(", ")}`).toEqual([]);
    }
  });
});

describe("urlHost", () => {
  it("lowercases the hostname", () => {
    expect(urlHost("https://www.KVRAudio.COM/product/x")).toBe("kvraudio.com");
  });

  it("strips a leading www.", () => {
    expect(urlHost("https://www.example.com")).toBe("example.com");
  });

  it("strips www. only as a whole label", () => {
    expect(urlHost("https://wwwx.example.com")).toBe("wwwx.example.com");
  });

  it("ignores the scheme, port, path and query", () => {
    expect(urlHost("http://example.com:8080/a/b?c=d#e")).toBe("example.com");
  });

  it("returns an empty string for anything URL cannot parse", () => {
    expect(urlHost("")).toBe("");
    expect(urlHost("not a url")).toBe("");
    expect(urlHost("//example.com")).toBe("");
  });

  it("returns an empty string for a scheme-less url", () => {
    // Known limitation: `url` values are expected to carry a scheme.
    // A bare "example.com/x" parses as nothing, so every downstream
    // aggregator check treats it as a non-aggregator.
    expect(urlHost("kvraudio.com/product/x")).toBe("");
  });
});

describe("isAggregatorUrl", () => {
  it.each(AGGREGATOR_DOMAINS)("flags %s at the apex", (domain) => {
    expect(isAggregatorUrl(`https://${domain}/some/product`)).toBe(true);
  });

  it.each(AGGREGATOR_DOMAINS)("flags a subdomain of %s", (domain) => {
    expect(isAggregatorUrl(`https://shop.${domain}/some/product`)).toBe(true);
  });

  it("flags a www. host", () => {
    expect(isAggregatorUrl("https://www.kvraudio.com/plugin/1")).toBe(true);
  });

  it("does not flag an official maker page", () => {
    expect(isAggregatorUrl("https://u-he.com/products/diva/")).toBe(false);
    expect(isAggregatorUrl("https://www.native-instruments.com/en/products/")).toBe(false);
  });

  it("does not flag a host that merely ends with the same letters", () => {
    // Suffix matching is on a label boundary, so these must not match.
    expect(isAggregatorUrl("https://notkvraudio.com")).toBe(false);
    expect(isAggregatorUrl("https://myetsy.com")).toBe(false);
  });

  it("does not flag a different domain under the same brand", () => {
    // Only the affiliate host sweetwater.sjv.io is listed.
    expect(isAggregatorUrl("https://sweetwater.sjv.io/c/123")).toBe(true);
    expect(isAggregatorUrl("https://www.sweetwater.com/store/detail/x")).toBe(false);
  });

  it("does not flag an unparsable url", () => {
    expect(isAggregatorUrl("")).toBe(false);
    expect(isAggregatorUrl("not a url")).toBe(false);
  });
});

describe("isManufacturerOwnDomain", () => {
  it("matches a slug against the domain with separators stripped", () => {
    expect(isManufacturerOwnDomain("best-service", "https://www.bestservice.com/x")).toBe(true);
    expect(isManufacturerOwnDomain("etsy", "https://etsy.com/shop/x")).toBe(true);
  });

  it("matches a slug whose hyphens are also in the domain", () => {
    expect(isManufacturerOwnDomain("u-he", "https://u-he.com/products/diva/")).toBe(true);
  });

  it("rejects a different maker's domain", () => {
    expect(isManufacturerOwnDomain("xfer-records", "https://pluginboutique.com/x")).toBe(false);
  });

  it("rejects an empty slug rather than matching an empty label", () => {
    expect(isManufacturerOwnDomain("", "https://bestservice.com")).toBe(false);
  });

  it("rejects an unparsable url", () => {
    expect(isManufacturerOwnDomain("best-service", "not a url")).toBe(false);
  });

  it("matches the slug on a subdomain of the maker's own host", () => {
    // tools.splice.com is Splice's own product page for Astra. Before
    // #644 the label was every host part concatenated ("toolssplice"),
    // so dataset-audit flagged it and promote-canonical-urls would have
    // rewritten it away once the entry gained a links array.
    expect(isManufacturerOwnDomain("splice", "https://splice.com")).toBe(true);
    expect(isManufacturerOwnDomain("splice", "https://shop.splice.com")).toBe(true);
    expect(isManufacturerOwnDomain("splice", "https://tools.splice.com/astra")).toBe(true);
  });

  it("matches the slug under a multi-part TLD", () => {
    expect(isManufacturerOwnDomain("best-service", "https://bestservice.co.uk")).toBe(true);
  });

  it("never matches the last label, so a slug equal to a TLD is not a match", () => {
    expect(isManufacturerOwnDomain("com", "https://pluginboutique.com/x")).toBe(false);
  });

  it("does not match a slug that only appears as part of a label", () => {
    expect(isManufacturerOwnDomain("splice", "https://notsplice.com")).toBe(false);
  });

  it("does not match a maker's slug on a subdomain of another aggregator", () => {
    // splice.pluginboutique.com is Plugin Boutique's host, whatever the
    // subdomain says. The registrable domain is the aggregator entry the
    // host matched, and only its labels are compared.
    expect(isManufacturerOwnDomain("splice", "https://splice.pluginboutique.com/x")).toBe(false);
    expect(isManufacturerOwnDomain("plugin-boutique", "https://splice.pluginboutique.com/x")).toBe(
      true
    );
  });
});
