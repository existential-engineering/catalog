/**
 * Stable per-port IO keys.
 *
 * Studio setup edges reference hardware ports by these keys, so they must
 * be unique within an entry and immutable once assigned. Keys are 8-char
 * alphanumeric (no `-`/`_`: Studio handle strings are hyphen-delimited)
 * and carry at least one letter.
 *
 * That last rule is why the pattern is not a plain `{8}` class. The
 * alphabet includes digits, so an all-digit key is reachable (about
 * 4e-7 per key), and such a key's handle re-enters Studio's legacy
 * numeric-fallback parsing on every load. Exact match wins first, so it
 * is harmless today, but the fallback is one refactor away from being
 * the path that answers, and a key is immutable once assigned: the
 * cheap moment to exclude it is before one is ever written. No key in
 * the catalog is all-digit today, so the tightening rejects nothing
 * that exists (AUREO-705).
 */

import { customAlphabet } from "nanoid";
import type { Document } from "yaml";
import type { IO } from "./types.js";

export const IO_KEY_LENGTH = 8;
export const IO_KEY_PATTERN = /^(?=.*[a-zA-Z])[0-9a-zA-Z]{8}$/;

const generateKey = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  IO_KEY_LENGTH
);

/**
 * Generate a key that is unique within `existing` and adds it to that set,
 * so a caller assigning several keys to one entry passes the same set
 * through and cannot collide with a key it has just handed out.
 *
 * Retries on two conditions rather than one: a collision, and a candidate
 * that fails IO_KEY_PATTERN (which is how an all-digit key is excluded —
 * see the module header for why that matters).
 */
export function generateUniqueIoKey(existing: Set<string>): string {
  let key: string;
  do {
    key = generateKey();
  } while (existing.has(key) || !IO_KEY_PATTERN.test(key));
  existing.add(key);
  return key;
}

export function findDuplicateIoKeys(io: Pick<IO, "key">[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const port of io) {
    if (!port?.key) continue;
    if (seen.has(port.key)) duplicates.add(port.key);
    seen.add(port.key);
  }
  return [...duplicates];
}

/**
 * Assign keys to any io entries in a parsed YAML document that lack one.
 * Mutates the document in place (preserving formatting/comments) and
 * returns the number of keys assigned. The key is inserted as the first
 * field of each io map for readability.
 */
export function assignIoKeys(doc: Document): number {
  const data = doc.toJSON() as { io?: Array<{ key?: unknown }> } | null;
  if (!data?.io || !Array.isArray(data.io)) return 0;

  const existing = new Set<string>(
    data.io.map((port) => port?.key).filter((k): k is string => typeof k === "string" && k !== "")
  );

  let assigned = 0;
  data.io.forEach((port, index) => {
    if (typeof port?.key === "string" && port.key !== "") return;
    doc.setIn(["io", index, "key"], generateUniqueIoKey(existing));

    // Move the key pair to the front of the io map. setIn creates the
    // pair with a plain string key, while parsed pairs hold Scalar nodes,
    // so match both shapes.
    const map = doc.getIn(["io", index]) as {
      items?: { key?: string | { value?: unknown } }[];
    };
    if (map?.items) {
      const keyIndex = map.items.findIndex(
        (item) => item.key === "key" || (typeof item.key === "object" && item.key?.value === "key")
      );
      if (keyIndex > 0) {
        const [keyItem] = map.items.splice(keyIndex, 1);
        map.items.unshift(keyItem);
      }
    }
    assigned++;
  });

  return assigned;
}

function portSignature(port: IO): string {
  return [port.name, port.signalFlow, port.type, port.connection].join("|");
}

/**
 * Immutability comparison for one entry's io list against its base version.
 * Returns violation messages (empty = clean).
 *
 * Rules:
 * 1. No duplicate keys within the current io list.
 * 2. A port that keeps its content (name/signalFlow/type/connection) must
 *    keep its key — key churn on an unchanged port breaks every Studio
 *    setup edge referencing it. Deleting a port (with its key) is allowed,
 *    and renaming a port while keeping its key is the intended workflow.
 */
export function findIoKeyViolations(baseIo: IO[], currentIo: IO[]): string[] {
  const violations: string[] = [];

  for (const dup of findDuplicateIoKeys(currentIo)) {
    violations.push(`duplicate io key '${dup}'`);
  }

  const currentKeys = new Set(currentIo.map((p) => p.key).filter(Boolean));
  for (const basePort of baseIo) {
    if (!basePort.key || currentKeys.has(basePort.key)) continue;
    const match = currentIo.find((p) => portSignature(p) === portSignature(basePort));
    if (match) {
      violations.push(
        `io port '${basePort.name}' changed key from '${basePort.key}' to '${match.key ?? "(none)"}'. IO keys are immutable once assigned.`
      );
    }
  }

  return violations;
}
