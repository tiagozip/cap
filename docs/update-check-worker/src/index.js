import { noticesFor } from "./notices.js";

const MAX_BODY = 512;
const ANALYTICS = 5;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, ...extra },
  });

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,32})?$/;
const power = (n, base, max) =>
  n === 0 ||
  (Number.isSafeInteger(n) &&
    n <= max &&
    base ** Math.round(Math.log(n) / Math.log(base)) === n);

export const parse = (raw) => {
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{8}$/.test(b?.id ?? "")) return null;
  if (!VERSION.test(b.version ?? "")) return null;
  if (b.runtime !== "bun" && b.runtime !== "workers") return null;
  if (!power(b.keys, 10, 1e12) || !power(b.solves, 10, 1e14)) return null;
  const memory = b.memory ?? null;
  if (memory !== null && (memory === 0 || !power(memory, 2, 2 ** 20)))
    return null;
  if (!/^[A-Za-z0-9_-]{4}$/.test(b.vars ?? "")) return null;
  const [flags, high, low] = Uint8Array.from(
    atob(b.vars.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  if (flags >> 1 >= ANALYTICS) return null;
  const exp = (n) => (n ? Math.round(Math.log10(n)) + 1 : 0);
  return {
    id: b.id,
    version: b.version,
    info:
      flags * 2 ** 16 +
      high * 2 ** 8 +
      low +
      (b.runtime === "workers" ? 2 ** 24 : 0) +
      exp(b.keys) * 2 ** 25 +
      exp(b.solves) * 2 ** 29 +
      (memory ? Math.log2(memory) : 0) * 2 ** 33,
  };
};

async function ping(request, env, ctx) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (ip && env.LIMIT) {
    const { success } = await env.LIMIT.limit({ key: ip });
    if (!success) return json({ error: "rate_limited" }, 429);
  }
  const length = Number(request.headers.get("Content-Length"));
  if (!Number.isSafeInteger(length) || length > MAX_BODY)
    return json({ error: "too_large" }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  const b = parse(raw);
  if (!b) return json({ error: "invalid_body" }, 400);
  await env.DB.prepare(
    `INSERT INTO instances (id, first_seen, last_seen, version, info) VALUES (?1, ?2, ?2, ?3, ?4)
     ON CONFLICT (id) DO UPDATE SET last_seen = excluded.last_seen, version = excluded.version, info = excluded.info
     WHERE excluded.last_seen - instances.last_seen > 43200`,
  )
    .bind(b.id, Math.floor(Date.now() / 1000), b.version, b.info)
    .run();
  return json(await noticesFor(env, ctx, b.version));
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    if (pathname === "/v1/ping" && request.method === "POST")
      return ping(request, env, ctx);
    return json({ error: "not_found" }, 404);
  },
};
