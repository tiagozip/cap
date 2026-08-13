import { RedisClient } from "bun";

const redisUrl =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://localhost:6379";
const prefix = process.env.REDIS_PREFIX || "";

let client = new RedisClient(redisUrl);
let pendingReconnect = null;

await client.send("PING", []);

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

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 60000;
const RECONNECT_ATTEMPT_TIMEOUT_MS = 3000;

function attemptConnect() {
  const next = new RedisClient(redisUrl);
  const ping = next.send("PING", []);
  ping.catch(() => {});
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("redis reconnect attempt timed out")),
      RECONNECT_ATTEMPT_TIMEOUT_MS,
    );
  });
  return Promise.race([ping, timeout])
    .then(
      () => next,
      (error) => {
        next.close();
        throw error;
      },
    )
    .finally(() => clearTimeout(timer));
}

async function runReconnectLoop() {
  let delay = RECONNECT_BASE_DELAY_MS;
  for (;;) {
    try {
      const next = await attemptConnect();
      client.close();
      client = next;
      console.error("[cap] redis reconnected");
      return;
    } catch {
      await Bun.sleep(delay);
      delay = Math.min(delay * 2, RECONNECT_MAX_DELAY_MS);
    }
  }
}

function ensureReconnect() {
  if (!pendingReconnect) {
    console.error("[cap] redis connection lost, reconnecting");
    pendingReconnect = runReconnectLoop().finally(() => {
      pendingReconnect = null;
    });
  }
  return pendingReconnect;
}

function isConnectionError(error) {
  return (
    error?.code === "ERR_REDIS_CONNECTION_CLOSED" ||
    error?.code === "ERR_REDIS_CONNECTION_TIMEOUT"
  );
}

async function withReconnect(run, retried = false) {
  try {
    return await run();
  } catch (error) {
    if (retried || !isConnectionError(error)) throw error;
    const recovery = ensureReconnect();
    if (error.code === "ERR_REDIS_CONNECTION_TIMEOUT") throw error;
    await Promise.race([
      recovery,
      Bun.sleep(RECONNECT_ATTEMPT_TIMEOUT_MS + 500),
    ]);
    return withReconnect(run, true);
  }
}

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
