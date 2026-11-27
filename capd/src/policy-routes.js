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
  expandRange,
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
import { WEBHOOK_SERVICES } from "./policy/webhook-services.js";
import {
  deliver,
  deliveryLog,
  getWebhooks,
  INSTANCE,
  INSTANCE_TRIGGERS,
  newWebhookId,
  newWebhookSecret,
  publicWebhook,
  resendEvent,
  saveWebhooks,
  testPayload,
  validateWebhook,
  WEBHOOK_DIGESTS,
  WEBHOOK_MIN_COUNTS,
  WEBHOOK_TRIGGERS,
} from "./policy/webhooks.js";
import { settingsSchemas } from "./settings-schemas.js";

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
      t.Literal("1y"),
      t.Literal("all"),
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

const queryOpts = async (siteKey, query) => ({
  ...(await expandRange(siteKey, query)),
  filters: parseFilters(query.f),
  q: query.q?.trim() || undefined,
});

const itemSchema = t.Object({
  kind: t.String(),
  value: t.String({ maxLength: 256 }),
  ttl: t.Optional(t.Number({ minimum: 0, maximum: 315_360_000 })),
  note: t.Optional(t.String({ maxLength: 200 })),
});

const keyScope = async ({ siteKey }) =>
  (await keyExists(siteKey)) ? siteKey : null;

const webhookRoutes = (base, scopeOf, tag) => (app) =>
  app
    .get(
      base,
      async ({ params, set }) => {
        const scope = await scopeOf(params);
        if (!scope) return notFound(set);
        return (await getWebhooks(scope)).map(publicWebhook);
      },
      { beforeHandle: unscopedOnly, detail: { tags: [tag] } },
    )
    .post(
      base,
      async ({ params, body, set }) => {
        const scope = await scopeOf(params);
        if (!scope) return notFound(set);
        const { hook, error, field } = validateWebhook(body, null, scope);
        if (error) {
          set.status = 400;
          return { success: false, error, field };
        }
        const hooks = await getWebhooks(scope);
        const secret = newWebhookSecret();
        const created = {
          ...hook,
          id: newWebhookId(),
          secret,
          created: Date.now(),
        };
        if (!(await saveWebhooks(scope, [...hooks, created]))) {
          set.status = 400;
          return {
            success: false,
            error: "You can add at most 10 webhooks here",
          };
        }
        return {
          success: true,
          webhook: publicWebhook(created),
          ...(hook.service === "generic" && { secret }),
        };
      },
      {
        body: t.Any(),
        beforeHandle: unscopedOnly,
        detail: { tags: [tag] },
      },
    )
    .put(
      `${base}/:id`,
      async ({ params, body, set }) => {
        const scope = await scopeOf(params);
        if (!scope) return notFound(set);
        const hooks = await getWebhooks(scope);
        const current = hooks.find((h) => h.id === params.id);
        if (!current) return notFound(set, "Webhook");
        const { hook, error, field } = validateWebhook(
          { ...current, ...body },
          current,
          scope,
        );
        if (error) {
          set.status = 400;
          return { success: false, error, field };
        }
        const { paused, ...rest } = current;
        const next = {
          ...rest,
          ...hook,
          ...(!hook.enabled && paused && { paused }),
        };
        if (next.service !== "generic") delete next.headers;
        else delete next.config;
        await saveWebhooks(
          scope,
          hooks.map((h) => (h.id === params.id ? next : h)),
        );
        return { success: true, webhook: publicWebhook(next) };
      },
      {
        body: t.Any(),
        beforeHandle: unscopedOnly,
        detail: { tags: [tag] },
      },
    )
    .delete(
      `${base}/:id`,
      async ({ params, set }) => {
        const scope = await scopeOf(params);
        if (!scope) return notFound(set);
        const hooks = await getWebhooks(scope);
        if (!hooks.some((h) => h.id === params.id))
          return notFound(set, "Webhook");
        await saveWebhooks(
          scope,
          hooks.filter((h) => h.id !== params.id),
        );
        await db.del(`webhook:${params.id}:log`);
        return { success: true };
      },
      { beforeHandle: unscopedOnly, detail: { tags: [tag] } },
    )
    .post(
      `${base}/:id/test`,
      async ({ params, set }) => {
        const scope = await scopeOf(params);
        const hook =
          scope && (await getWebhooks(scope)).find((h) => h.id === params.id);
        if (!hook) return notFound(set, "Webhook");
        return deliver(hook, testPayload(scope, hook));
      },
      { beforeHandle: unscopedOnly, detail: { tags: [tag] } },
    )
    .post(
      `${base}/:id/rotate`,
      async ({ params, set }) => {
        const scope = await scopeOf(params);
        if (!scope) return notFound(set);
        const hooks = await getWebhooks(scope);
        const current = hooks.find((h) => h.id === params.id);
        if (!current) return notFound(set, "Webhook");
        const secret = newWebhookSecret();
        const next = { ...current, secret };
        await saveWebhooks(
          scope,
          hooks.map((h) => (h.id === params.id ? next : h)),
        );
        return { success: true, webhook: publicWebhook(next), secret };
      },
      { beforeHandle: unscopedOnly, detail: { tags: [tag] } },
    )
    .get(
      `${base}/:id/deliveries`,
      async ({ params, set }) => {
        const scope = await scopeOf(params);
        const hook =
          scope && (await getWebhooks(scope)).find((h) => h.id === params.id);
        if (!hook) return notFound(set, "Webhook");
        return deliveryLog(params.id);
      },
      { beforeHandle: unscopedOnly, detail: { tags: [tag] } },
    );

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
      return overview(params.siteKey, await queryOpts(params.siteKey, query));
    },
    { query: rangeQuery, detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/analytics/insights",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return insights(params.siteKey, await queryOpts(params.siteKey, query));
    },
    { query: rangeQuery, detail: { tags: ["Analytics"] } },
  )
  .get(
    "/keys/:siteKey/analytics/top",
    async ({ params, query, set }) => {
      if (!(await keyExists(params.siteKey))) return notFound(set);
      return topDimensions(params.siteKey, {
        ...(await queryOpts(params.siteKey, query)),
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
        ...(await queryOpts(params.siteKey, query)),
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
      webhookInstanceTriggers: INSTANCE_TRIGGERS,
      webhookDigests: WEBHOOK_DIGESTS,
      webhookMinCounts: WEBHOOK_MIN_COUNTS,
      webhookServices: Object.entries(WEBHOOK_SERVICES).map(
        ([id, { name, blurb, fields }]) => ({ id, name, blurb, fields }),
      ),
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
  .use(webhookRoutes("/keys/:siteKey/webhooks", keyScope, "Webhooks"))
  .post(
    "/keys/:siteKey/webhooks/:id/resend",
    async ({ params, body, set }) => {
      const scope = await keyScope(params);
      const hook =
        scope && (await getWebhooks(scope)).find((h) => h.id === params.id);
      if (!hook) return notFound(set, "Webhook");
      const sent = await resendEvent(scope, hook, String(body?.event ?? ""));
      if (!sent) {
        set.status = 404;
        return {
          success: false,
          error: "Cap doesn't have this event anymore, so it can't resend it",
        };
      }
      return { success: sent.ok, ...sent };
    },
    {
      body: t.Object({ event: t.String({ maxLength: 64 }) }),
      beforeHandle: unscopedOnly,
      detail: { tags: ["Webhooks"] },
    },
  )
  .use(webhookRoutes("/settings/webhooks", () => INSTANCE, "Instance webhooks"))
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
      body: settingsSchemas.analytics,
      detail: { tags: ["Settings"] },
    },
  );
