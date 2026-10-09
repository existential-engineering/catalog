import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyRows,
  extractHttpUrls,
  formatRows,
  judgeResponse,
  parseRows,
  registrableDomain,
  toHttps,
} from "../upgrade-http-urls.js";

describe("extractHttpUrls", () => {
  it("finds url fields and prose URLs, without trailing punctuation", () => {
    const text = [
      "name: Thing",
      "url: http://example.com/a",
      "links:",
      "  - url: http://example.com/manual.pdf",
      "    title: Manual",
      "details: |-",
      "  Visit http://example.org.",
      "secure: https://example.net",
    ].join("\n");
    expect(extractHttpUrls(text, "data/x.yaml")).toEqual([
      { file: "data/x.yaml", line: 2, field: "url", url: "http://example.com/a" },
      { file: "data/x.yaml", line: 4, field: "url", url: "http://example.com/manual.pdf" },
      { file: "data/x.yaml", line: 7, field: "prose", url: "http://example.org" },
    ]);
  });

  it("files a URL in a one-line description as prose", () => {
    expect(extractHttpUrls("description: see http://a.com", "f")[0].field).toBe("prose");
  });
});

describe("registrableDomain", () => {
  it("drops subdomains", () => {
    expect(registrableDomain("www.wmdevices.com")).toBe("wmdevices.com");
    expect(registrableDomain("WMDevices.com.")).toBe("wmdevices.com");
  });

  it("keeps three labels under a co.uk-shaped suffix", () => {
    expect(registrableDomain("www.shop.co.uk")).toBe("shop.co.uk");
    expect(registrableDomain("www.shop.com.ar")).toBe("shop.com.ar");
  });
});

describe("registrableDomain on shared hosting", () => {
  it("treats each tenant as its own site", () => {
    expect(registrableDomain("a.github.io")).toBe("a.github.io");
    expect(registrableDomain("www.a.weebly.com")).toBe("a.weebly.com");
    expect(registrableDomain("github.io")).toBe("github.io");
    expect(registrableDomain("a.blogspot.com")).toBe("a.blogspot.com");
    expect(registrableDomain("www.a.blogspot.com.ar")).toBe("a.blogspot.com.ar");
    expect(registrableDomain("a.blogspot.de")).toBe("a.blogspot.de");
  });

  it("keeps a cross-tenant redirect from passing as an upgrade", () => {
    expect(
      judgeResponse("http://a.github.io/", { status: 200, finalUrl: "https://b.github.io/" })
        .verdict
    ).toBe("keep");
    expect(
      judgeResponse("http://a.github.io/", { status: 200, finalUrl: "https://a.github.io/" })
        .verdict
    ).toBe("upgrade");
  });
});

describe("judgeResponse", () => {
  const original = "http://www.example.com/p";

  it("upgrades a 2xx on the same site, across a www redirect", () => {
    expect(
      judgeResponse(original, { status: 200, finalUrl: "https://example.com/p" }).verdict
    ).toBe("upgrade");
  });

  it("keeps a redirect back to http", () => {
    expect(
      judgeResponse(original, { status: 200, finalUrl: "http://www.example.com/p" }).verdict
    ).toBe("keep");
  });

  it("keeps a different site", () => {
    const probe = judgeResponse(original, {
      status: 200,
      finalUrl: "https://www.hugedomains.com/x",
    });
    expect(probe).toMatchObject({ verdict: "keep" });
    expect(probe.reason).toContain("different site");
  });

  it("keeps a parked page on the same host", () => {
    const body = "<html><h1>This domain is for sale</h1><p>Buy this domain</p></html>";
    expect(
      judgeResponse(original, { status: 200, finalUrl: "https://www.example.com/p", body }).verdict
    ).toBe("keep");
  });

  it("keeps an error status and says what a proxy reported", () => {
    const probe = judgeResponse(original, {
      status: 503,
      finalUrl: "https://www.example.com/p",
      body: "upstream connect error or disconnect/reset before headers. retried",
    });
    expect(probe).toMatchObject({ verdict: "keep", transient: true });
    expect(probe.reason).toBe(
      "https returned 503: upstream connect error or disconnect/reset before headers"
    );
  });

  it("keeps a deep link that lands on the home page", () => {
    const probe = judgeResponse("http://shop.storenvy.com/products/1-x", {
      status: 200,
      finalUrl: "https://www.storenvy.com/?utm_campaign=store404redirect",
    });
    expect(probe.verdict).toBe("keep");
    expect(
      judgeResponse("http://www.example.com", { status: 200, finalUrl: "https://example.com/" })
        .verdict
    ).toBe("upgrade");
  });

  it("skips a refusal rather than reading it as a failed upgrade", () => {
    expect(
      judgeResponse(original, { status: 403, finalUrl: "https://www.example.com/p" }).verdict
    ).toBe("skip");
  });
});

