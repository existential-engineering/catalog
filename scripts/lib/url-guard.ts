/**
 * Destination guard for the URL-checking scripts.
 *
 * Every URL these scripts request comes out of contributed YAML, or a
 * mapping file built from it, so the hostname is chosen by whoever wrote
 * the entry. A checker that follows it blindly is a request to whatever
 * the operator's network can reach: a laptop's router admin page, a CI
 * runner's cloud metadata service (169.254.169.254), a service bound to
 * localhost. The scripts never record a response body, but they do record
 * a status code and a redirect target, and a blind request is still one
 * the operator did not choose to make.
 *
 * Two layers, because the two request paths differ:
 *
 * - `assertPublicUrl` rejects what is visible without a lookup: a scheme
 *   other than http(s), a hostname reserved for local use, and an IP
 *   literal in a non-public range, IPv4 and IPv6 alike (an IPv4-mapped
 *   IPv6 literal is checked as its IPv4 address).
 * - `resolvePublicAddresses` and `guardLookup` reject a hostname whose DNS
 *   answer includes a non-public address. Fail closed: one private answer
 *   among public ones rejects the host, because a connect that races its
 *   candidate addresses can land on the private one. The node:http path
 *   takes the guarded lookup directly, so the address the socket connects
 *   to is the one that was checked. `fetch` exposes no lookup hook, so
 *   `fetchPublic` resolves immediately before each hop instead; an answer
 *   that flips between that lookup and fetch's own is the residual gap,
 *   and the resolver cache is what keeps it narrow.
 *
 * Redirects are followed by hand so every hop passes both layers. fetch's
 * own `redirect: "follow"` checks only the URL it was given.
 */

import dns from "node:dns";
import net, { type LookupFunction } from "node:net";

export const MAX_REDIRECTS = 10;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Hostnames and suffixes reserved for local resolution (RFC 6761, RFC 8375). */
const LOCAL_HOSTNAMES = new Set(["localhost"]);
const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

const blocked = new net.BlockList();
// IPv4 (RFC 6890 special-purpose registry, plus multicast and reserved).
blocked.addSubnet("0.0.0.0", 8, "ipv4"); // "this" network
blocked.addSubnet("10.0.0.0", 8, "ipv4"); // private
blocked.addSubnet("100.64.0.0", 10, "ipv4"); // carrier-grade NAT
blocked.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
blocked.addSubnet("169.254.0.0", 16, "ipv4"); // link-local, cloud metadata
blocked.addSubnet("172.16.0.0", 12, "ipv4"); // private
blocked.addSubnet("192.0.0.0", 24, "ipv4"); // IETF protocol assignments
blocked.addSubnet("192.0.2.0", 24, "ipv4"); // TEST-NET-1
blocked.addSubnet("192.168.0.0", 16, "ipv4"); // private
blocked.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
blocked.addSubnet("198.51.100.0", 24, "ipv4"); // TEST-NET-2
blocked.addSubnet("203.0.113.0", 24, "ipv4"); // TEST-NET-3
blocked.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
blocked.addSubnet("240.0.0.0", 4, "ipv4"); // reserved, broadcast
// IPv6. BlockList checks an IPv4-mapped address (::ffff:a.b.c.d) against the
// IPv4 rules itself, so those need no separate entry.
blocked.addSubnet("::", 96, "ipv6"); // unspecified, loopback, deprecated IPv4-compatible
blocked.addSubnet("64:ff9b::", 96, "ipv6"); // NAT64, carries an IPv4 address
blocked.addSubnet("64:ff9b:1::", 48, "ipv6"); // local-use NAT64
blocked.addSubnet("100::", 64, "ipv6"); // discard-only
blocked.addSubnet("2001::", 32, "ipv6"); // Teredo, carries an IPv4 address
blocked.addSubnet("2002::", 16, "ipv6"); // 6to4, carries an IPv4 address
blocked.addSubnet("2001:db8::", 32, "ipv6"); // documentation
blocked.addSubnet("fc00::", 7, "ipv6"); // unique local
blocked.addSubnet("fe80::", 10, "ipv6"); // link-local
blocked.addSubnet("ff00::", 8, "ipv6"); // multicast

