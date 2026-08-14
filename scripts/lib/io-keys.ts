/**
 * Stable per-port IO keys.
 *
 * Studio setup edges reference hardware ports by these keys, so they must
 * be unique within an entry and immutable once assigned. Keys are 8-char
 * alphanumeric (no `-`/`_`: Studio handle strings are hyphen-delimited).
 */

import { customAlphabet } from "nanoid";
import type { Document } from "yaml";
import type { IO } from "./types.js";

export const IO_KEY_LENGTH = 8;
export const IO_KEY_PATTERN = /^[0-9a-zA-Z]{8}$/;

const generateKey = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  IO_KEY_LENGTH
);

export function generateUniqueIoKey(existing: Set<string>): string {
  let key: string;
  do {
    key = generateKey();
  } while (existing.has(key));
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