describe("toHttps", () => {
  it("changes the scheme and nothing else", () => {
    expect(toHttps("http://Example.com/A?b=1")).toBe("https://Example.com/A?b=1");
  });
});

describe("applyRows", () => {
  let root: string;
  const file = "data/hardware/x.yaml";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "https-upgrade-"));
    fs.mkdirSync(path.join(root, "data", "hardware"), { recursive: true });
    fs.writeFileSync(
      path.join(root, file),
      "name: X\nurl: http://a.com/p\nlinks:\n  - url: http://a.com/p2\n    title: More\n"
    );
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("rewrites upgrade rows only, and survives a TSV round trip", () => {
    const rows = parseRows(
      formatRows([
        {
          file,
          line: 2,
          field: "url",
          url: "http://a.com/p",
          verdict: "upgrade",
          reason: "https 2xx",
        },
        {
          file,
          line: 4,
          field: "url",
          url: "http://a.com/p2",
          verdict: "keep",
          reason: "https returned 404",
        },
      ])
    );
    const outcome = applyRows(rows, true, root);
    expect(outcome.applied).toBe(1);
    expect(fs.readFileSync(path.join(root, file), "utf8")).toBe(
      "name: X\nurl: https://a.com/p\nlinks:\n  - url: http://a.com/p2\n    title: More\n"
    );
  });

  it("refuses a row whose URL is only a prefix of what is on the line", () => {
    const outcome = applyRows(
      [{ file, line: 4, field: "url", url: "http://a.com/p", verdict: "upgrade", reason: "" }],
      true,
      root
    );
    expect(outcome.applied).toBe(0);
    expect(outcome.skipped[0].reason).toContain("no longer on that line");
  });

  it("refuses a symlinked file", () => {
    const outside = path.join(root, "outside.yaml");
    fs.writeFileSync(outside, "url: http://a.com/p\n");
    fs.symlinkSync(outside, path.join(root, "data/hardware/link.yaml"));
    const outcome = applyRows(
      [
        {
          file: "data/hardware/link.yaml",
          line: 1,
          field: "url",
          url: "http://a.com/p",
          verdict: "upgrade",
          reason: "",
        },
      ],
      true,
      root
    );
    expect(outcome.applied).toBe(0);
    expect(fs.readFileSync(outside, "utf8")).toBe("url: http://a.com/p\n");
  });

  it("inserts a URL carrying a replacement pattern literally", () => {
    fs.writeFileSync(path.join(root, file), "url: http://a.com/p?x=$&y=$'\n");
    const outcome = applyRows(
      [
        {
          file,
          line: 1,
          field: "url",
          url: "http://a.com/p?x=$&y=$'",
          verdict: "upgrade",
          reason: "",
        },
      ],
      true,
      root
    );
    expect(outcome.applied).toBe(1);
    expect(fs.readFileSync(path.join(root, file), "utf8")).toBe("url: https://a.com/p?x=$&y=$'\n");
  });

  it("does not write on a dry run", () => {
    applyRows(
      [{ file, line: 2, field: "url", url: "http://a.com/p", verdict: "upgrade", reason: "" }],
      false,
      root
    );
    expect(fs.readFileSync(path.join(root, file), "utf8")).toContain("url: http://a.com/p\n");
  });
});
