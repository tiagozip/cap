import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Elysia, t } from "elysia";
import { db } from "./db.js";
import valkeyRateLimit from "./ratelimit.js";
import { servePage } from "./static.js";
import { chartDurations, geoStats, keyStats } from "./stats.js";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export async function createShare(siteKey, { name, expiresIn } = {}) {
  let token, tokenHash, id;
  do {
    token = randomBytes(24).toString("base64url");
    tokenHash = hashToken(token);
    id = tokenHash.slice(0, 16);
  } while (await db.exists(`share:${id}`));
  const created = Date.now();
  const expires = expiresIn ? created + expiresIn * 1000 : 0;

  await db.sadd(`shares:${siteKey}`, id);
  await db.hmset(`share:${id}`, [
    "siteKey",
    siteKey,
    "tokenHash",
    tokenHash,
    "name",
    name?.trim() || "",
    "created",
    String(created),
    "expires",
    String(expires),
  ]);
  if (expires) await db.expire(`share:${id}`, Math.ceil(expiresIn));

  return {
    id,
    token,
    name: name?.trim() || "",
    created,
    expires: expires || null,
  };
}

export async function listShares(siteKey) {
  const ids = await db.smembers(`shares:${siteKey}`);
  const shares = [];
  const stale = [];
  for (const id of ids) {
    const fields = await db.hmget(`share:${id}`, [
      "name",
      "created",
      "expires",
    ]);
    if (!fields?.[1]) {
      stale.push(id);
      continue;
    }
    const expires = Number(fields[2]);
    if (expires && expires <= Date.now()) {
      stale.push(id);
      continue;
    }
    shares.push({
      id,
      name: fields[0] || "",
      created: Number(fields[1]),
      expires: expires || null,
    });
  }
  if (stale.length) {
    await Promise.all(stale.map((id) => db.srem(`shares:${siteKey}`, id)));
  }
  return shares.sort((a, b) => b.created - a.created);
}

export async function revokeShare(siteKey, id) {
  const owner = await db.hget(`share:${id}`, "siteKey");
  if (owner !== siteKey) return false;
  await db.srem(`shares:${siteKey}`, id);
  await db.del(`share:${id}`);
  return true;
}

export async function deleteSharesForKey(siteKey) {
  const ids = await db.smembers(`shares:${siteKey}`);
  await Promise.all([
    ...ids.map((id) => db.del(`share:${id}`)),
    db.del(`shares:${siteKey}`),
  ]);
}

const resolveShare = async (token) => {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const id = tokenHash.slice(0, 16);
  const fields = await db.hmget(`share:${id}`, [
    "siteKey",
    "tokenHash",
    "expires",
    "name",
  ]);
  if (!fields?.[1]) return null;
  const expected = Buffer.from(tokenHash);
  const stored = Buffer.from(fields[1]);
  if (expected.length !== stored.length || !timingSafeEqual(expected, stored))
    return null;
  const expires = Number(fields[2]);
  if (expires && expires <= Date.now()) return null;
  if (!(await db.exists(`key:${fields[0]}`))) return null;
  return {
    siteKey: fields[0],
    name: fields[3]?.trim() || "Shared stats",
    expires: expires || null,
  };
};

const cacheTtl = 10_000;
const cacheMax = 500;
const statsCache = new Map();

const cached = (key, run) => {
  const now = Date.now();
  const hit = statsCache.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (statsCache.size >= cacheMax) {
    for (const [k, entry] of statsCache) {
      if (entry.expires <= now) statsCache.delete(k);
    }
    if (statsCache.size >= cacheMax) statsCache.clear();
  }
  const value = run().catch((error) => {
    statsCache.delete(key);
    throw error;
  });
  statsCache.set(key, { value, expires: now + cacheTtl });
  return value;
};

const publicShare = ({ siteKey, ...share }) => share;

const notFound = (set) => {
  set.status = 404;
  return { success: false, error: "Share link not found or expired" };
};

export const shareServer = new Elysia({
  prefix: "/share",
  detail: { tags: ["Share"] },
})
  .use(
    valkeyRateLimit({
      duration: 10_000,
      max: 30,
    }),
  )
  .onBeforeHandle(({ set }) => {
    set.headers["X-Content-Type-Options"] = "nosniff";
  })
  .get(
    "/",
    ({ request, redirect, set }) => {
      if (new URL(request.url).pathname.endsWith("/"))
        return redirect("/share");
      return servePage("share.html", set);
    },
    { detail: { hide: true } },
  )
  .get(
    "/:token",
    async ({ params, query, set }) => {
      const share = await resolveShare(params.token);
      if (!share) return notFound(set);
      const duration = query.chartDuration || "today";
      return {
        ...publicShare(share),
        ...(await cached(`stats:${share.siteKey}:${duration}`, () =>
          keyStats(share.siteKey, duration),
        )),
      };
    },
    {
      params: t.Object({ token: t.String() }),
      query: t.Object({
        chartDuration: t.Optional(
          t.Union(chartDurations.map((d) => t.Literal(d))),
        ),
      }),
    },
  )
  .get(
    "/:token/geo-stats",
    async ({ params, set }) => {
      const share = await resolveShare(params.token);
      if (!share) return notFound(set);
      return cached(`geo:${share.siteKey}`, () => geoStats(share.siteKey));
    },
    {
      params: t.Object({ token: t.String() }),
    },
  );
