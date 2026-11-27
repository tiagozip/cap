import {
  ACTIONS,
  ENTRY_KINDS,
  INSTANCE_TRIGGERS,
  OPS,
  RULE_FIELDS,
  risk,
  WEBHOOK_TRIGGERS,
} from "virtual:cap-demo-server";
import { ipInCidr, isIp, parseCidr } from "../../../capd/src/policy/ip.js";
import {
  cleanAgentActions,
  cleanSignalActions,
  KNOWN_AGENTS,
  SIGNAL_GROUPS,
  SIGNED_AGENTS,
} from "../../../capd/src/policy/signals.js";
import {
  cleanServiceConfig,
  publicServiceConfig,
  serviceLabel,
  WEBHOOK_SERVICES,
} from "../../../capd/src/policy/webhook-services.js";
import {
  eventDetail,
  insights,
  legacyKeyStats,
  listEvents,
  overview,
  parseFilters,
  solvesByKey,
  topDimensions,
} from "./analytics.js";
import { h2, MIN, modelFor, unit } from "./model.js";
import {
  about,
  keyDefaults,
  newBase64Url,
  newHex,
  newSecret,
  newToken,
  save,
  state,
} from "./store.js";

const fail = (error) => ({ success: false, error });
const findKey = (sk) => state.keys.find((k) => k.siteKey === sk);
const retention = () => state.settings.analytics.retentionDays || 365;

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "rule";

function normalizeEntry(kind, raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (kind === "ip") {
    const ip = value.replace(/^::ffff:/i, "").toLowerCase();
    return isIp(ip) ? ["ip", ip] : null;
  }
  if (kind === "cidr")
    return parseCidr(value) ? ["cidr", value.toLowerCase()] : null;
  if (kind === "asn") {
    const n = Number(value.replace(/^AS/i, ""));
    return Number.isInteger(n) && n > 0 ? ["asn", String(n)] : null;
  }
  if (kind === "org") return ["org", value.toLowerCase()];
  if (kind === "country")
    return /^[A-Za-z]{2}$/.test(value)
      ? ["country", value.toUpperCase()]
      : null;
  if (kind === "ua") return ["ua", value];
  if (kind === "visitor")
    return /^[0-9a-f]{16}$/.test(value) ? ["visitor", value] : null;
  return null;
}

const listSummary = (l) => ({
  id: l.id,
  name: l.name,
  description: l.description,
  created: l.created,
  count: l.items.filter((i) => !i.expires || i.expires > Date.now()).length,
});

const listDetail = (l) => ({
  id: l.id,
  name: l.name,
  description: l.description,
  created: l.created,
  items: l.items
    .filter((i) => !i.expires || i.expires > Date.now())
    .toSorted((a, b) => (b.added ?? 0) - (a.added ?? 0))
    .map((i) => ({
      kind: i.kind,
      value: i.value,
      expires: i.expires || null,
      note: i.note || "",
      added: i.added || null,
    })),
});

function addItems(list, items) {
  const rejected = [];
  let added = 0;
  for (const raw of items ?? []) {
    const entry = normalizeEntry(raw.kind, raw.value);
    if (!entry) {
      rejected.push(raw.value);
      continue;
    }
    const [kind, value] = entry;
    list.items = list.items.filter(
      (i) => !(i.kind === kind && i.value === value),
    );
    list.items.push({
      kind,
      value,
      note: raw.note ? String(raw.note).slice(0, 200) : "",
      added: Date.now(),
      expires: raw.ttl ? Date.now() + raw.ttl * 1000 : null,
    });
    added++;
  }
  return { success: true, added, rejected };
}

