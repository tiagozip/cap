import { RedisClient } from "bun";
import { valkeyOptions, valkeyUrl } from "./config.js";

const redisUrl = valkeyUrl();
const clientOptions = valkeyOptions();
const prefix = process.env.REDIS_PREFIX || "";

let client = new RedisClient(redisUrl, clientOptions);
let reconnecting = null;

try {
  await client.send("PING", []);
} catch (e) {
  console.error(
    `[cap] Couldn't reach Valkey at ${redisUrl.replace(/\/\/[^@/]*@/, "//")}. Set VALKEY_URL to your Valkey server, for example redis://valkey:6379.`,
  );
  throw e;
}

const CONNECTION_ERRORS = new Set([
  "ERR_REDIS_CONNECTION_CLOSED",
  "ERR_REDIS_CONNECTION_TIMEOUT",
]);

const reconnect = () => {
  reconnecting ??= (async () => {
    console.error("[cap] Valkey connection lost, reconnecting");
    for (let delay = 500; ; delay = Math.min(delay * 2, 15000)) {
      const next = new RedisClient(redisUrl, {
        ...clientOptions,
        connectionTimeout: 3000,
      });
      try {
        await next.send("PING", []);
      } catch {
        next.close();
        await Bun.sleep(delay);
        continue;
      }
      try {
        client.close();
      } catch {}
      client = next;
      console.error("[cap] Valkey reconnected");
      return;
    }
  })().finally(() => {
    reconnecting = null;
  });
  return reconnecting;
};

async function withReconnect(run) {
  try {
    return await run();
  } catch (error) {
    if (!CONNECTION_ERRORS.has(error?.code)) throw error;
    await Promise.race([reconnect(), Bun.sleep(4000)]);
    try {
      return await run();
    } catch (retryError) {
      if (CONNECTION_ERRORS.has(retryError?.code)) reconnect();
      throw retryError;
    }
  }
}

const addPrefix = (k) => (typeof k === "string" && k.length ? prefix + k : k);
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
  "hmset",
  "hmget",
  "hgetall",
  "hincrby",
  "hdel",
  "getset",
  "append",
]);

const KEY_ALL = new Set(["del", "unlink", "exists", "mget"]);

const MULTI_KEY_CMDS = new Set(["DEL", "UNLINK", "MGET", "EXISTS"]);

function rawSend(cmd, args = []) {
  return withReconnect(() => client.send(cmd, args));
}

function prefixedSend(cmd, args = []) {
  const upper = cmd.toUpperCase();
  if (upper === "PING" || !args.length) return rawSend(cmd, args);
  if (upper === "KEYS") {
    return rawSend(cmd, [addPrefix(args[0]), ...args.slice(1)]).then((res) =>
      Array.isArray(res) ? res.map(stripPrefix) : res,
    );
  }
  if (MULTI_KEY_CMDS.has(upper)) {
    return rawSend(cmd, args.map(addPrefix));
  }
  return rawSend(cmd, [addPrefix(args[0]), ...args.slice(1)]);
}

const db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "send") return prefix ? prefixedSend : rawSend;
      const value = client[prop];
      if (typeof value !== "function") return value;
      if (prefix && KEY_FIRST.has(prop)) {
        return (...args) => {
          if (args.length) args[0] = addPrefix(args[0]);
          return withReconnect(() => client[prop](...args));
        };
      }
      if (prefix && KEY_ALL.has(prop)) {
        return (...args) =>
          withReconnect(() => client[prop](...args.map(addPrefix)));
      }
      return (...args) => withReconnect(() => client[prop](...args));
    },
  },
);

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

export async function incrWithTtl(key, seconds) {
  const count = await db.incr(key);
  if (count === 1) await db.expire(key, seconds);
  return count;
}

export const sweep = async () => {};
