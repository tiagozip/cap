import { randomBytes } from "node:crypto";
import { Elysia, t } from "elysia";
import { authBeforeHandle } from "./auth.js";
import { invalidateBlockCache } from "./cap.js";
import { db, hgetall } from "./db.js";
import {
  isDemoMode,
  demoGetKeys,
  demoGetKey,
  demoGetGeoStats,
  demoGetBlockedIps,
} from "./demo.js";
import {
  deleteDB,
  downloadDB,
  getDownloadProgress,
  getStatus as getIPDBStatus
} from "./ipdb.js";
import {
  invalidateCorsCache,
  setCorsDefault,
  setFiltering,
  setHeaders,
  setRatelimit,
} from "./settings-cache.js";

const keyDefaults = {
  difficulty: 4,
  challengeCount: 80,
  saltSize: 32,
  instrumentation: false,
  obfuscationLevel: 3,
  blockAutomatedBrowsers: false,
};

const sumSolutions = (data, startBucket, endBucket) => {
  let sum = 0;
  for (const [bucketStr, countStr] of Object.entries(data)) {
    const bucket = Number(bucketStr);
    const count = Number(countStr);
    if (bucket >= startBucket && (endBucket === undefined || bucket < endBucket)) {
      sum += count;
    }
  }
  return sum;
};

const demoWriteGuard = ({ request, set }) => {
  if (!isDemoMode()) return;
  const method = request.method;
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    return { success: true, demo: true };
  }
};

