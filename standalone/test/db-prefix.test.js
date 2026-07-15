import { afterAll, expect, test } from "bun:test";
import { RedisClient } from "bun";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";
const prefix = `cap-prefix-test:${crypto.randomUUID()}:`;
const key = "key:metadata";

process.env.REDIS_URL = REDIS_URL;
process.env.REDIS_PREFIX = prefix;

const raw = new RedisClient(REDIS_URL);
await raw.send("PING", []);

const { db } = await import("../src/db.js");

afterAll(async () => {
  await raw.send("DEL", [`${prefix}${key}`]);
  raw.close();
});

test("prefixes hmset key metadata", async () => {
  await db.hmset(key, ["name", "Example", "created", "1"]);

  await expect(db.hmget(key, ["name", "created"])).resolves.toEqual([
    "Example",
    "1",
  ]);
  await expect(raw.exists(`${prefix}${key}`)).resolves.toBe(true);
});
