import { RedisClient } from "bun";

const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL || "redis://localhost:6379";
const db = new RedisClient(redisUrl);

await db.send("PING", []);

export async function hgetall(key) {
  const data = await db.send("HGETALL", [key]);
  if (!data) return {};
  if (typeof data === "object" && !Array.isArray(data)) return data;
  const obj = {};
  for (let i = 0; i < data.length; i += 2) {
    obj[data[i]] = data[i + 1];
  }
  return obj;
}

export { db };
