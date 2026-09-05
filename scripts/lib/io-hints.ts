/**
 * Layout hint shape checks (AUREO-1115).
 *
 * `rowPosition` and `columnPosition` are the only panel geometry the
 * catalog carries, and Studio's `computeHandleGrid` takes a side with any
 * hint down the grid path and back-fills the unhinted ports row-major. So
 * a hint has to be a 1-based integer, come with its partner, land in a cell
 * no other port on that edge occupies, and cover every port of the edge it
 * appears on, or the app renders a grid nobody drew. Each rule has its own
 * code (E122 to E125) so a fixture can prove it fires.
 */

export const HINT_FIELDS = ["columnPosition", "rowPosition"] as const;
export type HintField = (typeof HINT_FIELDS)[number];

/** The subset of an io port this module reads. */
export interface HintedPort {
  name?: string;
  position?: string;
  columnPosition?: unknown;
  rowPosition?: unknown;
}

export type HintFindingKind =
  /** A hint that is present but not a positive integer (E122). */
  | "not-positive-integer"
  /** One of the pair without the other (E123). */
  | "unpaired"
  /** A `(position, rowPosition, columnPosition)` cell used twice (E124). */
  | "duplicate-cell"
  /** A port with no hint on an edge where another port carries one (E125). */
  | "partial-edge";

export interface HintFinding {
  kind: HintFindingKind;
  /** Index into the io array. */
  index: number;
  /** The field the finding is about, when it is about one field. */
  field?: HintField;
  message: string;
}

/** True for a 1-based integer, the only value a hint may hold. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** True when the port carries either hint, whatever its value. */
export function hasAnyHint(port: HintedPort): boolean {
  return port.columnPosition !== undefined || port.rowPosition !== undefined;
}

/** True when the port carries both hints as positive integers. */
export function hasCompleteHints(
  port: HintedPort
): port is HintedPort & { columnPosition: number; rowPosition: number } {
  return isPositiveInteger(port.columnPosition) && isPositiveInteger(port.rowPosition);
}

function label(port: HintedPort, index: number): string {
  return port.name ? `'${port.name}'` : `io[${index}]`;
}

/**
 * Every hint defect in an io list. Edges are grouped by `position` as
 * written (the caller canonicalises aliases if it wants to), and a port
 * with no position forms an edge of its own so a played instrument with
 * one hinted jack still gets the pair and integer checks.
 */
export function findHintFindings(io: readonly HintedPort[]): HintFinding[] {
  const findings: HintFinding[] = [];

  // Per-port shape: integer and pairing.
  io.forEach((port, index) => {
    for (const field of HINT_FIELDS) {
      const value = port[field];
      if (value === undefined || isPositiveInteger(value)) continue;
      findings.push({
        kind: "not-positive-integer",
        index,
        field,
        message: `io hint ${field} on ${label(port, index)} must be a positive integer (1-based), got ${JSON.stringify(value)}.`,
      });
    }
    const hasColumn = port.columnPosition !== undefined;
    const hasRow = port.rowPosition !== undefined;
    if (hasColumn !== hasRow) {
      const missing: HintField = hasColumn ? "rowPosition" : "columnPosition";
      const present: HintField = hasColumn ? "columnPosition" : "rowPosition";
      findings.push({
        kind: "unpaired",
        index,
        field: missing,
        message: `io hint pair incomplete on ${label(port, index)}: ${present} without ${missing}. Set both or neither.`,
      });
    }
  });

  // Per-edge shape: unique cells and full coverage.
  const edges = new Map<string, number[]>();
  io.forEach((port, index) => {
    const edge = port.position ?? "";
    const list = edges.get(edge) ?? [];
    list.push(index);
    edges.set(edge, list);
  });

  for (const [edge, indexes] of edges) {
    const hinted = indexes.filter((i) => hasAnyHint(io[i]));
    if (hinted.length === 0) continue;
    const edgeName = edge || "(no position)";

    const cells = new Map<string, number>();
    for (const i of hinted) {
      const port = io[i];
      if (!hasCompleteHints(port)) continue;
      const cell = `${port.rowPosition}:${port.columnPosition}`;
      const first = cells.get(cell);
      if (first === undefined) {
        cells.set(cell, i);
        continue;
      }
      findings.push({
        kind: "duplicate-cell",
        index: i,
        message: `io hint cell occupied twice on edge ${edgeName}: ${label(port, i)} and ${label(io[first], first)} both sit at row ${port.rowPosition}, column ${port.columnPosition}.`,
      });
    }

    for (const i of indexes) {
      if (hasAnyHint(io[i])) continue;
      findings.push({
        kind: "partial-edge",
        index: i,
        message: `io hint edge ${edgeName} is partly hinted: ${label(io[i], i)} carries no rowPosition or columnPosition while ${hinted.length} other port(s) on that edge do. Hint every port on the edge or none.`,
      });
    }
  }

  return findings;
}

/**
 * Coverage of hints across a set of entries, for `pnpm dataset:audit`.
 * An entry counts as hinted when any of its ports carries a hint.
 */
export interface HintCoverage {
  /** Entries in the group. */
  entries: number;
  /** Entries with at least one io port. */
  withIo: number;
  /** Entries with at least one hinted port. */
  withHints: number;
}

export function emptyHintCoverage(): HintCoverage {
  return { entries: 0, withIo: 0, withHints: 0 };
}

/** Add one entry's io to a running coverage total. */
export function countHintCoverage(coverage: HintCoverage, io: unknown): void {
  coverage.entries += 1;
  if (!Array.isArray(io) || io.length === 0) return;
  coverage.withIo += 1;
  if (io.some((port) => port && typeof port === "object" && hasAnyHint(port as HintedPort)))
    coverage.withHints += 1;
}
