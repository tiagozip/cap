import { describe, expect, it } from "vitest";
import {
  parseAllowedOrigins,
  parseProtocols,
  readConfig,
} from "../src/config.js";
import { resolveAllowedOrigin } from "../src/cors.js";
import { SHARD_COUNT, shardNameForKey } from "../src/shards.js";
import {
  CACHE_TTL_MS,
  forgetSites,
  loadSite,
  parseSitePath,
  validateOrigins,
  validateSettings,
} from "../src/sites.js";
import {
  constantTimeSecretMatch,
  consumeRedeemToken,
  parseRedeemToken,
  storageKeyFor,
  tokenSecretHash,
} from "../src/siteverify.js";

describe("constantTimeSecretMatch", () => {
  it("accepts equal secrets", () => {
    expect(constantTimeSecretMatch("abc", "abc")).toBe(true);
  });

  it("rejects different secrets, including different lengths", () => {
    expect(constantTimeSecretMatch("abc", "abd")).toBe(false);
    expect(constantTimeSecretMatch("abc", "abcabc")).toBe(false);
    expect(constantTimeSecretMatch("", "")).toBe(false);
    expect(constantTimeSecretMatch("abc", "")).toBe(false);
    expect(constantTimeSecretMatch(null, "abc")).toBe(false);
    expect(constantTimeSecretMatch("abc", undefined)).toBe(false);
  });
});

