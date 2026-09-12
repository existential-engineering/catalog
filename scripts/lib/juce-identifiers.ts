/**
 * JUCE project identifier extraction.
 *
 * An open-source JUCE plugin states its identifiers in its build file:
 * `juce_add_plugin(... BUNDLE_ID com.vendor.Name PLUGIN_MANUFACTURER_CODE
 * Vndr PLUGIN_CODE Plg1 FORMATS AU VST3 ...)` in CMake, or
 * `bundleIdentifier="..." pluginManufacturerCode="..." pluginCode="..."
 * pluginFormats="buildAU,buildVST3"` on a `.jucer` file's root element.
 *
 * The bundle id is what the catalog's `default` key holds. It is offered
 * per listed format for review rather than written blind, because JUCE
 * may derive a per-format bundle id from it, and a built bundle read by the
 * racks installer lane is the authority where one is available. The
 * manufacturer and plugin codes are the AU `subtype:manufacturer` half of
 * Studio's `au_tsm` triplet and are reported for the day the catalog has a
 * field for it.
 */

import type { IdentifierRow } from "./identifier-writer.js";

export interface JuceIdentifiers {
  bundleId?: string;
  manufacturerCode?: string;
  pluginCode?: string;
  /** Catalog format names, lowercased: au, vst3, aax, vst, lv2, clap, standalone. */
  formats: string[];
}

/** juce_add_plugin keywords that carry no underscore, so the shape test below misses them. */
const CMAKE_KEYS = new Set(["FORMATS", "VERSION", "DESCRIPTION"]);

/**
 * Whether a token opens a keyword argument. JUCE keywords are upper-case
 * with underscores (`BUNDLE_ID`, `PLUGIN_CODE`, `IS_SYNTH`); a four-letter
 * upper-case plugin code (`SURG`) is not one, and the value slot right
 * after `PLUGIN_CODE` or `PLUGIN_MANUFACTURER_CODE` is never a keyword.
 */
function isCmakeKeyword(token: string, current: string | null, taken: number): boolean {
  if ((current === "PLUGIN_CODE" || current === "PLUGIN_MANUFACTURER_CODE") && taken === 0) {
    return false;
  }
  return CMAKE_KEYS.has(token) || /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(token);
}

/** Map a JUCE format token (CMake `VST3`, jucer `buildVST3`) to the catalog's spelling. */
function juceFormat(token: string): string | null {
  const t = token.replace(/^build/i, "").toLowerCase();
  switch (t) {
    case "au":
    case "auv3":
      return "au";
    case "vst3":
      return "vst3";
    case "vst":
      return "vst";
    case "aax":
      return "aax";
    case "lv2":
      return "lv2";
    case "clap":
      return "clap";
    case "standalone":
      return "standalone";
    default:
      return null;
  }
}

/**
 * The argument text of the first `juce_add_plugin(...)` call, or null.
 * Scanned with a quote-aware paren counter rather than a regex: a quoted
 * `DESCRIPTION "A synth (mono)"` holds a `)` that a lazy match stops at,
 * cutting off every keyword after it. Comments run to end of line.
 */
function juceAddPluginBody(text: string): string | null {
  const start = /juce_add_plugin\s*\(/.exec(text);
  if (!start) return null;
  const from = start.index + start[0].length;
  let depth = 1;
  let quoted = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === "\\") i++;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === "#") {
      const eol = text.indexOf("\n", i);
      i = eol === -1 ? text.length : eol;
    } else if (c === "(") {
      depth++;
    } else if (c === ")" && --depth === 0) {
      return text.slice(from, i);
    }
  }
  return null;
}

/** Identifiers out of a CMake project's `juce_add_plugin` call. */
function parseCmake(text: string): JuceIdentifiers | null {
  const body = juceAddPluginBody(text)?.replace(/#[^\n]*/g, "");
  if (body === undefined) return null;
  const tokens = body.match(/"[^"]*"|\S+/g) ?? [];
  const values = new Map<string, string[]>();
  let current: string | null = null;
  for (const raw of tokens) {
    const token = raw.replace(/^"|"$/g, "");
    if (isCmakeKeyword(token, current, current ? (values.get(current)?.length ?? 0) : 0)) {
      current = token;
      if (!values.has(current)) values.set(current, []);
      continue;
    }
    if (current) values.get(current)?.push(token);
  }
  const formats = (values.get("FORMATS") ?? [])
    .map(juceFormat)
    .filter((f): f is string => f !== null);
  return {
    bundleId: values.get("BUNDLE_ID")?.[0],
    manufacturerCode: values.get("PLUGIN_MANUFACTURER_CODE")?.[0],
    pluginCode: values.get("PLUGIN_CODE")?.[0],
    formats: [...new Set(formats)],
  };
}

/** A double-quoted XML attribute value, or undefined when absent or empty. */
function attr(text: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(text);
  return match?.[1] || undefined;
}

/** Identifiers off a `.jucer` file's `JUCERPROJECT` root element. */
function parseJucer(text: string): JuceIdentifiers | null {
  if (!/<JUCERPROJECT\b/.test(text)) return null;
  const formats = (attr(text, "pluginFormats") ?? "")
    .split(",")
    .map((f) => juceFormat(f.trim()))
    .filter((f): f is string => f !== null);
  return {
    bundleId: attr(text, "bundleIdentifier"),
    manufacturerCode: attr(text, "pluginManufacturerCode"),
    pluginCode: attr(text, "pluginCode"),
    formats: [...new Set(formats)],
  };
}

/** Read identifiers out of a CMakeLists.txt or .jucer text; null when neither. */
export function extractJuceIdentifiers(text: string): JuceIdentifiers | null {
  return parseJucer(text) ?? parseCmake(text);
}

/**
 * Review rows for one entry: the bundle id per identifier-bearing format
 * the project builds. With no bundle id, the formats alone.
 */
export function juceRows(slug: string, info: JuceIdentifiers, source: string): IdentifierRow[] {
  const formats = info.formats.filter((f) => f !== "standalone");
  if (formats.length === 0) return [];
  return formats.map((format) => ({
    target: slug,
    format,
    ...(info.bundleId ? { identifier: info.bundleId } : {}),
    source,
  }));
}