const publicWebhook = ({ secret, config, headers, ...hook }) => {
  const service = hook.service ?? "generic";
  const generic = service === "generic";
  return {
    ...hook,
    service,
    digest: hook.digest ?? 0,
    label: generic
      ? hook.url.replace(/^https?:\/\//, "")
      : serviceLabel(service, config),
    ...(generic
      ? {
          secretHint: `${secret.slice(0, 8)}…`,
          headers: (headers ?? []).map(({ name }) => ({ name, value: "" })),
        }
      : publicServiceConfig(service, config)),
  };
};

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|\[?::1)/;

const INSTANCE = "@instance";

function validateWebhook(input, current, scope) {
  const instance = scope === INSTANCE;
  const service = String(input?.service ?? current?.service ?? "generic");
  if (!WEBHOOK_SERVICES[service]) return { error: "Pick a service" };
  const triggers = (Array.isArray(input.triggers) ? input.triggers : []).filter(
    (t) => (instance ? INSTANCE_TRIGGERS : WEBHOOK_TRIGGERS).includes(t),
  );
  if (!triggers.length) return { error: "Pick at least one trigger" };
  const digest = instance ? 0 : Number(input.digest ?? current?.digest ?? 0);
  const hook = {
    service,
    triggers: [...new Set(triggers)],
    enabled: input.enabled !== false,
    name: String(input.name ?? "")
      .trim()
      .slice(0, 60),
    digest,
    min: digest ? Number(input.min ?? current?.min ?? 0) : 0,
    filters: Object.fromEntries(
      Object.entries(
        instance ? {} : (input.filters ?? current?.filters ?? {}),
      ).filter(
        ([k, v]) =>
          k === "exceptCountries" ||
          (Array.isArray(v) &&
            v.length &&
            (k === "countries" ||
              triggers.includes(
                {
                  rules: "rule",
                  flags: "flagged",
                  agents: "agent",
                  reasons: "reason",
                }[k],
              ))),
      ),
    ),
  };
  const same = current && (current.service ?? "generic") === service;
  if (service === "generic") {
    let parsed;
    try {
      parsed = new URL(String(input?.url ?? ""));
    } catch {
      return { error: "Enter a valid URL", field: "url" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
      return { error: "Webhooks must use http or https", field: "url" };
    if (parsed.username || parsed.password)
      return {
        error: "Put credentials in a header, not the URL",
        field: "url",
      };
    if (PRIVATE_HOST.test(parsed.hostname))
      return {
        error: "Webhooks can't point at private or local addresses",
        field: "url",
      };
    const previous = same ? (current.headers ?? []) : [];
    const headers = (input.headers ?? previous)
      .filter((h) => h?.name || h?.value)
      .map((h) => ({
        name: String(h.name).trim(),
        value:
          String(h.value ?? "") ||
          previous.find((p) => p.name === h.name)?.value ||
          "",
      }));
    if (headers.some((h) => !h.name || !h.value))
      return {
        error: "Fill in each header's name and value",
        field: "headers",
      };
    return { hook: { ...hook, url: parsed.toString(), headers } };
  }
  const merged = same
    ? {
        ...publicServiceConfig(service, current.config).config,
        ...input.config,
      }
    : input.config;
  const { config, error, field } = cleanServiceConfig(
    service,
    merged,
    same ? current.config : {},
  );
  if (error) return { error, field };
  return { hook: { ...hook, url: "", config } };
}

function deliveries(sk, hook) {
  const own = state.deliveries[hook.id] ?? [];
  if (!hook.enabled || !modelFor(sk)) return own;
  const busy = hook.triggers.includes("all")
    ? 0.4
    : hook.triggers.includes("agent")
      ? 3
      : 1.5;
  const out = [];
  let at = Math.floor(Date.now() / MIN) * MIN;
  for (let i = 0; out.length < 50 - own.length && i < 400; i++) {
    at -= Math.round(busy * MIN * (0.3 + 1.4 * unit(h2(i, at / MIN))));
    if (at < hook.created) break;
    const r = unit(h2(at / MIN, 7));
    const ok = r > 0.015;
    const status = ok ? 200 : r < 0.008 ? 503 : 0;
    out.push({
      at,
      ms: 40 + Math.round(unit(h2(at / MIN, 9)) * 260),
      status,
      ok,
      error: ok
        ? null
        : status
          ? `Couldn't reach the URL (HTTP ${status})`
          : "Couldn't reach the URL",
      attempt: 0,
      event: `${at.toString(16).padStart(12, "0")}7${(h2(at, 3) >>> 0).toString(16).padStart(8, "0")}${(h2(at, 5) >>> 0).toString(16).padStart(8, "0")}${(h2(at, 6) >>> 4).toString(16).padStart(3, "0")}`,
      kind: "cap.event",
    });
  }
  return [...own, ...out].toSorted((a, b) => b.at - a.at).slice(0, 50);
}

const rulesOut = (rules) =>
  rules.map((r) => ({
    ...r,
    stage: r.conditions.every((c) => RULE_FIELDS[c.field]?.stage === "request")
      ? "challenge"
      : "redeem",
  }));

function validateRules(input) {
  if (!Array.isArray(input)) return { error: "Rules must be an array" };
  if (input.length > 100) return { error: "At most 100 rules per key" };
  const ids = new Set();
  const rules = [];
  for (const [i, r] of input.entries()) {
    const name = String(r?.name ?? "")
      .trim()
      .slice(0, 80);
    if (!name) return { error: `Rule ${i + 1} needs a name` };
    if (!ACTIONS.includes(r.action))
      return { error: `Rule "${name}" has an unknown action` };
    let id = r.id && /^[a-z0-9-]{1,48}$/.test(r.id) ? r.id : slug(name);
    for (let n = 2; ids.has(id); n++) id = `${slug(name)}-${n}`;
    ids.add(id);
    const conditions = Array.isArray(r.conditions) ? r.conditions : [];
    if (!conditions.length)
      return { error: `Rule "${name}" needs at least one condition` };
    if (conditions.length > 12)
      return { error: `Rule "${name}" has too many conditions` };
    const clean = [];
    for (const c of conditions) {
      const spec = RULE_FIELDS[c?.field];
      if (!spec) return { error: `Rule "${name}" uses an unknown field` };
      if (!OPS[spec.type].includes(c.op))
        return {
          error: `Rule "${name}": "${c.op}" doesn't work with ${spec.label}`,
        };
      const cond = { field: c.field, op: c.op };
      if (spec.type === "header") {
        const header = String(c.header ?? "")
          .trim()
          .toLowerCase();
        if (!/^[a-z0-9-]{1,64}$/.test(header))
          return { error: `Rule "${name}" needs a header name` };
        cond.header = header;
      }
      if (!["exists", "not_exists", "is_true", "is_false"].includes(c.op)) {
        if (c.op === "in" || c.op === "not_in") {
          const values = (
            Array.isArray(c.value) ? c.value : String(c.value ?? "").split(",")
          )
            .map((v) => String(v).trim())
            .filter(Boolean)
            .slice(0, 500);
          if (!values.length)
            return { error: `Rule "${name}" has an empty value list` };
          cond.value = values;
        } else if (spec.type === "number") {
          const n = Number(c.value);
          if (!Number.isFinite(n))
            return { error: `Rule "${name}": ${spec.label} needs a number` };
          cond.value = n;
        } else {
          const v = String(c.value ?? "");
          if (!v) return { error: `Rule "${name}" has an empty value` };
          if (v.length > 300)
            return { error: `Rule "${name}" has a value over 300 characters` };
          if (c.op === "matches") {
            try {
              new RegExp(v);
            } catch {
              return {
                error: `Rule "${name}": the regular expression doesn't compile`,
              };
            }
          }
          cond.value = v;
        }
      }
      clean.push(cond);
    }
    rules.push({
      id,
      name,
      enabled: r.enabled !== false,
      match: r.match === "any" ? "any" : "all",
      conditions: clean,
      action: r.action,
      ...(r.action === "harder" && {
        factor: Math.min(10, Math.max(1.5, Number(r.factor) || 2)),
      }),
      ...(r.note && { note: String(r.note).slice(0, 300) }),
    });
  }
  return { rules };
}

function ensureBlocklist(sk) {
  const id = `blk_${sk}`;
  let list = state.lists.find((l) => l.id === id);
  if (!list) {
    list = {
      id,
      name: `Blocked on ${findKey(sk)?.name || sk}`,
      description: "Created from this key's IP blocking rules",
      created: Date.now(),
      items: [],
    };
    state.lists.push(list);
  }
  state.rules[sk] ??= [];
  const rules = state.rules[sk];
  if (
    !rules.some((r) =>
      r.conditions.some((c) => c.field === "list" && c.value === id),
    )
  )
    rules.unshift({
      id: "blocklist",
      name: "Block entries on this key's blocklist",
      enabled: true,
      match: "all",
      conditions: [{ field: "list", op: "in_list", value: id }],
      action: "block",
    });
  return list;
}

const legacyEntry = (type, value) =>
  type === "asn" && !/^(AS)?\d+$/i.test(value)
    ? ["org", value]
    : [type || "ip", value];

const ipdbProgress = () => {
  const d = state.download;
  if (!d)
    return { active: false, file: "", downloaded: 0, total: 0, error: null };
  const files =
    d.mode === "ipinfo"
      ? [["ipinfo-lite.mmdb", 31_204_331]]
      : [
          [
            d.cities
              ? d.mode === "maxmind"
                ? "GeoLite2-City.mmdb"
                : "dbip-city-lite.mmdb"
              : d.mode === "maxmind"
                ? "GeoLite2-Country.mmdb"
                : "dbip-country-lite.mmdb",
            d.cities ? 126_873_350 : 7_342_118,
          ],
          [
            d.mode === "maxmind" ? "GeoLite2-ASN.mmdb" : "dbip-asn-lite.mmdb",
            9_871_204,
          ],
        ];
  const elapsed = (Date.now() - d.started) / 1000;
  const per = 1.8;
  const i = Math.floor(elapsed / per);
  if (i >= files.length) {
    const s = state.settings.ipdb;
    state.settings.ipdb = {
      ...s,
      mode: d.mode,
      cities: !!d.cities,
      maxmindAccountId: d.maxmindAccountId ?? "",
      maxmindKey: d.maxmindKey ? `••••${d.maxmindKey.slice(-4)}` : "",
      ipinfoToken: d.ipinfoToken ? `••••${d.ipinfoToken.slice(-4)}` : "",
      lastUpdated: new Date().toISOString(),
      country: { exists: true, city: !!d.cities, size: files[0][1] },
      asn: { exists: true, size: files.at(-1)[1] },
      loaded: { country: true, asn: true },
      error: null,
    };
    state.download = null;
    save();
    return { active: false, file: "", downloaded: 0, total: 0, error: null };
  }
  const [file, total] = files[i];
  return {
    active: true,
    file,
    downloaded: Math.round(total * Math.min(1, (elapsed - i * per) / per)),
    total,
    error: null,
  };
};

const assetStatus = () => {
  const s = state.settings.assets;
  return {
    ...s,
    builtWith: about.capAssets,
    source: "https://cdn.jsdelivr.net",
    updating: false,
    cached:
      s.enabled && state.settings.assetsCachedAt
        ? {
            widget: s.widget,
            wasm: s.wasm,
            at: state.settings.assetsCachedAt,
            hashwx: true,
          }
        : null,
    error: null,
    failedAt: null,
  };
};

const storageStatus = () => {
  const days = retention();
  let events = 0;
  for (const k of state.keys) {
    const m = modelFor(k.siteKey);
    if (m) events += m.def.monthly * 2.95 * (days / 30);
  }
  events = Math.round(events);
  return {
    backend: "clickhouse",
    configured: "clickhouse",
    healthy: true,
    lastError: null,
    buffered: Math.floor(unit(h2(Math.floor(Date.now() / 5000), 1)) * 900),
    dropped: 0,
    info: { events, bytes: Math.round(events * 41.7) },
  };
};

const queryOpts = (query) => ({
  range: query.get("range") ?? undefined,
  from: query.get("from") ?? undefined,
  to: query.get("to") ?? undefined,
  filters: parseFilters(query.getAll("f")),
  q: query.get("q")?.trim() || undefined,
});

const routes = [];
const route = (method, pattern, fn) => {
  const keys = [];
  const re = new RegExp(
    `^${pattern.replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    })}$`,
  );
  routes.push({ method, re, keys, fn });
};

const withKey = (fn) => (ctx) => {
  const key = findKey(ctx.params.siteKey);
  if (!key) return fail("Key not found");
  return fn({ ...ctx, key });
};

route("GET", "/keys", () =>
  state.keys
    .toSorted((a, b) => b.created - a.created)
    .map((key) => {
      const { current, previous } = solvesByKey(key.siteKey);
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
        solvesLast24h: current,
        difference: {
          value: change.toFixed(2),
          direction:
            current > previous ? "up" : current < previous ? "down" : "",
        },
      };
    }),
);

route("POST", "/keys", ({ body }) => {
  const siteKey = newHex(5);
  const secretKey = newSecret();
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
    hashwxDifficulty: body?.hashwxDifficulty ?? keyDefaults.hashwxDifficulty,
    ...(body?.corsOrigins?.length && { corsOrigins: body.corsOrigins }),
  };
  state.keys.push({
    siteKey,
    name: body?.name || siteKey,
    created: Date.now(),
    secret: secretKey,
    config,
  });
  save();
  return { siteKey, secretKey };
});

route(
  "GET",
  "/keys/:siteKey",
  withKey(({ key, query }) => ({
    key: {
      siteKey: key.siteKey,
      name: key.name,
      created: key.created,
      config: structuredClone(key.config),
    },
    ...legacyKeyStats(key.siteKey, query.get("chartDuration") || "today"),
  })),
);

route(
  "PUT",
  "/keys/:siteKey/config",
  withKey(({ key, body }) => {
    const next = { ...keyDefaults, ...key.config };
    for (const [k, v] of Object.entries(body ?? {})) {
      if (v === undefined) continue;
      if (k === "signalActions") next[k] = cleanSignalActions(v);
      else if (k === "agentActions") next[k] = cleanAgentActions(v);
      else next[k] = v;
    }
    next.saltSize = 32;
    if (body?.name) key.name = body.name;
    next.name = key.name;
    key.config = next;
    save();
    return { success: true };
  }),
);

route("DELETE", "/keys/:siteKey", ({ params }) => {
  const sk = params.siteKey;
  if (!findKey(sk)) return fail("Key not found");
  state.keys = state.keys.filter((k) => k.siteKey !== sk);
  for (const hook of state.webhooks[sk] ?? []) delete state.deliveries[hook.id];
  delete state.rules[sk];
  delete state.webhooks[sk];
  delete state.shares[sk];
  state.lists = state.lists.filter((l) => l.id !== `blk_${sk}`);
  for (const a of state.apikeys)
    if (a.siteKeys) a.siteKeys = a.siteKeys.filter((s) => s !== sk);
  save();
  return { success: true };
});

route(
  "POST",
  "/keys/:siteKey/rotate-secret",
  withKey(({ key }) => {
    key.secret = newSecret();
    save();
    return { secretKey: key.secret };
  }),
);

route(
  "GET",
  "/keys/:siteKey/secret",
  withKey(({ key }) => ({ secretKey: key.secret })),
);

route(
  "GET",
  "/keys/:siteKey/geo-stats",
  withKey(() => ({
    countries: [],
    totalCountry: 0,
    asns: [],
    totalAsn: 0,
    platforms: [],
    totalPlatform: 0,
    oses: [],
    totalOs: 0,
  })),
);

route(
  "GET",
  "/keys/:siteKey/shares",
  withKey(({ key }) =>
    (state.shares[key.siteKey] ?? [])
      .filter((s) => !s.expires || s.expires > Date.now())
      .toSorted((a, b) => b.created - a.created),
  ),
);

route(
  "POST",
  "/keys/:siteKey/shares",
  withKey(({ key, body }) => {
    const created = Date.now();
    const share = {
      id: newHex(8),
      name: body?.name?.trim() || "",
      created,
      expires: body?.expiresIn ? created + body.expiresIn * 1000 : null,
    };
    state.shares[key.siteKey] ??= [];
    state.shares[key.siteKey].push(share);
    save();
    return { ...share, token: newBase64Url(24) };
  }),
);

route("DELETE", "/keys/:siteKey/shares/:id", ({ params }) => {
  const list = state.shares[params.siteKey] ?? [];
  if (!list.some((s) => s.id === params.id))
    return fail("Share link not found");
  state.shares[params.siteKey] = list.filter((s) => s.id !== params.id);
  save();
  return { success: true };
});

route(
  "POST",
  "/keys/:siteKey/block-ip",
  withKey(({ key, body }) => {
    const value = body?.ip || body?.value;
    if (!value) return fail("Missing value");
    if (!["ip", "cidr", "asn", "country"].includes(body.type || "ip"))
      return fail("Invalid block type");
    const [kind, v] = legacyEntry(body.type || "ip", value);
    const list = ensureBlocklist(key.siteKey);
    const res = addItems(list, [{ kind, value: v, ttl: body.duration || 0 }]);
    if (!res.added) return fail("Invalid value");
    save();
    return { success: true };
  }),
);

route(
  "POST",
  "/keys/:siteKey/unblock-ip",
  withKey(({ key, body }) => {
    const value = body?.ip || body?.value;
    if (!value) return fail("Missing value");
    const entry = normalizeEntry(...legacyEntry(body.type || "ip", value));
    const list = state.lists.find((l) => l.id === `blk_${key.siteKey}`);
    if (list && entry)
      list.items = list.items.filter(
        (i) => !(i.kind === entry[0] && i.value === entry[1]),
      );
    save();
    return { success: true };
  }),
);

route("GET", "/keys/:siteKey/blocked-ips", ({ params }) => {
  const list = state.lists.find((l) => l.id === `blk_${params.siteKey}`);
  return (list ? listDetail(list).items : []).map((item) => ({
    ip: item.value,
    type: item.kind === "org" ? "asn" : item.kind,
    permanent: !item.expires,
    expires: item.expires,
  }));
});

route(
  "GET",
  "/keys/:siteKey/analytics",
  withKey(({ key, query }) =>
    overview(key.siteKey, queryOpts(query), retention()),
  ),
);

route(
  "GET",
  "/keys/:siteKey/analytics/insights",
  withKey(({ key, query }) =>
    insights(key.siteKey, queryOpts(query), retention()),
  ),
);

route(
  "GET",
  "/keys/:siteKey/analytics/top",
  withKey(({ key, query }) =>
    topDimensions(
      key.siteKey,
      {
        ...queryOpts(query),
        dims: (
          query.get("dims") ?? "country,asn_org,flag,agent,reason,browser,os"
        ).split(","),
        limit: Number(query.get("limit")) || 10,
      },
      retention(),
    ),
  ),
);

route(
  "GET",
  "/keys/:siteKey/events",
  withKey(({ key, query }) =>
    listEvents(
      key.siteKey,
      {
        ...queryOpts(query),
        cursor: query.get("cursor") ?? undefined,
        limit: Number(query.get("limit")) || 50,
      },
      retention(),
    ),
  ),
);

const EXPORT_COLUMNS = [
  "time",
  "id",
  "ts",
  "type",
  "outcome",
  "reason",
  "ip",
  "country",
  "asn",
  "asn_org",
  "city",
  "ua",
  "browser",
  "os",
  "platform",
  "origin",
  "lang",
  "fp",
  "protocol",
  "solve_ms",
  "score",
  "verdict",
  "agent",
  "agent_confidence",
  "agent_verified",
  "flags",
  "rule",
  "token_id",
];

const csvCell = (v) => {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join(" ") : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

route(
  "GET",
  "/keys/:siteKey/events/export",
  withKey(({ key, query }) => {
    const opts = queryOpts(query);
    const csv = query.get("format") !== "ndjson";
    const rows = [];
    let cursor;
    while (rows.length < 5000) {
      const page = listEvents(
        key.siteKey,
        { ...opts, cursor, limit: 200 },
        retention(),
      );
      rows.push(...page.events);
      if (!page.next) break;
      cursor = page.next;
    }
    const lines = rows.map((e) =>
      csv
        ? EXPORT_COLUMNS.map((c) =>
            csvCell(c === "time" ? new Date(e.ts).toISOString() : e[c]),
          ).join(",")
        : JSON.stringify(e),
    );
    if (csv) lines.unshift(EXPORT_COLUMNS.join(","));
    const day = new Date(rows.at(-1)?.ts ?? Date.now())
      .toISOString()
      .slice(0, 10);
    return {
      export: true,
      body: `${lines.join("\n")}\n`,
      type: csv
        ? "text/csv; charset=utf-8"
        : "application/x-ndjson; charset=utf-8",
      filename: `cap-${key.siteKey}-events-${day}.${csv ? "csv" : "ndjson"}`,
    };
  }),
);

route(
  "GET",
  "/keys/:siteKey/events/:id",
  ({ params }) =>
    (findKey(params.siteKey) &&
      eventDetail(params.siteKey, decodeURIComponent(params.id))) ??
    fail("Event not found"),
);

route(
  "GET",
  "/keys/:siteKey/rules",
  withKey(({ key }) => rulesOut(state.rules[key.siteKey] ?? [])),
);

const previewValue = (c, e) => {
  if (c.field === "header" || c.field.endsWith("_velocity")) return null;
  if (c.field === "visitor") return e.fp;
  if (c.field === "flag")
    return (e.flags ?? []).filter((f) => !f.startsWith("rule:"));
  return e[c.field];
};

const inPreviewList = (id, e) => {
  const list = state.lists.find((l) => l.id === id);
  const now = Date.now();
  return (list?.items ?? []).some((i) => {
    if (i.expires && i.expires <= now) return false;
    const v = String(i.value).toLowerCase();
    if (i.kind === "ip") return e.ip?.toLowerCase() === v;
    if (i.kind === "cidr") {
      const parsed = parseCidr(i.value);
      return !!(parsed && e.ip && ipInCidr(e.ip, parsed));
    }
    if (i.kind === "asn") return String(e.asn) === v;
    if (i.kind === "org") return e.asn_org?.toLowerCase() === v;
    if (i.kind === "country") return e.country?.toLowerCase() === v;
    if (i.kind === "ua") return !!e.ua?.toLowerCase().includes(v);
    if (i.kind === "visitor") return e.fp === i.value;
    return false;
  });
};

const previewTest = (c, e) => {
  const v = previewValue(c, e);
  if (c.op === "exists") return v != null && v !== "";
  if (c.op === "not_exists") return v == null || v === "";
  if (c.op === "is_true") return v === true;
  if (c.op === "is_false") return v !== true;
  if (c.op === "in_list") return inPreviewList(c.value, e);
  if (c.op === "not_in_list") return !inPreviewList(c.value, e);
  if (c.op === "has" || c.op === "not_has") {
    const flags = v ?? [];
    const found = c.value.endsWith("*")
      ? flags.some((f) => f.startsWith(c.value.slice(0, -1)))
      : flags.includes(c.value);
    return c.op === "has" ? found : !found;
  }
  if (v == null || v === "")
    return c.op === "neq" || c.op === "not_in" || c.op === "not_contains";
  if (RULE_FIELDS[c.field]?.type === "number") {
    const n = Number(v);
    if (c.op === "eq") return n === c.value;
    if (c.op === "neq") return n !== c.value;
    if (c.op === "gt") return n > c.value;
    if (c.op === "gte") return n >= c.value;
    if (c.op === "lt") return n < c.value;
    if (c.op === "lte") return n <= c.value;
    return false;
  }
  const lower = String(v).toLowerCase();
  const want = Array.isArray(c.value) ? "" : String(c.value).toLowerCase();
  if (c.op === "eq") return lower === want;
  if (c.op === "neq") return lower !== want;
  if (c.op === "contains") return lower.includes(want);
  if (c.op === "not_contains") return !lower.includes(want);
  if (c.op === "starts_with") return lower.startsWith(want);
  if (c.op === "matches") {
    try {
      return new RegExp(c.value, "i").test(String(v));
    } catch {
      return false;
    }
  }
  if (c.op === "in" || c.op === "not_in") {
    const found = c.value.some((x) => {
      if (x.toLowerCase() === lower) return true;
      const parsed = x.includes("/") && parseCidr(x);
      return !!(parsed && c.field === "ip" && ipInCidr(String(v), parsed));
    });
    return c.op === "in" ? found : !found;
  }
  return false;
};

const previewHits = (rule, e) => {
  for (const c of rule.conditions) {
    const ok = previewTest(c, e);
    if (rule.match === "all" && !ok) return false;
    if (rule.match === "any" && ok) return true;
  }
  return rule.match === "all";
};

const PREVIEW_UNSEEN = new Set(["header", "ip_velocity", "visitor_velocity"]);

function simulatePreview(rules, sample) {
  const per = new Map(
    rules.map((r) => [
      r.id,
      {
        matched: 0,
        decided: 0,
        stages: { challenge: 0, redeem: 0 },
        outcomes: { pass: 0, fail: 0, block: 0, limit: 0 },
        changes: { blocked: 0, unblocked: 0 },
        estimate: { matched: 0, blocked: 0, unblocked: 0 },
        ips: new Set(),
        visitors: new Set(),
        top: { ip: new Map(), country: new Map(), asn_org: new Map() },
        examples: [],
      },
    ]),
  );
  const totals = {
    events: 0,
    block: 0,
    allow: 0,
    flag: 0,
    harder: 0,
    blocked: 0,
    unblocked: 0,
  };
  for (const [e, w] of sample) {
    const stage = e.type === "redeem" ? "redeem" : "challenge";
    totals.events += w;
    const lifted = e.outcome === "block" && e.reason !== "rate_limited";
    const passed = e.outcome !== "block" && e.outcome !== "limit";
    let action = null;
    let flagged = false;
    let harder = false;
    for (const rule of rules) {
      const requestOnly = rule.conditions.every(
        (c) => RULE_FIELDS[c.field]?.stage === "request",
      );
      if (stage === "challenge" && !requestOnly) continue;
      if (!previewHits(rule, e)) continue;
      const c = per.get(rule.id);
      c.matched++;
      c.estimate.matched += w;
      c.stages[stage]++;
      if (c.outcomes[e.outcome] != null) c.outcomes[e.outcome]++;
      if (e.ip) c.ips.add(e.ip);
      if (e.fp) c.visitors.add(e.fp);
      for (const f of ["ip", "country", "asn_org"])
        if (e[f]) c.top[f].set(e[f], (c.top[f].get(e[f]) ?? 0) + 1);
      if (c.examples.length < 5) c.examples.push(e);
      if (action || rule.enabled === false) continue;
      c.decided++;
      if (rule.action === "flag") flagged = true;
      else if (rule.action === "harder") harder = true;
      else {
        action = rule.action;
        if (action === "block" && passed) {
          c.changes.blocked++;
          c.estimate.blocked += w;
        }
        if (action === "allow" && lifted) {
          c.changes.unblocked++;
          c.estimate.unblocked += w;
        }
      }
    }
    if (action === "block") totals.block += w;
    if (action === "allow") totals.allow += w;
    if (flagged) totals.flag += w;
    if (harder) totals.harder += w;
    if (action === "block" && passed) totals.blocked += w;
    const ruleBlocked = e.outcome === "block" && e.reason?.startsWith("rule:");
    if ((action === "allow" && lifted) || (ruleBlocked && action !== "block"))
      totals.unblocked += w;
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return { per, totals };
}

route(
  "POST",
  "/keys/:siteKey/rules/preview",
  withKey(({ key, body }) => {
    const { rules, error } = validateRules(body?.rules);
    if (error) return fail(error);
    const lists = new Set(state.lists.map((l) => l.id));
    const missing = rules.find((r) =>
      r.conditions.some((c) => c.field === "list" && !lists.has(c.value)),
    );
    if (missing)
      return fail(`Rule "${missing.name}" points at a list that doesn't exist`);
    const range = body?.range ?? "24h";
    const span = overview(key.siteKey, { range }, retention()).range;
    const windows = 12;
    const step = Math.ceil((span.to - span.from) / windows);
    const sample = [];
    const kinds = [
      [{ field: "type", neg: false, value: "redeem" }],
      [
        { field: "type", neg: false, value: "challenge" },
        { field: "outcome", neg: false, value: "block" },
        { field: "outcome", neg: false, value: "limit" },
      ],
    ];
    for (let i = 0; i < windows; i++) {
      const from = span.from + i * step;
      const to = Math.min(span.to, from + step);
      for (const filters of kinds) {
        const { events } = listEvents(
          key.siteKey,
          { from, to, filters, limit: 250 },
          retention(),
        );
        if (!events.length) continue;
        const total = overview(key.siteKey, { from, to, filters }, retention())
          .summary.total;
        const w = Math.max(1, total / events.length);
        for (const e of events) sample.push([e, w]);
      }
    }
    sample.sort((a, b) => b[0].ts - a[0].ts);
    const draft = simulatePreview(rules, sample);
    const saved = simulatePreview(state.rules[key.siteKey] ?? [], sample);
    const topOf = (m) =>
      [...m]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, n]) => ({ value, n }));
    return {
      range: { from: span.from, to: span.to },
      sampled: sample.length,
      estimated: sample.some(([, w]) => w > 1),
      ipMasked: state.settings.analytics.ipMode !== "full",
      rules: rules.map((r) => {
        const c = draft.per.get(r.id);
        return {
          id: r.id,
          name: r.name,
          action: r.action,
          enabled: r.enabled !== false,
          stage: r.conditions.every(
            (x) => RULE_FIELDS[x.field]?.stage === "request",
          )
            ? "challenge"
            : "redeem",
          unseen: [
            ...new Set(
              r.conditions
                .map((x) => x.field)
                .filter((f) => PREVIEW_UNSEEN.has(f)),
            ),
          ],
          matched: c.matched,
          decided: c.decided,
          stages: c.stages,
          outcomes: c.outcomes,
          changes: c.changes,
          estimate: {
            matched: Math.round(c.estimate.matched),
            blocked: Math.round(c.estimate.blocked),
            unblocked: Math.round(c.estimate.unblocked),
          },
          ips: c.ips.size,
          visitors: c.visitors.size,
          top: {
            ip: topOf(c.top.ip),
            country: topOf(c.top.country),
            asn_org: topOf(c.top.asn_org),
          },
          examples: c.examples,
        };
      }),
      totals: { draft: draft.totals, saved: saved.totals },
    };
  }),
);

