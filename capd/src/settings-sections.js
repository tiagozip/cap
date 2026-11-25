import { t } from "elysia";
import { BUILT_WITH, assetVersionError } from "./assets.js";
import { analyticsDefaults } from "./events/index.js";
import {
  CORS_DEFAULT,
  FILTERING_DEFAULT,
  HEADERS_DEFAULT,
  RATELIMIT_DEFAULT,
  invalidateCorsCache,
  setCorsDefault,
  setFiltering,
  setHeaders,
  setRatelimit,
} from "./settings-cache.js";

// Instance settings that both the API and the config file (CAP_CONFIG) can set.
// `fields` is the request body schema, `normalize` fills in defaults for a full
// value, `check` catches what the schema can't express, and `apply` updates the
// in-memory cache after a save (sections without it have their own save logic).
const DEFS = {
  headers: {
    key: "settings:headers",
    label: "Visitor location",
    fields: {
      ipHeader: t.Optional(t.String()),
      countryHeader: t.Optional(t.String()),
      asnHeader: t.Optional(t.String()),
    },
    normalize: (v) => ({
      ipHeader: v.ipHeader || HEADERS_DEFAULT.ipHeader,
      countryHeader: v.countryHeader || HEADERS_DEFAULT.countryHeader,
      asnHeader: v.asnHeader || HEADERS_DEFAULT.asnHeader,
    }),
    apply: (v) => setHeaders(v),
  },
  ratelimit: {
    key: "settings:ratelimit",
    label: "Rate limit",
    fields: {
      max: t.Optional(t.Number({ minimum: 1, maximum: 10000 })),
      duration: t.Optional(t.Number({ minimum: 1000, maximum: 3600000 })),
    },
    normalize: (v) => ({
      max: v.max ?? RATELIMIT_DEFAULT.max,
      duration: v.duration ?? RATELIMIT_DEFAULT.duration,
    }),
    apply: (v) => setRatelimit(v),
  },
  cors: {
    key: "settings:cors",
    label: "Allowed websites",
    fields: {
      origins: t.Union([t.Array(t.String()), t.Null()]),
    },
    normalize: (v) => ({ origins: v.origins ?? CORS_DEFAULT.origins }),
    apply: (v) => {
      setCorsDefault(v);
      invalidateCorsCache();
    },
  },
  filtering: {
    key: "settings:filtering",
    label: "Request filtering",
    fields: {
      blockNonBrowserUA: t.Optional(t.Boolean()),
      requiredHeaders: t.Optional(t.Array(t.String())),
    },
    normalize: (v) => ({
      blockNonBrowserUA:
        v.blockNonBrowserUA ?? FILTERING_DEFAULT.blockNonBrowserUA,
      requiredHeaders: v.requiredHeaders ?? [],
    }),
    apply: (v) => setFiltering(v),
  },
  assets: {
    key: "settings:assets",
    label: "Widget files",
    fields: {
      enabled: t.Optional(t.Boolean()),
      widget: t.Optional(t.String({ maxLength: 40 })),
      wasm: t.Optional(t.String({ maxLength: 40 })),
    },
    normalize: (v) => ({
      enabled: v.enabled ?? false,
      widget: v.widget ?? BUILT_WITH.widget,
      wasm: v.wasm ?? BUILT_WITH.wasm,
    }),
    check: assetVersionError,
  },
  analytics: {
    key: "settings:analytics",
    label: "Analytics",
    fields: {
      retentionDays: t.Optional(t.Number({ minimum: 1, maximum: 3650 })),
      ipMode: t.Optional(
        t.Union([t.Literal("full"), t.Literal("truncate"), t.Literal("none")]),
      ),
      logChallenges: t.Optional(t.Boolean()),
    },
    normalize: (v) => ({
      retentionDays: v.retentionDays ?? analyticsDefaults.retentionDays,
      ipMode: v.ipMode ?? analyticsDefaults.ipMode,
      logChallenges: v.logChallenges ?? analyticsDefaults.logChallenges,
    }),
  },
};

// `body` is the lenient request schema the API accepts, `strict` the one the
// config file is checked against (unknown keys there are mistakes, not extras).
export const SECTIONS = Object.fromEntries(
  Object.entries(DEFS).map(([name, def]) => [
    name,
    {
      ...def,
      body: t.Object(def.fields),
      strict: t.Object(def.fields, { additionalProperties: false }),
    },
  ]),
);

export const sectionBody = (name) => SECTIONS[name].body;
