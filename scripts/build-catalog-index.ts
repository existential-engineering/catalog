/**
 * Catalog Web Index Build Script
 *
 * Emits a lean JSON index (dist/catalog-index.json) as a release artifact — a
 * machine-readable summary of the catalog (categories, brands, products) for
 * web/consumer use, alongside catalog.sqlite.
 *
 * This intentionally mirrors the source-of-truth loading in build-sqlite.ts
 * (same directories, same slug = filename, same category-alias normalization,
 * same manufacturer slug -> name resolution) so consumers stay consistent
 * with catalog.sqlite. It deliberately OMITS the heavy long-form fields
 * (details / specs / io / videos / links).
 *
 * Run with: pnpm build:index
 */

import fs from "node:fs";
import path from "node:path";

import type {
  Accessory,
  CategoryAliasesSchema,
  Hardware,
  Manufacturer,
  Software,
} from "./lib/types.js";
import { DATA_DIR, getYamlFiles, loadYamlFile, OUTPUT_DIR, SCHEMA_DIR } from "./lib/utils.js";

// =============================================================================
// OUTPUT SHAPE
// =============================================================================

type ProductType = "software" | "hardware" | "accessory";

interface IndexPrice {
  amount: number;
  currency: string;
}

interface IndexProduct {
  id: string;
  slug: string;
  name: string;
  type: ProductType;
  manufacturerSlug: string;
  manufacturerName: string;
  primaryCategory?: string;
  categories: string[];
  description?: string;
  platforms?: string[];
  price?: IndexPrice;
  image?: string;
  url?: string;
  discontinued?: boolean;
}

interface IndexCategory {
  slug: string;
  name: string;
  /** Whether the products in this category are software, hardware, or a mix. */
  kind: "software" | "hardware" | "accessory" | "mixed";
  count: number;
}

interface IndexManufacturer {
  slug: string;
  name: string;
  url?: string;
  description?: string;
  productCount: number;
}

interface CatalogIndex {
  version: string;
  generated: string;
  counts: {
    manufacturers: number;
    software: number;
    hardware: number;
    accessories: number;
  };
  categories: IndexCategory[];
  manufacturers: IndexManufacturer[];
  products: IndexProduct[];
}

// hardware/software YAML carries an `images` array that is not part of the
// DB-facing types in lib/types.ts — declare it locally for the index only.
type WithImages<T> = T & { images?: string[] };

// =============================================================================
// NORMALIZATION (mirrors build-sqlite.ts)
// =============================================================================

const categoryAliasesSchema = loadYamlFile<CategoryAliasesSchema>(
  path.join(SCHEMA_DIR, "category-aliases.yaml")
);
const CATEGORY_ALIASES = new Map<string, string>(Object.entries(categoryAliasesSchema.aliases));

function normalizeCategory(category: string): string {
  return CATEGORY_ALIASES.get(category) ?? category;
}

/** Human-readable name from a category slug: "studio-monitor" -> "Studio Monitor". */
function categoryDisplayName(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function firstPrice(
  prices: { amount: number; currency: string }[] | undefined
): IndexPrice | undefined {
  const p = prices?.[0];
  return p ? { amount: p.amount, currency: p.currency } : undefined;
}

function isDiscontinued(verification: { status?: string } | undefined): boolean {
  return verification?.status === "discontinued";
}

// =============================================================================
// BUILD
// =============================================================================

function loadManufacturers(): Map<string, Manufacturer> {
  const map = new Map<string, Manufacturer>();
  for (const file of getYamlFiles(path.join(DATA_DIR, "manufacturers"))) {
    const slug = path.basename(file, path.extname(file));
    map.set(slug, loadYamlFile<Manufacturer>(file));
  }
  return map;
}

interface CollectionResult {
  products: IndexProduct[];
}

function loadCollection(
  dir: "software" | "hardware" | "accessories",
  type: ProductType,
  manufacturers: Map<string, Manufacturer>
): CollectionResult {
  const products: IndexProduct[] = [];

  for (const file of getYamlFiles(path.join(DATA_DIR, dir))) {
    const data = loadYamlFile<WithImages<Software & Hardware & Accessory>>(file);
    const slug = path.basename(file, path.extname(file));
    const manufacturer = manufacturers.get(data.manufacturer);

    const categories = (data.categories ?? []).map(normalizeCategory);
    const primaryCategory = data.primaryCategory
      ? normalizeCategory(data.primaryCategory)
      : categories[0];

    products.push({
      id: data.id ?? slug,
      slug,
      name: data.name,
      type,
      manufacturerSlug: data.manufacturer,
      manufacturerName: manufacturer?.name ?? data.manufacturer,
      primaryCategory,
      categories,
      description: data.description,
      platforms: data.platforms?.length ? data.platforms : undefined,
      price: firstPrice(data.prices),
      image: data.images?.[0],
      url: data.url,
      discontinued: isDiscontinued(data.verification) || undefined,
    });
  }

  return { products };
}

function buildCategories(products: IndexProduct[]): IndexCategory[] {
  const buckets = new Map<string, { count: number; kinds: Set<ProductType> }>();

  for (const product of products) {
    if (!product.primaryCategory) continue;
    const bucket = buckets.get(product.primaryCategory) ?? { count: 0, kinds: new Set() };
    bucket.count += 1;
    bucket.kinds.add(product.type);
    buckets.set(product.primaryCategory, bucket);
  }

  return [...buckets.entries()]
    .map(([slug, { count, kinds }]) => ({
      slug,
      name: categoryDisplayName(slug),
      kind: kinds.size > 1 ? ("mixed" as const) : [...kinds][0],
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildManufacturers(
  manufacturers: Map<string, Manufacturer>,
  products: IndexProduct[]
): IndexManufacturer[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.manufacturerSlug, (counts.get(product.manufacturerSlug) ?? 0) + 1);
  }

  const result: IndexManufacturer[] = [];
  for (const [slug, data] of manufacturers) {
    const productCount = counts.get(slug) ?? 0;
    if (productCount === 0) continue; // skip brands with nothing to show
    result.push({
      slug,
      name: data.name,
      url: data.url,
      description: data.description,
      productCount,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function build(): void {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "..", "package.json"), "utf-8")
  );

  const manufacturers = loadManufacturers();

  const software = loadCollection("software", "software", manufacturers);
  const hardware = loadCollection("hardware", "hardware", manufacturers);
  const accessories = loadCollection("accessories", "accessory", manufacturers);

  const products = [...software.products, ...hardware.products, ...accessories.products].sort(
    (a, b) => a.manufacturerName.localeCompare(b.manufacturerName) || a.name.localeCompare(b.name)
  );

  const index: CatalogIndex = {
    version: packageJson.version,
    generated: new Date().toISOString(),
    counts: {
      manufacturers: manufacturers.size,
      software: software.products.length,
      hardware: hardware.products.length,
      accessories: accessories.products.length,
    },
    categories: buildCategories(products),
    manufacturers: buildManufacturers(manufacturers, products),
    products,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outFile = path.join(OUTPUT_DIR, "catalog-index.json");
  fs.writeFileSync(outFile, JSON.stringify(index));

  const sizeMb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(2);
  console.log(
    `✓ catalog-index.json — ${index.products.length} products, ` +
      `${index.categories.length} categories, ${index.manufacturers.length} brands (${sizeMb} MB)`
  );
}

build();