route(
  "GET",
  "/keys/:siteKey/analytics/checks",
  withKey(({ key, query }) => {
    const range = query.get("range") ?? "7d";
    const base = overview(
      key.siteKey,
      { range, filters: [{ field: "type", neg: false, value: "redeem" }] },
      retention(),
    );
    const span = base.range.to - base.range.from;
    const prevWin = { from: base.range.from - span, to: base.range.from };
    const dims = ["flag", "agent"];
    const now = topDimensions(
      key.siteKey,
      { range, dims, limit: 40 },
      retention(),
    );
    const before = topDimensions(
      key.siteKey,
      { ...prevWin, dims, limit: 100 },
      retention(),
    );
    const total = (b) =>
      b.challenges +
      b.solved +
      b.failed +
      b.blocked +
      b.limited +
      b.verified +
      (b.other ?? 0);
    const build = (dim) => {
      const prev = new Map((before[dim] ?? []).map((r) => [r.value, r.n]));
      const out = {};
      for (const row of now[dim] ?? []) {
        if (dim === "flag" && String(row.value).startsWith("rule:")) continue;
        const o = overview(
          key.siteKey,
          { range, filters: [{ field: dim, neg: false, value: row.value }] },
          retention(),
        );
        out[row.value] = {
          n: row.n,
          blocked: row.blocked ?? 0,
          previous: prev.get(row.value) ?? 0,
          series: o.series.map(total),
        };
      }
      for (const [value, n] of prev) {
        if (out[value] || (dim === "flag" && value.startsWith("rule:")))
          continue;
        out[value] = {
          n: 0,
          blocked: 0,
          previous: n,
          series: base.series.map(() => 0),
        };
      }
      return out;
    };
    return {
      range: base.range,
      attempts: {
        current: base.summary.total,
        previous: base.previous.total,
      },
      flags: build("flag"),
      agents: build("agent"),
    };
  }),
);

