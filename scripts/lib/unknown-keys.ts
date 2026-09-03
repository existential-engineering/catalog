/**
 * Unknown-key detection against the Zod collection schemas.
 *
 * Zod strips keys a schema does not declare, silently, so a key that the
 * catalog never reads validates, builds and ships as if it were data.
 * `prices[].type`, `versions[].notes`, a top-level `note` and the
 * `discontinued: true` flag behind catalog#689 all arrived this way. The
 * validator used to catch exactly one such key (`images`) by hand.
 *
 * This walks a schema and a raw value side by side and reports every key
 * the schema does not declare, at any depth. The walk reads Zod's internal
 * `_zod.def` rather than parsing with `.strict()`, because the collection
 * schemas carry refinements and transforms that a strict re-parse would
 * run twice, and because the report needs the path of each stray key
 * rather than a pass or fail.
 */

import type { z } from "zod";

export interface UnknownKey {
  /** Path segments to the object carrying the key, empty at the root. */
  parent: (string | number)[];
  key: string;
}

/**
 * Top-level keys no Zod schema declares because another script owns them:
 * `id` (assign-ids), `translations` (validate-translations) and
 * `verification` (typed in lib/types.ts, read by the staleness report).
 * `verification` lists its own subkeys so a typo inside it is still
 * reported.
 */
const TOP_LEVEL_EXTRAS: ReadonlyMap<string, ReadonlySet<string> | null> = new Map([
  ["id", null],
  ["translations", null],
  [
    "verification",
    new Set(["lastVerified", "verifiedBy", "status", "discontinuedDate", "discontinuedReason"]),
  ],
]);

interface ZodDef {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  innerType?: z.ZodType;
  in?: z.ZodType;
  options?: z.ZodType[];
  valueType?: z.ZodType;
  getter?: () => z.ZodType;
}

function defOf(schema: z.ZodType): ZodDef {
  return (schema as unknown as { _zod: { def: ZodDef } })._zod.def;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The container kind a schema accepts once wrappers are peeled, or null. */
function containerKind(schema: z.ZodType): "object" | "array" | null {
  const def = defOf(schema);
  switch (def.type) {
    case "object":
      return "object";
    case "array":
      return "array";
    case "optional":
    case "nullable":
    case "default":
    case "nonoptional":
    case "readonly":
    case "catch":
      return def.innerType ? containerKind(def.innerType) : null;
    case "pipe":
      return def.in ? containerKind(def.in) : null;
    case "lazy":
      return def.getter ? containerKind(def.getter()) : null;
    default:
      return null;
  }
}

function walk(
  schema: z.ZodType,
  value: unknown,
  parent: (string | number)[],
  out: UnknownKey[]
): void {
  const def = defOf(schema);
  switch (def.type) {
    case "object": {
      if (!isPlainObject(value) || !def.shape) return;
      for (const [key, child] of Object.entries(value)) {
        const childSchema = def.shape[key];
        if (childSchema) walk(childSchema, child, [...parent, key], out);
        else out.push({ parent, key });
      }
      return;
    }
    case "array": {
      if (!Array.isArray(value) || !def.element) return;
      for (const [i, item] of value.entries()) walk(def.element, item, [...parent, i], out);
      return;
    }
    case "record": {
      if (!isPlainObject(value) || !def.valueType) return;
      for (const [key, child] of Object.entries(value)) {
        walk(def.valueType, child, [...parent, key], out);
      }
      return;
    }
    case "optional":
    case "nullable":
    case "default":
    case "nonoptional":
    case "readonly":
    case "catch":
      if (def.innerType) walk(def.innerType, value, parent, out);
      return;
    case "pipe":
      if (def.in) walk(def.in, value, parent, out);
      return;
    case "lazy":
      if (def.getter) walk(def.getter(), value, parent, out);
      return;
    case "union": {
      // Descend into the first option whose container kind matches the
      // value. A union of scalars, or one where nothing matches, is a
      // leaf: the schema parse reports a wrong shape on its own.
      const kind = isPlainObject(value) ? "object" : Array.isArray(value) ? "array" : null;
      if (!kind || !def.options) return;
      const option = def.options.find((o) => containerKind(o) === kind);
      if (option) walk(option, value, parent, out);
      return;
    }
    default:
      return;
  }
}

/**
 * Every key in `value` that `schema` does not declare, plus a typo inside
 * `verification`. Top-level keys another validator owns are skipped.
 */
export function collectUnknownKeys(schema: z.ZodType, value: unknown): UnknownKey[] {
  const out: UnknownKey[] = [];
  if (!isPlainObject(value)) return out;
  const rest: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!TOP_LEVEL_EXTRAS.has(key)) {
      rest[key] = child;
      continue;
    }
    const allowed = TOP_LEVEL_EXTRAS.get(key);
    if (!allowed || !isPlainObject(child)) continue;
    for (const sub of Object.keys(child)) {
      if (!allowed.has(sub)) out.push({ parent: [key], key: sub });
    }
  }
  walk(schema, rest, [], out);
  return out;
}

/** `prices[1].type` style rendering of a finding, `(root)` for the top level. */
export function formatUnknownKeyPath(finding: UnknownKey): string {
  const parent = finding.parent.reduce<string>(
    (acc, seg) => (typeof seg === "number" ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg),
    ""
  );
  return parent ? `${parent}.${finding.key}` : finding.key;
}
