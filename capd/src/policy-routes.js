import {
  BEHAVIOR_WEIGHTS,
  DEFAULT_BEHAVIOR_THRESHOLD,
  WEAK_CAP,
} from "capjs-core";
import { Elysia, t } from "elysia";
import { db } from "#db";
import { authBeforeHandle } from "./auth.js";
import {
  eventDetail,
  insights,
  listEvents,
  overview,
  parseFilters,
  topDimensions,
} from "./events/analytics.js";
import {
  getPublicSettings,
  storageStatus,
  updateSettings,
} from "./events/index.js";
import { scopeGuard } from "./guards.js";
import {
  addItems,
  createList,
  deleteList,
  ENTRY_KINDS,
  getList,
  listLists,
  removeItems,
  updateList,
} from "./policy/lists.js";
import {
  ACTIONS,
  getRules,
  OPS,
  RULE_FIELDS,
  saveRules,
  validateRules,
} from "./policy/rules.js";
import {
  KNOWN_AGENTS,
  SIGNAL_GROUPS,
  SIGNED_AGENTS,
} from "./policy/signals.js";
import {
  deliver,
  deliveryLog,
  getWebhooks,
  newWebhookId,
  newWebhookSecret,
  publicWebhook,
  saveWebhooks,
  validateWebhook,
  WEBHOOK_TRIGGERS,
} from "./policy/webhooks.js";

const keyExists = async (siteKey) => !!(await db.exists(`key:${siteKey}`));

const unscopedOnly = ({ scope, set }) => {
  if (!scope?.siteKeys) return;
  set.status = 403;
  return {
    success: false,
    error: "Only admin sessions and unscoped API keys can manage webhooks.",
  };
};

const notFound = (set, what = "Key") => {
  set.status = 404;
  return { success: false, error: `${what} not found` };
};

const rangeQuery = t.Object({
  range: t.Optional(
    t.Union([
      t.Literal("1h"),
      t.Literal("24h"),
      t.Literal("7d"),
      t.Literal("30d"),
      t.Literal("90d"),
    ]),
  ),
  from: t.Optional(t.Numeric()),
  to: t.Optional(t.Numeric()),
  f: t.Optional(t.Union([t.String(), t.Array(t.String())])),
  q: t.Optional(t.String({ maxLength: 120 })),
  dims: t.Optional(t.String({ maxLength: 300 })),
  limit: t.Optional(t.Numeric()),
  cursor: t.Optional(t.String({ maxLength: 80 })),
});

const queryOpts = (query) => ({
  range: query.range,
  from: query.from,
  to: query.to,
  filters: parseFilters(query.f),
  q: query.q?.trim() || undefined,
});

const itemSchema = t.Object({
  kind: t.String(),
  value: t.String({ maxLength: 256 }),
  ttl: t.Optional(t.Number({ minimum: 0, maximum: 315_360_000 })),
  note: t.Optional(t.String({ maxLength: 200 })),
});

