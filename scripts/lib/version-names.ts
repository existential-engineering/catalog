/**
 * Version-name helpers shared by every script that adds a `versions`
 * entry from an observed version string (telemetry, installers,
 * registries). One coercion rule, so "3.24" and "3.24.0" are the same
 * version to every writer, the way they are to Studio's pluginMatcher.
 */

export interface VersionRecord {
  name: string;
  [key: string]: unknown;
}

/** Coerce a version string to [major, minor, patch], like semver.coerce. */
export function coerceVersion(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/** Whether two version strings coerce to the same major.minor.patch. */
export function coercedEqual(a: string, b: string): boolean {
  const ca = coerceVersion(a);
  const cb = coerceVersion(b);
  if (!ca || !cb) {
    return false;
  }
  return ca[0] === cb[0] && ca[1] === cb[1] && ca[2] === cb[2];
}

/** A version the scanner could not read: no digits, or the 0.0.0 sentinel. */
export function isJunkVersion(version: string): boolean {
  const c = coerceVersion(version);
  return !c || (c[0] === 0 && c[1] === 0 && c[2] === 0);
}

/** Descending compare of coerced versions; unparseable names sort last. */
export function compareCoercedDesc(a: string, b: string): number {
  const ca = coerceVersion(a);
  const cb = coerceVersion(b);
  if (!ca || !cb) {
    return ca ? -1 : cb ? 1 : 0;
  }
  return cb[0] - ca[0] || cb[1] - ca[1] || cb[2] - ca[2];
}

/**
 * Insert `version` into `existing` newest-first, or return null when an
 * entry with the same name or the same coerced value is already there.
 * Never reorders what was there.
 */
export function insertVersion(existing: VersionRecord[], version: string): VersionRecord[] | null {
  const dupe = existing.some(
    (v) => String(v.name) === version || coercedEqual(String(v.name), version)
  );
  if (dupe) {
    return null;
  }
  const merged: VersionRecord[] = [...existing];
  const insertAt = merged.findIndex((v) => compareCoercedDesc(version, String(v.name)) < 0);
  merged.splice(insertAt < 0 ? merged.length : insertAt, 0, { name: version });
  return merged;
}
