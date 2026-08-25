/**
 * Generate JSON Schema files from the catalog's YAML schema definitions.
 *
 * These JSON schemas power inline validation and autocomplete in VS Code
 * via the Red Hat YAML extension (redhat.vscode-yaml).
 *
 * Run with: pnpm generate:schemas
 */

import fs from "node:fs";
import path from "node:path";
import { loadSchemaContext } from "./lib/schema-loader.js";

const OUTPUT_DIR = path.resolve(import.meta.dirname, "../schema/json");

const ctx = loadSchemaContext();

// All categories including aliases (deduplicated for JSON Schema validity)
const allCategories = [...new Set([...ctx.categories, ...Object.keys(ctx.categoryAliases)])];

// =============================================================================
// SHARED SCHEMA DEFINITIONS
// =============================================================================

const priceSchema = {
  type: "object",
  required: ["amount", "currency"],
  additionalProperties: false,
  properties: {
    amount: { type: "number" },
    currency: {
      type: "string",
      enum: ctx.currencies,
      description: "ISO 4217 currency code. To add a new currency, update schema/currencies.yaml.",
    },
    asOf: { type: "string", format: "date", description: "ISO date when price was last verified" },
    source: { type: "string", description: 'Source of price (e.g., "official-website")' },
  },
};

const videoLinkSchema = {
  type: "object",
  required: ["videoId"],
  additionalProperties: false,
  properties: {
    videoId: { type: "string", minLength: 1 },
    provider: {
      type: "string",
      enum: ["youtube", "vimeo"],
      default: "youtube",
      description: "Video platform. Omit for YouTube (default).",
    },
    title: { type: "string" },
    description: { type: "string" },
  },
};

const linkSchema = {
  type: "object",
  required: ["type", "url"],
  additionalProperties: false,
  properties: {
    type: {
      type: "string",
      enum: ctx.linkTypes,
      description:
        "Link type. Valid values are defined in schema/link-types.yaml. To add a new type, submit a PR updating that file.",
    },
    title: { type: "string" },
    url: { type: "string", format: "uri" },
    description: { type: "string" },
  },
};

const versionSchema = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    releaseDate: { type: "string" },
    releaseDateYearOnly: { type: "boolean" },
    preRelease: { type: "boolean" },
    unofficial: { type: "boolean" },
    url: { type: "string", format: "uri" },
    description: { type: "string" },
    prices: { type: "array", items: priceSchema },
    links: { type: "array", items: linkSchema },
    videos: { type: "array", items: videoLinkSchema },
  },
};

const ioSchema = {
  type: "object",
  required: ["name", "signalFlow", "category", "type", "connection"],
  additionalProperties: false,
  properties: {
    key: {
      type: "string",
      pattern: "^[0-9a-zA-Z]{8}$",
      description:
        "Stable per-port identifier (8 alphanumeric chars, unique within the entry). Auto-assigned by CI; immutable once assigned.",
    },
    name: { type: "string" },
    signalFlow: {
      type: "string",
      enum: ctx.ioSignalFlows,
      description: "Direction of signal flow. Defined in schema/io-signal-flows.yaml.",
    },
    category: {
      type: "string",
      enum: ctx.ioCategories,
      description:
        "Signal category (audio, midi, digital, power). Defined in schema/io-categories.yaml.",
    },
    type: {
      type: "string",
      enum: ctx.ioTypes,
      description:
        "Signal type (e.g., line, instrument, mic, headphone, usb). Describes what kind of signal, NOT the physical connector — that belongs in `connection`. Defined in schema/io-types.yaml; add missing values there rather than inventing one here.",
    },
    connection: {
      type: "string",
      description:
        "Physical connector (e.g., 1/4-inch, xlr, usb-c). Describes the plug/jack, not the signal type. Known values are in schema/io-connections.yaml — unknown values produce warnings.",
    },
    connectorDetail: { type: "array", items: { type: "string" } },
    maxConnections: { type: "number" },
    position: {
      type: "string",
      enum: ctx.ioPositions,
      // Not listed in `required`: the rule is conditional on the entry's
      // primaryCategory, which JSON Schema cannot express here without
      // duplicating the Instruments category group. `pnpm validate`
      // enforces it (E199), so a file that omits position passes this
      // schema and still fails validation — say so rather than let an
      // editor or an external contributor read it as optional.
      description:
        "Physical position on the device. Defined in schema/io-positions.yaml. " +
        "Required on every io entry except on played instruments (the Instruments " +
        "category group in schema/category-groups.yaml), whose single output jack " +
        "has no panel position. Enforced by pnpm validate as E199, not by this schema.",
    },
    columnPosition: { type: "number" },
    rowPosition: { type: "number" },
    description: { type: "string" },
  },
};

