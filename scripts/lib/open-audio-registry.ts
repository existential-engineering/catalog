/**
 * Open Audio Stack registry matcher.
 *
 * The registry (https://open-audio-stack.github.io/open-audio-stack-registry,
 * CC0) lists free and open-source plugins with, per version, the formats
 * each download contains and the version name. It carries no bundle
 * identifiers, so what it gives the catalog is a format list and a version
 * per package, plus the download URLs a bundle id can be read out of by the
 * racks installer-introspection lane (a macOS archive holds the built
 * `.vst3` and `.component` bundles with their Info.plist).
 *
 * Packages are matched to catalog entries by manufacturer and product name
 * reduced to letters and digits, and only matched entries produce rows: a
 * package the catalog does not carry is listed for a later import, never
 * created here, because a new manufacturer enters through triage only.
 */

import path from "node:path";
import type { IdentifierRow } from "./identifier-writer.js";
import { DATA_DIR, getYamlFiles, loadYamlFile } from "./utils.js";

export interface RegistryFile {
  systems?: Array<{ type?: string }>;
  contains?: string[];
  type?: string;
  url?: string;
}

export interface RegistryVersion {
  name?: string;
  author?: string;
  url?: string;
  files?: RegistryFile[];
}

export interface RegistryPackage {
  slug?: string;
  version?: string;
  versions?: Record<string, RegistryVersion>;
}

export interface Registry {
  plugins?: Record<string, RegistryPackage>;
  apps?: Record<string, RegistryPackage>;
}

export interface CatalogSoftwareRef {
  slug: string;
  name: string;
  manufacturerSlug: string;
  manufacturerName: string;
}

export interface RegistryMatch {
  rows: IdentifierRow[];
  /** macOS archives, `slug<TAB>url`, for the racks installer lane. */
  downloads: Array<{ slug: string; url: string }>;
  unmatched: Array<{ package: string; name: string; author: string; url?: string }>;
}

/** Registry `contains` values the catalog's formats vocabulary spells the same way. */
const FORMAT_MAP: Record<string, string> = {
  au: "au",
  vst: "vst",
  vst2: "vst2",
  vst3: "vst3",
  aax: "aax",
  clap: "clap",
  lv2: "lv2",
};

/** Letters and digits only, lowercased, so spellings differing in punctuation match. */
function alnum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The match key: normalized manufacturer and product name. */
function key(manufacturer: string, name: string): string {
  return `${alnum(manufacturer)}/${alnum(name)}`;
}

/** Every software entry with its manufacturer's display name, read once. */
export function loadCatalogSoftware(dataDir = DATA_DIR): CatalogSoftwareRef[] {
  const manufacturers = new Map<string, string>();
  for (const file of getYamlFiles(path.join(dataDir, "manufacturers"))) {
    const data = loadYamlFile<{ name?: string }>(file);
    manufacturers.set(path.basename(file).replace(/\.ya?ml$/, ""), data.name ?? "");
  }
  const refs: CatalogSoftwareRef[] = [];
  for (const file of getYamlFiles(path.join(dataDir, "software"))) {
    const data = loadYamlFile<{ name?: string; manufacturer?: string }>(file);
    const manufacturerSlug = data.manufacturer ?? "";
    refs.push({
      slug: path.basename(file).replace(/\.ya?ml$/, ""),
      name: data.name ?? "",
      manufacturerSlug,
      manufacturerName: manufacturers.get(manufacturerSlug) ?? manufacturerSlug,
    });
  }
  return refs;
}

/**
 * Match every plugin package's current version against the catalog. A
 * package matches when its author and name, reduced to letters and digits,
 * equal an entry's manufacturer (display name or slug) and name. The
 * registry's own `org/slug` key is tried as well, for the packages whose
 * display author differs from their organisation.
 */
export function matchRegistry(registry: Registry, catalog: CatalogSoftwareRef[]): RegistryMatch {
  const byKey = new Map<string, CatalogSoftwareRef>();
  for (const ref of catalog) {
    byKey.set(key(ref.manufacturerName, ref.name), ref);
    byKey.set(key(ref.manufacturerSlug, ref.name), ref);
  }

  const rows: IdentifierRow[] = [];
  const downloads: RegistryMatch["downloads"] = [];
  const unmatched: RegistryMatch["unmatched"] = [];

  for (const [packageKey, pkg] of Object.entries(registry.plugins ?? {})) {
    const current = pkg.version ? pkg.versions?.[pkg.version] : undefined;
    if (!current) continue;
    const name = current.name ?? packageKey.split("/").pop() ?? packageKey;
    const author = current.author ?? packageKey.split("/")[0] ?? "";
    const [org, pkgSlug] = packageKey.split("/");
    const ref =
      byKey.get(key(author, name)) ??
      byKey.get(key(org ?? "", name)) ??
      byKey.get(key(org ?? "", pkgSlug ?? ""));
    if (!ref) {
      unmatched.push({ package: packageKey, name, author, url: current.url });
      continue;
    }

    const formats = new Set<string>();
    for (const file of current.files ?? []) {
      for (const contained of file.contains ?? []) {
        const format = FORMAT_MAP[contained.toLowerCase()];
        if (format) formats.add(format);
      }
      const isMac = (file.systems ?? []).some((s) => s.type === "mac");
      if (isMac && file.url && file.type === "archive") {
        downloads.push({ slug: ref.slug, url: file.url });
      }
    }
    const source = `registry:${packageKey}`;
    if (formats.size === 0) {
      rows.push({ target: ref.slug, format: "standalone", version: pkg.version, source });
      continue;
    }
    for (const format of [...formats].sort()) {
      rows.push({ target: ref.slug, format, version: pkg.version, source });
    }
  }

  return { rows, downloads, unmatched };
}

/** Render writer rows as the TSV `pnpm identifiers:apply` reads. */
export function rowsToTsv(rows: IdentifierRow[]): string {
  return rows
    .map((r) =>
      [r.target, r.format, r.identifier ?? "-", r.version ?? "", r.source ?? ""].join("\t")
    )
    .join("\n");
}
