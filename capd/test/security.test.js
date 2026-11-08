import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch (e) {
  console.warn("[security-test] redis not available, skipping:", e.message);
}

const PREFIX = `sectest:${process.pid}:`;
const CAPD = join(import.meta.dir, "..");

process.env.REDIS_URL = REDIS_URL;
process.env.REDIS_PREFIX = PREFIX;
process.env.HIDE_RATELIMIT_IP_WARNING = "true";

let db = null;
let isolated = false;
if (redisAvailable) {
  ({ db } = await import("../src/db.js"));
  await db.set("isolation-probe", "1");
  const raw = new RedisClient(REDIS_URL);
  isolated = (await raw.get(`${PREFIX}isolation-probe`)) === "1";
  raw.close();
  await db.del("isolation-probe");
}

const clearPrefix = async (prefix) => {
  const client = new RedisClient(REDIS_URL);
  const keys = await client.send("KEYS", [`${prefix}*`]);
  if (keys.length) await client.send("DEL", keys);
  client.close();
};

const startServer = async ({ prefix = PREFIX, env = {} } = {}) => {
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const eventsDb = join(tmpdir(), `cap-sec-${process.pid}-${port}.duckdb`);
  const proc = Bun.spawn(["bun", "src/index.js"], {
    cwd: CAPD,
    env: {
      ...process.env,
      REDIS_URL,
      REDIS_PREFIX: prefix,
      SERVER_PORT: String(port),
      SERVER_HOSTNAME: "127.0.0.1",
      ADMIN_KEY: "security-test-admin-key-0123456789abcdef",
      DUCKDB_PATH: eventsDb,
      HIDE_RATELIMIT_IP_WARNING: "true",
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 200; i++) {
    if (proc.exitCode != null) break;
    try {
      if ((await fetch(`${base}/health/live`)).ok) break;
    } catch {}
    await Bun.sleep(50);
  }
  return {
    proc,
    base,
    stop: async () => {
      proc.kill();
      await proc.exited;
      for (const f of [eventsDb, `${eventsDb}.wal`]) rmSync(f, { force: true });
    },
  };
};

describe("private address checks", async () => {
  const { isPrivateAddress, isLocalHostname, embeddedIpv4, unmapIpv4 } =
    await import("../src/policy/address.js");

  test("rejects internal ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.255.0.9",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "100.127.255.255",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::",
      "::1",
      "[::1]",
      "fe80::1",
      "fe80::1%en0",
      "febf::1",
      "fc00::1",
      "fd12:3456::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:10.0.0.1",
      "::ffff:a9fe:a9fe",
      "::127.0.0.1",
      "64:ff9b::a9fe:a9fe",
      "not-an-ip",
    ])
      expect(isPrivateAddress(ip)).toBe(true);
  });

  test("accepts public addresses", () => {
    for (const ip of [
      "1.1.1.1",
      "8.8.8.8",
      "172.32.0.1",
      "100.128.0.1",
      "192.169.0.1",
      "2606:4700:4700::1111",
      "::ffff:1.1.1.1",
      "fec0::1",
    ])
      expect(isPrivateAddress(ip)).toBe(false);
  });

  test("hostnames that are local without DNS", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("db.localhost")).toBe(true);
    expect(isLocalHostname("[::1]")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(isLocalHostname("hooks.example.com")).toBe(false);
  });

  test("IPv4-mapped forms", () => {
    expect(embeddedIpv4("::ffff:5.6.7.8")).toBe("5.6.7.8");
    expect(embeddedIpv4("::ffff:0506:0708")).toBe("5.6.7.8");
    expect(embeddedIpv4("2001:db8::1")).toBe(null);
    expect(unmapIpv4("::ffff:5.6.7.8")).toBe("5.6.7.8");
    expect(unmapIpv4("::FFFF:506:708")).toBe("5.6.7.8");
    expect(unmapIpv4("2001:db8::1")).toBe("2001:db8::1");
  });
});