const variantSchema = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    slug: {
      type: "string",
      pattern: "^[a-z0-9][a-z0-9-]{0,49}$",
      description:
        "URL-safe slug. Auto-derived from name if omitted. Lowercase alphanumeric with hyphens, max 50 chars.",
    },
    releaseDate: { type: "string" },
    releaseDateYearOnly: { type: "boolean" },
    url: { type: "string", format: "uri" },
    description: { type: "string" },
    prices: { type: "array", items: priceSchema },
    links: { type: "array", items: linkSchema },
    videos: { type: "array", items: videoLinkSchema },
  },
};

const ioTranslationSchema = {
  type: "object",
  required: ["originalName"],
  additionalProperties: false,
  properties: {
    originalName: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
  },
};

const baseTranslationProperties = {
  description: { type: "string" },
  details: { type: "string" },
  specs: { type: "string" },
  url: { type: "string", format: "uri" },
  links: { type: "array", items: linkSchema },
  videos: { type: "array", items: videoLinkSchema },
};

const contentTranslationSchema = {
  type: "object",
  additionalProperties: false,
  properties: baseTranslationProperties,
};

const hardwareTranslationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...baseTranslationProperties,
    io: { type: "array", items: ioTranslationSchema },
  },
};

const localePattern = `^(${ctx.localeCodes.join("|")})$`;

const translationsSchema = {
  type: "object",
  description: "Translations keyed by locale code",
  patternProperties: {
    [localePattern]: contentTranslationSchema,
  },
  additionalProperties: false,
};

const hardwareTranslationsSchema = {
  type: "object",
  description: "Translations keyed by locale code",
  patternProperties: {
    [localePattern]: hardwareTranslationSchema,
  },
  additionalProperties: false,
};

const verificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lastVerified: { type: "string", format: "date" },
    verifiedBy: { type: "string" },
    status: {
      type: "string",
      enum: ["active", "discontinued", "unknown"],
      description: "Current product availability status.",
    },
    discontinuedDate: { type: "string", format: "date" },
    discontinuedReason: { type: "string" },
  },
};

const markdownField = {
  oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
};

// Shared fields used across most collection types
const sharedFields = {
  id: { type: "string", pattern: "^[A-Za-z0-9_-]{21}$", description: "Auto-assigned nanoid" },
  name: { type: "string", minLength: 1 },
  manufacturer: {
    type: "string",
    minLength: 1,
    description: "Manufacturer slug (filename without .yaml)",
  },
  categories: {
    type: "array",
    items: { type: "string", enum: allCategories },
    description:
      "Additional categories. Valid values are in schema/categories.yaml. Common synonyms (e.g., 'eq' for 'equalizer') are mapped in schema/category-aliases.yaml. To add a new category, submit a PR updating the schema file.",
  },
  url: { type: "string", format: "uri" },
  releaseDate: {
    type: "string",
    description: "ISO date (YYYY-MM-DD) or year-only (YYYY) if releaseDateYearOnly is true.",
  },
  releaseDateYearOnly: {
    type: "boolean",
    description: "Set true if releaseDate is year-only (YYYY format).",
  },
  primaryCategory: {
    type: "string",
    enum: allCategories,
    description:
      "Main category for this entry. Valid values are in schema/categories.yaml. Common synonyms (e.g., 'eq' for 'equalizer') are mapped in schema/category-aliases.yaml. To add a new category, submit a PR updating the schema file.",
  },
  secondaryCategory: {
    type: "string",
    enum: allCategories,
    description: "Optional secondary category. Same valid values as primaryCategory.",
  },
  supersedes: {
    type: "string",
    description:
      "ID (21-char nanoid) of the older product this replaces. Find the ID in the superseded product's YAML file. Use for version upgrades (Pro-C 2 → Pro-C 3) and hardware generations (MKI → MKII).",
  },
  searchTerms: { type: "array", items: { type: "string" } },
  description: { ...markdownField, description: "Short product description. Supports markdown." },
  details: {
    ...markdownField,
    description:
      "Longer product details. Use block scalar '|-' format with paragraphs separated by blank lines.",
  },
  specs: {
    ...markdownField,
    description:
      "Product specifications. Use block scalar '|-' format with '- ' prefixed list items.",
  },
  versions: { type: "array", items: versionSchema },
  prices: { type: "array", items: priceSchema },
  links: { type: "array", items: linkSchema },
  videos: { type: "array", items: videoLinkSchema },
  translations: translationsSchema,
  verification: verificationSchema,
};

