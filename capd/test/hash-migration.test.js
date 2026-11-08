import { afterAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
let up = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  up = true;
} catch {}

describe.skipIf(!up)("old hash migration", async () => {
  process.env.REDIS_PREFIX = `hashmig:${process.pid}:`;
  const { db } = await import("../src/db.js");
  const { hashSecret, tokenId } = await import("../src/secret-hash.js");
  const { migrateOldHashes } = await import("../src/hash-migration.js");

  afterAll(async () => {
    for (const k of ["keys", "apikeys", "sessions"]) await db.del(k);
    for (const k of ["key:old", "key:new", "apikey:a", "apikey:b"])
      await db.del(k);
  });

  test("reports old secrets and API keys and signs out old sessions", async () => {
    const argon = await Bun.password.hash("x");
    await db.sadd("keys", "old");
    await db.sadd("keys", "new");
    await db.hset("key:old", "secretHash", argon);
    await db.hset("key:new", "secretHash", hashSecret("y"));
    await db.sadd("apikeys", "a");
    await db.sadd("apikeys", "b");
    await db.hset("apikey:a", "tokenHash", argon);
    await db.hset("apikey:b", "tokenHash", hashSecret("z"));
    const current = tokenId("session");
    for (const h of [argon, current]) {
      await db.sadd("sessions", h);
      await db.set(`session:${h}`, "{}");
    }

    const warn = console.warn;
    const lines = [];
    console.warn = (m) => lines.push(m);
    const result = await migrateOldHashes().finally(() => {
      console.warn = warn;
    });

    expect(result).toEqual({ sessions: 1, keys: ["old"], apiKeys: ["a"] });
    expect(await db.smembers("sessions")).toEqual([current]);
    expect(await db.get(`session:${argon}`)).toBeNull();
    const ours = lines.filter((l) => String(l).includes("older release"));
    expect(ours.join("\n")).toContain("old");
    expect(ours).toHaveLength(3);
  });
});