export const server = new Elysia({
  prefix: "/server",
  detail: {
    security: [
      {
        apiKey: [],
      },
    ],
  },
})
  .onBeforeHandle(isDemoMode() ? () => {} : authBeforeHandle)
  .onBeforeHandle(demoWriteGuard)
  .get(
    "/keys",
    async () => {
      if (isDemoMode()) return demoGetKeys();

      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;

      const currentStart = now - day;
      const previousStart = now - 2 * day;

      const siteKeys = await db.smembers("keys");
      const keys = await Promise.all(
        siteKeys.map(async (sk) => {
          const fields = await db.hmget(`key:${sk}`, ["name", "config", "created"]);
          return {
            siteKey: sk,
            name: fields[0],
            config: fields[1],
            created: Number(fields[2]),
          };
        }),
      );
      keys.sort((a, b) => b.created - a.created);

      return await Promise.all(
        keys.map(async (key) => {
          const data = await hgetall(`metrics:verified:${key.siteKey}`);
          const current = sumSolutions(data, currentStart);
          const previous = sumSolutions(data, previousStart, currentStart);

          let change = 0;
          let direction = "";

          if (previous > 0) {
            change = ((current - previous) / previous) * 100;
            direction = current > previous ? "up" : current < previous ? "down" : "";
          } else if (current > 0) {
            change = 100;
            direction = "up";
          }

          return {
            siteKey: key.siteKey,
            name: key.name,
            created: key.created,
            solvesLast24h: current,
            difference: {
              value: change.toFixed(2),
              direction,
            },
          };
        }),
      );
    },
    {
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .post(
    "/keys",
    async ({ body }) => {
      const siteKey = randomBytes(5).toString("hex");
      const secretKey = `sk-${randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "")}`;
      const jwtSecret = randomBytes(32).toString("base64url");

      const config = {
        ...keyDefaults,
        instrumentation: body?.instrumentation ?? false,
        blockAutomatedBrowsers: body?.blockAutomatedBrowsers ?? false,
      };

      if (body?.corsOrigins && Array.isArray(body.corsOrigins) && body.corsOrigins.length) {
        config.corsOrigins = body.corsOrigins;
      }

      await db.hmset(`key:${siteKey}`, [
        "name",
        body?.name || siteKey,
        "secretHash",
        await Bun.password.hash(secretKey),
        "jwtSecret",
        jwtSecret,
        "config",
        JSON.stringify(config),
        "created",
        String(Date.now()),
      ]);
      await db.sadd("keys", siteKey);

      return {
        siteKey,
        secretKey,
      };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        instrumentation: t.Optional(t.Boolean()),
        blockAutomatedBrowsers: t.Optional(t.Boolean()),
        corsOrigins: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .get(
    "/keys/:siteKey",
    async ({ params, query }) => {
      if (isDemoMode()) {
        const d = demoGetKey(params.siteKey, query.chartDuration || "today");
        return d || { success: false, error: "Key not found" };
      }

      const sk = params.siteKey;
      const keyFields = await db.hmget(`key:${sk}`, ["name", "config", "created"]);

      if (!keyFields[0]) {
        return { success: false, error: "Key not found" };
      }

      const key = {
        siteKey: sk,
        name: keyFields[0],
        config: keyFields[1],
        created: Number(keyFields[2]),
      };

      const chartDuration = query.chartDuration || "today";
      const now = Math.floor(Date.now() / 1000);
      const day = 86400;

      let bucketSize, startTime, endTime;
      switch (chartDuration) {
        case "today":
          bucketSize = 3600;
          startTime = Math.floor(now / day) * day;
          endTime = Math.floor(now / 3600) * 3600 + 3600;
          break;
        case "yesterday":
          bucketSize = 3600;
          startTime = Math.floor(now / day) * day - day;
          endTime = startTime + day;
          break;
        case "last7days":
          bucketSize = day;
          startTime = Math.floor((now - 7 * day) / day) * day;
          endTime = Math.floor(now / day) * day + day;
          break;
        case "last28days":
          bucketSize = day;
          startTime = Math.floor((now - 28 * day) / day) * day;
          endTime = Math.floor(now / day) * day + day;
          break;
        case "last91days":
          bucketSize = day;
          startTime = Math.floor((now - 91 * day) / day) * day;
          endTime = Math.floor(now / day) * day + day;
          break;
        case "alltime":
          bucketSize = day;
          startTime = 0;
          endTime = now + day;
          break;
        default:
          bucketSize = 3600;
          startTime = now - day;
          endTime = now + 3600;
      }

      const periodLen = endTime - startTime;
      let prevStartTime = null, prevEndTime = null;
      if (chartDuration !== "alltime") {
        prevEndTime = startTime;
        prevStartTime = startTime - periodLen;
      }

      const [verifiedH, failedH, ratelimitedH, latSumH, latCountH] = await Promise.all([
        hgetall(`metrics:verified:${sk}`),
        hgetall(`metrics:failed:${sk}`),
        hgetall(`metrics:ratelimited:${sk}`),
        hgetall(`metrics:latency_sum:${sk}`),
        hgetall(`metrics:latency_count:${sk}`),
      ]);

      const sumRange = (hash, start, end) => {
        let s = 0;
        for (const [b, v] of Object.entries(hash)) {
          const bn = Number(b);
          if (bn >= start && (end === undefined || bn < end)) s += Number(v);
        }
        return s;
      };

      const aggregateDaily = (hash, start, end) => {
        const m = new Map();
        for (const [b, v] of Object.entries(hash)) {
          const bn = Number(b);
          if (bn >= start && (end === undefined || bn < end)) {
            const dayB = Math.floor(bn / day) * day;
            m.set(dayB, (m.get(dayB) || 0) + Number(v));
          }
        }
        return m;
      };

      const chartData = [];
      if (bucketSize === day) {
        const veM = aggregateDaily(verifiedH, startTime, endTime);
        const faM = aggregateDaily(failedH, startTime, endTime);
        const rlM = aggregateDaily(ratelimitedH, startTime, endTime);

        const numDays =
          chartDuration === "last7days"
            ? 7
            : chartDuration === "last28days"
              ? 28
              : chartDuration === "last91days"
                ? 91
                : undefined;
        if (numDays) {
          const currentDayStart = Math.floor(now / day) * day;
          for (let i = 0; i < numDays; i++) {
            const b = currentDayStart - (numDays - 1 - i) * day;
            const verified = veM.get(b) || 0;
            const failed = faM.get(b) || 0;
            chartData.push({
              bucket: b,
              challenges: verified + failed,
              verified,
              failed,
              rateLimited: rlM.get(b) || 0,
            });
          }
        } else {
          const allBuckets = new Set([...veM.keys(), ...faM.keys(), ...rlM.keys()]);
          for (const b of [...allBuckets].sort((a, c) => a - c)) {
            const verified = veM.get(b) || 0;
            const failed = faM.get(b) || 0;
            chartData.push({
              bucket: b,
              challenges: verified + failed,
              verified,
              failed,
              rateLimited: rlM.get(b) || 0,
            });
          }
        }
      } else {
        const startHour = Math.floor(startTime / 3600);
        const endHour = Math.floor((endTime - 1) / 3600);
        for (let h = startHour; h <= endHour; h++) {
          const b = h * 3600;
          const bs = String(b);
          const verified = Number(verifiedH[bs] || 0);
          const failed = Number(failedH[bs] || 0);
          chartData.push({
            bucket: b,
            challenges: verified + failed,
            verified,
            failed,
            rateLimited: Number(ratelimitedH[bs] || 0),
          });
        }
      }

      const totalVerified = sumRange(verifiedH, startTime, endTime);
      const totalFailed = sumRange(failedH, startTime, endTime);
      const totalRateLimited = sumRange(ratelimitedH, startTime, endTime);
      const totalLatSum = sumRange(latSumH, startTime, endTime);
      const totalLatCount = sumRange(latCountH, startTime, endTime);
      const avgLatency = totalLatCount > 0 ? Math.round(totalLatSum / totalLatCount) : 0;

      let prevStats = null;
      if (prevStartTime !== null) {
        const pVerified = sumRange(verifiedH, prevStartTime, prevEndTime);
        const pFailed = sumRange(failedH, prevStartTime, prevEndTime);
        const pRateLimited = sumRange(ratelimitedH, prevStartTime, prevEndTime);
        const pLatSum = sumRange(latSumH, prevStartTime, prevEndTime);
        const pLatCount = sumRange(latCountH, prevStartTime, prevEndTime);
        prevStats = {
          challenges: pVerified + pFailed,
          verified: pVerified,
          failed: pFailed,
          avgLatency: pLatCount > 0 ? Math.round(pLatSum / pLatCount) : 0,
          rateLimited: pRateLimited,
        };
      }

      return {
        key: {
          siteKey: key.siteKey,
          name: key.name,
          created: key.created,
          config: JSON.parse(key.config),
        },
        stats: {
          challenges: totalVerified + totalFailed,
          verified: totalVerified,
          failed: totalFailed,
          avgLatency,
          rateLimited: totalRateLimited,
        },
        prevStats,
        chartData: {
          duration: chartDuration,
          bucketSize,
          data: chartData,
        },
      };
    },
    {
      params: t.Object({
        siteKey: t.String(),
      }),
      query: t.Object({
        chartDuration: t.Optional(
          t.Union([
            t.Literal("today"),
            t.Literal("yesterday"),
            t.Literal("last7days"),
            t.Literal("last28days"),
            t.Literal("last91days"),
            t.Literal("alltime"),
          ]),
        ),
      }),
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .put(
    "/keys/:siteKey/config",
    async ({ params, body }) => {
      const configStr = await db.hget(`key:${params.siteKey}`, "config");

      if (!configStr) {
        return { success: false, error: "Key not found" };
      }

      const existingConfig = JSON.parse(configStr);
      const {
        name,
        difficulty,
        challengeCount,
        instrumentation,
        obfuscationLevel,
        blockAutomatedBrowsers,
        ratelimitMax,
        ratelimitDuration,
        corsOrigins,
        blockNonBrowserUA,
        requiredHeaders,
        adaptiveChallengeCount,
      } = body;

      const config = {
        ...keyDefaults,
        ...existingConfig,
        name: name ?? existingConfig.name,
        difficulty: difficulty ?? existingConfig.difficulty,
        challengeCount: challengeCount ?? existingConfig.challengeCount,
        saltSize: 32,
        instrumentation: instrumentation ?? existingConfig.instrumentation ?? false,
        obfuscationLevel: obfuscationLevel ?? existingConfig.obfuscationLevel ?? 3,
        blockAutomatedBrowsers:
          blockAutomatedBrowsers ?? existingConfig.blockAutomatedBrowsers ?? false,
        ratelimitMax:
          ratelimitMax !== undefined ? ratelimitMax : (existingConfig.ratelimitMax ?? null),
        ratelimitDuration:
          ratelimitDuration !== undefined
            ? ratelimitDuration
            : (existingConfig.ratelimitDuration ?? null),
        corsOrigins: corsOrigins !== undefined ? corsOrigins : (existingConfig.corsOrigins ?? null),
        blockNonBrowserUA:
          blockNonBrowserUA !== undefined
            ? blockNonBrowserUA
            : (existingConfig.blockNonBrowserUA ?? null),
        requiredHeaders:
          requiredHeaders !== undefined
            ? requiredHeaders
            : (existingConfig.requiredHeaders ?? null),
        adaptiveChallengeCount:
          adaptiveChallengeCount !== undefined
            ? adaptiveChallengeCount
            : (existingConfig.adaptiveChallengeCount ?? null),
      };

      const currentName = await db.hget(`key:${params.siteKey}`, "name");

      await db.hmset(`key:${params.siteKey}`, [
        "name",
        config.name || currentName,
        "config",
        JSON.stringify(config),
      ]);

      invalidateCorsCache(params.siteKey);

      return { success: true };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 600 })),
        difficulty: t.Optional(t.Number({ minimum: 1, maximum: 8 })),
        challengeCount: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
        instrumentation: t.Optional(t.Boolean()),
        obfuscationLevel: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        blockAutomatedBrowsers: t.Optional(t.Boolean()),
        ratelimitMax: t.Optional(t.Union([t.Number({ minimum: 1, maximum: 10000 }), t.Null()])),
        ratelimitDuration: t.Optional(
          t.Union([t.Number({ minimum: 1000, maximum: 3600000 }), t.Null()]),
        ),
        corsOrigins: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
        blockNonBrowserUA: t.Optional(t.Union([t.Boolean(), t.Null()])),
        requiredHeaders: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
        adaptiveChallengeCount: t.Optional(
          t.Union([
            t.Object({
              enabled: t.Boolean(),
              windowMs: t.Number({ minimum: 60000, maximum: 3600000 }),
              tiers: t.Array(
                t.Object({
                  minRequests: t.Number({ minimum: 1, maximum: 100000 }),
                  challengeCount: t.Number({ minimum: 1, maximum: 500 }),
                }),
                { minItems: 0, maxItems: 20 },
              ),
              globalTiers: t.Optional(
                t.Array(
                  t.Object({
                    minRequests: t.Number({ minimum: 1, maximum: 10000000 }),
                    challengeCount: t.Number({ minimum: 1, maximum: 500 }),
                  }),
                  { minItems: 0, maxItems: 20 },
                ),
              ),
            }),
            t.Null(),
          ]),
        ),
      }),
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .delete(
    "/keys/:siteKey",
    async ({ params, set }) => {
      const exists = await db.exists(`key:${params.siteKey}`);

      if (!exists) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }

      const sk = params.siteKey;
      await Promise.all([
        db.del(`key:${sk}`),
        db.del(`metrics:verified:${sk}`),
        db.del(`metrics:failed:${sk}`),
        db.del(`metrics:ratelimited:${sk}`),
        db.del(`metrics:latency_sum:${sk}`),
        db.del(`metrics:latency_count:${sk}`),
        db.del(`metrics:country:${sk}`),
        db.del(`metrics:asn:${sk}`),
        db.del(`metrics:platform:${sk}`),
        db.del(`metrics:os:${sk}`),
        db.del(`blocked:${sk}`),
        db.srem("keys", sk),
      ]);
      invalidateBlockCache(params.siteKey);

      return { success: true };
    },
    {
      params: t.Object({
        siteKey: t.String(),
      }),
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .post(
    "/keys/:siteKey/rotate-secret",
    async ({ params }) => {
      const exists = await db.exists(`key:${params.siteKey}`);

      if (!exists) {
        return { success: false, error: "Key not found" };
      }

      const newSecretKey = `sk-${randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "")}`;

      await db.hmset(`key:${params.siteKey}`, [
        "secretHash",
        await Bun.password.hash(newSecretKey),
      ]);

      return {
        secretKey: newSecretKey,
      };
    },
    {
      params: t.Object({
        siteKey: t.String(),
      }),
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .get(
    "/keys/:siteKey/geo-stats",
    async ({ params }) => {
      if (isDemoMode()) {
        const d = demoGetGeoStats(params.siteKey);
        return d || { countries: [], totalCountry: 0, asns: [], totalAsn: 0, platforms: [], totalPlatform: 0, oses: [], totalOs: 0 };
      }

      const sk = params.siteKey;
      const [countryData, asnData, platformData, osData] = await Promise.all([
        hgetall(`metrics:country:${sk}`),
        hgetall(`metrics:asn:${sk}`),
        hgetall(`metrics:platform:${sk}`),
        hgetall(`metrics:os:${sk}`),
      ]);

      const countries = Object.entries(countryData)
        .map(([code, count]) => ({ code, count: Number(count) }))
        .sort((a, b) => b.count - a.count);

      const totalCountry = countries.reduce((s, c) => s + c.count, 0);

      const asns = Object.entries(asnData)
        .map(([name, count]) => ({ name, count: Number(count) }))
        .sort((a, b) => b.count - a.count);

      const totalAsn = asns.reduce((s, a) => s + a.count, 0);

      const platforms = Object.entries(platformData)
        .map(([name, count]) => ({ name, count: Number(count) }))
        .sort((a, b) => b.count - a.count);

      const totalPlatform = platforms.reduce((s, p) => s + p.count, 0);

      const oses = Object.entries(osData)
        .map(([name, count]) => ({ name, count: Number(count) }))
        .sort((a, b) => b.count - a.count);

      const totalOs = oses.reduce((s, o) => s + o.count, 0);

      return { countries, totalCountry, asns, totalAsn, platforms, totalPlatform, oses, totalOs };
    },
    {
      params: t.Object({ siteKey: t.String() }),
      detail: { tags: ["Keys"] },
    },
  )
  .post(
    "/keys/:siteKey/block-ip",
    async ({ params, body, set }) => {
      const sk = params.siteKey;
      const exists = await db.exists(`key:${sk}`);
      if (!exists) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }

      const type = body.type || "ip";
      let key;
      if (type === "ip") {
        key = body.ip || body.value;
      } else if (type === "cidr") {
        key = `cidr:${body.value}`;
      } else if (type === "asn") {
        key = `asn:${body.value}`;
      } else if (type === "country") {
        key = `country:${body.value}`;
      } else {
        set.status = 400;
        return { success: false, error: "Invalid block type" };
      }

      if (!key) {
        set.status = 400;
        return { success: false, error: "Missing value" };
      }

      const duration = body.duration || 0;
      const expires = duration === 0 ? "0" : String(Date.now() + duration * 1000);
      await db.send("HSET", [`blocked:${sk}`, key, expires]);
      invalidateBlockCache(sk);

      return { success: true };
    },
    {
      params: t.Object({ siteKey: t.String() }),
      body: t.Object({
        ip: t.Optional(t.String()),
        value: t.Optional(t.String()),
        type: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
      }),
      detail: { tags: ["Keys"] },
    },
  )
  .post(
    "/keys/:siteKey/unblock-ip",
    async ({ params, body, set }) => {
      const sk = params.siteKey;
      const exists = await db.exists(`key:${sk}`);
      if (!exists) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }

      const type = body.type || "ip";
      let key;
      if (type === "ip") {
        key = body.ip || body.value;
      } else if (type === "cidr") {
        key = `cidr:${body.value}`;
      } else if (type === "asn") {
        key = `asn:${body.value}`;
      } else if (type === "country") {
        key = `country:${body.value}`;
      } else {
        key = body.ip;
      }

      if (!key) {
        set.status = 400;
        return { success: false, error: "Missing value" };
      }

      await db.send("HDEL", [`blocked:${sk}`, key]);
      invalidateBlockCache(sk);
      return { success: true };
    },
    {
      params: t.Object({ siteKey: t.String() }),
      body: t.Object({
        ip: t.Optional(t.String()),
        value: t.Optional(t.String()),
        type: t.Optional(t.String()),
      }),
      detail: { tags: ["Keys"] },
    },
  )
  .get(
    "/keys/:siteKey/blocked-ips",
    async ({ params }) => {
      if (isDemoMode()) return demoGetBlockedIps(params.siteKey);

      const sk = params.siteKey;
      const raw = await hgetall(`blocked:${sk}`);
      const now = Date.now();
      const result = [];

      for (const [key, val] of Object.entries(raw)) {
        const permanent = val === "0";
        const expires = permanent ? null : Number(val);

        if (!permanent && expires <= now) {
          await db.send("HDEL", [`blocked:${sk}`, key]);
          continue;
        }

        let type = "ip",
          value = key;
        if (key.startsWith("cidr:")) {
          type = "cidr";
          value = key.slice(5);
        } else if (key.startsWith("asn:")) {
          type = "asn";
          value = key.slice(4);
        } else if (key.startsWith("country:")) {
          type = "country";
          value = key.slice(8);
        }

        result.push({ ip: value, type, permanent, expires });
      }

      return result;
    },
    {
      params: t.Object({ siteKey: t.String() }),
      detail: { tags: ["Keys"] },
    },
  )
  .get(
    "/settings/sessions",
    async () => {
      const hashes = await db.smembers("sessions");
      const sessions = [];
      const stale = [];

      const results = await Promise.all(
        hashes.map(async (hash) => {
          const data = await db.get(`session:${hash}`);
          return { hash, data };
        }),
      );

      for (const { hash, data } of results) {
        if (data) {
          sessions.push({ token: hash, ...JSON.parse(data) });
        } else {
          stale.push(hash);
        }
      }

      if (stale.length > 0) {
        await Promise.all(stale.map((h) => db.srem("sessions", h)));
      }

      return sessions.map((session) => ({
        token: session.token.slice(-14),
        expires: new Date(session.expires).toISOString(),
        created: new Date(session.created).toISOString(),
      }));
    },
    {
      detail: {
        tags: ["Settings"],
      },
    },
  )
  .get(
    "/settings/apikeys",
    async () => {
      const ids = await db.smembers("apikeys");
      const apikeys = await Promise.all(
        ids.map(async (id) => {
          const fields = await db.hmget(`apikey:${id}`, ["name", "created"]);
          return { id, name: fields[0], created: Number(fields[1]) };
        }),
      );

      return apikeys.map((key) => ({
        name: key.name,
        id: key.id,
        created: new Date(key.created).toISOString(),
      }));
    },
    {
      detail: {
        tags: ["Settings"],
      },
    },
  )
  .post(
    "/settings/apikeys",
    async ({ body }) => {
      const id = randomBytes(16).toString("hex");
      const token = randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "");

      const name = body.name;

      await db.hmset(`apikey:${id}`, [
        "name",
        name,
        "tokenHash",
        await Bun.password.hash(token),
        "created",
        String(Date.now()),
      ]);
      await db.sadd("apikeys", id);

      return {
        apiKey: `${id}_${token}`,
      };
    },
    {
      body: t.Object({
        name: t.String(),
      }),
      detail: {
        tags: ["Settings"],
      },
    },
  )
  .delete(
    "/settings/apikeys/:id",
    async ({ params, set }) => {
      const exists = await db.exists(`apikey:${params.id}`);

      if (!exists) {
        set.status = 404;
        return { success: false, error: "API key not found" };
      }

      await db.del(`apikey:${params.id}`);
      await db.srem("apikeys", params.id);

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Settings"],
      },
    },
  )
  .get(
    "/settings/headers",
    async () => {
      const raw = await db.get("settings:headers");
      if (!raw) return { ipHeader: "", countryHeader: "", asnHeader: "" };
      try {
        return JSON.parse(raw);
      } catch {
        return { ipHeader: "", countryHeader: "", asnHeader: "" };
      }
    },
    { detail: { tags: ["Settings"] } },
  )
  .put(
    "/settings/headers",
    async ({ body }) => {
      const newSettings = {
        ipHeader: body.ipHeader || "",
        countryHeader: body.countryHeader || "",
        asnHeader: body.asnHeader || "",
      };
      await db.set("settings:headers", JSON.stringify(newSettings));
      setHeaders(newSettings);
      return { success: true };
    },
    {
      body: t.Object({
        ipHeader: t.Optional(t.String()),
        countryHeader: t.Optional(t.String()),
        asnHeader: t.Optional(t.String()),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .get(
    "/settings/ratelimit",
    async () => {
      const raw = await db.get("settings:ratelimit");
      if (!raw) return { max: 30, duration: 5000 };
      try {
        return JSON.parse(raw);
      } catch {
        return { max: 30, duration: 5000 };
      }
    },
    { detail: { tags: ["Settings"] } },
  )
  .put(
    "/settings/ratelimit",
    async ({ body }) => {
      const newSettings = {
        max: body.max ?? 30,
        duration: body.duration ?? 5000,
      };
      await db.set("settings:ratelimit", JSON.stringify(newSettings));
      setRatelimit(newSettings);
      return { success: true };
    },
    {
      body: t.Object({
        max: t.Optional(t.Number({ minimum: 1, maximum: 10000 })),
        duration: t.Optional(t.Number({ minimum: 1000, maximum: 3600000 })),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .get(
    "/settings/cors",
    async () => {
      const raw = await db.get("settings:cors");
      if (!raw) return { origins: null };
      try {
        return JSON.parse(raw);
      } catch {
        return { origins: null };
      }
    },
    { detail: { tags: ["Settings"] } },
  )
  .put(
    "/settings/cors",
    async ({ body }) => {
      const newSettings = {
        origins: body.origins ?? null,
      };
      await db.set("settings:cors", JSON.stringify(newSettings));
      setCorsDefault(newSettings);
      invalidateCorsCache();
      return { success: true };
    },
    {
      body: t.Object({
        origins: t.Union([t.Array(t.String()), t.Null()]),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .get(
    "/settings/filtering",
    async () => {
      const raw = await db.get("settings:filtering");
      if (!raw) return { blockNonBrowserUA: false, requiredHeaders: [] };
      try {
        return JSON.parse(raw);
      } catch {
        return { blockNonBrowserUA: false, requiredHeaders: [] };
      }
    },
    { detail: { tags: ["Settings"] } },
  )
  .put(
    "/settings/filtering",
    async ({ body }) => {
      const newSettings = {
        blockNonBrowserUA: body.blockNonBrowserUA ?? false,
        requiredHeaders: body.requiredHeaders ?? [],
      };
      await db.set("settings:filtering", JSON.stringify(newSettings));
      setFiltering(newSettings);
      return { success: true };
    },
    {
      body: t.Object({
        blockNonBrowserUA: t.Optional(t.Boolean()),
        requiredHeaders: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .get(
    "/settings/ipdb",
    async () => {
      return { ...getIPDBStatus(), progress: getDownloadProgress() };
    },
    { detail: { tags: ["Settings"] } },
  )
  .post(
    "/settings/ipdb/download",
    async ({ body, set }) => {
      const progress = getDownloadProgress();
      if (progress.active) {
        set.status = 409;
        return { success: false, error: "Download already in progress" };
      }
      const mode = body.mode;
      if (!["dbip", "maxmind", "ipinfo"].includes(mode)) {
        set.status = 400;
        return { success: false, error: "Invalid mode" };
      }
      if (mode === "maxmind" && !body.maxmindKey) {
        set.status = 400;
        return { success: false, error: "MaxMind license key required" };
      }
      if (mode === "ipinfo" && !body.ipinfoToken) {
        set.status = 400;
        return { success: false, error: "IPInfo token required" };
      }
      downloadDB(mode, {
        maxmindKey: body.maxmindKey,
        ipinfoToken: body.ipinfoToken,
      }).catch((e) => {
        console.error("[cap] IP DB download failed:", e.message);
      });
      return { success: true };
    },
    {
      body: t.Object({
        mode: t.String(),
        maxmindKey: t.Optional(t.String()),
        ipinfoToken: t.Optional(t.String()),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .get("/settings/ipdb/progress", () => getDownloadProgress(), {
    detail: { tags: ["Settings"] },
  })
  .delete(
    "/settings/ipdb",
    async () => {
      await deleteDB();
      return { success: true };
    },
    { detail: { tags: ["Settings"] } },
  )
  .get(
    "/about",
    async () => {
      const pkg = await import("../package.json", { assert: { type: "json" } });

      return {
        bun: Bun.version,
        ver: pkg.default.version,
        demo: isDemoMode(),
      };
    },
    {},
  )
  .post(
    "/logout",
    async ({ body, headers, set }) => {
      const { authorization } = headers;
      if (!authorization) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const { hash } = JSON.parse(atob(authorization.replace("Bearer ", "").trim()));

      let session = hash;

      if (body.session) {
        if (body.session.length < 10) {
          return { success: false, error: "Session code too short" };
        }

        const allHashes = await db.smembers("sessions");
        const match = allHashes.find((h) => h.endsWith(body.session));

        if (!match) {
          set.status = 404;
          return { success: false, error: "Session not found" };
        }

        session = match;
      }

      await db.del(`session:${session}`);
      await db.srem("sessions", session);

      return { success: true };
    },
    {
      body: t.Optional(
        t.Object({
          session: t.Optional(t.String()),
        }),
      ),
      detail: {
        tags: ["Settings"],
      },
    },
  );
