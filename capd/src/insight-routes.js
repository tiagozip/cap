import { Elysia, t } from "elysia";
import { db } from "#db";
import { authBeforeHandle } from "./auth.js";
import { expandRange, parseFilters } from "./events/analytics.js";
import { checkActivity } from "./events/checks.js";
import { exportEvents } from "./events/export.js";
import { movers } from "./events/movers.js";
import { scopeGuard } from "./guards.js";
import { eventContextDetail } from "./policy/event-context.js";
import { listHits } from "./policy/list-hits.js";
import { listLists } from "./policy/lists.js";
import { previewRules } from "./policy/preview.js";
import { ruleStats } from "./policy/rule-stats.js";
import { validateRules } from "./policy/rules.js";
import valkeyRateLimit from "./ratelimit.js";

const keyExists = async (siteKey) => !!(await db.exists(`key:${siteKey}`));

const fail = (set, status, error) => {
  set.status = status;
  return { success: false, error };
};

const rangeSchema = t.Optional(
  t.Union([t.Literal("1h"), t.Literal("24h"), t.Literal("7d")]),
);

export const insightRoutes = new Elysia({
  prefix: "/server",
  detail: { security: [{ apiKey: [] }] },
})
  .use(valkeyRateLimit({ max: 60, duration: 60_000 }))
  .onBeforeHandle(authBeforeHandle)
  .onBeforeHandle(scopeGuard)
  .post(
    "/keys/:siteKey/rules/preview",
    async ({ params, body, set }) => {
      if (!(await keyExists(params.siteKey)))
        return fail(set, 404, "Key not found");
      const { rules, error } = validateRules(body.rules);
      if (error) return fail(set, 400, error);
      const lists = new Set((await listLists()).map((l) => l.id));
      const missing = rules.find((r) =>
        r.conditions.some((c) => c.field === "list" && !lists.has(c.value)),
      );
      if (missing)
        return fail(
          set,
          400,
          `Rule "${missing.name}" points at a list that doesn't exist`,
        );
      return previewRules(params.siteKey, rules, { range: body.range });
    },
    {
      body: t.Object({
        rules: t.Array(t.Any(), { maxItems: 100 }),
        range: rangeSchema,
      }),
      detail: {
        tags: ["Rules"],
        summary: "Preview rules against recent traffic",
        description:
          "Replays a draft rule set against the key's recent redeems and stopped challenges, without saving it. Returns per-rule matches and how the outcome would change compared with the saved rules.",
      },
    },
  )
  .get(
    "/keys/:siteKey/analytics/movers",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey)))
        return fail(set, 404, "Key not found");
      return movers(params.siteKey, {
        range: query.range,
        filters: parseFilters(query.f),
        q: query.q?.trim() || undefined,
      });
    },
    {
      query: t.Object({
        range: t.Optional(
          t.Union([
            t.Literal("1h"),
            t.Literal("24h"),
            t.Literal("7d"),
            t.Literal("30d"),
          ]),
        ),
        f: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        q: t.Optional(t.String({ maxLength: 120 })),
      }),
      detail: {
        tags: ["Analytics"],
        summary: "What changed",
        description:
          "Countries, networks, signals, agents, block reasons, browsers and rules whose volume moved most against the previous period, after scaling for overall traffic change.",
      },
    },
  )
  .get(
    "/lists/:id/hits",
    async ({ params, query, set }) =>
      (await listHits(params.id, { range: query.range })) ??
      fail(set, 404, "List not found"),
    {
      query: t.Object({
        range: t.Optional(
          t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")]),
        ),
      }),
      detail: {
        tags: ["Lists"],
        summary: "List entry hits",
        description:
          "How many events across all keys matched each IP, ASN, network, country and visitor entry of a list over a range. CIDR and user agent entries aren't counted.",
      },
    },
  )
  .get(
    "/keys/:siteKey/analytics/checks",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey)))
        return fail(set, 404, "Key not found");
      return checkActivity(params.siteKey, { range: query.range });
    },
    {
      query: t.Object({
        range: t.Optional(
          t.Union([t.Literal("24h"), t.Literal("7d"), t.Literal("30d")]),
        ),
      }),
      detail: {
        tags: ["Analytics"],
        summary: "Check activity",
        description:
          "How often each risk signal and AI agent fired over a range, with blocks, a time series and the previous period's count, plus the number of solve attempts for rates.",
      },
    },
  )
  .get(
    "/keys/:siteKey/rules/stats",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey)))
        return fail(set, 404, "Key not found");
      return ruleStats(params.siteKey, { range: query.range });
    },
    {
      query: t.Object({
        range: t.Optional(
          t.Union([
            t.Literal("1h"),
            t.Literal("24h"),
            t.Literal("7d"),
            t.Literal("30d"),
          ]),
        ),
      }),
      detail: {
        tags: ["Rules"],
        summary: "Rule activity",
        description:
          "Hits per rule over a range, split by outcome, with a time series, unique IPs and visitors, the last hit and the previous period's total.",
      },
    },
  )
  .get(
    "/keys/:siteKey/events/:id/context",
    async ({ params, scope, set }) => {
      const out = await eventContextDetail(params.siteKey, params.id, {
        scoped: !!scope?.siteKeys,
      });
      return out ?? fail(set, 404, "Event not found");
    },
    {
      params: t.Object({
        siteKey: t.String(),
        id: t.String({ maxLength: 80 }),
      }),
      detail: {
        tags: ["Analytics"],
        summary: "Event context",
        description:
          "History of the event's IP, network and visitor on this key, the lists its IP, network, country, user agent or visitor are on, and the saved rules that match it now.",
      },
    },
  );

export const exportRoutes = new Elysia({
  prefix: "/server",
  detail: { security: [{ apiKey: [] }] },
})
  .use(valkeyRateLimit({ max: 6, duration: 60_000 }))
  .onBeforeHandle(authBeforeHandle)
  .onBeforeHandle(scopeGuard)
  .get(
    "/keys/:siteKey/events/export",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey)))
        return fail(set, 404, "Key not found");
      return exportEvents(params.siteKey, {
        format: query.format,
        ...(await expandRange(params.siteKey, query)),
        filters: parseFilters(query.f),
        q: query.q?.trim() || undefined,
      });
    },
    {
      query: t.Object({
        format: t.Optional(t.Union([t.Literal("csv"), t.Literal("ndjson")])),
        range: t.Optional(
          t.Union([
            t.Literal("1h"),
            t.Literal("24h"),
            t.Literal("7d"),
            t.Literal("30d"),
            t.Literal("90d"),
            t.Literal("1y"),
            t.Literal("all"),
          ]),
        ),
        from: t.Optional(t.Numeric()),
        to: t.Optional(t.Numeric()),
        f: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        q: t.Optional(t.String({ maxLength: 120 })),
      }),
      detail: {
        tags: ["Analytics"],
        summary: "Export events",
        description:
          "Streams the events that match a range, filters and search as CSV (default) or NDJSON, newest first, up to 100,000 rows (20,000 on Workers).",
      },
    },
  );
