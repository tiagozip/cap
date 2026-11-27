import { afterAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  redisAvailable = true;
} catch (e) {
  console.warn("[update-check-test] redis not available, skipping:", e.message);
}

if (!redisAvailable) {
  test.skip(`update check skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  const pings = [];
  const receiver = Bun.serve({
    port: 0,
    async fetch(req) {
      pings.push(await req.text());
      return Response.json({
        latest: {
          version: "99.0.0",
          url: "https://github.com/tiagozip/cap/releases/tag/capd%4099.0.0",
        },
        advisories: [
          {
            id: "GHSA-test",
            summary: "Test advisory",
            severity: "high",
            url: "https://github.com/tiagozip/cap/security/advisories/GHSA-test",
            fixedIn: "99.0.0",
          },
          { id: "bad", summary: "x", url: "https://evil.example/" },
        ],
      });
    },
  });

  process.env.REDIS_URL = REDIS_URL;
  process.env.REDIS_PREFIX = `usage-test-${process.pid}:`;
  process.env.ADMIN_KEY ||= "test-admin-key-1234567890";
  process.env.HIDE_RATELIMIT_IP_WARNING = "true";
  process.env.CAP_UPDATE_CHECK_URL = `http://127.0.0.1:${receiver.port}/v1/ping`;
  delete process.env.CAP_UPDATE_CHECK;
  process.env.DUCKDB_PATH = `${tmpdir()}/cap-usage-${process.pid}.duckdb`;

  await (await import("../src/events/index.js")).initEvents();
  const { auth } = await import("../src/auth.js");
  const { server } = await import("../src/server.js");
  const { db } = await import("../src/db.js");
  const { parse } = await import("../../docs/update-check-worker/src/index.js");
  const { packVars, sendUpdateCheck, updateNotices, usageReport } =
    await import("../src/update-check.js");

  const app = new Elysia().use(auth).use(server);
  const call = async (method, path, { body, auth: authHeader } = {}) => {
    const headers = {};
    if (authHeader) headers.Authorization = authHeader;
    if (body) headers["Content-Type"] = "application/json";
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    return { status: res.status, json: await res.json() };
  };

  const login = await call("POST", "/auth/login", {
    body: { admin_key: process.env.ADMIN_KEY },
  });
  const admin = `Bearer ${btoa(
    JSON.stringify({
      token: login.json.session_token,
      hash: login.json.hashed_token,
    }),
  )}`;
  const siteKey = (
    await call("POST", "/server/keys", {
      body: { name: "Private shop name" },
      auth: admin,
    })
  ).json.siteKey;

  afterAll(async () => {
    receiver.stop(true);
    const keys = await db.send("KEYS", ["*"]);
    if (keys.length) await db.send("DEL", keys);
  });

  describe("update check", () => {
    test("vars packs into 4 characters and the server stores one integer", () => {
      const vars = packVars({
        docker: true,
        analytics: "d1",
        features: { rules: true, mcp: true, sha256: false },
      });
      expect(vars).toHaveLength(4);
      const back = parse(
        JSON.stringify({
          id: "AbC-_123",
          version: "4.0.18",
          runtime: "workers",
          keys: 100,
          solves: 1_000_000,
          memory: 256,
          vars,
        }),
      );
      const bit = (from, width) =>
        Math.floor(back.info / 2 ** from) % 2 ** width;
      expect(back.id).toBe("AbC-_123");
      expect(bit(0, 16)).toBe((1 << 6) | (1 << 13));
      expect(bit(16, 1)).toBe(1);
      expect(bit(17, 3)).toBe(3);
      expect(bit(24, 1)).toBe(1);
      expect(10 ** (bit(25, 4) - 1)).toBe(100);
      expect(10 ** (bit(29, 4) - 1)).toBe(1_000_000);
      expect(2 ** bit(33, 5)).toBe(256);
      expect(parse("not-a-report")).toBeNull();
      expect(parse(JSON.stringify({ id: "AbC-_123", vars: "x" }))).toBeNull();
    });

    test("the report holds no names, keys or hosts", async () => {
      const report = await usageReport();
      const text = JSON.stringify(report);
      expect(text).not.toContain(siteKey);
      expect(text).not.toContain("Private shop name");
      expect(report.id).toMatch(/^[A-Za-z0-9_-]{8}$/);
      expect(report.keys).toBe(1);
      expect(report.solves).toBe(0);
      expect(Math.log2(report.memory) % 1).toBe(0);
      expect(report.vars).toMatch(/^[A-Za-z0-9_-]{4}$/);
      expect(Object.keys(report)).toEqual([
        "id",
        "version",
        "runtime",
        "keys",
        "solves",
        "memory",
        "vars",
      ]);
    });

    test("it is on by default and the status shows the report", async () => {
      const res = await call("GET", "/server/settings/update-check", {
        auth: admin,
      });
      expect(res.json.enabled).toBe(true);
      expect(res.json.lockedByEnv).toBe(false);
      expect(res.json.report.vars).toMatch(/^[A-Za-z0-9_-]{4}$/);
    });

    test("it sends at most once a day", async () => {
      expect(await sendUpdateCheck()).toBe(true);
      expect(await sendUpdateCheck()).toBe(false);
      expect(pings).toHaveLength(1);
      expect(JSON.parse(pings[0])).toEqual(await usageReport());
      expect(parse(pings[0])?.id).toBe((await usageReport()).id);
    });

    test("the check stores update and security notices", async () => {
      const n = await updateNotices();
      expect(n.latest.version).toBe("99.0.0");
      expect(n.advisories.map((a) => a.id)).toEqual(["GHSA-test"]);
      const res = await call("GET", "/server/settings/updates", {
        auth: admin,
      });
      expect(res.json.latest.version).toBe("99.0.0");
    });

    test("the interval spaces out checks", async () => {
      const res = await call("PUT", "/server/settings/update-check", {
        body: { interval: "weekly" },
        auth: admin,
      });
      expect(res.json.interval).toBe("weekly");
      expect(res.json.enabled).toBe(true);
      expect(res.json.nextCheck - res.json.lastSent).toBe(7 * 86_400_000);
      const bad = await call("PUT", "/server/settings/update-check", {
        body: { interval: "hourly" },
        auth: admin,
      });
      expect(bad.status).toBe(422);
    });

    test("turning it off stops sending", async () => {
      await call("PUT", "/server/settings/update-check", {
        body: { enabled: false },
        auth: admin,
      });
      await db.send("DEL", ["update-check:lock"]);
      expect(await sendUpdateCheck({ force: true })).toBe(false);
      expect(pings).toHaveLength(1);
      const n = await updateNotices();
      expect(n.enabled).toBe(false);
      expect(n.latest).toBeNull();
      expect(n.advisories).toEqual([]);
    });

    test("CAP_UPDATE_CHECK=0 wins over the saved setting", async () => {
      await call("PUT", "/server/settings/update-check", {
        body: { enabled: true },
        auth: admin,
      });
      await Bun.sleep(50);
      const before = pings.length;
      process.env.CAP_UPDATE_CHECK = "0";
      await db.send("DEL", ["update-check:lock"]);
      expect(await sendUpdateCheck({ force: true })).toBe(false);
      const res = await call("GET", "/server/settings/update-check", {
        auth: admin,
      });
      expect(res.json.enabled).toBe(false);
      expect(res.json.lockedByEnv).toBe(true);
      expect(pings).toHaveLength(before);
      delete process.env.CAP_UPDATE_CHECK;
    });
  });
}