route("GET", "/lists/:id/hits", ({ params, query }) => {
  const list = state.lists.find((l) => l.id === params.id);
  if (!list) return fail("List not found");
  const range = query.get("range") ?? "7d";
  const columns = { ip: "ip", asn: "asn", country: "country", visitor: "fp" };
  const now = Date.now();
  const items = (list.items ?? [])
    .filter((i) => !i.expires || i.expires > now)
    .slice(0, 1000);
  const byKind = new Map();
  for (const i of items) {
    if (!columns[i.kind] && i.kind !== "org") continue;
    byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), String(i.value)]);
  }
  const hits = {};
  const add = (key, row) => {
    const cur = hits[key] ?? { n: 0, blocked: 0 };
    cur.n += row.n;
    cur.blocked += row.blocked ?? 0;
    hits[key] = cur;
  };
  let span = null;
  for (const key of state.keys) {
    for (const [kind, values] of byKind) {
      if (kind === "org") {
        const wanted = new Set(values.map((v) => v.toLowerCase()));
        const top = topDimensions(
          key.siteKey,
          { range, dims: ["asn_org"], limit: 100 },
          retention(),
        );
        for (const row of top.asn_org ?? [])
          if (wanted.has(String(row.value).toLowerCase()))
            add(`org:${String(row.value).toLowerCase()}`, row);
        continue;
      }
      const field = columns[kind];
      const top = topDimensions(
        key.siteKey,
        {
          range,
          filters: values.map((value) => ({ field, neg: false, value })),
          dims: [field],
          limit: 100,
        },
        retention(),
      );
      for (const row of top[field] ?? []) add(`${kind}:${row.value}`, row);
    }
    span ??= overview(key.siteKey, { range }, retention()).range;
  }
  return {
    range: { from: span?.from ?? now, to: span?.to ?? now },
    counted: items.filter((i) => i.kind !== "cidr" && i.kind !== "ua").length,
    total: items.length,
    uncounted: [
      ...new Set(
        items.map((i) => i.kind).filter((k) => k === "cidr" || k === "ua"),
      ),
    ],
    hits,
  };
});

