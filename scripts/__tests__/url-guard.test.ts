import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertPublicUrl,
  fetchPublic,
  guardLookup,
  isPrivateDestinationError,
  isPublicAddress,
  MAX_REDIRECTS,
  PrivateDestinationError,
  type ResolveAll,
  resolvePublicAddresses,
} from "../lib/url-guard.js";

const PUBLIC: ResolveAll = async () => [{ address: "93.184.216.34", family: 4 }];

describe("isPublicAddress", () => {
  it.each(["8.8.8.8", "93.184.216.34", "2606:4700::1111", "2a00:1450:4001:80e::200e"])(
    "accepts %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );

  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.255",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.254",
    "192.0.0.1",
    "192.0.2.10",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.7",
    "203.0.113.9",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "100::1",
    "2001:db8::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
  ])("rejects %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it("rejects anything that is not an IP address", () => {
    expect(isPublicAddress("example.com")).toBe(false);
    expect(isPublicAddress("")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it.each([
    "https://example.com/product",
    "http://example.com",
    "https://8.8.8.8/",
    "https://[2606:4700::1111]/",
    "https://sub.localhost.example.com/",
  ])("accepts %s", (url) => {
    expect(assertPublicUrl(url).toString()).toBe(new URL(url).toString());
  });

  it.each([
    ["ftp://example.com/file", "scheme"],
    ["file:///etc/passwd", "scheme"],
    ["not a url", "not a URL"],
    ["http://localhost/", "local name"],
    ["http://LOCALHOST./", "local name"],
    ["http://api.localhost/", "local name"],
    ["http://printer.local/", "local name"],
    ["http://db.internal/", "local name"],
    ["http://router.home.arpa/", "local name"],
    ["http://127.0.0.1:8080/", "not a public address"],
    ["http://169.254.169.254/latest/meta-data/", "not a public address"],
    ["http://10.0.0.1/", "not a public address"],
    ["http://[::1]/", "not a public address"],
    ["http://[::ffff:127.0.0.1]/", "not a public address"],
    ["http://[fe80::1]/", "not a public address"],
  ])("rejects %s (%s)", (url, reason) => {
    expect(() => assertPublicUrl(url)).toThrow(PrivateDestinationError);
    expect(() => assertPublicUrl(url)).toThrow(reason);
  });
});

describe("resolvePublicAddresses", () => {
  it("returns every answer when all are public", async () => {
    const answers = [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ];
    await expect(resolvePublicAddresses("example.com", async () => answers)).resolves.toEqual(
      answers
    );
  });

  it("fails closed when any answer is private", async () => {
    const resolveAll: ResolveAll = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ];
    const error = await resolvePublicAddresses("rebind.example", resolveAll).catch((e) => e);
    expect(error).toBeInstanceOf(PrivateDestinationError);
    expect(error.message).toContain("10.0.0.5");
  });

  it("rejects an IPv4-mapped answer as its IPv4 address", async () => {
    const resolveAll: ResolveAll = async () => [{ address: "::ffff:169.254.169.254", family: 6 }];
    await expect(resolvePublicAddresses("metadata.example", resolveAll)).rejects.toThrow(
      PrivateDestinationError
    );
  });

  it("reports an empty answer as ENOTFOUND", async () => {
    const error = await resolvePublicAddresses("nx.example", async () => []).catch((e) => e);
    expect(error.code).toBe("ENOTFOUND");
  });

  it("checks an IP literal without resolving it", async () => {
    const resolveAll = vi.fn<ResolveAll>();
    await expect(resolvePublicAddresses("8.8.8.8", resolveAll)).resolves.toEqual([
      { address: "8.8.8.8", family: 4 },
    ]);
    await expect(resolvePublicAddresses("127.0.0.1", resolveAll)).rejects.toThrow(
      PrivateDestinationError
    );
    expect(resolveAll).not.toHaveBeenCalled();
  });
});

