import { afterAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";

// Exercises the db layer against whatever store REDIS_URL points at. With
// REDIS_CLUSTER=true (see the standalone-cluster CI job) the same assertions run
// against a Redis/Valkey Cluster, covering the cluster code path in db.js.

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

// A non-empty prefix is required for the regression guard below to be
// meaningful: the double-prefix bug only manifests when a prefix is set.
process.env.REDIS_PREFIX = "captest:";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL.split(",")[0]);
  await probe.send("PING", []);
  probe.close?.();
  redisAvailable = true;
} catch (e) {
  console.warn("[db-test] redis not available, skipping:", e.message);
}

if (!redisAvailable) {
  test.skip(`db layer skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  const { db, hgetall } = await import("../src/db.js");
  const NS = `dbtest:${Math.random().toString(16).slice(2)}`;

  describe("db layer", () => {
    afterAll(async () => {
      // One key per DEL so cleanup is cluster-safe (no CROSSSLOT).
      await Promise.all(
        ["str", "cnt", "hash", "set", "nx"].map((s) => db.del(`${NS}:${s}`)),
      );
    });

    test("string, counter and ttl", async () => {
      await db.set(`${NS}:str`, "v1");
      expect(await db.get(`${NS}:str`)).toBe("v1");
      expect(await db.incr(`${NS}:cnt`)).toBe(1);
      await db.expire(`${NS}:cnt`, 60);
    });

    test("send() and builtin methods resolve to the same key", async () => {
      // Regression guard: keys written through the raw send() path must be
      // readable through the builtin methods (and vice versa). ioredis applies
      // keyPrefix to call() as well, so neither path may prefix manually, or
      // they would diverge (e.g. captest:hash vs captest:captest:hash).
      await db.send("HSET", [`${NS}:hash`, "a", "1", "b", "2"]);
      await db.hincrby(`${NS}:hash`, "a", 4);
      expect(await db.hget(`${NS}:hash`, "a")).toBe("5");
      expect((await hgetall(`${NS}:hash`)).b).toBe("2");
      // Read back through the raw path: must see the builtin's increment.
      const raw = await db.send("HGETALL", [`${NS}:hash`]);
      expect(raw).toContain("5");
    });

    test("sets and existence", async () => {
      await db.sadd(`${NS}:set`, "x");
      expect(await db.smembers(`${NS}:set`)).toContain("x");
      await db.srem(`${NS}:set`, "x");
      expect(await db.exists(`${NS}:str`)).toBeTruthy();
      expect(await db.exists(`${NS}:missing`)).toBeFalsy();
    });

    test("SET NX EX is atomic", async () => {
      expect(await db.send("SET", [`${NS}:nx`, "1", "NX", "EX", "30"])).toBe(
        "OK",
      );
      expect(
        await db.send("SET", [`${NS}:nx`, "1", "NX", "EX", "30"]),
      ).toBeNull();
    });
  });
}
