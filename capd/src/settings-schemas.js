import { t } from "elysia";

export const settingsSchemas = {
  ratelimit: t.Object({
    max: t.Optional(t.Number({ minimum: 1, maximum: 10000 })),
    duration: t.Optional(t.Number({ minimum: 1000, maximum: 3600000 })),
  }),
  cors: t.Object({
    origins: t.Union([t.Array(t.String()), t.Null()]),
  }),
  filtering: t.Object({
    blockNonBrowserUA: t.Optional(t.Boolean()),
    requiredHeaders: t.Optional(t.Array(t.String())),
  }),
  headers: t.Object({
    ipHeader: t.Optional(t.String()),
    countryHeader: t.Optional(t.String()),
    asnHeader: t.Optional(t.String()),
  }),
  analytics: t.Object({
    retentionDays: t.Optional(t.Integer({ minimum: 0, maximum: 3650 })),
    anonymizeDays: t.Optional(t.Integer({ minimum: 0, maximum: 3650 })),
    ipMode: t.Optional(
      t.Union([t.Literal("full"), t.Literal("truncate"), t.Literal("none")]),
    ),
    logChallenges: t.Optional(t.Boolean()),
  }),
  assets: t.Object({
    enabled: t.Optional(t.Boolean()),
    widget: t.Optional(t.String({ maxLength: 40 })),
    wasm: t.Optional(t.String({ maxLength: 40 })),
  }),
  updateCheck: t.Object({
    enabled: t.Optional(t.Boolean()),
    sidebar: t.Optional(t.Boolean()),
    interval: t.Optional(
      t.Union([
        t.Literal("daily"),
        t.Literal("4d"),
        t.Literal("weekly"),
        t.Literal("monthly"),
      ]),
    ),
  }),
};