route(
  "GET",
  "/keys/:siteKey/analytics/movers",
  withKey(({ key, query }) => {
    const opts = queryOpts(query);
    const range = opts.range ?? "24h";
    const dims = [
      "country",
      "asn_org",
      "flag",
      "agent",
      "reason",
      "browser",
      "rule",
    ];
    const cur = overview(key.siteKey, { ...opts, range }, retention());
    const span = cur.range.to - cur.range.from;
    const prevWin = { from: cur.range.from - span, to: cur.range.from };
    const nowTop = topDimensions(
      key.siteKey,
      { ...opts, range, dims, limit: 50 },
      retention(),
    );
    const prevTop = topDimensions(
      key.siteKey,
      { ...opts, range: undefined, ...prevWin, dims, limit: 50 },
      retention(),
    );
    const total = cur.summary.total;
    const previousTotal = cur.previous.total;
    const scale = previousTotal ? total / previousTotal : 1;
    const out = [];
    for (const dim of dims) {
      const current = nowTop[dim] ?? [];
      const previous = new Map((prevTop[dim] ?? []).map((r) => [r.value, r]));
      const prevFloor =
        previous.size < 50
          ? 0
          : Math.min(...[...previous.values()].map((r) => r.n));
      const consider = (value, c, p0) => {
        if (
          (dim === "flag" && /^(rule|agent):/.test(value)) ||
          (dim === "reason" && String(value).startsWith("rule:"))
        )
          return;
        const n = c?.n ?? 0;
        const p = p0?.n ?? prevFloor;
        if (Math.max(n, p) < 20) return;
        const expected = p * scale;
        const score = (n - expected) / Math.sqrt(expected + n + 1);
        if (Math.abs(score) < 3) return;
        const label = c?.label ?? p0?.label;
        out.push({
          dim,
          value,
          ...(label != null && { label }),
          n,
          previous: p,
          expected: Math.round(expected),
          change: p0 && p ? n / p - 1 : null,
          blocked: c?.blocked ?? 0,
          score: Math.round(score * 10) / 10,
        });
      };
      const listed = new Set(current.map((r) => r.value));
      for (const r of current) consider(r.value, r, previous.get(r.value));
      if (current.length < 50)
        for (const r of previous.values())
          if (!listed.has(r.value)) consider(r.value, null, r);
    }
    out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    return {
      range: { from: cur.range.from, to: cur.range.to },
      total,
      previousTotal,
      movers: out.slice(0, 12),
    };
  }),
);

route(
  "GET",
  "/keys/:siteKey/rules/stats",
  withKey(({ key, query }) => {
    const range = query.get("range") ?? "24h";
    const rules = state.rules[key.siteKey] ?? [];
    const top = topDimensions(
      key.siteKey,
      { range, dims: ["rule", "flag"], limit: 100 },
      retention(),
    );
    const viaRule = new Set(top.rule.map((r) => r.value));
    const ids = new Set([
      ...rules.map((r) => r.id),
      ...viaRule,
      ...top.flag
        .filter((f) => f.value.startsWith("rule:"))
        .map((f) => f.value.slice(5)),
    ]);
    const hitsOf = (b) =>
      b.challenges +
      b.solved +
      b.failed +
      b.blocked +
      b.limited +
      b.verified +
      (b.other ?? 0);
    let span = null;
    const out = {};
    for (const id of ids) {
      const action = rules.find((r) => r.id === id)?.action;
      const flagged = action === "flag" || (!action && !viaRule.has(id));
      const filters = [
        flagged
          ? { field: "flag", neg: false, value: `rule:${id}` }
          : { field: "rule", neg: false, value: id },
      ];
      const o = overview(key.siteKey, { range, filters }, retention());
      span = o.range;
      const series = o.series.map(hitsOf);
      const hits = series.reduce((a, b) => a + b, 0);
      const firstAt = series.findIndex((n) => n > 0);
      const { failed, blocked, limited } = o.summary;
      out[id] = {
        hits,
        previous: o.previous.total,
        outcomes: {
          pass: Math.max(0, hits - failed - blocked - limited),
          fail: failed,
          block: blocked,
          limit: limited,
        },
        ips: o.summary.ips,
        visitors: o.summary.clients,
        first: firstAt >= 0 ? o.series[firstAt].b : null,
        last: hits
          ? (listEvents(key.siteKey, { range, filters, limit: 1 }, retention())
              .events[0]?.ts ?? null)
          : null,
        series,
        ...(!action && { removed: true }),
      };
    }
    span ??= overview(key.siteKey, { range }, retention()).range;
    return { range: span, rules: out };
  }),
);

