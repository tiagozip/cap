import Redis from "ioredis";

const prefix = process.env.REDIS_PREFIX || "";
const useCluster = process.env.REDIS_CLUSTER === "true";

// REDIS_URL may hold a comma-separated list of seed nodes in cluster mode.
const rawUrl =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://localhost:6379";

function parseNode(url) {
  const u = new URL(url);
  return { host: u.hostname, port: Number(u.port) || 6379 };
}

function buildClient() {
  if (useCluster) {
    const urls = rawUrl
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const nodes = urls.map(parseNode);
    const seed = new URL(urls[0]);
    return new Redis.Cluster(nodes, {
      enableAutoPipelining: true,
      redisOptions: {
        keyPrefix: prefix,
        username: seed.username || undefined,
        password: seed.password || undefined,
        tls: seed.protocol === "rediss:" ? {} : undefined,
      },
    });
  }
  return new Redis(rawUrl, { keyPrefix: prefix, enableAutoPipelining: true });
}

const client = buildClient();

await client.ping();

const stripPrefix = (k) =>
  typeof k === "string" && k.startsWith(prefix) ? k.slice(prefix.length) : k;

// Raw command escape hatch. ioredis applies keyPrefix to call() too (it knows
// each command's key positions), so keys must NOT be prefixed manually here or
// they would be double-prefixed relative to the builtin methods.
function send(cmd, args = []) {
  if (cmd.toUpperCase() === "KEYS") {
    // ioredis prefixes the pattern but does not strip it from the reply.
    return client
      .call(cmd, ...args)
      .then((res) => (Array.isArray(res) ? res.map(stripPrefix) : res));
  }
  return client.call(cmd, ...args);
}

// ioredis exposes every command as a lowercase method with keyPrefix applied
// automatically, so the client is used directly; only send() needs wrapping.
client.send = send;

const db = client;

export async function hgetall(key) {
  // Builtin method: keyPrefix is applied and the reply is already an object.
  const data = await client.hgetall(key);
  return data || {};
}

export { db };