export const policyRoutes = new Elysia({
  prefix: "/server",
  detail: { security: [{ apiKey: [] }] },
})
  .onBeforeHandle(authBeforeHandle)
  .onBeforeHandle(scopeGuard)
  .get(
    "/keys/:siteKey/analytics",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return overview(params.siteKey, queryOpts(query));
    },
    { query: rangeQuery, detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/analytics/insights",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return insights(params.siteKey, queryOpts(query));
    },
    { query: rangeQuery, detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/analytics/top",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return topDimensions(params.siteKey, {
        ...queryOpts(query),
        dims: (
          query.dims ?? "country,asn_org,flag,agent,reason,browser,os"
        ).split(","),
        limit: Number(query.limit) || 10,
      });
    },
    { query: rangeQuery, detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/events",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return listEvents(params.siteKey, {
        ...queryOpts(query),
        cursor: query.cursor,
        limit: Number(query.limit) || 50,
      });
    },
    { query: rangeQuery, detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/events/:id",
    async ({ params, set }) => {
      const detail = await eventDetail(params.siteKey, params.id);
      return detail ?? notFound(set, "Event");
    },
    { detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/rules",
    async ({ params, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      const rules = await getRules(params.siteKey);
      return rules.map(({ requestOnly, conditions, ...r }) => ({
        ...r,
        stage: requestOnly ? "challenge" : "redeem",
        conditions: conditions.map(({ re, cidrs, ...c }) => c),
      }));
    },
    { detail: { tags: ["Rules"] } },
  )
  .put(
    "/keys/:siteKey/rules",
    async ({ params, body, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      const { rules, error } = validateRules(body.rules);
      if (error) {
        set.status = 400;
        return { success: false, error };
      }
      const lists = new Set((await listLists()).map((l) => l.id));
      for (const r of rules) {
        const missing = r.conditions.find(
          (c) => c.field === "list" && !lists.has(c.value),
        );
        if (missing) {
          set.status = 400;
          return {
            success: false,
            error: `Rule "${r.name}" points at a list that doesn't exist`,
          };
        }
      }
      await saveRules(params.siteKey, rules);
      return { success: true, rules };
    },
    {
      body: t.Object({ rules: t.Array(t.Any()) }),
      detail: { tags: ["Rules"] },
    },
  )
  .get(
    "/policy/catalog",
    () => ({
      fields: RULE_FIELDS,
      ops: OPS,
      actions: ACTIONS,
      signals: SIGNAL_GROUPS,
      agents: KNOWN_AGENTS,
      signedAgents: [...SIGNED_AGENTS],
      risk: {
        weights: BEHAVIOR_WEIGHTS,
        weakCap: WEAK_CAP,
        threshold: DEFAULT_BEHAVIOR_THRESHOLD,
      },
      listKinds: ENTRY_KINDS,
      webhookTriggers: WEBHOOK_TRIGGERS,
    }),
    { detail: { tags: ["Rules"] } },
  )
  .get("/lists", () => listLists(), { detail: { tags: ["Lists"] } })
  .post(
    "/lists",
    async ({ body }) => {
      const id = await createList({
        name: body.name.trim(),
        description: body.description?.trim() ?? "",
      });
      if (body.items?.length) await addItems(id, body.items);
      return { success: true, id };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 80 }),
        description: t.Optional(t.String({ maxLength: 300 })),
        items: t.Optional(t.Array(itemSchema, { maxItems: 10_000 })),
      }),
      detail: { tags: ["Lists"] },
    },
  )
  .get(
    "/lists/:id",
    async ({ params, set }) =>
      (await getList(params.id)) ?? notFound(set, "List"),
    { detail: { tags: ["Lists"] } },
  )
  .put(
    "/lists/:id",
    async ({ params, body, set }) =>
      (await updateList(params.id, body))
        ? { success: true }
        : notFound(set, "List"),
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        description: t.Optional(t.String({ maxLength: 300 })),
      }),
      detail: { tags: ["Lists"] },
    },
  )
  .delete(
    "/lists/:id",
    async ({ params, set }) => {
      for (const sk of await db.smembers("keys")) {
        const rules = await getRules(sk);
        if (
          rules.some((r) =>
            r.conditions.some(
              (c) => c.field === "list" && c.value === params.id,
            ),
          )
        ) {
          set.status = 409;
          return {
            success: false,
            error: "A rule still uses this list. Remove the rule first.",
          };
        }
      }
      await deleteList(params.id);
      return { success: true };
    },
    { detail: { tags: ["Lists"] } },
  )
  .post(
    "/lists/:id/items",
    async ({ params, body, set }) => {
      const res = await addItems(params.id, body.items);
      if (!res.success) set.status = res.error === "List not found" ? 404 : 400;
      return res;
    },
    {
      body: t.Object({ items: t.Array(itemSchema, { maxItems: 10_000 }) }),
      detail: { tags: ["Lists"] },
    },
  )
  .delete(
    "/lists/:id/items",
    async ({ params, body }) => removeItems(params.id, body.items),
    {
      body: t.Object({
        items: t.Array(t.Object({ kind: t.String(), value: t.String() }), {
          maxItems: 10_000,
        }),
      }),
      detail: { tags: ["Lists"] },
    },
  )
  .get(
    "/keys/:siteKey/webhooks",
    async ({ params, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return (await getWebhooks(params.siteKey)).map(publicWebhook);
    },
    { detail: { tags: ["Webhooks"] } },
  )
  .post(
    "/keys/:siteKey/webhooks",
    async ({ params, body, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      const { hook, error } = validateWebhook(body);
      if (error) {
        set.status = 400;
        return { success: false, error };
      }
      const hooks = await getWebhooks(params.siteKey);
      const secret = newWebhookSecret();
      const created = {
        ...hook,
        id: newWebhookId(),
        secret,
        created: Date.now(),
      };
      if (!(await saveWebhooks(params.siteKey, [...hooks, created]))) {
        set.status = 400;
        return { success: false, error: "A key can have at most 10 webhooks" };
      }
      return { success: true, webhook: publicWebhook(created), secret };
    },
    {
      body: t.Any(),
      beforeHandle: unscopedOnly,
      detail: { tags: ["Webhooks"] },
    },
  )
  .put(
    "/keys/:siteKey/webhooks/:id",
    async ({ params, body, set }) => {
      const hooks = await getWebhooks(params.siteKey);
      const current = hooks.find((h) => h.id === params.id);
      if (!current) return notFound(set, "Webhook");
      const { hook, error } = validateWebhook({ ...current, ...body });
      if (error) {
        set.status = 400;
        return { success: false, error };
      }
      const next = { ...current, ...hook };
      await saveWebhooks(
        params.siteKey,
        hooks.map((h) => (h.id === params.id ? next : h)),
      );
      return { success: true, webhook: publicWebhook(next) };
    },
    {
      body: t.Any(),
      beforeHandle: unscopedOnly,
      detail: { tags: ["Webhooks"] },
    },
  )
  .delete(
    "/keys/:siteKey/webhooks/:id",
    async ({ params, set }) => {
      const hooks = await getWebhooks(params.siteKey);
      if (!hooks.some((h) => h.id === params.id))
        return notFound(set, "Webhook");
      await saveWebhooks(
        params.siteKey,
        hooks.filter((h) => h.id !== params.id),
      );
      await db.del(`webhook:${params.id}:log`);
      return { success: true };
    },
    { detail: { tags: ["Webhooks"] } },
  )
  .post(
    "/keys/:siteKey/webhooks/:id/test",
    async ({ params, set }) => {
      const hook = (await getWebhooks(params.siteKey)).find(
        (h) => h.id === params.id,
      );
      if (!hook) return notFound(set, "Webhook");
      return deliver(hook, {
        type: "cap.test",
        site_key: params.siteKey,
        event: {
          id: "test",
          ts: Date.now(),
          site_key: params.siteKey,
          type: "redeem",
          outcome: "block",
          reason: "rule:test",
          flags: ["bh_linear_path"],
        },
      });
    },
    { detail: { tags: ["Webhooks"] } },
  )
  .get(
    "/keys/:siteKey/webhooks/:id/deliveries",
    async ({ params, set }) => {
      const hook = (await getWebhooks(params.siteKey)).find(
        (h) => h.id === params.id,
      );
      if (!hook) return notFound(set, "Webhook");
      return deliveryLog(params.id);
    },
    { detail: { tags: ["Webhooks"] } },
  )
  .get(
    "/settings/analytics",
    async () => ({
      settings: getPublicSettings(),
      status: await storageStatus(),
    }),
    { detail: { tags: ["Settings"] } },
  )
  .put(
    "/settings/analytics",
    async ({ body, set }) => {
      const res = await updateSettings(body);
      if (!res.success) set.status = 400;
      return res;
    },
    {
      body: t.Object({
        retentionDays: t.Optional(t.Number({ minimum: 1, maximum: 3650 })),
        ipMode: t.Optional(
          t.Union([
            t.Literal("full"),
            t.Literal("truncate"),
            t.Literal("none"),
          ]),
        ),
        logChallenges: t.Optional(t.Boolean()),
      }),
      detail: { tags: ["Settings"] },
    },
  );