/** Thrown for a destination the guard refuses; `code` lets node-style callers branch on it. */
export class PrivateDestinationError extends Error {
  readonly code = "EPRIVATEDEST";

  constructor(
    readonly url: string,
    reason: string
  ) {
    super(`private destination refused for ${url}: ${reason}`);
    this.name = "PrivateDestinationError";
  }
}

/** True for a guard refusal, by class or by its `code`, so it survives a realm boundary. */
export function isPrivateDestinationError(error: unknown): error is PrivateDestinationError {
  return (
    error instanceof PrivateDestinationError ||
    (error instanceof Error && (error as { code?: unknown }).code === "EPRIVATEDEST")
  );
}

/** True for a globally routable IPv4 or IPv6 address; false for anything else, including junk. */
export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** A URL's hostname without the brackets an IPv6 literal carries. */
function bareHostname(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/**
 * Parse `raw` and reject anything the guard can see without a lookup.
 * Returns the parsed URL so callers keep one parse.
 */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PrivateDestinationError(raw, "not a URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PrivateDestinationError(raw, `scheme ${url.protocol} is not http(s)`);
  }
  const host = bareHostname(url);
  if (host === "") throw new PrivateDestinationError(raw, "empty host");
  if (LOCAL_HOSTNAMES.has(host) || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new PrivateDestinationError(raw, `${host} is a local name`);
  }
  if (net.isIP(host) !== 0 && !isPublicAddress(host)) {
    throw new PrivateDestinationError(raw, `${host} is not a public address`);
  }
  return url;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type ResolveAll = (hostname: string) => Promise<ResolvedAddress[]>;

/** The system resolver, every record, in the order it answered. */
export const systemResolveAll: ResolveAll = (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true });

/**
 * Resolve `hostname` and refuse it if any answer is non-public. An IP
 * literal is returned as itself after the same check.
 */
export async function resolvePublicAddresses(
  hostname: string,
  resolveAll: ResolveAll = systemResolveAll
): Promise<ResolvedAddress[]> {
  const family = net.isIP(hostname);
  if (family !== 0) {
    if (!isPublicAddress(hostname)) {
      throw new PrivateDestinationError(hostname, `${hostname} is not a public address`);
    }
    return [{ address: hostname, family }];
  }
  const answers = await resolveAll(hostname);
  if (answers.length === 0) {
    throw Object.assign(new Error(`no addresses for ${hostname}`), { code: "ENOTFOUND" });
  }
  const offender = answers.find((answer) => !isPublicAddress(answer.address));
  if (offender) {
    throw new PrivateDestinationError(hostname, `resolves to ${offender.address}`);
  }
  return answers;
}

/**
 * A `lookup` for node:http(s) request options that runs `resolveAll`
 * through the guard, so the socket can only ever connect to an address
 * that passed it.
 */
export function guardLookup(resolveAll: ResolveAll): LookupFunction {
  return (hostname, options, callback) => {
    resolvePublicAddresses(hostname, resolveAll)
      .then((answers) => {
        if (options.all) {
          callback(null, answers);
        } else {
          const [first] = answers;
          (callback as (err: null, address: string, family: number) => void)(
            null,
            first.address,
            first.family
          );
        }
      })
      .catch((error: Error) => callback(error, []));
  };
}

export interface PublicFetchResult {
  response: Response;
  /** The URL the returned response came from, after any redirects. */
  url: string;
}

/**
 * `fetch` that follows redirects itself, checking every hop against the
 * guard and resolving each hostname immediately before requesting it.
 * `init.redirect` is ignored; the loop is the redirect policy.
 */
export async function fetchPublic(
  input: string,
  init: RequestInit = {},
  resolveAll: ResolveAll = systemResolveAll
): Promise<PublicFetchResult> {
  let current = assertPublicUrl(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await resolvePublicAddresses(bareHostname(current), resolveAll);
    const response = await fetch(current, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (!REDIRECT_STATUSES.has(response.status) || !location) {
      return { response, url: current.toString() };
    }
    await response.body?.cancel();
    current = assertPublicUrl(new URL(location, current).toString());
  }
  throw new Error(`too many redirects (more than ${MAX_REDIRECTS}) for ${input}`);
}
