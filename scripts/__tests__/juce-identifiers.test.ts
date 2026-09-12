import { describe, expect, it } from "vitest";
import { extractJuceIdentifiers, juceRows } from "../lib/juce-identifiers.js";

const cmake = `
cmake_minimum_required(VERSION 3.22)
project(SurgeXT VERSION 1.3.4)

juce_add_plugin(surge-xt
    PRODUCT_NAME "Surge XT"
    COMPANY_NAME "Surge Synth Team"
    BUNDLE_ID org.surge-synth-team.surge-xt
    PLUGIN_MANUFACTURER_CODE VmbA
    PLUGIN_CODE SgXT   # four upper-ish letters, still a value
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    FORMATS AU VST3 CLAP LV2 Standalone
    VST3_CATEGORIES Instrument Synth
)
`;

const jucer = `<?xml version="1.0" encoding="UTF-8"?>
<JUCERPROJECT id="abcd" name="Dexed" projectType="audioplug" version="0.9.8"
              bundleIdentifier="com.digitalsuburban.Dexed" pluginFormats="buildAU,buildVST3,buildStandalone"
              pluginManufacturerCode="Dgsb" pluginCode="Dexd" companyName="Digital Suburban">
  <MAINGROUP id="x" name="Dexed"/>
</JUCERPROJECT>
`;

describe("extractJuceIdentifiers", () => {
  it("reads the bundle id, codes and formats out of a juce_add_plugin call", () => {
    expect(extractJuceIdentifiers(cmake)).toEqual({
      bundleId: "org.surge-synth-team.surge-xt",
      manufacturerCode: "VmbA",
      pluginCode: "SgXT",
      formats: ["au", "vst3", "clap", "lv2", "standalone"],
    });
  });

  it("keeps an all-caps plugin code as a value rather than a keyword", () => {
    const info = extractJuceIdentifiers(
      "juce_add_plugin(x PLUGIN_MANUFACTURER_CODE ACME PLUGIN_CODE VERB FORMATS VST3)"
    );
    expect(info).toMatchObject({ manufacturerCode: "ACME", pluginCode: "VERB", formats: ["vst3"] });
  });

  it("reads the attributes off a .jucer root element", () => {
    expect(extractJuceIdentifiers(jucer)).toEqual({
      bundleId: "com.digitalsuburban.Dexed",
      manufacturerCode: "Dgsb",
      pluginCode: "Dexd",
      formats: ["au", "vst3", "standalone"],
    });
  });

  it("returns null for a file that is neither", () => {
    expect(extractJuceIdentifiers("add_executable(tool main.cpp)")).toBeNull();
  });
});

describe("juceRows", () => {
  it("offers the bundle id per identifier-bearing format and leaves standalone out", () => {
    const info = extractJuceIdentifiers(jucer);
    if (!info) throw new Error("fixture did not parse");
    expect(juceRows("dexed", info, "juce:Dexed.jucer")).toEqual([
      {
        target: "dexed",
        format: "au",
        identifier: "com.digitalsuburban.Dexed",
        source: "juce:Dexed.jucer",
      },
      {
        target: "dexed",
        format: "vst3",
        identifier: "com.digitalsuburban.Dexed",
        source: "juce:Dexed.jucer",
      },
    ]);
  });

  it("emits format-only rows when the project states no bundle id", () => {
    const rows = juceRows("x", { formats: ["vst3"] }, "juce:CMakeLists.txt");
    expect(rows).toEqual([{ target: "x", format: "vst3", source: "juce:CMakeLists.txt" }]);
  });
});
