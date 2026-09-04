import { describe, expect, it } from "vitest";
import { parsePairs } from "../apply-capability-gaps.js";
import { PROBES, probeProse } from "../lib/capability-probes.js";
import { getCapabilitiesSet } from "../lib/schema-loader.js";

const NONE = new Set<string>();
const caps = (prose: string) => probeProse(prose, NONE).map((hit) => hit.capability);

describe("capability probes", () => {
  it("only ever produces values the vocabulary carries", () => {
    const vocabulary = getCapabilitiesSet();
    for (const probe of PROBES) {
      expect(vocabulary.has(probe.capability), `probe for '${probe.capability}'`).toBe(true);
    }
  });

  it("never re-reports a capability the entry already carries", () => {
    const prose = "A granular reverb with freeze and loop functions.";
    expect(caps(prose)).toContain("granular");
    expect(probeProse(prose, new Set(["granular"])).map((h) => h.capability)).not.toContain(
      "granular"
    );
  });

  // Each of these defeated a probe that looked sound until it ran over the
  // corpus. They are regression cases, not hypotheticals — the slug in each
  // comment is the entry that produced the false positive.
  describe("rejects the failure classes found in the corpus", () => {
    it("does not read a denied spec-table row as a capability", () => {
      // korg-dvp-1
      expect(caps("- Keyboard: None - Arpeggiator/Sequencer: None")).not.toContain("sequencing");
    });

    it("does not read a measured spec as a performed operation", () => {
      expect(caps("Total harmonic distortion below 0.001%")).not.toContain("distortion");
      expect(caps("A 1-inch compression driver on a waveguide")).not.toContain("compression");
    });

    it("does not read compatibility as capability", () => {
      // origin-effects-deluxe55 / deluxe61 / revivaldrive-compact
      expect(
        caps("Offers compatibility with traditional amps, power amps and cabinet simulators.")
      ).not.toContain("cabinet-simulation");
      expect(
        caps(
          "Designed to work with a wide range of amps, flat-response power amps, cabinet simulators."
        )
      ).not.toContain("cabinet-simulation");
    });

    it("does not read an influence as capability", () => {
      // alm-busy-circuits-mum-m8
      expect(
        caps("A filter inspired by the filter circuit of the Akai S950 12-bit sampler.")
      ).not.toContain("sampling");
    });

    it("does not read an adjective as an engine", () => {
      // catalinbread-pads-proto-365
      expect(caps("creating a smeared, granular texture")).not.toContain("granular");
      // eventide-audio-h90-harmonizer — the case this whole pass came from
      expect(caps("The pedal includes four new granular effects")).toContain("granular");
    });

    it("does not read an accessory module as a dynamics stage", () => {
      // alm-busy-circuits-mfx, bastl-instruments-cv-trinity
      expect(caps("Via the Axon-1 or Axon-2 expanders this can be extended")).not.toContain(
        "expansion"
      );
      // dbx-1066
      expect(caps("Expander/Gate Ratio: 1:1 to 4:1")).toContain("expansion");
    });

    it("does not read a compressor's attack control as a transient shaper", () => {
      // rupert-neve-designs-shelford-compressor
      expect(caps("from snappy transient control to smooth program-level reduction")).not.toContain(
        "transient-shaping"
      );
    });

    it("does not read a long decay as a freeze function", () => {
      // catalinbread-sinkhole-modulated-reverb
      expect(caps("can achieve near-infinite sustain at extreme settings")).not.toContain("freeze");
      // strymon-big-sky-reverb
      expect(caps("Press-and-hold infinite sustain and freeze functions")).toContain("freeze");
    });
  });

  it("matches plural effect names", () => {
    // The H90 reads "blooming reverse delays"; a singular-only pattern missed it.
    expect(caps("blooming reverse delays, rhythmic glitchy stutters")).toContain("reverse");
  });
});

describe("reviewed pair list", () => {
  it("parses slug/capability pairs and skips comments", () => {
    expect(parsePairs("# note\n\nfoo-slug\tgranular\nbar-slug reverb # trailing\n")).toEqual([
      { slug: "foo-slug", capability: "granular" },
      { slug: "bar-slug", capability: "reverb" },
    ]);
  });

  it("refuses a line that names no capability", () => {
    // A slug alone would apply every finding on that entry, including the
    // rejected ones — the pair is the reviewed unit.
    expect(() => parsePairs("foo-slug\n")).toThrow(/slug<TAB>capability/);
  });
});