describe("parseRedeemToken", () => {
  it("splits exactly two non-empty segments", () => {
    expect(parseRedeemToken("0abc:secret")).toEqual({
      id: "0abc",
      secret: "secret",
    });
    expect(parseRedeemToken("0abc:sec:ret")).toBeNull();
    expect(parseRedeemToken(":secret")).toBeNull();
    expect(parseRedeemToken("id:")).toBeNull();
    expect(parseRedeemToken("nocolon")).toBeNull();
    expect(parseRedeemToken(42)).toBeNull();
  });

  it("only accepts a hex signature, so a token cannot name another tenant", () => {
    // `<sig>@<siteKey>` is a storage key, never a valid token id.
    expect(parseRedeemToken("0abc@demo:secret")).toBeNull();
    expect(parseRedeemToken("0abc@0123456789:secret")).toBeNull();
    expect(parseRedeemToken("0ABC:secret")).toBeNull();
    expect(parseRedeemToken("xyz:secret")).toBeNull();
  });

  it("keys rows by the token signature and hashes the secret", () => {
    expect(storageKeyFor("deadbeef")).toBe("deadbeef");
    expect(storageKeyFor("deadbeef", "@demo")).toBe("deadbeef@demo");
    const hash = tokenSecretHash("secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("secret");
    expect(hash).toBe(tokenSecretHash("secret"));
    expect(hash).not.toBe(tokenSecretHash("secret2"));
  });
});

describe("consumeRedeemToken", () => {
  it("consumes a stored, unexpired token", async () => {
    const key = storageKeyFor("0abc");
    const store = new Map([[key, Date.now() + 60_000]]);
    const seen = [];
    const result = await consumeRedeemToken("0abc:secret", async (k, hash) => {
      seen.push([k, hash]);
      const value = store.get(k);
      store.delete(k);
      return value ?? null;
    });
    expect(result).toEqual({ ok: true, status: 200 });
    expect(store.size).toBe(0);
    expect(seen).toEqual([[key, tokenSecretHash("secret")]]);
  });

  it("suffixes the storage key for a tenant", async () => {
    let seenKey = null;
    const result = await consumeRedeemToken(
      "0abc:secret",
      async (k) => {
        seenKey = k;
        return Date.now() + 60_000;
      },
      "@demo",
    );
    expect(result).toEqual({ ok: true, status: 200 });
    expect(seenKey).toBe("0abc@demo");
  });

  it("maps missing and expired tokens to standalone-style errors", async () => {
    const missing = await consumeRedeemToken("0abc:secret", async () => null);
    expect(missing).toMatchObject({
      ok: false,
      status: 404,
      error: "Token not found",
    });

    const expired = await consumeRedeemToken(
      "0abc:secret",
      async () => Date.now() - 1,
    );
    expect(expired).toMatchObject({
      ok: false,
      status: 403,
      error: "Token expired",
    });
  });

  it("rejects malformed tokens without touching the store", async () => {
    let called = false;
    const result = await consumeRedeemToken("broken", async () => {
      called = true;
      return Date.now() + 1000;
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(called).toBe(false);
  });
});

describe("shardNameForKey", () => {
  it("maps hex keys onto all shards deterministically", () => {
    const shards = new Set();
    for (const char of "0123456789abcdef") {
      const name = shardNameForKey(`${char}abc`);
      expect(name).toBe(`shard-${Number.parseInt(char, 16) % SHARD_COUNT}`);
      expect(shardNameForKey(`${char}abc`)).toBe(name);
      shards.add(name);
    }
    expect(shards.size).toBe(SHARD_COUNT);
  });

  it("falls back to shard-0 for unexpected keys", () => {
    expect(shardNameForKey("zebra")).toBe("shard-0");
    expect(shardNameForKey("")).toBe("shard-0");
  });
});

describe("config", () => {
  it("defaults to the production origin and format 1", () => {
    const config = readConfig({});
    expect([...config.allowedOrigins]).toEqual(["https://verify.rakko.cn"]);
    expect(config.protocols).toEqual([]);
  });

  it("parses comma separated origins and rejects paths", () => {
    expect([
      ...parseAllowedOrigins("https://a.example, https://b.example"),
    ]).toEqual(["https://a.example", "https://b.example"]);
    expect(() => parseAllowedOrigins("https://a.example/path")).toThrow();
    expect(() => parseAllowedOrigins("not a url")).toThrow();
  });

  it("accepts the supported protocols and rejects the rest", () => {
    expect(parseProtocols("hashwx, instrumentation")).toEqual([
      "hashwx",
      "instrumentation",
    ]);
    expect(() => parseProtocols("rsw")).toThrow();
  });

  it("rejects out-of-range integer vars", () => {
    expect(() => readConfig({ CHALLENGE_DIFFICULTY: "99" })).toThrow();
    expect(() => readConfig({ INSTRUMENTATION_LEVEL: "0" })).toThrow();
    expect(() => readConfig({ BLOCK_AUTOMATED_BROWSERS: "maybe" })).toThrow();
  });
});

describe("cors", () => {
  it("returns the origin for same-origin and allowlisted requests only", () => {
    const self = new Request("https://verify.rakko.cn/challenge", {
      headers: { Origin: "https://verify.rakko.cn" },
    });
    expect(resolveAllowedOrigin(self, new Set())).toBe(
      "https://verify.rakko.cn",
    );

    const allowed = new Request("https://verify.rakko.cn/challenge", {
      headers: { Origin: "https://blog.example" },
    });
    expect(
      resolveAllowedOrigin(allowed, new Set(["https://blog.example"])),
    ).toBe("https://blog.example");
    expect(resolveAllowedOrigin(allowed, new Set())).toBeNull();

    const noOrigin = new Request("https://verify.rakko.cn/challenge");
    expect(resolveAllowedOrigin(noOrigin, new Set())).toBeNull();
  });
});

describe("site registry cache", () => {
  function fakeRegistry(keys) {
    const registry = {
      reads: 0,
      async listSites() {
        registry.reads += 1;
        return keys.map((siteKey) => ({ siteKey }));
      },
    };
    return registry;
  }

  it("reads the registry once per TTL, however many keys are asked for", async () => {
    forgetSites();
    const registry = fakeRegistry(["0123456789"]);
    const now = 1_000_000;
    const lookups = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        loadSite(registry, i.toString(16).padStart(10, "f"), now),
      ),
    );
    expect(lookups.every((site) => site === null)).toBe(true);
    expect((await loadSite(registry, "0123456789", now + 1))?.siteKey).toBe(
      "0123456789",
    );
    expect(registry.reads).toBe(1);

    await loadSite(registry, "0123456789", now + CACHE_TTL_MS);
    expect(registry.reads).toBe(2);

    forgetSites();
    await loadSite(registry, "0123456789", now + CACHE_TTL_MS + 1);
    expect(registry.reads).toBe(3);
  });
});

describe("site input", () => {
  it("only routes 10-hex site keys", () => {
    expect(parseSitePath("/0123456789/challenge")).toEqual({
      siteKey: "0123456789",
      action: "challenge",
    });
    for (const path of [
      "/challenge",
      "/demo/challenge",
      "/0123456789/challenge/",
      "/0123456789A/redeem",
      "/012345678/redeem",
      "/0123456789/other",
    ]) {
      expect(parseSitePath(path), path).toBeNull();
    }
  });

  it("normalises origins and settings", () => {
    expect(
      validateOrigins([
        " https://a.example/ ",
        "https://a.example",
        "",
        "http://127.0.0.1:8080",
      ]),
    ).toEqual(["https://a.example", "http://127.0.0.1:8080"]);
    expect(() => validateOrigins(["http://a.example"])).toThrow();
    expect(() => validateOrigins("https://a.example")).toThrow();
    expect(
      validateSettings({
        challengeCount: "7",
        tokenTtlMs: null,
        blockAutomatedBrowsers: true,
      }),
    ).toEqual({ challengeCount: 7, blockAutomatedBrowsers: true });
    expect(() => validateSettings({ blockAutomatedBrowsers: "yes" })).toThrow();
  });
});
