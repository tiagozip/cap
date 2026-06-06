import { RedisClient } from "bun";

const redisUrl =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://localhost:6379";
const prefix = process.env.REDIS_PREFIX || "";

const client = new RedisClient(redisUrl);

await client.send("PING", []);

const addPrefix = (k) =>
  typeof k === "string" && k.length ? prefix + k : k;
const stripPrefix = (k) =>
  typeof k === "string" && k.startsWith(prefix) ? k.slice(prefix.length) : k;

const KEY_FIRST = new Set([
  "get",
  "getBuffer",
  "getdel",
  "set",
  "incr",
  "decr",
  "expire",
  "ttl",
  "sadd",
  "srem",
  "smembers",
  "scard",
  "sismember",
  "hget",
  "hset",
  "hmget",
  "hgetall",
  "hincrby",
  "hdel",
  "getset",
  "append",
]);

const KEY_ALL = new Set(["del", "unlink", "exists", "mget"]);

const MULTI_KEY_CMDS = new Set(["DEL", "UNLINK", "MGET", "EXISTS"]);

function prefixedSend(cmd, args = []) {
  const upper = cmd.toUpperCase();
  if (upper === "PING" || !args.length) return client.send(cmd, args);
  if (upper === "KEYS") {
    return client
      .send(cmd, [addPrefix(args[0]), ...args.slice(1)])
      .then((res) => (Array.isArray(res) ? res.map(stripPrefix) : res));
  }
  if (MULTI_KEY_CMDS.has(upper)) {
    return client.send(cmd, args.map(addPrefix));
  }
  return client.send(cmd, [addPrefix(args[0]), ...args.slice(1)]);
}

const db = prefix
  ? new Proxy(client, {
      get(target, prop, receiver) {
        if (prop === "send") return prefixedSend;
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        if (KEY_FIRST.has(prop)) {
          return (...args) => {
            if (args.length) args[0] = addPrefix(args[0]);
            return value.apply(target, args);
          };
        }
        if (KEY_ALL.has(prop)) {
          return (...args) => value.apply(target, args.map(addPrefix));
        }
        return value.bind(target);
      },
    })
  : client;

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