// =============================================================================
// COLLECTION SCHEMAS
// =============================================================================

function makeSchema(
  title: string,
  description: string,
  required: string[],
  properties: Record<string, unknown>
) {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title,
    description,
    type: "object",
    required,
    additionalProperties: false,
    properties,
  };
}

const schemas: Record<string, unknown> = {
  manufacturer: makeSchema(
    "Manufacturer",
    "A manufacturer or company in the audio catalog",
    ["name"],
    {
      id: sharedFields.id,
      name: sharedFields.name,
      companyName: { type: "string" },
      parentCompany: { type: "string" },
      defunct: {
        type: "boolean",
        description:
          "True when the company no longer exists and nothing it made is still produced under this brand. Products of defunct manufacturers are auto-tagged discontinued.",
      },
      url: sharedFields.url,
      description: { type: "string" },
      searchTerms: sharedFields.searchTerms,
      translations: translationsSchema,
    }
  ),

  software: makeSchema(
    "Software",
    "A software product (plugin, DAW, standalone app)",
    ["name", "manufacturer"],
    {
      ...sharedFields,
      formats: {
        type: "array",
        items: { type: "string", enum: ctx.formats },
        description: "Plugin formats (e.g., au, vst3, aax, clap). Defined in schema/formats.yaml.",
      },
      platforms: {
        type: "array",
        items: { type: "string", enum: ctx.platforms },
        description: "Supported platforms. Defined in schema/platforms.yaml.",
      },
      identifiers: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Plugin identifiers keyed by format (e.g., au, vst3)",
      },
      compatibleWith: {
        type: "array",
        items: { type: "string" },
        description: "Software slugs for host products this is compatible with",
      },
    }
  ),

  content: makeSchema(
    "Content",
    "Content entry (presets, sample packs, expansions)",
    ["name", "manufacturer"],
    {
      ...sharedFields,
      compatibleWith: {
        type: "array",
        items: { type: "string" },
        description: "Software or hardware slugs for host products this content is compatible with",
      },
    }
  ),

  hardware: makeSchema(
    "Hardware",
    "A hardware product (synthesizer, audio interface, pedal, etc.)",
    ["name", "manufacturer"],
    {
      ...sharedFields,
      capabilities: {
        type: "array",
        items: { type: "string", enum: ctx.capabilities },
        description:
          "Audio processing operations this product performs (reverb, compression, amp-modeling...). A single-dimension axis, separate from 'categories', which also carries lifecycle, form factor and technology. Valid values are in schema/capabilities.yaml; there are no aliases. Omit the field when not yet assessed rather than guessing.",
      },
      translations: hardwareTranslationsSchema,
      io: {
        type: "array",
        items: ioSchema,
        description: "Physical input/output ports on the device.",
      },
      variants: {
        type: "array",
        items: variantSchema,
        description:
          "Cosmetic-only variants (color, finish). For different hardware generations or capabilities, create a separate entry and use 'supersedes' instead.",
      },
    }
  ),

  accessory: makeSchema(
    "Accessory",
    "An accessory product (cable, stand, acoustic treatment, etc.)",
    ["name", "manufacturer"],
    { ...sharedFields }
  ),
};

// =============================================================================
// WRITE SCHEMAS
// =============================================================================

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const [name, schema] of Object.entries(schemas)) {
  const filePath = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(schema, null, 2)}\n`);
}

console.log(`Generated ${Object.keys(schemas).length} JSON schemas in schema/json/`);
