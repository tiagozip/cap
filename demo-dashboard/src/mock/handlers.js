import {
  ACTIONS,
  ENTRY_KINDS,
  OPS,
  RULE_FIELDS,
  risk,
  WEBHOOK_TRIGGERS,
} from "virtual:cap-demo-server";
import { isIp, parseCidr } from "../../../capd/src/policy/ip.js";
import {
  cleanAgentActions,
  cleanSignalActions,
  KNOWN_AGENTS,
  SIGNAL_GROUPS,
  SIGNED_AGENTS,
} from "../../../capd/src/policy/signals.js";
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
const retention = () => state.settings.analytics.retentionDays;

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

const publicWebhook = ({ secret, ...hook }) => ({
  ...hook,
  secretHint: `${secret.slice(0, 8)}…`,
});

function validateWebhook(input) {
  let parsed;
  try {
    parsed = new URL(String(input?.url ?? ""));
  } catch {
    return { error: "Enter a valid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    return { error: "Webhooks must use http or https" };
  if (parsed.username || parsed.password)
    return { error: "Put credentials in the webhook secret, not the URL" };
  if (/^(localhost|127\.|10\.|192\.168\.|\[?::1)/.test(parsed.hostname))
    return { error: "Webhooks can't point at private or local addresses" };
  const triggers = (Array.isArray(input.triggers) ? input.triggers : []).filter(
    (t) => WEBHOOK_TRIGGERS.includes(t),
  );
  if (!triggers.length) return { error: "Pick at least one trigger" };
  return {
    hook: {
      url: parsed.toString(),
      triggers: [...new Set(triggers)],
      enabled: input.enabled !== false,
      name: String(input.name ?? "")
        .trim()
        .slice(0, 60),
    },
  };
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
            d.mode === "maxmind"
              ? "GeoLite2-Country.mmdb"
              : "dbip-country-lite.mmdb",
            7_342_118,
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
      maxmindAccountId: d.maxmindAccountId ?? "",
      maxmindKey: d.maxmindKey ? `••••${d.maxmindKey.slice(-4)}` : "",
      ipinfoToken: d.ipinfoToken ? `••••${d.ipinfoToken.slice(-4)}` : "",
      lastUpdated: new Date().toISOString(),
      country: { exists: true, size: files[0][1] },
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

route(
  "GET",
  "/keys/:siteKey/webhooks",
  withKey(({ key }) => (state.webhooks[key.siteKey] ?? []).map(publicWebhook)),
);

route(
  "POST",
  "/keys/:siteKey/webhooks",
  withKey(({ key, body }) => {
    const { hook, error } = validateWebhook(body);
    if (error) return fail(error);
    state.webhooks[key.siteKey] ??= [];
    const hooks = state.webhooks[key.siteKey];
    if (hooks.length >= 10) return fail("A key can have at most 10 webhooks");
    const secret = `whsec_${newBase64Url(24)}`;
    const created = {
      ...hook,
      id: `wh_${newHex(6)}`,
      secret,
      created: Date.now(),
    };
    hooks.push(created);
    save();
    return { success: true, webhook: publicWebhook(created), secret };
  }),
);

const withHook = (fn) => (ctx) => {
  const hook = (state.webhooks[ctx.params.siteKey] ?? []).find(
    (h) => h.id === ctx.params.id,
  );
  if (!hook) return fail("Webhook not found");
  return fn({ ...ctx, hook });
};

route(
  "PUT",
  "/keys/:siteKey/webhooks/:id",
  withHook(({ hook, body }) => {
    const { hook: next, error } = validateWebhook({ ...hook, ...body });
    if (error) return fail(error);
    Object.assign(hook, next);
    save();
    return { success: true, webhook: publicWebhook(hook) };
  }),
);

route(
  "DELETE",
  "/keys/:siteKey/webhooks/:id",
  withHook(({ params, hook }) => {
    state.webhooks[params.siteKey] = state.webhooks[params.siteKey].filter(
      (h) => h !== hook,
    );
    delete state.deliveries[hook.id];
    save();
    return { success: true };
  }),
);

route(
  "POST",
  "/keys/:siteKey/webhooks/:id/test",
  withHook(({ hook }) => {
    const entry = {
      at: Date.now(),
      ms: 60 + Math.floor(Math.random() * 180),
      status: 200,
      ok: true,
      error: null,
      attempt: 0,
      event: "test",
      kind: "cap.test",
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
  "GET",
  "/keys/:siteKey/webhooks/:id/deliveries",
  withHook(({ params, hook }) => deliveries(params.siteKey, hook)),
);

route("GET", "/settings/analytics", () => ({
  settings: { ...state.settings.analytics },
  status: storageStatus(),
}));

route("PUT", "/settings/analytics", ({ body }) => {
  const s = state.settings.analytics;
  const days = body?.retentionDays ?? s.retentionDays;
  if (!Number.isFinite(days) || days < 1 || days > 3650)
    return fail("Keep events for 1 to 3650 days");
  if (body?.ipMode && !["full", "truncate", "none"].includes(body.ipMode))
    return fail("Unknown IP mode");
  state.settings.analytics = {
    retentionDays: Math.round(days),
    ipMode: body?.ipMode ?? s.ipMode,
    logChallenges: body?.logChallenges ?? s.logChallenges,
  };
  save();
  return { success: true, settings: { ...state.settings.analytics } };
});

route("GET", "/settings/sessions", () =>
  state.sessions
    .filter((s) => s.expires > Date.now())
    .map((s) => ({
      token: s.token,
      expires: new Date(s.expires).toISOString(),
      created: new Date(s.created).toISOString(),
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