route(
  "GET",
  "/keys/:siteKey/events/:id/context",
  withKey(({ key, params }) => {
    const detail = eventDetail(key.siteKey, decodeURIComponent(params.id));
    if (!detail?.event) return fail("Event not found");
    const e = detail.event;
    const retain = retention();
    const to = Date.now() + MIN;
    const from = to - retain * 86_400_000;
    const week = to - 7 * 86_400_000;
    const footprint = (field, value, since) => {
      if (value == null || value === "") return null;
      const filters = [{ field, neg: false, value: String(value) }];
      const o = overview(key.siteKey, { from: since, to, filters }, retain);
      if (!o.summary.total) return null;
      const seen = o.series.filter((b) => hitsOf(b) > 0);
      const s = o.summary;
      return {
        total: s.total,
        blocked: s.blocked,
        limited: s.limited,
        failed: s.failed,
        solved: s.solved,
        flagged: s.flagged,
        ips: s.ips,
        visitors: s.clients,
        first: seen[0]?.b ?? e.ts,
        last: Math.max(e.ts, seen.at(-1)?.b ?? e.ts),
      };
    };
    const hitsOf = (b) =>
      b.challenges +
      b.solved +
      b.failed +
      b.blocked +
      b.limited +
      b.verified +
      (b.other ?? 0);
    const ip = footprint("ip", e.ip, from);
    const network = e.asn ? footprint("asn", e.asn, week) : null;
    const weekTotal = e.asn
      ? overview(key.siteKey, { from: week, to }, retain).summary.total
      : 0;
    const lists = state.lists
      .map((l) => {
        const hit = (l.items ?? []).find(
          (i) =>
            (i.kind === "ip" && i.value === e.ip) ||
            (i.kind === "asn" && Number(i.value) === e.asn) ||
            (i.kind === "country" && i.value === e.country) ||
            (i.kind === "visitor" && i.value === e.fp),
        );
        return (
          hit && { id: l.id, name: l.name, kind: hit.kind, value: hit.value }
        );
      })
      .filter(Boolean);
    const rules = (state.rules[key.siteKey] ?? [])
      .filter((r) =>
        r.conditions.some(
          (c) =>
            (c.field === "country" && c.op === "eq" && c.value === e.country) ||
            (c.field === "list" && lists.some((l) => l.id === c.value)),
        ),
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        action: r.action,
        enabled: r.enabled !== false,
      }));
    return {
      ip: ip && { ...ip, keys: 1 },
      network: network && {
        ...network,
        asn: e.asn,
        asn_org: e.asn_org,
        share: weekTotal ? network.total / weekTotal : null,
      },
      visitor: footprint("fp", e.fp, from),
      lists,
      rules,
      window: { from, to, networkFrom: week },
    };
  }),
);

route(
  "PUT",
  "/keys/:siteKey/rules",
  withKey(({ key, body }) => {
    const { rules, error } = validateRules(body?.rules);
    if (error) return fail(error);
    const lists = new Set(state.lists.map((l) => l.id));
    const missing = rules.find((r) =>
      r.conditions.some((c) => c.field === "list" && !lists.has(c.value)),
    );
    if (missing)
      return fail(`Rule "${missing.name}" points at a list that doesn't exist`);
    state.rules[key.siteKey] = rules;
    save();
    return { success: true, rules };
  }),
);

route("GET", "/policy/catalog", () => ({
  fields: RULE_FIELDS,
  ops: OPS,
  actions: ACTIONS,
  signals: SIGNAL_GROUPS,
  agents: KNOWN_AGENTS,
  signedAgents: [...SIGNED_AGENTS],
  risk,
  listKinds: ENTRY_KINDS,
  webhookTriggers: WEBHOOK_TRIGGERS,
  webhookInstanceTriggers: INSTANCE_TRIGGERS,
  webhookDigests: [0, 60, 300, 900, 3600],
  webhookMinCounts: [0, 5, 10, 25, 50, 100, 500],
  webhookServices: Object.entries(WEBHOOK_SERVICES).map(
    ([id, { name, blurb, fields }]) => ({ id, name, blurb, fields }),
  ),
}));

route("GET", "/lists", () =>
  state.lists.map(listSummary).toSorted((a, b) => b.created - a.created),
);

route("POST", "/lists", ({ body }) => {
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 80)
    return fail("Give the list a name of up to 80 characters");
  const list = {
    id: `l_${newHex(5)}`,
    name,
    description: body?.description?.trim() ?? "",
    created: Date.now(),
    items: [],
  };
  state.lists.push(list);
  if (body?.items?.length) addItems(list, body.items);
  save();
  return { success: true, id: list.id };
});

const withList = (fn) => (ctx) => {
  const list = state.lists.find((l) => l.id === ctx.params.id);
  if (!list) return fail("List not found");
  return fn({ ...ctx, list });
};

route(
  "GET",
  "/lists/:id",
  withList(({ list }) => listDetail(list)),
);

route(
  "PUT",
  "/lists/:id",
  withList(({ list, body }) => {
    if (body?.name != null)
      list.name = String(body.name).trim().slice(0, 80) || list.name;
    if (body?.description != null)
      list.description = String(body.description).slice(0, 300);
    save();
    return { success: true };
  }),
);

route(
  "DELETE",
  "/lists/:id",
  withList(({ list }) => {
    const used = Object.values(state.rules).some((rules) =>
      rules.some((r) =>
        r.conditions.some((c) => c.field === "list" && c.value === list.id),
      ),
    );
    if (used)
      return fail("A rule still uses this list. Remove the rule first.");
    state.lists = state.lists.filter((l) => l !== list);
    save();
    return { success: true };
  }),
);

route(
  "POST",
  "/lists/:id/items",
  withList(({ list, body }) => {
    const res = addItems(list, body?.items);
    save();
    return res;
  }),
);

route(
  "DELETE",
  "/lists/:id/items",
  withList(({ list, body }) => {
    const entries = (body?.items ?? [])
      .map((i) => normalizeEntry(i.kind, i.value))
      .filter(Boolean);
    list.items = list.items.filter(
      (i) => !entries.some(([k, v]) => k === i.kind && v === i.value),
    );
    save();
    return { success: true, removed: entries.length };
  }),
);

