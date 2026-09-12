import { describe, expect, it } from "vitest";
import {
  type CatalogSoftwareRef,
  matchRegistry,
  type Registry,
  rowsToTsv,
} from "../lib/open-audio-registry.js";

const catalog: CatalogSoftwareRef[] = [
  {
    slug: "zl-audio-zl-splitter",
    name: "ZL Splitter",
    manufacturerSlug: "zl-audio",
    manufacturerName: "ZL Audio",
  },
  {
    slug: "surge-xt",
    name: "Surge XT",
    manufacturerSlug: "surge-synth-team",
    manufacturerName: "Surge Synth Team",
  },
];

const registry: Registry = {
  plugins: {
    "zl-audio/zlsplitter": {
      slug: "zl-audio/zlsplitter",
      version: "0.3.0",
      versions: {
        "0.3.0": {
          name: "ZL Splitter",
          author: "ZL Audio",
          url: "https://github.com/ZL-Audio/ZLSplitter",
          files: [
            {
              systems: [{ type: "linux" }],
              contains: ["vst3", "lv2"],
              type: "archive",
              url: "https://example.com/linux.zip",
            },
            {
              systems: [{ type: "mac" }],
              contains: ["vst3", "au"],
              type: "archive",
              url: "https://example.com/mac.zip",
            },
          ],
        },
      },
    },
    "surge-synthesizer/surge": {
      slug: "surge-synthesizer/surge",
      version: "1.3.4",
      versions: {
        "1.3.4": {
          name: "Surge XT",
          author: "Surge Synth Team",
          files: [
            {
              systems: [{ type: "win" }],
              contains: ["vst3", "clap"],
              type: "installer",
              url: "https://example.com/win.exe",
            },
          ],
        },
      },
    },
    "someone/unknown-plugin": {
      slug: "someone/unknown-plugin",
      version: "1.0.0",
      versions: {
        "1.0.0": { name: "Unknown Plugin", author: "Someone", url: "https://example.com" },
      },
    },
  },
};

describe("matchRegistry", () => {
  it("emits a format-and-version row per format of every matched package", () => {
    const match = matchRegistry(registry, catalog);
    expect(match.rows).toEqual([
      {
        target: "zl-audio-zl-splitter",
        format: "au",
        version: "0.3.0",
        source: "registry:zl-audio/zlsplitter",
      },
      {
        target: "zl-audio-zl-splitter",
        format: "lv2",
        version: "0.3.0",
        source: "registry:zl-audio/zlsplitter",
      },
      {
        target: "zl-audio-zl-splitter",
        format: "vst3",
        version: "0.3.0",
        source: "registry:zl-audio/zlsplitter",
      },
      {
        target: "surge-xt",
        format: "clap",
        version: "1.3.4",
        source: "registry:surge-synthesizer/surge",
      },
      {
        target: "surge-xt",
        format: "vst3",
        version: "1.3.4",
        source: "registry:surge-synthesizer/surge",
      },
    ]);
  });

  it("lists macOS archives for the installer lane and packages the catalog lacks", () => {
    const match = matchRegistry(registry, catalog);
    expect(match.downloads).toEqual([
      { slug: "zl-audio-zl-splitter", url: "https://example.com/mac.zip" },
    ]);
    expect(match.unmatched).toEqual([
      {
        package: "someone/unknown-plugin",
        name: "Unknown Plugin",
        author: "Someone",
        url: "https://example.com",
      },
    ]);
  });
});

describe("rowsToTsv", () => {
  it("writes - for a missing identifier so the applier reads the row as format-only", () => {
    expect(rowsToTsv([{ target: "a", format: "vst3", version: "1.0", source: "s" }])).toBe(
      "a\tvst3\t-\t1.0\ts"
    );
  });
});