describe("guardLookup", () => {
  it("hands node:http the first public answer", async () => {
    const lookup = guardLookup(PUBLIC);
    const result = await new Promise((resolve) => {
      lookup("example.com", { all: false }, (err, address, family) =>
        resolve({ err, address, family })
      );
    });
    expect(result).toEqual({ err: null, address: "93.184.216.34", family: 4 });
  });

  it("hands node:http every answer under options.all", async () => {
    const lookup = guardLookup(PUBLIC);
    const result = await new Promise((resolve) => {
      lookup("example.com", { all: true }, (err, addresses) => resolve({ err, addresses }));
    });
    expect(result).toEqual({ err: null, addresses: [{ address: "93.184.216.34", family: 4 }] });
  });

  it("surfaces a private answer as an error instead of an address", async () => {
    const lookup = guardLookup(async () => [{ address: "192.168.0.10", family: 4 }]);
    const err = await new Promise((resolve) => {
      lookup("nas.example", { all: false }, (error) => resolve(error));
    });
    expect(isPrivateDestinationError(err)).toBe(true);
  });
});

describe("fetchPublic", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const respond = (status: number, location?: string): Response =>
    new Response(null, { status, headers: location ? { location } : {} });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  function stub(...responses: Response[]): void {
    for (const response of responses) fetchMock.mockResolvedValueOnce(response);
    vi.stubGlobal("fetch", fetchMock);
  }

  it("never lets fetch follow a redirect on its own", async () => {
    stub(respond(200));
    await fetchPublic("https://example.com/", { method: "HEAD", redirect: "follow" }, PUBLIC);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD", redirect: "manual" });
  });

  it("follows a public redirect chain and reports where it ended", async () => {
    stub(respond(301, "https://example.com/new"), respond(302, "/newer"), respond(200));
    const result = await fetchPublic("https://example.com/old", {}, PUBLIC);
    expect(result.url).toBe("https://example.com/newer");
    expect(result.response.status).toBe(200);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://example.com/old",
      "https://example.com/new",
      "https://example.com/newer",
    ]);
  });

  it("refuses a redirect into a private destination before requesting it", async () => {
    stub(respond(302, "http://169.254.169.254/latest/meta-data/"));
    await expect(fetchPublic("https://example.com/", {}, PUBLIC)).rejects.toThrow(
      PrivateDestinationError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to a host that resolves privately", async () => {
    stub(respond(302, "https://intranet.example/"));
    const resolveAll: ResolveAll = async (hostname) =>
      hostname === "intranet.example"
        ? [{ address: "10.1.1.1", family: 4 }]
        : [{ address: "93.184.216.34", family: 4 }];
    await expect(fetchPublic("https://example.com/", {}, resolveAll)).rejects.toThrow(
      PrivateDestinationError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves each hop's host immediately before requesting it", async () => {
    stub(respond(307, "https://cdn.example/"), respond(200));
    const resolveAll = vi.fn<ResolveAll>(PUBLIC);
    await fetchPublic("https://example.com/", {}, resolveAll);
    expect(resolveAll.mock.calls.map((call) => call[0])).toEqual(["example.com", "cdn.example"]);
  });

  it("refuses the initial URL without a request", async () => {
    stub();
    await expect(fetchPublic("http://localhost:3000/", {}, PUBLIC)).rejects.toThrow(
      PrivateDestinationError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a 3xx that carries no Location as the final response", async () => {
    stub(respond(304));
    const result = await fetchPublic("https://example.com/", {}, PUBLIC);
    expect(result.response.status).toBe(304);
    expect(result.url).toBe("https://example.com/");
  });

  it("gives up on a redirect loop", async () => {
    const loop = Array.from({ length: MAX_REDIRECTS + 2 }, () =>
      respond(302, "https://example.com/loop")
    );
    stub(...loop);
    await expect(fetchPublic("https://example.com/loop", {}, PUBLIC)).rejects.toThrow(
      "too many redirects"
    );
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });
});