for (const [base, scopeOf] of [
  ["/keys/:siteKey/webhooks", (ctx) => ctx.params.siteKey],
  ["/settings/webhooks", () => INSTANCE],
]) {
  const known = (ctx) => scopeOf(ctx) === INSTANCE || findKey(scopeOf(ctx));
  const withHook = (fn) => (ctx) => {
    const scope = scopeOf(ctx);
    const hook = (state.webhooks[scope] ?? []).find(
      (h) => h.id === ctx.params.id,
    );
    if (!hook) return fail("Webhook not found");
    return fn({ ...ctx, scope, hook });
  };

  route("GET", base, (ctx) =>
    known(ctx)
      ? (state.webhooks[scopeOf(ctx)] ?? []).map(publicWebhook)
      : fail("Key not found"),
  );

  route("POST", base, (ctx) => {
    if (!known(ctx)) return fail("Key not found");
    const scope = scopeOf(ctx);
    const { hook, error, field } = validateWebhook(ctx.body, null, scope);
    if (error) return { ...fail(error), field };
    state.webhooks[scope] ??= [];
    const hooks = state.webhooks[scope];
    if (hooks.length >= 10) return fail("You can add at most 10 webhooks here");
    const secret = `whsec_${newBase64Url(24)}`;
    const created = {
      ...hook,
      id: `wh_${newHex(6)}`,
      secret,
      created: Date.now(),
    };
    hooks.push(created);
    save();
    return {
      success: true,
      webhook: publicWebhook(created),
      ...(hook.service === "generic" && { secret }),
    };
  });

  route(
    "PUT",
    `${base}/:id`,
    withHook(({ hook, body, scope }) => {
      const {
        hook: next,
        error,
        field,
      } = validateWebhook({ ...hook, ...body }, hook, scope);
      if (error) return { ...fail(error), field };
      if (next.enabled) delete hook.paused;
      if (next.service === "generic") delete hook.config;
      else delete hook.headers;
      Object.assign(hook, next);
      save();
      return { success: true, webhook: publicWebhook(hook) };
    }),
  );

  route(
    "DELETE",
    `${base}/:id`,
    withHook(({ scope, hook }) => {
      state.webhooks[scope] = state.webhooks[scope].filter((h) => h !== hook);
      delete state.deliveries[hook.id];
      save();
      return { success: true };
    }),
  );

  route(
    "POST",
    `${base}/:id/test`,
    withHook(({ hook, scope }) => {
      const entry = {
        at: Date.now(),
        ms: 60 + Math.floor(Math.random() * 180),
        status: 200,
        ok: true,
        error: null,
        attempt: 0,
        event: "test",
        kind: scope === INSTANCE ? "cap.instance" : "cap.test",
      };
      state.deliveries[hook.id] = [
        entry,
        ...(state.deliveries[hook.id] ?? []),
      ].slice(0, 20);
      save();
      return { ok: true, status: 200, error: null };
    }),
  );

  route(
    "POST",
    `${base}/:id/rotate`,
    withHook(({ hook }) => {
      hook.secret = `whsec_${newBase64Url(24)}`;
      save();
      return {
        success: true,
        webhook: publicWebhook(hook),
        secret: hook.secret,
      };
    }),
  );

  route(
    "POST",
    `${base}/:id/resend`,
    withHook(({ hook, body }) => {
      const entry = {
        at: Date.now(),
        ms: 80 + Math.floor(Math.random() * 160),
        status: 200,
        ok: true,
        error: null,
        attempt: 0,
        event: String(body?.event ?? ""),
        kind: "cap.event",
      };
      state.deliveries[hook.id] = [
        entry,
        ...(state.deliveries[hook.id] ?? []),
      ].slice(0, 20);
      save();
      return { success: true, ok: true, status: 200, error: null };
    }),
  );

  route(
    "GET",
    `${base}/:id/deliveries`,
    withHook(({ scope, hook }) => deliveries(scope, hook)),
  );
}

route("GET", "/settings/analytics", () => ({
  settings: { anonymizeDays: 60, ...state.settings.analytics },
  status: storageStatus(),
}));

route("PUT", "/settings/analytics", ({ body }) => {
  const s = state.settings.analytics;
  const days = body?.retentionDays ?? s.retentionDays;
  const anonymize = body?.anonymizeDays ?? s.anonymizeDays ?? 60;
  if (!Number.isInteger(days) || days < 0 || days > 3650)
    return fail("Keep events for 0 to 3650 days");
  if (!Number.isInteger(anonymize) || anonymize < 0 || anonymize > 3650)
    return fail("Anonymize IP addresses after 0 to 3650 days");
  if (body?.ipMode && !["full", "truncate", "none"].includes(body.ipMode))
    return fail("Unknown IP mode");
  state.settings.analytics = {
    retentionDays: days,
    anonymizeDays: anonymize,
    ipMode: body?.ipMode ?? s.ipMode,
    logChallenges: body?.logChallenges ?? s.logChallenges,
  };
  save();
  return { success: true, settings: { ...state.settings.analytics } };
});

const loginBackground = () => {
  if (!state.settings.loginBackground)
    state.settings.loginBackground = {
      mode: "default",
      color: null,
      image: null,
    };
  return state.settings.loginBackground;
};

route("GET", "/settings/login-background", () => loginBackground());

route("PUT", "/settings/login-background", ({ body }) => {
  const bg = loginBackground();
  if (body?.mode) bg.mode = body.mode;
  if (body?.color !== undefined) bg.color = body.color;
  if (body?.focus && bg.image) bg.image.focus = body.focus;
  save();
  return { success: true, ...bg };
});

route("PUT", "/settings/login-background/image", ({ body }) => {
  const data = String(body?.data ?? "");
  const type = data.match(/^data:(image\/(?:jpeg|png|webp));base64,/)?.[1];
  if (!type) return fail("Use a JPEG, PNG or WebP image.");
  const size = Math.floor(((data.length - data.indexOf(",") - 1) * 3) / 4);
  if (size > 750_000) return fail("Use an image under 750 KB.");
  const bg = loginBackground();
  bg.mode = "image";
  bg.image = {
    type,
    size,
    etag: newHex(10),
    updated: Date.now(),
    focus: [50, 50],
  };
  save();
  return { success: true, ...bg };
});

route("DELETE", "/settings/login-background/image", () => {
  const bg = loginBackground();
  bg.image = null;
  if (bg.mode === "image") bg.mode = "default";
  save();
  return { success: true, ...bg };
});

route("GET", "/settings/sessions", () =>
  state.sessions
    .filter((s) => s.expires > Date.now())
    .map((s) => ({
      token: s.token,
      expires: new Date(s.expires).toISOString(),
      created: new Date(s.created).toISOString(),
      seen: new Date(s.seen ?? s.created).toISOString(),
      ua: s.ua ?? null,
      browser: s.browser ?? null,
      os: s.os ?? null,
      country: s.country ?? null,
    })),
);

route("POST", "/logout", ({ body }) => {
  if (!body?.session) return { success: true };
  if (body.session.length < 10) return fail("Session code too short");
  const match = state.sessions.find((s) => s.token.endsWith(body.session));
  if (!match) return fail("Session not found");
  state.sessions = state.sessions.filter((s) => s !== match);
  save();
  return { success: true };
});

const proxyAuth = {
  mode: "off",
  header: "X-Cap-Proxy-Secret",
  hasSecret: false,
};

route("GET", "/settings/proxy-auth", () => ({
  ...proxyAuth,
  requestPasses: false,
}));

route("PUT", "/settings/proxy-auth", ({ body }) => {
  if (body?.mode !== "off" && !proxyAuth.hasSecret)
    return fail("Generate a proxy secret before turning proxy sign-in on.");
  const header = body?.header?.trim() || "X-Cap-Proxy-Secret";
  if (body?.mode === "require")
    return fail(
      `This request didn't carry a valid ${header} header, so proxy-only sign-in would lock you out. Open the dashboard through your proxy, then try again.`,
    );
  proxyAuth.mode = body?.mode ?? "off";
  proxyAuth.header = header;
  return { success: true };
});

route("POST", "/settings/proxy-auth/secret", () => {
  proxyAuth.hasSecret = true;
  return { success: true, secret: `cps_${newToken(43)}` };
});

route("GET", "/settings/apikeys", () =>
  state.apikeys
    .toSorted((a, b) => b.created - a.created)
    .map((k) => ({
      name: k.name,
      id: k.id,
      created: new Date(k.created).toISOString(),
      siteKeys: k.siteKeys,
      readonly: k.readonly,
    })),
);

route("POST", "/settings/apikeys", ({ body }) => {
  const name = String(body?.name ?? "");
  if (!name) return fail("Give the API key a name");
  const siteKeys = [...new Set(body?.siteKeys ?? [])];
  const unknown = siteKeys.find((sk) => !findKey(sk));
  if (unknown) return fail(`Unknown site key: ${unknown}`);
  const id = newHex(16);
  state.apikeys.push({
    id,
    name,
    created: Date.now(),
    siteKeys: siteKeys.length ? siteKeys : null,
    readonly: !!body?.readonly,
  });
  save();
  return { apiKey: `${id}_${newToken(32)}` };
});

route("DELETE", "/settings/apikeys/:id", ({ params }) => {
  if (!state.apikeys.some((k) => k.id === params.id))
    return fail("API key not found");
  state.apikeys = state.apikeys.filter((k) => k.id !== params.id);
  save();
  return { success: true };
});

for (const [name, keys] of [
  ["headers", ["ipHeader", "countryHeader", "asnHeader"]],
  ["ratelimit", ["max", "duration"]],
  ["cors", ["origins"]],
  ["filtering", ["blockNonBrowserUA", "requiredHeaders"]],
]) {
  route("GET", `/settings/${name}`, () =>
    structuredClone(state.settings[name]),
  );
  route("PUT", `/settings/${name}`, ({ body }) => {
    const next = { ...state.settings[name] };
    for (const k of keys) if (body?.[k] !== undefined) next[k] = body[k];
    if (name === "headers") for (const k of keys) next[k] = next[k] || "";
    state.settings[name] = next;
    save();
    return { success: true };
  });
}

