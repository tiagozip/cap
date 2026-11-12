import { randomBytes } from "node:crypto";
import { Elysia, t } from "elysia";
import { db } from "#db";
import {
  deleteDB,
  downloadDB,
  getDownloadProgress,
  getStatus as getIPDBStatus,
  ipdbUnsupported,
} from "#ipdb";
import { runtime, runtimeVersion } from "#platform";
import {
  assetStatus,
  latestVersions,
  refreshAssets,
  saveAssetSettings,
} from "./assets.js";
import { authBeforeHandle } from "./auth.js";
import { invalidateKeyCache, resolveProtocol } from "./cap.js";
import {
  legacyGeoStats,
  legacyKeyStats,
  solvesByKey,
} from "./events/analytics.js";
import { getStore } from "./events/index.js";
import { scopeGuard } from "./guards.js";
import {
  addItems,
  deleteList,
  ensureKeyBlocklist,
  getList,
  keyBlocklistId,
  legacyEntry,
  removeItems,
} from "./policy/lists.js";
import { ensureBlocklistRule, invalidateRules } from "./policy/rules.js";
import { cleanAgentActions, cleanSignalActions } from "./policy/signals.js";
import {
  DEFAULT_PROXY_HEADER,
  headerMatches,
  PROXY_MODES,
  proxyAuthSettings,
  rotateProxySecret,
  saveProxyAuth,
  validProxyHeader,
} from "./proxy-auth.js";
import { openSecret, sealSecret } from "./secret-box.js";
import { hashSecret, isCurrentHash } from "./secret-hash.js";
import {
  invalidateCorsCache,
  setCorsDefault,
  setFiltering,
  setHeaders,
  setRatelimit,
} from "./settings-cache.js";
import {
  createShare,
  deleteSharesForKey,
  listShares,
  revokeShare,
} from "./share.js";

