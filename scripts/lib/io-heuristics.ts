/**
 * Shared IO data-quality heuristics.
 *
 * Used by both `validate.ts` (warning W128) and the `io-quality` report so the
 * CI signal and the triage report stay in lockstep.
 */

/** Connections that carry exactly one physical link; maxConnections>1 is a smell. */
export const SINGLE_JACK_CONNECTIONS = new Set([
  "1/4-inch",
  "1/8-inch",
  "2.5mm",
  "xlr",
  "mini-xlr",
  "rca",
  "5-pin din",
  "7-pin din",
]);

/** Names that describe an intentional aggregate, not a single jack. */
const AGGREGATE_NAME = /\b(all|slots?|bank|banks|combined|total|each)\b/i;

/** Minimal shape needed to evaluate the combine heuristic. */
export interface IoLike {
  name?: string;
  connection?: string;
  maxConnections?: number;
}

/**
 * True when an io entry represents a single-jack connection but claims more than
 * one connection — i.e. several physical jacks likely collapsed into one entry.
 * Intentional aggregates ("All Slots", "Bank A") are excluded.
 */
export function isIoCombineCandidate(io: IoLike): boolean {
  const conn = io.connection?.toLowerCase();
  if (!conn || !SINGLE_JACK_CONNECTIONS.has(conn)) return false;
  if ((io.maxConnections ?? 1) <= 1) return false;
  if (io.name && AGGREGATE_NAME.test(io.name)) return false;
  return true;
}