route("GET", "/settings/ipdb", () => ({
  ...structuredClone(state.settings.ipdb),
  progress: ipdbProgress(),
}));

route("POST", "/settings/ipdb/download", ({ body }) => {
  if (ipdbProgress().active) return fail("Download already in progress");
  const mode = body?.mode;
  if (!["dbip", "maxmind", "ipinfo"].includes(mode))
    return fail("Invalid mode");
  if (mode === "maxmind" && (!body.maxmindAccountId || !body.maxmindKey))
    return fail("MaxMind account ID and license key required");
  if (mode === "ipinfo" && !body.ipinfoToken)
    return fail("IPInfo token required");
  state.download = {
    mode,
    started: Date.now(),
    maxmindAccountId: body.maxmindAccountId,
    maxmindKey: body.maxmindKey,
    ipinfoToken: body.ipinfoToken,
    cities: !!body.cities,
  };
  save();
  return { success: true };
});

route("GET", "/settings/ipdb/progress", () => ipdbProgress());

route("DELETE", "/settings/ipdb", () => {
  state.settings.ipdb = {
    mode: "",
    maxmindAccountId: "",
    maxmindKey: "",
    ipinfoToken: "",
    lastUpdated: "",
    country: { exists: false },
    asn: { exists: false },
    loaded: { country: false, asn: false },
    error: null,
  };
  save();
  return { success: true };
});

route("GET", "/settings/assets", () => assetStatus());

route("PUT", "/settings/assets", ({ body }) => {
  const version = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,32})?$/;
  const s = state.settings.assets;
  const next = {
    enabled: body?.enabled ?? s.enabled,
    widget: body?.widget ?? s.widget,
    wasm: body?.wasm ?? s.wasm,
  };
  if (!version.test(next.widget) || !version.test(next.wasm))
    return fail("Use version numbers such as 0.1.58.");
  state.settings.assets = next;
  if (next.enabled) state.settings.assetsCachedAt = Date.now();
  save();
  return { success: true, status: assetStatus() };
});

route("POST", "/settings/assets/refresh", () => {
  state.settings.assetsCachedAt = Date.now();
  save();
  return { success: true, status: assetStatus() };
});

route("GET", "/settings/assets/latest", () => ({
  success: true,
  widget: about.capAssets.widget,
  wasm: about.capAssets.wasm,
}));

route("GET", "/about", () => ({ bun: about.bun, ver: about.ver }));

const updateCheck = () => {
  state.settings.updateCheck ??= {
    enabled: true,
    interval: "daily",
    lastSent: Date.now() - 42 * MIN,
  };
  return state.settings.updateCheck;
};

const UPDATE_INTERVALS = { daily: 1, "4d": 4, weekly: 7, monthly: 30 };

const updateCheckStatus = () => {
  const { enabled, sidebar = true, interval, lastSent } = updateCheck();
  const solves = state.keys
    .map((k) => solvesByKey(k.siteKey).current)
    .reduce((a, b) => a + b, 0);
  const bucket = (n) => (n > 0 ? 10 ** Math.floor(Math.log10(n)) : 0);
  return {
    enabled,
    sidebar,
    lockedByEnv: false,
    interval,
    lastSent,
    nextCheck: lastSent + UPDATE_INTERVALS[interval] * 86_400_000,
    report: {
      id: "q7Rk2mXa",
      version: about.ver,
      runtime: "bun",
      keys: bucket(state.keys.length),
      solves: bucket(solves),
      memory: 64,
      vars: "AgFp",
    },
  };
};

route("GET", "/settings/update-check", () => updateCheckStatus());

route("PUT", "/settings/update-check", ({ body }) => {
  const s = updateCheck();
  if (typeof body?.enabled === "boolean") {
    s.enabled = body.enabled;
    if (body.enabled) s.lastSent = Date.now();
  }
  if (UPDATE_INTERVALS[body?.interval]) s.interval = body.interval;
  if (typeof body?.sidebar === "boolean") s.sidebar = body.sidebar;
  save();
  return { success: true, ...updateCheckStatus() };
});

route("GET", "/settings/updates", () => {
  const { enabled, sidebar = true, interval, lastSent } = updateCheck();
  return {
    enabled,
    sidebar,
    interval,
    nextCheck: enabled
      ? lastSent + UPDATE_INTERVALS[interval] * 86_400_000
      : null,
    version: about.ver,
    checkedAt: enabled ? lastSent : null,
    latest: null,
    advisories: [],
  };
});

const grants = () => {
  if (state.grants) return state.grants;
  const now = Date.now();
  const [shop, docs] = state.keys.map((k) => k.siteKey);
  const call = (ago, tool, status = 200, siteKey) => ({
    t: now - ago * MIN,
    tool,
    status,
    ...(siteKey && { siteKey }),
  });
  state.grants = [
    {
      id: newHex(12),
      clientName: "Claude Code",
      access: "full",
      siteKeys: null,
      created: now - 12 * 86_400_000,
      lastUsed: now - 6 * MIN,
      log: [
        call(6, "search_events", 200, shop),
        call(7, "get_event", 200, shop),
        call(9, "get_top", 200, shop),
        call(14, "block_ip", 200, shop),
        call(15, "get_rules", 200, shop),
        call(16, "set_rules", 400, shop),
        call(18, "set_rules", 200, shop),
        call(64, "get_analytics", 200, docs),
        call(66, "list_site_keys"),
        call(190, "list_lists"),
        call(192, "add_list_items", 200),
        call(1450, "get_insights", 200, shop),
        call(1452, "list_site_keys"),
      ],
    },
    {
      id: newHex(12),
      clientName: "Cursor",
      access: "read",
      siteKeys: shop ? [shop] : null,
      created: now - 3 * 86_400_000,
      lastUsed: now - 26 * 60 * MIN,
      log: [
        call(26 * 60, "get_analytics", 200, shop),
        call(26 * 60 + 1, "search_events", 200, shop),
        call(26 * 60 + 2, "block_ip", 403, shop),
        call(26 * 60 + 3, "get_site_key", 200, shop),
      ],
    },
    {
      id: newHex(12),
      clientName: "Codex",
      access: "full",
      siteKeys: [shop, docs].filter(Boolean),
      created: now - 6 * 86_400_000,
      lastUsed: now - 2 * 24 * 60 * MIN,
      log: [
        call(2 * 24 * 60, "list_webhooks", 200, shop),
        call(2 * 24 * 60 + 1, "create_webhook", 200, shop),
        call(2 * 24 * 60 + 3, "get_site_key", 200, docs),
        call(2 * 24 * 60 + 4, "update_site_key", 200, docs),
        call(5 * 24 * 60, "list_site_keys"),
      ],
    },
  ];
  return state.grants;
};

route("GET", "/oauth/grants", () => grants().map(({ log, ...g }) => g));

route("GET", "/oauth/requests/:id", () => ({
  clientName: "Claude Code",
  redirectTo: "localhost:33418",
  readOnly: false,
}));

route("POST", "/oauth/requests/:id", () => ({
  redirect: "#/keys/c4f1a9e27b/activity",
}));

route("GET", "/oauth/grants/:id/log", ({ params }) => {
  const g = grants().find((x) => x.id === params.id);
  return g ? { calls: g.log } : fail("App not found");
});

route("DELETE", "/oauth/grants/:id", ({ params }) => {
  state.grants = grants().filter((x) => x.id !== params.id);
  save();
  return { success: true };
});

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function handle(method, path, body) {
  const parsed = new URL(String(path), "https://demo.invalid/");
  const hit = routes.find(
    (r) => r.method === method && r.re.test(parsed.pathname),
  );
  await pause(
    method === "GET" ? 30 + Math.random() * 90 : 120 + Math.random() * 160,
  );
  if (!hit) return fail("Not found");
  const match = parsed.pathname.match(hit.re);
  const params = Object.fromEntries(
    hit.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]),
  );
  try {
    const result = hit.fn({
      params,
      query: parsed.searchParams,
      body: body === undefined ? undefined : structuredClone(body),
    });
    return structuredClone(result);
  } catch (e) {
    console.error("demo:", e);
    return fail("Something went wrong in the demo");
  }
}