const keyDefaults = {
  difficulty: 4,
  challengeCount: 80,
  saltSize: 32,
  instrumentation: true,
  obfuscationLevel: 5,
  blockAutomatedBrowsers: false,
  detectAutomatedInteractions: false,
  blockAutomatedInteractions: false,
  behavior: "off",
  blockAgents: "off",
  allowVerifiedAgents: false,
  protocol: "hashwx",
  hashwxDifficulty: 1_000_000,
  sha256Fallback: false,
  signalActions: {},
  agentActions: {},
  behaviorThreshold: null,
  behaviorStrict: false,
  requireInteraction: false,
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
  .onBeforeHandle(authBeforeHandle)
  .onBeforeHandle(scopeGuard)
  .get(
    "/keys",
    async ({ scope }) => {
      const siteKeys = (await db.smembers("keys")).filter(
        (sk) => !scope?.siteKeys || scope.siteKeys.includes(sk),
      );
      const keys = await Promise.all(
        siteKeys.map(async (sk) => {
          const fields = await db.hmget(`key:${sk}`, [
            "name",
            "config",
            "created",
            "secretHash",
          ]);
          return {
            siteKey: sk,
            name: fields[0],
            config: fields[1],
            created: Number(fields[2]),
            secretOutdated: !!fields[3] && !isCurrentHash(fields[3]),
          };
        }),
      );
      keys.sort((a, b) => b.created - a.created);

      const counts = await solvesByKey(keys.map((k) => k.siteKey));
      return keys.map((key) => {
        const { current = 0, previous = 0 } = counts[key.siteKey] ?? {};
        const change =
          previous > 0
            ? ((current - previous) / previous) * 100
            : current > 0
              ? 100
              : 0;
        return {
          siteKey: key.siteKey,
          name: key.name,
          created: key.created,
          ...(key.secretOutdated && { secretOutdated: true }),
          solvesLast24h: current,
          difference: {
            value: change.toFixed(2),
            direction:
              current > previous ? "up" : current < previous ? "down" : "",
          },
        };
      });
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
      const sealed = sealSecret(siteKey, secretKey);

      const config = {
        ...keyDefaults,
        instrumentation: body?.instrumentation ?? true,
        blockAutomatedBrowsers: body?.blockAutomatedBrowsers ?? false,
        detectAutomatedInteractions: body?.detectAutomatedInteractions ?? false,
        blockAutomatedInteractions: body?.blockAutomatedInteractions ?? false,
        behavior: body?.behavior ?? keyDefaults.behavior,
        blockAgents: body?.blockAgents ?? keyDefaults.blockAgents,
        allowVerifiedAgents:
          body?.allowVerifiedAgents ?? keyDefaults.allowVerifiedAgents,
        protocol: body?.protocol ?? keyDefaults.protocol,
        hashwxDifficulty:
          body?.hashwxDifficulty ?? keyDefaults.hashwxDifficulty,
        sha256Fallback: body?.sha256Fallback ?? keyDefaults.sha256Fallback,
      };

      if (
        body?.corsOrigins &&
        Array.isArray(body.corsOrigins) &&
        body.corsOrigins.length
      ) {
        config.corsOrigins = body.corsOrigins;
      }

      await db.hmset(`key:${siteKey}`, [
        "name",
        body?.name || siteKey,
        "secretHash",
        hashSecret(secretKey),
        ...(sealed ? ["secretEnc", sealed] : []),
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
        detectAutomatedInteractions: t.Optional(t.Boolean()),
        blockAutomatedInteractions: t.Optional(t.Boolean()),
        behavior: t.Optional(
          t.Union([t.Literal("off"), t.Literal("report"), t.Literal("block")]),
        ),
        blockAgents: t.Optional(
          t.Union([
            t.Literal("off"),
            t.Literal("identified"),
            t.Literal("all"),
          ]),
        ),
        allowVerifiedAgents: t.Optional(t.Boolean()),
        corsOrigins: t.Optional(t.Array(t.String())),
        protocol: t.Optional(
          t.Union([t.Literal("sha256-pow"), t.Literal("hashwx")]),
        ),
        hashwxDifficulty: t.Optional(
          t.Number({ minimum: 50000, maximum: 5000000 }),
        ),
        sha256Fallback: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Keys"],
      },
    },
  )
  .get(
    "/keys/:siteKey",
    async ({ params, query, set }) => {
      const sk = params.siteKey;
      const keyFields = await db.hmget(`key:${sk}`, [
        "name",
        "config",
        "created",
        "secretHash",
      ]);

      if (!keyFields[0]) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }

      const key = {
        siteKey: sk,
        name: keyFields[0],
        config: keyFields[1],
        created: Number(keyFields[2]),
      };

      const chartDuration = query.chartDuration || "today";

      return {
        key: {
          siteKey: key.siteKey,
          name: key.name,
          created: key.created,
          config: JSON.parse(key.config),
          ...(keyFields[3] &&
            !isCurrentHash(keyFields[3]) && { secretOutdated: true }),
        },
        ...(await legacyKeyStats(sk, chartDuration)),
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
    async ({ params, body, set }) => {
      const configStr = await db.hget(`key:${params.siteKey}`, "config");

      if (!configStr) {
        set.status = 404;
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
        detectAutomatedInteractions,
        blockAutomatedInteractions,
        behavior,
        blockAgents,
        allowVerifiedAgents,
        ratelimitMax,
        ratelimitDuration,
        corsOrigins,
        blockNonBrowserUA,
        requiredHeaders,
        protocol,
        hashwxDifficulty,
        sha256Fallback,
        signalActions,
        agentActions,
        behaviorThreshold,
        behaviorStrict,
        requireInteraction,
      } = body;

      const config = {
        ...keyDefaults,
        ...existingConfig,
        name: name ?? existingConfig.name,
        difficulty: difficulty ?? existingConfig.difficulty,
        challengeCount: challengeCount ?? existingConfig.challengeCount,
        saltSize: 32,
        instrumentation:
          instrumentation ?? existingConfig.instrumentation ?? true,
        obfuscationLevel:
          obfuscationLevel ?? existingConfig.obfuscationLevel ?? 3,
        blockAutomatedBrowsers:
          blockAutomatedBrowsers ??
          existingConfig.blockAutomatedBrowsers ??
          false,
        detectAutomatedInteractions:
          detectAutomatedInteractions ??
          existingConfig.detectAutomatedInteractions ??
          false,
        blockAutomatedInteractions:
          blockAutomatedInteractions ??
          existingConfig.blockAutomatedInteractions ??
          false,
        behavior: behavior ?? existingConfig.behavior ?? "off",
        blockAgents: blockAgents ?? existingConfig.blockAgents ?? "off",
        allowVerifiedAgents:
          allowVerifiedAgents ?? existingConfig.allowVerifiedAgents ?? false,
        ratelimitMax:
          ratelimitMax !== undefined
            ? ratelimitMax
            : (existingConfig.ratelimitMax ?? null),
        ratelimitDuration:
          ratelimitDuration !== undefined
            ? ratelimitDuration
            : (existingConfig.ratelimitDuration ?? null),
        corsOrigins:
          corsOrigins !== undefined
            ? corsOrigins
            : (existingConfig.corsOrigins ?? null),
        blockNonBrowserUA:
          blockNonBrowserUA !== undefined
            ? blockNonBrowserUA
            : (existingConfig.blockNonBrowserUA ?? null),
        requiredHeaders:
          requiredHeaders !== undefined
            ? requiredHeaders
            : (existingConfig.requiredHeaders ?? null),
        protocol: protocol ?? resolveProtocol(existingConfig),
        hashwxDifficulty:
          hashwxDifficulty ??
          existingConfig.hashwxDifficulty ??
          keyDefaults.hashwxDifficulty,
        sha256Fallback:
          sha256Fallback ?? existingConfig.sha256Fallback ?? false,
        signalActions:
          signalActions !== undefined
            ? cleanSignalActions(signalActions)
            : (existingConfig.signalActions ?? {}),
        agentActions:
          agentActions !== undefined
            ? cleanAgentActions(agentActions)
            : (existingConfig.agentActions ?? {}),
        behaviorThreshold:
          behaviorThreshold !== undefined
            ? behaviorThreshold
            : (existingConfig.behaviorThreshold ?? null),
        behaviorStrict:
          behaviorStrict ?? existingConfig.behaviorStrict ?? false,
        requireInteraction:
          requireInteraction ?? existingConfig.requireInteraction ?? false,
      };

      const currentName = await db.hget(`key:${params.siteKey}`, "name");

      await db.hmset(`key:${params.siteKey}`, [
        "name",
        config.name || currentName,
        "config",
        JSON.stringify(config),
      ]);

      invalidateCorsCache(params.siteKey);
      invalidateKeyCache(params.siteKey);

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
        detectAutomatedInteractions: t.Optional(t.Boolean()),
        blockAutomatedInteractions: t.Optional(t.Boolean()),
        behavior: t.Optional(
          t.Union([t.Literal("off"), t.Literal("report"), t.Literal("block")]),
        ),
        blockAgents: t.Optional(
          t.Union([
            t.Literal("off"),
            t.Literal("identified"),
            t.Literal("all"),
          ]),
        ),
        allowVerifiedAgents: t.Optional(t.Boolean()),
        ratelimitMax: t.Optional(
          t.Union([t.Number({ minimum: 1, maximum: 10000 }), t.Null()]),
        ),
        ratelimitDuration: t.Optional(
          t.Union([t.Number({ minimum: 1000, maximum: 3600000 }), t.Null()]),
        ),
        corsOrigins: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
        blockNonBrowserUA: t.Optional(t.Union([t.Boolean(), t.Null()])),
        requiredHeaders: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
        protocol: t.Optional(
          t.Union([t.Literal("sha256-pow"), t.Literal("hashwx")]),
        ),
        hashwxDifficulty: t.Optional(
          t.Number({ minimum: 50000, maximum: 5000000 }),
        ),
        sha256Fallback: t.Optional(t.Boolean()),
        signalActions: t.Optional(t.Record(t.String(), t.String())),
        agentActions: t.Optional(t.Record(t.String(), t.String())),
        behaviorThreshold: t.Optional(
          t.Union([t.Number({ minimum: 0.1, maximum: 1 }), t.Null()]),
        ),
        behaviorStrict: t.Optional(t.Boolean()),
        requireInteraction: t.Optional(t.Boolean()),
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
        db.del(`rules:${sk}`),
        db.del(`webhooks:${sk}`),
        deleteList(keyBlocklistId(sk)),
        db.srem("keys", sk),
        deleteSharesForKey(sk),
        getStore().deleteSite(sk),
      ]);
      invalidateRules(sk);
      invalidateKeyCache(params.siteKey);

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
    async ({ params, scope, set }) => {
      set.headers["cache-control"] = "no-store";
      if (scope?.siteKeys || scope?.readonly) {
        set.status = 403;
        return {
          success: false,
          error:
            "Only admin sessions and unscoped API keys with write access can reset secrets.",
        };
      }
      const exists = await db.exists(`key:${params.siteKey}`);

      if (!exists) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }

      const newSecretKey = `sk-${randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "")}`;

      const sealed = sealSecret(params.siteKey, newSecretKey);
      await db.hmset(`key:${params.siteKey}`, [
        "secretHash",
        hashSecret(newSecretKey),
        ...(sealed ? ["secretEnc", sealed] : []),
      ]);
      if (!sealed) await db.hdel(`key:${params.siteKey}`, "secretEnc");

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
    "/keys/:siteKey/secret",
    async ({ params, scope, set }) => {
      set.headers["cache-control"] = "no-store";
      if (scope?.siteKeys || scope?.readonly) {
        set.status = 403;
        return {
          success: false,
          error:
            "Only admin sessions and unscoped API keys with write access can reveal secrets.",
        };
      }
      const [secretHash, sealed] = await db.hmget(`key:${params.siteKey}`, [
        "secretHash",
        "secretEnc",
      ]);
      if (!secretHash) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }
      const secretKey = sealed ? openSecret(params.siteKey, sealed) : null;
      if (!secretKey) {
        set.status = 409;
        return {
          success: false,
          error:
            "Cap can't show this secret. Reset it to get one you can reveal.",
        };
      }
      return { secretKey };
    },
    {
      params: t.Object({ siteKey: t.String() }),
      detail: {
        tags: ["Keys"],
        description:
          "Returns the secret key. Needs an admin session or an unscoped API key that isn't read-only.",
      },
    },
  )
  .get(
    "/keys/:siteKey/geo-stats",
    async ({ params }) => {
      return legacyGeoStats(params.siteKey);
    },
    {
      params: t.Object({ siteKey: t.String() }),
      detail: { tags: ["Keys"] },
    },
  )
  .get(
    "/keys/:siteKey/shares",
    async ({ params, set }) => {
      if (!(await db.exists(`key:${params.siteKey}`))) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }
      return listShares(params.siteKey);
    },
    {
      params: t.Object({ siteKey: t.String() }),
      detail: { tags: ["Keys"] },
    },
  )
  .post(
    "/keys/:siteKey/shares",
    async ({ params, body, set }) => {
      if (!(await db.exists(`key:${params.siteKey}`))) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }
      return createShare(params.siteKey, body);
    },
    {
      params: t.Object({ siteKey: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 64 })),
        expiresIn: t.Optional(t.Number({ minimum: 0, maximum: 315_360_000 })),
      }),
      detail: { tags: ["Keys"] },
    },
  )
  .delete(
    "/keys/:siteKey/shares/:id",
    async ({ params, set }) => {
      if (!(await revokeShare(params.siteKey, params.id))) {
        set.status = 404;
        return { success: false, error: "Share link not found" };
      }
      return { success: true };
    },
    {
      params: t.Object({ siteKey: t.String(), id: t.String() }),
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

      const value = body.ip || body.value;
      if (!value) {
        set.status = 400;
        return { success: false, error: "Missing value" };
      }
      if (!["ip", "cidr", "asn", "country"].includes(body.type || "ip")) {
        set.status = 400;
        return { success: false, error: "Invalid block type" };
      }
      const [kind, v] = legacyEntry(body.type || "ip", value);
      const listId = await ensureKeyBlocklist(sk);
      await ensureBlocklistRule(sk);
      const res = await addItems(listId, [
        { kind, value: v, ttl: body.duration || 0 },
      ]);
      if (!res.added) {
        set.status = 400;
        return { success: false, error: "Invalid value" };
      }

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

      const value = body.ip || body.value;
      if (!value) {
        set.status = 400;
        return { success: false, error: "Missing value" };
      }
      const [kind, v] = legacyEntry(body.type || "ip", value);
      await removeItems(keyBlocklistId(sk), [{ kind, value: v }]);
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
      const list = await getList(keyBlocklistId(params.siteKey));
      const result = (list?.items ?? []).map((item) => ({
        ip: item.value,
        type: item.kind === "org" ? "asn" : item.kind,
        permanent: !item.expires,
        expires: item.expires,
      }));
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
        if (data && /^[0-9a-f]{64}$/.test(hash)) {
          sessions.push({ token: hash, ...JSON.parse(data) });
        } else {
          stale.push(hash);
        }
      }

      if (stale.length > 0) {
        await Promise.all(
          stale.flatMap((h) => [
            db.srem("sessions", h),
            db.del(`session:${h}`),
          ]),
        );
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
          const fields = await db.hmget(`apikey:${id}`, [
            "name",
            "created",
            "siteKeys",
            "readonly",
            "tokenHash",
          ]);
          return {
            id,
            name: fields[0],
            created: Number(fields[1]),
            siteKeys: fields[2] ? JSON.parse(fields[2]) : null,
            readonly: fields[3] === "true",
            outdated: !!fields[4] && !isCurrentHash(fields[4]),
          };
        }),
      );

      return apikeys
        .sort((a, b) => b.created - a.created)
        .map((key) => ({
          name: key.name,
          id: key.id,
          created: new Date(key.created).toISOString(),
          siteKeys: key.siteKeys,
          readonly: key.readonly,
          ...(key.outdated && { outdated: true }),
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
    async ({ body, set }) => {
      const siteKeys = [...new Set(body.siteKeys || [])];
      for (const sk of siteKeys) {
        if (!(await db.exists(`key:${sk}`))) {
          set.status = 400;
          return { success: false, error: `Unknown site key: ${sk}` };
        }
      }

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
        hashSecret(token),
        "created",
        String(Date.now()),
        ...(siteKeys.length ? ["siteKeys", JSON.stringify(siteKeys)] : []),
        ...(body.readonly ? ["readonly", "true"] : []),
      ]);
      await db.sadd("apikeys", id);

      return {
        apiKey: `${id}_${token}`,
      };
    },
    {
      body: t.Object({
        name: t.String(),
        siteKeys: t.Optional(t.Array(t.String())),
        readonly: t.Optional(t.Boolean()),
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
    "/settings/proxy-auth",
    async ({ request }) => {
      const { mode, header, secretHash } = await proxyAuthSettings();
      return {
        mode,
        header,
        hasSecret: !!secretHash,
        requestPasses: headerMatches(request, header, secretHash),
      };
    },
    { detail: { tags: ["Settings"] } },
  )
  .put(
    "/settings/proxy-auth",
    async ({ body, request, scope, set }) => {
      if (scope) {
        set.status = 403;
        return {
          success: false,
          error: "Only admin sessions can change proxy sign-in.",
        };
      }
      const header = body.header?.trim() || DEFAULT_PROXY_HEADER;
      if (!validProxyHeader(header)) {
        set.status = 422;
        return {
          success: false,
          error:
            "Use a header name made of letters, digits and dashes that isn't a standard header, such as X-Cap-Proxy-Secret.",
        };
      }
      const { secretHash } = await proxyAuthSettings();
      if (body.mode !== "off" && !secretHash) {
        set.status = 409;
        return {
          success: false,
          error: "Generate a proxy secret before turning proxy sign-in on.",
        };
      }
      if (
        body.mode === "require" &&
        !headerMatches(request, header, secretHash)
      ) {
        set.status = 409;
        return {
          success: false,
          error: `This request didn't carry a valid ${header} header, so proxy-only sign-in would lock you out. Open the dashboard through your proxy, then try again.`,
        };
      }
      await saveProxyAuth({ mode: body.mode, header });
      return { success: true };
    },
    {
      body: t.Object({
        mode: t.Union(PROXY_MODES.map((m) => t.Literal(m))),
        header: t.Optional(t.String({ maxLength: 64 })),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .post(
    "/settings/proxy-auth/secret",
    async ({ scope, set }) => {
      if (scope) {
        set.status = 403;
        return {
          success: false,
          error: "Only admin sessions can change proxy sign-in.",
        };
      }
      if ((await proxyAuthSettings()).mode === "require") {
        set.status = 409;
        return {
          success: false,
          error:
            "A new secret would lock everyone out while proxy-only sign-in is on. Switch to allowing the admin key too, generate the secret, update your proxy, then switch back.",
        };
      }
      return { success: true, secret: await rotateProxySecret() };
    },
    { detail: { tags: ["Settings"] } },
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
      if (ipdbUnsupported) {
        set.status = 400;
        return { success: false, error: ipdbUnsupported };
      }
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
      if (mode === "maxmind" && (!body.maxmindAccountId || !body.maxmindKey)) {
        set.status = 400;
        return {
          success: false,
          error: "MaxMind account ID and license key required",
        };
      }
      if (mode === "ipinfo" && !body.ipinfoToken) {
        set.status = 400;
        return { success: false, error: "IPInfo token required" };
      }
      downloadDB(mode, {
        maxmindAccountId: body.maxmindAccountId,
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
        maxmindAccountId: t.Optional(t.String()),
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
    async ({ set }) => {
      if (ipdbUnsupported) {
        set.status = 400;
        return { success: false, error: ipdbUnsupported };
      }
      await deleteDB();
      return { success: true };
    },
    { detail: { tags: ["Settings"] } },
  )
  .get("/settings/assets", () => assetStatus(), {
    detail: { tags: ["Settings"] },
  })
  .put(
    "/settings/assets",
    async ({ body, set }) => {
      const r = await saveAssetSettings(body);
      if (r.error) {
        set.status = 400;
        return { success: false, error: r.error };
      }
      return { success: true, status: await assetStatus() };
    },
    {
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        widget: t.Optional(t.String({ maxLength: 40 })),
        wasm: t.Optional(t.String({ maxLength: 40 })),
      }),
      detail: { tags: ["Settings"] },
    },
  )
  .post(
    "/settings/assets/refresh",
    async () => {
      await refreshAssets({ force: true });
      return { success: true, status: await assetStatus() };
    },
    { detail: { tags: ["Settings"] } },
  )
  .get(
    "/settings/assets/latest",
    async ({ set }) => {
      try {
        return { success: true, ...(await latestVersions()) };
      } catch (e) {
        set.status = 502;
        return {
          success: false,
          error: `Couldn't check for new versions: ${e.message}`,
        };
      }
    },
    { detail: { tags: ["Settings"] } },
  )
  .get(
    "/about",
    async () => {
      const pkg = await import("../package.json", { assert: { type: "json" } });

      return {
        bun: runtimeVersion(),
        runtime,
        ver: pkg.default.version,
      };
    },
    {},
  )
  .post(
    "/logout",
    async ({ body, headers, set }) => {
      const { authorization } = headers;
      if (!authorization?.startsWith("Bearer ")) {
        set.status = 400;
        return {
          success: false,
          error: "Log out with a session token. API keys have no session.",
        };
      }

      let hash;
      try {
        ({ hash } = JSON.parse(
          atob(authorization.replace("Bearer ", "").trim()),
        ));
      } catch {
        set.status = 400;
        return { success: false, error: "Malformed session token" };
      }

      let session = hash;

      if (body?.session) {
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
