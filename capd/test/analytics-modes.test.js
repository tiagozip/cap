import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";

setDefaultTimeout(30_000);

const REDIS_URL =
  process.env.VALKEY_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379";
const CAPD = join(import.meta.dir, "..");
const ADMIN_KEY = "modes-test-admin-key-0123456789abcdef";
const HOUR = 3_600_000;

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

if (!redisAvailable) {
  test.skip(`analytics modes skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.VALKEY_URL ??= REDIS_URL;
  const { analyticsMode } = await import("../src/events/open-store.js");
  const { createRedisStore } = await import("../src/events/counters.js");
  const { db } = await import("../src/db.js");

  const runId = `${process.pid}${Date.now()}`;
  const prefix = `modestest:${runId}:`;
  const servers = [];
  const files = [];

  afterAll(async () => {
    for (const s of servers) await s.stop();
    for (const f of files) rmSync(f, { force: true });
    const client = new RedisClient(REDIS_URL);
    const keys = await client.send("KEYS", [`${prefix}*`]);
    if (keys.length) await client.send("DEL", keys);
    const own = await client.send("KEYS", [`analytics:counts:unit-${runId}*`]);
    if (own.length) await client.send("DEL", own);
    client.close();
  });

  const start = async (env) => {
    const port = 20_000 + Math.floor(Math.random() * 20_000);
    const eventsDb = join(tmpdir(), `cap-modes-${process.pid}-${port}.duckdb`);
    files.push(eventsDb, `${eventsDb}.wal`);
    const proc = Bun.spawn(["bun", "src/index.js"], {
      cwd: CAPD,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        VALKEY_URL: REDIS_URL,
        REDIS_PREFIX: prefix,
        SERVER_PORT: String(port),
        SERVER_HOSTNAME: "127.0.0.1",
        ADMIN_KEY,
        DUCKDB_PATH: eventsDb,
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
    const login = await (
      await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ admin_key: ADMIN_KEY }),
      })
    ).json();
    const authorization = `Bearer ${btoa(
      JSON.stringify({ token: login.session_token, hash: login.hashed_token }),
    )}`;
    const call = async (method, path, body) =>
      (
        await fetch(`${base}${path}`, {
          method,
          headers: {
            authorization,
            ...(body && { "content-type": "application/json" }),
          },
          ...(body && { body: JSON.stringify(body) }),
        })
      ).json();
    const server = {
      base,
      eventsDb,
      call,
      challenge: (siteKey) =>
        fetch(`${base}/${siteKey}/challenge`, { method: "POST" }),
      stop: async () => {
        proc.kill();
        await proc.exited;
      },
    };
    servers.push(server);
    return server;
  };

  const waitFor = async (check) => {
    for (let i = 0; i < 60; i++) {
      const value = await check();
      if (value) return value;
      await Bun.sleep(100);
    }
    return check();
  };

  describe("ANALYTICS setting", () => {
    test("resolves each mode and reports bad values", () => {
      expect(analyticsMode({})).toEqual({ mode: "duckdb" });
      expect(analyticsMode({ ANALYTICS: " Redis " })).toEqual({
        mode: "redis",
      });
      expect(analyticsMode({ ANALYTICS: "valkey" })).toEqual({
        mode: "redis",
      });
      expect(
        analyticsMode({ ANALYTICS: "off", CLICKHOUSE_URL: "http://ch:8123" }),
      ).toEqual({ mode: "off" });
      expect(
        analyticsMode({
          ANALYTICS: "duckdb",
          CLICKHOUSE_URL: "http://ch:8123",
        }),
      ).toEqual({ mode: "duckdb" });
      expect(analyticsMode({ CLICKHOUSE_URL: "http://ch:8123" }).mode).toBe(
        "clickhouse",
      );
      expect(analyticsMode({ ANALYTICS: "clickhouse" }).error).toContain(
        "CLICKHOUSE_URL",
      );
      expect(analyticsMode({ CLICKHOUSE_URL: "ftp://x" }).error).toContain(
        "http://",
      );
      const bad = analyticsMode({ ANALYTICS: "nope" });
      expect(bad.mode).toBe("duckdb");
      expect(bad.error).toContain("redis or off");
    });
  });

  describe("redis counter store", () => {
    const siteKey = `unit-${runId}`;
    const store = createRedisStore();
    const now = Date.now();
    const hour = Math.floor(now / HOUR) * HOUR;
    const event = (type, outcome, ts = now) => ({
      site_key: siteKey,
      type,
      outcome,
      ts,
    });

    test("counts events per hour and answers the overview queries", async () => {
      await store.insert([
        event("challenge", "pass"),
        event("challenge", "pass"),
        event("redeem", "pass"),
        event("redeem", "fail"),
        event("challenge", "block"),
        event("challenge", "limit"),
        event("siteverify", "pass"),
        event("challenge", "pass", now - 3 * HOUR),
        { site_key: "", type: "challenge", outcome: "pass", ts: now },
      ]);
      const ctx = { siteKey, from: now - 2 * HOUR, to: now + HOUR };
      expect(await store.queries.summary(ctx)).toMatchObject({
        total: 7,
        challenges: 2,
        solved: 1,
        failed: 1,
        blocked: 1,
        limited: 1,
        verified: 1,
        ips: 0,
      });
      const wide = { siteKey, from: now - 5 * HOUR, to: now + HOUR };
      expect((await store.queries.summary(wide)).challenges).toBe(3);
      const series = await store.queries.series(wide, HOUR);
      expect(
        series
          .filter((r) => r.type === "challenge" && r.outcome === "pass")
          .map((r) => [r.b, r.n])
          .sort((a, b) => a[0] - b[0]),
      ).toEqual([
        [hour - 3 * HOUR, 1],
        [hour, 2],
      ]);
      const daily = await store.queries.series(wide, 24 * HOUR);
      expect(daily.every((r) => r.b % (24 * HOUR) === 0)).toBe(true);
      expect(
        (await store.queries.flow(ctx)).find(
          (r) => r.type === "redeem" && r.outcome === "fail",
        ).n,
      ).toBe(1);
      expect(await store.queries.firstEventTs(siteKey)).toBe(hour - 3 * HOUR);
      expect(
        await store.queries.summary({
          ...ctx,
          filters: [{ field: "country", value: "US" }],
        }),
      ).toMatchObject({ total: 0 });
      expect(await store.queries.list(ctx)).toEqual({ events: [], next: null });
      expect(await store.queries.top(ctx, "country")).toEqual([]);
    });

    test("prunes hours past retention and deletes a site", async () => {
      await db.sadd("keys", siteKey);
      try {
        await store.insert([event("challenge", "pass", now - 40 * 24 * HOUR)]);
        expect(await store.prune(30)).toBe(1);
        const all = { siteKey, from: 0, to: now + HOUR };
        expect((await store.queries.summary(all)).challenges).toBe(3);
        await store.deleteSite(siteKey);
        expect((await store.queries.summary(all)).total).toBe(0);
      } finally {
        await db.srem("keys", siteKey);
      }
    });

    test("reads Cap 3 counters as rollups", async () => {
      const legacyKey = `${siteKey}-legacy`;
      const hourSec = String(Math.floor((now - 48 * HOUR) / 1000));
      await db.hset(`metrics:verified:${legacyKey}`, hourSec, "4");
      await db.hset(`metrics:failed:${legacyKey}`, hourSec, "2");
      await db.hset(`metrics:verified:${legacyKey}`, "junk", "x");
      try {
        expect(await store.queries.rollups(legacyKey, 0, now)).toEqual([
          {
            hour: Number(hourSec) * 1000,
            verified: 4,
            failed: 2,
            ratelimited: 0,
          },
        ]);
        expect(await store.queries.rollups(legacyKey, now - HOUR, now)).toEqual(
          [],
        );
      } finally {
        await db.del(
          `metrics:verified:${legacyKey}`,
          `metrics:failed:${legacyKey}`,
        );
      }
    });
  });

  describe("ANALYTICS=redis across two instances", () => {
    test("both containers add to the same totals", async () => {
      const a = await start({ ANALYTICS: "redis" });
      const b = await start({ ANALYTICS: "redis" });
      const { siteKey } = await a.call("POST", "/server/keys", {
        name: "modes",
      });
      expect(siteKey).toBeTruthy();

      for (const s of [a, a, a, b, b])
        expect((await s.challenge(siteKey)).status).toBe(200);

      const overview = await waitFor(async () => {
        const o = await b.call(
          "GET",
          `/server/keys/${siteKey}/analytics?range=24h`,
        );
        return o.summary?.challenges === 5 && o;
      });
      expect(overview.storage).toBe("redis");
      expect(overview.summary.challenges).toBe(5);
      expect(
        overview.series.reduce((sum, row) => sum + row.challenges, 0),
      ).toBe(5);

      const events = await a.call(
        "GET",
        `/server/keys/${siteKey}/events?range=24h`,
      );
      expect(events.events).toEqual([]);

      const settings = await a.call("GET", "/server/settings/analytics");
      expect(settings.status).toMatchObject({
        backend: "redis",
        configured: "redis",
        healthy: true,
      });
      expect(settings.status.info.events).toBeGreaterThanOrEqual(5);
      expect(existsSync(a.eventsDb)).toBe(false);

      const hourSec = String(Math.floor((Date.now() - 72 * HOUR) / 1000));
      const client = new RedisClient(REDIS_URL);
      await client.send("HSET", [
        `${prefix}metrics:verified:${siteKey}`,
        hourSec,
        "7",
      ]);
      client.close();
      const week = await a.call(
        "GET",
        `/server/keys/${siteKey}/analytics?range=7d`,
      );
      expect(week.summary.solved).toBe(7);
      expect(week.legacy).toBe(true);

      await a.call("DELETE", `/server/keys/${siteKey}`);
      const check = new RedisClient(REDIS_URL);
      const left = await check.send("EXISTS", [
        `${prefix}analytics:counts:${siteKey}`,
      ]);
      check.close();
      expect(left).toBe(0);
    });
  });

  describe("ANALYTICS=off", () => {
    test("serves challenges and stores nothing", async () => {
      const s = await start({ ANALYTICS: "off" });
      const { siteKey } = await s.call("POST", "/server/keys", {
        name: "off",
      });
      for (let i = 0; i < 3; i++)
        expect((await s.challenge(siteKey)).status).toBe(200);
      await Bun.sleep(1500);

      const overview = await s.call(
        "GET",
        `/server/keys/${siteKey}/analytics?range=24h`,
      );
      expect(overview.storage).toBe("off");
      expect(overview.summary.total).toBe(0);

      const insights = await s.call(
        "GET",
        `/server/keys/${siteKey}/analytics/insights?range=24h`,
      );
      expect(insights.error).toBeUndefined();

      const settings = await s.call("GET", "/server/settings/analytics");
      expect(settings.status).toMatchObject({
        backend: "off",
        configured: "off",
        healthy: true,
      });
      const client = new RedisClient(REDIS_URL);
      const counts = await client.send("KEYS", [
        `${prefix}analytics:counts:${siteKey}`,
      ]);
      client.close();
      expect(counts).toEqual([]);
      expect(existsSync(s.eventsDb)).toBe(false);
    });
  });
}