describe("rate limit buckets", async () => {
  if (!redisAvailable) return;
  const { rateLimitBucket } = await import("../src/ratelimit.js");

  test("groups IPv6 by /64 and unmaps IPv4", () => {
    expect(rateLimitBucket("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(rateLimitBucket("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe(
      "2001:db8:1:2::/64",
    );
    expect(rateLimitBucket("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64");
    expect(rateLimitBucket("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(rateLimitBucket("203.0.113.5")).toBe("203.0.113.5");
  });
});

describe("regex rules", async () => {
  if (!isolated) return;
  const {
    unsafeRegex,
    compileRegex,
    REGEX_INPUT_LIMIT,
    validateRules,
    evaluateRules,
    getRules,
    saveRules,
  } = await import("../src/policy/rules.js");

  const rule = (value, extra = {}) => ({
    name: "r",
    action: "block",
    conditions: [{ field: "ua", op: "matches", value }],
    ...extra,
  });

  test("refuses patterns RE2 can't compile or that are too large", () => {
    for (const p of [
      "(a)\\1",
      "(?<n>a)\\k<n>",
      "\\\\\\k<n>",
      "(?=a+)a",
      "(?!a)b",
      "(?<!x)a",
      "(?<=x)a",
      "a{1,1001}",
      "a{1,100}b{1,100}c{1,100}",
      "(?:a?){999}a{999}",
      "\\w{999}",
      "x".repeat(201),
      "(unclosed",
    ])
      expect(unsafeRegex(p)).not.toBe(null);
  });

  test("accepts ordinary and formerly refused patterns", () => {
    for (const p of [
      "bot|crawler|spider",
      "^curl/",
      "python-requests/\\d+\\.\\d+",
      "(?:Headless)?Chrome/1[0-4]\\d",
      "(bot|spider)?x",
      "[(a+)+]",
      "\\(a+\\)+",
      "(?:ab)+",
      "a{1,5}b{2}",
      "^(a+)+$",
      "(a*)*b",
      "(a|aa)*x",
      "(\\w+\\s?)*$",
      "\\d*\\d*\\d*x",
      "(?<name>bot)",
      "\\u0041\\/b",
      "\\\\k<n>",
      "Mozilla/5\\.0 \\(Windows NT \\d+\\.\\d+.*\\) Chrome/\\d+",
    ])
      expect(unsafeRegex(p)).toBe(null);
  });

  test("matches like the old case-insensitive RegExp", () => {
    const run = (p, s) => compileRegex(p).re.test(s);
    const chrome =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    expect(
      run("Mozilla/5\\.0 \\(Windows NT \\d+\\.\\d+.*\\) Chrome/\\d+", chrome),
    ).toBe(true);
    expect(
      run(
        "Mozilla/5\\.0 \\(Windows NT \\d+\\.\\d+.*\\) Chrome/\\d+",
        chrome.replace("Windows NT", "Macintosh"),
      ),
    ).toBe(false);
    for (const [p, s, want] of [
      ["CURL", "curl/8.4", true],
      ["^curl", "my curl", false],
      ["bot$", "googlebot", true],
      ["bot$", "bot\nx", false],
      ["^x$", "a\nx", false],
      ["a.b", "a\nb", false],
      ["caf\u00e9", "CAF\u00c9", true],
      ["\\u0041", "a", true],
      ["a/b", "a/b", true],
      ["[^a-z]", "ABC", false],
    ]) {
      expect(run(p, s)).toBe(want);
      expect(new RegExp(p, "i").test(s)).toBe(want);
    }
  });

  test("validateRules reports the problem", () => {
    expect(validateRules([rule("(a)\\1")]).error).toMatch(
      /can't be compiled.*Backreferences/,
    );
    expect(validateRules([rule("(?:a?){999}a{999}")]).error).toMatch(
      /too complex/,
    );
    expect(validateRules([rule("x".repeat(201))]).error).toMatch(
      /longer than 200/,
    );
    expect(validateRules([rule("^(a+)+$")]).error).toBeUndefined();
    expect(validateRules([rule("bot")]).error).toBeUndefined();
    const many = Array.from({ length: 11 }, (_, i) => rule(`bot${i}`));
    expect(validateRules(many).error).toMatch(/At most 10/);
  });

  test("catastrophic patterns run in linear time on capped input", () => {
    for (const [p, s] of [
      ["(a+)+b", "a".repeat(5000)],
      ["^(a+)+$", `${"a".repeat(511)}!`],
      [".*.*.*x", "a".repeat(5000)],
      ["(a|aa)*b", "a".repeat(5000)],
    ]) {
      const { re } = compileRegex(p);
      const started = performance.now();
      expect(re.test(s.slice(0, REGEX_INPUT_LIMIT))).toBe(false);
      expect(performance.now() - started).toBeLessThan(50);
    }
  });

  test("stored patterns that RE2 can't compile never run", async () => {
    await saveRules("rxkey", [
      {
        id: "backref",
        name: "backref",
        enabled: true,
        match: "any",
        action: "block",
        conditions: [
          { field: "ua", op: "matches", value: "(a)\\1" },
          { field: "ua", op: "matches", value: "(?=a)a" },
        ],
      },
      {
        id: "evil",
        name: "evil",
        enabled: true,
        match: "all",
        action: "block",
        conditions: [{ field: "ua", op: "matches", value: "^(a+)+$" }],
      },
      {
        id: "long",
        name: "long",
        enabled: true,
        match: "all",
        action: "flag",
        conditions: [{ field: "ua", op: "matches", value: "z$" }],
      },
    ]);
    const rules = await getRules("rxkey");
    expect(rules[0].conditions.map((c) => c.re)).toEqual([null, null]);
    expect(rules[1].conditions[0].re).not.toBe(null);
    const started = performance.now();
    const out = await evaluateRules(
      rules,
      { ua: `${"a".repeat(40)}!`, headers: new Headers() },
      "challenge",
    );
    expect(performance.now() - started).toBeLessThan(100);
    expect(out.action).toBe(null);
    const tail = await evaluateRules(
      rules,
      { ua: `${"a".repeat(600)}z`, headers: new Headers() },
      "challenge",
    );
    expect(tail.flags).toEqual([]);
  });
});

describe("legacy blocklist migration", async () => {
  if (!isolated) return;
  const { migrateLegacyBlocks } = await import("../src/policy/rules.js");
  const { getList } = await import("../src/policy/lists.js");

  test("keeps entries it can't store and unmaps IPv4", async () => {
    await db.sadd("keys", "migkey");
    await db.hmset("key:migkey", ["name", "mig", "config", "{}"]);
    await db.send("HSET", [
      "blocked:migkey",
      "::ffff:5.6.7.8",
      "0",
      "203.0.113.9",
      "0",
      "cidr:not-a-cidr",
      "0",
      "198.51.100.1",
      String(Date.now() - 1000),
    ]);
    await migrateLegacyBlocks();
    await db.srem("keys", "migkey");
    const list = await getList("blk_migkey");
    const values = list.items.map((i) => `${i.kind}:${i.value}`).sort();
    expect(values).toEqual(["ip:203.0.113.9", "ip:5.6.7.8"]);
    const left = await db.send("HGETALL", ["blocked:migkey"]);
    expect(Object.keys(left)).toEqual(["cidr:not-a-cidr"]);
  });
});

describe("analytics ranges", async () => {
  if (!redisAvailable) return;
  const { resolveRange } = await import("../src/events/analytics.js");

  test("clamps from to the retention window and caps buckets", () => {
    const r = resolveRange({ from: -1e14, to: Date.now() });
    expect(r.from).toBeGreaterThan(Date.now() - 31 * 86_400_000);
    expect((r.to - r.from) / r.bucket).toBeLessThanOrEqual(2000);
    const inverted = resolveRange({ from: Date.now(), to: -1e14 });
    expect(inverted.to).toBeGreaterThanOrEqual(inverted.from);
    const forced = resolveRange({ from: 0, to: Date.now(), bucket: 3_600_000 });
    expect((forced.to - forced.from) / forced.bucket).toBeLessThanOrEqual(2000);
  });
});

describe("CORS cache", async () => {
  if (!isolated) return;
  const {
    checkCorsOrigin,
    corsCacheSize,
    corsTarget,
    originAllowed,
    setCorsDefault,
  } = await import("../src/settings-cache.js");

  test("wildcard origins match subdomains and nothing else", () => {
    const cases = [
      ["https://*.example.com", "https://a.example.com", true],
      ["https://*.example.com", "https://a.b.example.com", true],
      ["https://*.example.com", "https://example.com", false],
      ["https://*.example.com", "http://a.example.com", false],
      ["https://*.example.com", "https://a.example.com.evil.io", false],
      ["https://*.example.com", "https://aexample.com", false],
      ["https://*.example.com", "https://a.example.com:8443", false],
      ["https://*.example.com:8443", "https://a.example.com:8443", true],
      ["https://sub*.example.com", "https://sub1.example.com", true],
      ["https://sub*.example.com", "https://foo.example.com", false],
      ["https://sub*.example.com", "https://sub.example.com", false],
      ["https://sub*.example.com", "https://sub1.x.example.com", false],
      ["*.example.com", "http://a.example.com", true],
      ["https://*.com", "https://evil.com", false],
      ["https://*", "https://evil.com", false],
      ["https://a.*.com", "https://a.b.com", false],
      ["https://*.example.com", "null", false],
    ];
    for (const [entry, from, allowed] of cases)
      expect([entry, from, originAllowed([entry], from)]).toEqual([
        entry,
        from,
        allowed,
      ]);
  });

  test("only widget routes get CORS", () => {
    expect(corsTarget("/abc/challenge")).toEqual({ siteKey: "abc" });
    expect(corsTarget("/abc/redeem")).toEqual({ siteKey: "abc" });
    expect(corsTarget("/assets/widget.js")).toEqual({ any: true });
    for (const p of [
      "/server/keys",
      "/auth/login",
      "/abc/siteverify",
      "/share/x",
      "/abc",
      "/",
    ])
      expect(corsTarget(p)).toBe(null);
  });

  test("unknown keys are never cached", async () => {
    setCorsDefault({ origins: null });
    for (let i = 0; i < 500; i++)
      await checkCorsOrigin(`nokey${i}`, "https://a.example");
    expect(corsCacheSize()).toBe(0);
  });

  test("first request to a restricted key uses its own list", async () => {
    setCorsDefault({ origins: null });
    await db.hmset("key:corskey", [
      "config",
      JSON.stringify({ corsOrigins: ["https://example.com"] }),
    ]);
    expect(await checkCorsOrigin("corskey", "https://evil.example")).toBe(
      false,
    );
    expect(await checkCorsOrigin("corskey", "https://example.com")).toBe(true);
    expect(corsCacheSize()).toBe(1);
  });
});

afterAll(async () => {
  if (redisAvailable) await clearPrefix(PREFIX);
});

describe("running server", () => {
  if (!redisAvailable) return;
  let server;
  let admin;
  let siteKey;

  beforeAll(async () => {
    server = await startServer({ prefix: `${PREFIX}srv:` });
    const login = await (
      await fetch(`${server.base}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          admin_key: "security-test-admin-key-0123456789abcdef",
        }),
      })
    ).json();
    admin = `Bearer ${btoa(
      JSON.stringify({ token: login.session_token, hash: login.hashed_token }),
    )}`;
    ({ siteKey } = await (
      await fetch(`${server.base}/server/keys`, {
        method: "POST",
        headers: { authorization: admin, "content-type": "application/json" },
        body: JSON.stringify({
          name: "sec",
          corsOrigins: ["https://example.com"],
        }),
      })
    ).json());
  });

  afterAll(async () => {
    await server?.stop();
  });

  test("argon2 and bcrypt hashes from older releases are rejected", async () => {
    const raw = new RedisClient(REDIS_URL);
    const P = `${PREFIX}srv:`;
    const db = {
      hget: (k, f) => raw.send("HGET", [P + k, f]),
      hset: (k, f, v) => raw.send("HSET", [P + k, f, v]),
      get: (k) => raw.send("GET", [P + k]),
      set: (k, v) => raw.send("SET", [P + k, v]),
      sadd: (k, v) => raw.send("SADD", [P + k, v]),
    };
    const created = await (
      await fetch(`${server.base}/server/settings/apikeys`, {
        method: "POST",
        headers: { authorization: admin, "content-type": "application/json" },
        body: JSON.stringify({ name: "old" }),
      })
    ).json();
    const [id, token] = created.apiKey.split("_");
    expect(await db.hget(`apikey:${id}`, "tokenHash")).toStartWith("sha256:");
    await db.hset(`apikey:${id}`, "tokenHash", await Bun.password.hash(token));
    const bot = (t) =>
      fetch(`${server.base}/server/keys`, {
        headers: { authorization: `Bot ${id}_${t}` },
      });
    const rejected = await bot(token);
    expect(rejected.status).toBe(401);
    expect((await rejected.json()).error).toContain("older Cap release");
    expect(await db.hget(`apikey:${id}`, "tokenHash")).toStartWith("$argon2");
    const apiList = await (
      await fetch(`${server.base}/server/settings/apikeys`, {
        headers: { authorization: admin },
      })
    ).json();
    expect(apiList.find((k) => k.id === id).outdated).toBe(true);

    const secret = "old-release-secret-0123456789abcdef";
    await db.hset(
      `key:${siteKey}`,
      "secretHash",
      await Bun.password.hash(secret, "bcrypt"),
    );
    const verify = (s) =>
      fetch(`${server.base}/siteverify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret: s, response: `${siteKey}:nope:nope` }),
      });
    const old = await verify(secret);
    expect(old.status).toBe(403);
    expect((await old.json()).error).toContain("older Cap release");
    expect(await db.hget(`key:${siteKey}`, "secretHash")).toStartWith("$2");
    const keyList = await (
      await fetch(`${server.base}/server/keys`, {
        headers: { authorization: admin },
      })
    ).json();
    expect(keyList.find((k) => k.siteKey === siteKey).secretOutdated).toBe(
      true,
    );
    const detail = await (
      await fetch(`${server.base}/server/keys/${siteKey}`, {
        headers: { authorization: admin },
      })
    ).json();
    expect(detail.key.secretOutdated).toBe(true);

    await db.hset(`key:${siteKey}`, "secretHash", "plaintext-or-garbage");
    expect((await verify("plaintext-or-garbage")).status).toBe(403);

    const oldToken = "f".repeat(60);
    const oldHash = await Bun.password.hash(oldToken);
    await db.set(
      `session:${oldHash}`,
      JSON.stringify({ created: Date.now(), expires: Date.now() + 60_000 }),
    );
    await db.sadd("sessions", oldHash);
    const oldSession = await fetch(`${server.base}/server/keys`, {
      headers: {
        authorization: `Bearer ${btoa(JSON.stringify({ token: oldToken, hash: oldHash }))}`,
      },
    });
    expect(oldSession.status).toBe(401);
    const list = await (
      await fetch(`${server.base}/server/settings/sessions`, {
        headers: { authorization: admin },
      })
    ).json();
    expect(list.every((x) => !x.token.includes("$"))).toBe(true);
    expect(await db.get(`session:${oldHash}`)).toBeNull();
    raw.close();
  });

  test("missing keys answer 404", async () => {
    for (const [method, path, body] of [
      ["GET", "/server/keys/nope000000"],
      ["PUT", "/server/keys/nope000000/config", { name: "x" }],
      ["POST", "/server/keys/nope000000/rotate-secret"],
    ]) {
      const res = await fetch(`${server.base}${path}`, {
        method,
        headers: {
          authorization: admin,
          ...(body && { "content-type": "application/json" }),
        },
        ...(body && { body: JSON.stringify(body) }),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        success: false,
        error: "Key not found",
      });
    }
  });

  test("admin routes answer without CORS", async () => {
    for (const [method, path] of [
      ["OPTIONS", "/server/keys"],
      ["GET", "/server/keys"],
      ["POST", "/auth/login"],
      ["OPTIONS", "/auth/login"],
    ]) {
      const res = await fetch(`${server.base}${path}`, {
        method,
        headers: {
          origin: "https://evil.example",
          authorization: admin,
          "access-control-request-method": "POST",
        },
      });
      expect(res.headers.get("access-control-allow-origin")).toBe(null);
      expect(res.headers.get("access-control-allow-credentials")).toBe(null);
    }
  });

  test("widget routes follow the key's origins from the first request", async () => {
    const challenge = (origin) =>
      fetch(`${server.base}/${siteKey}/challenge`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
      });
    const evil = await challenge("https://evil.example");
    expect(evil.headers.get("access-control-allow-origin")).toBe(null);
    const good = await challenge("https://example.com");
    expect(good.headers.get("access-control-allow-origin")).toBe(
      "https://example.com",
    );
    expect(good.headers.get("access-control-allow-credentials")).toBe(null);
    const preflight = await fetch(`${server.base}/${siteKey}/redeem`, {
      method: "OPTIONS",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "https://example.com",
    );
    expect(preflight.headers.get("access-control-allow-methods")).toBe(
      "GET, POST",
    );
  });

  test("bodies over 1 MB are refused", async () => {
    const res = await fetch(`${server.base}/siteverify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"pad":"${"A".repeat(2 * 1024 * 1024)}"}`,
    });
    expect(res.status).toBe(413);
  });

  test("scoped keys can't create webhooks", async () => {
    const { apiKey } = await (
      await fetch(`${server.base}/server/settings/apikeys`, {
        method: "POST",
        headers: { authorization: admin, "content-type": "application/json" },
        body: JSON.stringify({ name: "scoped", siteKeys: [siteKey] }),
      })
    ).json();
    const hook = {
      url: "https://hooks.example.com/cap",
      triggers: ["block"],
    };
    const scoped = await fetch(
      `${server.base}/server/keys/${siteKey}/webhooks`,
      {
        method: "POST",
        headers: {
          authorization: `Bot ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(hook),
      },
    );
    expect(scoped.status).toBe(403);
    const internal = await fetch(
      `${server.base}/server/keys/${siteKey}/webhooks`,
      {
        method: "POST",
        headers: { authorization: admin, "content-type": "application/json" },
        body: JSON.stringify({ ...hook, url: "http://127.0.0.1:8123/" }),
      },
    );
    expect(internal.status).toBe(400);
    const ok = await fetch(`${server.base}/server/keys/${siteKey}/webhooks`, {
      method: "POST",
      headers: { authorization: admin, "content-type": "application/json" },
      body: JSON.stringify(hook),
    });
    expect(ok.status).toBe(200);
    const unscoped = await (
      await fetch(`${server.base}/server/settings/apikeys`, {
        method: "POST",
        headers: { authorization: admin, "content-type": "application/json" },
        body: JSON.stringify({ name: "unscoped" }),
      })
    ).json();
    const logout = await fetch(`${server.base}/server/logout`, {
      method: "POST",
      headers: { authorization: `Bot ${unscoped.apiKey}` },
    });
    expect(logout.status).toBe(400);
    const allowed = await fetch(
      `${server.base}/server/keys/${siteKey}/webhooks`,
      {
        method: "POST",
        headers: {
          authorization: `Bot ${unscoped.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(hook),
      },
    );
    expect(allowed.status).toBe(200);
  });

  test("analytics ranges and limits are bounded", async () => {
    const res = await fetch(
      `${server.base}/server/keys/${siteKey}/analytics?from=-100000000000000&to=${Date.now()}`,
      { headers: { authorization: admin } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.series.length).toBeLessThanOrEqual(2000);
    const events = await fetch(
      `${server.base}/server/keys/${siteKey}/events?limit=-5`,
      { headers: { authorization: admin } },
    );
    expect(events.status).toBe(200);
  });

  test("pages carry a CSP and can't be framed", async () => {
    const res = await fetch(`${server.base}/`);
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("frame-ancestors 'none'");
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    const html = await res.text();
    if (html.includes("<script"))
      expect(html.match(/<script(?![^>]*nonce=)/g)).toBe(null);
    expect(html).toContain(`nonce="${nonce}"`);
  });

  test("one client's failed logins don't lock out another", async () => {
    const client = new RedisClient(REDIS_URL);
    const window = Math.floor(Date.now() / 600_000);
    await client.send("SET", [
      `${PREFIX}srv:auth:failures:ip:203.0.113.9:${window}`,
      "500",
    ]);
    client.close();
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push(
        (
          await fetch(`${server.base}/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              admin_key: "security-test-admin-key-0123456789abcdef",
            }),
          })
        ).status,
      );
    expect(statuses).toEqual([200, 200, 200]);
  });

  test("failed logins from many clients don't throttle the admin", async () => {
    const client = new RedisClient(REDIS_URL);
    const window = Math.floor(Date.now() / 600_000);
    await client.send("SET", [
      `${PREFIX}srv:auth:failures:all:${window}`,
      "5000",
    ]);
    client.close();
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push(
        (
          await fetch(`${server.base}/auth/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              admin_key: "security-test-admin-key-0123456789abcdef",
            }),
          })
        ).status,
      );
    expect(statuses).toEqual([200, 200, 200]);
  });
});

describe("secret box", async () => {
  const { openSecret, sealSecret } = await import("../src/secret-box.js");

  test("round trips and binds to the site key and admin key", () => {
    const before = process.env.ADMIN_KEY;
    process.env.ADMIN_KEY = "secret-box-admin-key-0123456789";
    const sealed = sealSecret("abc123", "sk-plain");
    expect(sealed).toMatch(/^v1:[\w-]{16}:[\w-]+:[\w-]{22}$/);
    expect(sealed).not.toContain("sk-plain");
    expect(sealSecret("abc123", "sk-plain")).not.toBe(sealed);
    expect(openSecret("abc123", sealed)).toBe("sk-plain");
    expect(openSecret("other", sealed)).toBe(null);
    const tag = sealed.split(":")[3];
    const tampered = sealed.replace(
      `:${tag}`,
      `:${tag[0] === "A" ? "B" : "A"}${tag.slice(1)}`,
    );
    expect(openSecret("abc123", tampered)).toBe(null);
    expect(openSecret("abc123", "v2:a:b:c")).toBe(null);
    process.env.ADMIN_KEY = "a-different-admin-key-0123456789";
    expect(openSecret("abc123", sealed)).toBe(null);
    if (before == null) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = before;
  });
});

describe("revealing secrets", () => {
  if (!redisAvailable) return;
  const prefix = `${PREFIX}reveal:`;
  const firstAdmin = "reveal-test-admin-key-0123456789abcdef";
  let server;

  const login = async (base, adminKey) => {
    const res = await (
      await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ admin_key: adminKey }),
      })
    ).json();
    return `Bearer ${btoa(
      JSON.stringify({ token: res.session_token, hash: res.hashed_token }),
    )}`;
  };

  const call = (method, path, authorization, body) =>
    fetch(`${server.base}${path}`, {
      method,
      headers: {
        authorization,
        ...(body && { "content-type": "application/json" }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });

  const rawKey = async (siteKey) => {
    const client = new RedisClient(REDIS_URL);
    const fields = await client.send("HGETALL", [`${prefix}key:${siteKey}`]);
    client.close();
    return fields;
  };

  afterAll(async () => {
    await server?.stop();
    await clearPrefix(prefix);
  });

  test("admins and unscoped keys can reveal, others can't", async () => {
    server = await startServer({ prefix, env: { ADMIN_KEY: firstAdmin } });
    const admin = await login(server.base, firstAdmin);
    const { siteKey, secretKey } = await (
      await call("POST", "/server/keys", admin, { name: "reveal" })
    ).json();

    const shown = await call("GET", `/server/keys/${siteKey}/secret`, admin);
    expect(shown.status).toBe(200);
    expect(shown.headers.get("cache-control")).toBe("no-store");
    expect(await shown.json()).toEqual({ secretKey });

    const stored = await rawKey(siteKey);
    expect(stored.secretEnc).toMatch(/^v1:/);
    expect(JSON.stringify(stored)).not.toContain(secretKey);
    expect(JSON.stringify(stored)).not.toContain(secretKey.slice(3));

    const apiKey = async (body) =>
      `Bot ${(await (await call("POST", "/server/settings/apikeys", admin, body)).json()).apiKey}`;
    const unscoped = await apiKey({ name: "full" });
    const scoped = await apiKey({ name: "scoped", siteKeys: [siteKey] });
    const readonly = await apiKey({ name: "ro", readonly: true });
    const scopedReadonly = await apiKey({
      name: "scoped-ro",
      siteKeys: [siteKey],
      readonly: true,
    });

    const viaKey = await call(
      "GET",
      `/server/keys/${siteKey}/secret`,
      unscoped,
    );
    expect(viaKey.status).toBe(200);
    expect((await viaKey.json()).secretKey).toBe(secretKey);
    for (const auth of [scoped, readonly, scopedReadonly]) {
      const res = await call("GET", `/server/keys/${siteKey}/secret`, auth);
      expect(res.status).toBe(403);
      expect(JSON.stringify(await res.json())).not.toContain(secretKey);
    }

    const share = await (
      await call("POST", `/server/keys/${siteKey}/shares`, admin, {
        name: "s",
      })
    ).json();
    const viaShare = await fetch(
      `${server.base}/server/keys/${siteKey}/secret`,
      { headers: { authorization: `Bearer ${share.token}` } },
    );
    expect(viaShare.status).toBe(401);
    expect(
      (await fetch(`${server.base}/share/${share.token}/secret`)).status,
    ).toBe(404);

    const missing = await call("GET", "/server/keys/nope000000/secret", admin);
    expect(missing.status).toBe(404);
  });

  test("keys from older releases and a changed ADMIN_KEY give 409 until rotated", async () => {
    const admin = await login(server.base, firstAdmin);
    const { siteKey } = await (
      await call("POST", "/server/keys", admin, { name: "legacy" })
    ).json();
    const client = new RedisClient(REDIS_URL);
    await client.send("HDEL", [`${prefix}key:${siteKey}`, "secretEnc"]);
    client.close();
    const legacy = await call("GET", `/server/keys/${siteKey}/secret`, admin);
    expect(legacy.status).toBe(409);
    expect((await legacy.json()).error).toBe(
      "Cap can't show this secret. Reset it to get one you can reveal.",
    );

    const { siteKey: kept, secretKey: keptSecret } = await (
      await call("POST", "/server/keys", admin, { name: "kept" })
    ).json();
    await server.stop();
    const secondAdmin = "reveal-test-changed-admin-key-9876543210";
    server = await startServer({ prefix, env: { ADMIN_KEY: secondAdmin } });
    const admin2 = await login(server.base, secondAdmin);
    const changed = await call("GET", `/server/keys/${kept}/secret`, admin2);
    expect(changed.status).toBe(409);

    const verify = await fetch(`${server.base}/siteverify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: keptSecret,
        response: `${kept}:y:z`,
      }),
    });
    expect((await verify.json()).error).toBe("Token not found");

    const rotated = await (
      await call("POST", `/server/keys/${kept}/rotate-secret`, admin2)
    ).json();
    const after = await call("GET", `/server/keys/${kept}/secret`, admin2);
    expect(after.status).toBe(200);
    expect((await after.json()).secretKey).toBe(rotated.secretKey);
  }, 20_000);
});
