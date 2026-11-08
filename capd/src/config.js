import { readFileSync } from "node:fs";

const warned = new Set();

export function deprecated(name, message) {
  if (warned.has(name)) return;
  warned.add(name);
  console.warn(`[cap] ${message}`);
}

export const resetDeprecations = () => warned.clear();

export function parseClickhouseUrl(raw) {
  const match = /^(https?):\/\/(.+)$/i.exec(String(raw ?? "").trim());
  if (!match)
    throw new Error("CLICKHOUSE_URL must start with http:// or https://");
  const [, scheme, rest] = match;
  const at = rest.lastIndexOf("@");
  const userinfo = at === -1 ? null : rest.slice(0, at);
  const location = at === -1 ? rest : rest.slice(at + 1);
  const slash = location.search(/[/?#]/);
  const host = slash === -1 ? location : location.slice(0, slash);
  const path = slash === -1 ? "" : location.slice(slash);
  let origin;
  try {
    origin = new URL(`${scheme.toLowerCase()}://${host}`).origin;
  } catch {
    throw new Error(`CLICKHOUSE_URL has an invalid host: ${host}`);
  }
  const colon = userinfo?.indexOf(":") ?? -1;
  const user = colon === -1 ? userinfo : userinfo.slice(0, colon);
  const password = colon === -1 ? null : userinfo.slice(colon + 1);
  const database = /^\/([^/?#]+)/.exec(path)?.[1] ?? null;
  return { url: origin, user: user || null, password, database };
}

export function clickhouseConfig(env = process.env) {
  if (!env.CLICKHOUSE_URL) return null;
  const parsed = parseClickhouseUrl(env.CLICKHOUSE_URL);
  return {
    url: parsed.url,
    user: parsed.user ?? "default",
    password: parsed.password ?? "",
    database: parsed.database ?? "cap",
  };
}

export const valkeyUrl = (env = process.env) =>
  env.VALKEY_URL || env.REDIS_URL || "redis://localhost:6379";

export function valkeyOptions(env = process.env) {
  const files = {
    ca: env.VALKEY_TLS_CA,
    cert: env.VALKEY_TLS_CERT,
    key: env.VALKEY_TLS_KEY,
  };
  const tls = {};
  for (const [name, path] of Object.entries(files)) {
    if (!path) continue;
    try {
      tls[name] = readFileSync(path, "utf8");
    } catch (e) {
      throw new Error(
        `VALKEY_TLS_${name.toUpperCase()} points at ${path}, which Cap can't read: ${e.message}`,
      );
    }
  }
  if (!Object.keys(tls).length) return {};
  if (!/^rediss:\/\//i.test(valkeyUrl(env)))
    console.warn(
      "[cap] VALKEY_TLS_* is set but VALKEY_URL doesn't start with rediss://, so Cap connects over TLS anyway.",
    );
  return { tls };
}
