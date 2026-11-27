import { createHmac, randomBytes } from "node:crypto";
import { db } from "#db";
import { defer, later } from "#platform";
import { getQueries, onEvent } from "../events/index.js";
import { isLocalHostname, resolvePublicAddress } from "./address.js";
import { getRules } from "./rules.js";
import { KNOWN_AGENTS, SIGNAL_GROUPS } from "./signals.js";
import {
  buildRequests,
  cleanServiceConfig,
  formatMessage,
  publicServiceConfig,
  SERVICE_IDS,
  serviceLabel,
  serviceUrls,
  WEBHOOK_SERVICES,
} from "./webhook-services.js";

export const INSTANCE = "@instance";

export const WEBHOOK_TRIGGERS = [
  "all",
  "challenge",
  "solve",
  "siteverify",
  "block",
  "fail",
  "limit",
  "siteverify_fail",
  "flagged",
  "score",
  "agent",
  "rule",
  "reason",
];

export const INSTANCE_TRIGGERS = [
  "login",
  "login_failed",
  "keys",
  "access",
  "settings",
  "automation",
  "update",
  "security",
];

export const NOTICE_TRIGGERS = ["update", "security"];
const CHANGE_TRIGGERS = ["keys", "access", "settings"];

export const WEBHOOK_DIGESTS = [0, 60, 300, 900, 3600];

export { SERVICE_IDS as WEBHOOK_SERVICE_IDS };

export const WEBHOOK_MIN_COUNTS = [0, 5, 10, 25, 50, 100, 500];

const FILTER_LIMIT = 100;
const FLAG_IDS = new Set(
  SIGNAL_GROUPS.flatMap((g) => g.signals.map(([id]) => id)),
);
const AGENT_IDS = new Set(KNOWN_AGENTS.map(([id]) => id));

const MAX_WEBHOOKS = 10;
const MAX_HEADERS = 10;
const QUEUE_MAX = 1000;
const RATE_PER_SEC = 50;
const RETRIES = [1_000, 5_000, 30_000];
const CACHE_TTL = 5_000;
const PAUSE_AFTER = 20;
const DIGEST_KEEP = 50;
const RESERVED_HEADERS = new Set([
  "host",
  "content-type",
  "content-length",
  "connection",
  "transfer-encoding",
  "user-agent",
  "cap-signature",
  "cap-webhook-id",
]);

const cache = new Map();
const queues = new Map();
const digests = new Map();
const names = new Map();

const allowPrivate = () => process.env.WEBHOOK_ALLOW_PRIVATE === "true";

export async function getWebhooks(siteKey) {
  const hit = cache.get(siteKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.hooks;
  let hooks = [];
  try {
    hooks = JSON.parse((await db.get(`webhooks:${siteKey}`)) || "[]");
  } catch {}
  cache.set(siteKey, { hooks, ts: Date.now() });
  return hooks;
}

const serviceOf = (hook) => hook.service ?? "generic";

export const publicWebhook = ({ secret, config, headers, ...hook }) => {
  const service = serviceOf(hook);
  const generic = service === "generic";
  return {
    ...hook,
    service,
    label: generic
      ? hook.url.replace(/^https?:\/\//, "")
      : serviceLabel(service, config),
    ...(generic
      ? {
          secretHint: `${secret.slice(0, 8)}…`,
          headers: (headers ?? []).map(({ name }) => ({ name, value: "" })),
        }
      : publicServiceConfig(service, config)),
    digest: hook.digest ?? 0,
  };
};

function cleanHeaders(input, previous = []) {
  const out = [];
  for (const h of Array.isArray(input) ? input : []) {
    const name = String(h?.name ?? "").trim();
    let value = String(h?.value ?? "").trim();
    if (!name && !value) continue;
    if (!/^[A-Za-z0-9-]{1,64}$/.test(name))
      return { error: `"${name.slice(0, 30)}" isn't a valid header name` };
    if (RESERVED_HEADERS.has(name.toLowerCase()))
      return { error: `Cap sets the ${name} header itself` };
    if (!value)
      value =
        previous.find((p) => p.name.toLowerCase() === name.toLowerCase())
          ?.value ?? "";
    if (!value) return { error: `Enter a value for the ${name} header` };
    if (value.length > 1000 || /[\r\n]/.test(value))
      return { error: `The ${name} header value isn't allowed` };
    if (out.some((o) => o.name.toLowerCase() === name.toLowerCase()))
      return { error: `The ${name} header is listed twice` };
    out.push({ name, value });
  }
  if (out.length > MAX_HEADERS)
    return { error: `Add at most ${MAX_HEADERS} headers` };
  return { headers: out };
}

function checkUrl(raw, label = "URL") {
  let url;
  try {
    url = new URL(String(raw ?? ""));
  } catch {
    return { error: `Enter a valid ${label}` };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { error: "Webhooks must use http or https" };
  if (url.username || url.password)
    return { error: "Put credentials in the webhook secret, not the URL" };
  if (!allowPrivate() && isLocalHostname(url.hostname))
    return { error: "Webhooks can't point at private or local addresses" };
  return { url };
}

function cleanList(raw, test, label) {
  if (raw == null) return { list: [] };
  if (!Array.isArray(raw)) return { error: `Pick the ${label} as a list` };
  const list = [...new Set(raw.map((v) => String(v ?? "").trim()))].filter(
    Boolean,
  );
  if (list.length > FILTER_LIMIT)
    return { error: `Pick at most ${FILTER_LIMIT} ${label}` };
  const bad = list.find((v) => !test(v));
  if (bad) return { error: `"${bad.slice(0, 40)}" isn't one of the ${label}` };
  return { list };
}

function cleanFilters(input, triggers) {
  const spec = {
    rules: ["rule", "rules", (v) => /^[\w-]{1,64}$/.test(v)],
    reasons: ["reason", "reasons", (v) => /^[\w:.-]{1,80}$/.test(v)],
    flags: ["flagged", "risk flags", (v) => FLAG_IDS.has(v)],
    agents: [
      "agent",
      "AI agents",
      (v) => AGENT_IDS.has(v) || /^[a-z0-9][a-z0-9-]{0,63}$/.test(v),
    ],
  };
  const filters = {};
  for (const [key, [trigger, label, test]] of Object.entries(spec)) {
    if (!triggers.includes(trigger)) continue;
    const { list, error } = cleanList(input?.[key], test, label);
    if (error) return { error, field: key };
    if (list.length) filters[key] = list;
  }
  if (triggers.includes("score")) {
    const score = Number(input?.score ?? 0.75);
    if (!Number.isFinite(score) || score < 0.05 || score > 1)
      return { error: "Pick a risk score between 0.05 and 1", field: "score" };
    filters.score = Math.round(score * 100) / 100;
  }
  const countries = cleanList(
    input?.countries?.map?.((c) => String(c).toUpperCase()) ?? input?.countries,
    (v) => /^[A-Z]{2}$/.test(v),
    "countries",
  );
  if (countries.error) return { error: countries.error, field: "countries" };
  if (countries.list.length) {
    filters.countries = countries.list;
    filters.exceptCountries = input?.exceptCountries === true;
  }
  return { filters };
}

export function validateWebhook(input, current, scope) {
  const instance = scope === INSTANCE;
  const allowed = instance ? INSTANCE_TRIGGERS : WEBHOOK_TRIGGERS;
  const service = String(input?.service ?? current?.service ?? "generic");
  if (!WEBHOOK_SERVICES[service]) return { error: "Pick a service" };
  const triggers = (Array.isArray(input.triggers) ? input.triggers : []).filter(
    (t) => allowed.includes(t),
  );
  if (!triggers.length) return { error: "Pick at least one trigger" };
  const digest = instance ? 0 : Number(input.digest ?? current?.digest ?? 0);
  if (!WEBHOOK_DIGESTS.includes(digest))
    return { error: "Pick how often to send" };
  const min = digest ? Number(input.min ?? current?.min ?? 0) : 0;
  if (!WEBHOOK_MIN_COUNTS.includes(min))
    return { error: "Pick how many events a summary needs", field: "min" };
  const cleaned = instance
    ? { filters: {} }
    : cleanFilters(input.filters ?? current?.filters, triggers);
  if (cleaned.error) return cleaned;
  const hook = {
    service,
    triggers: [...new Set(triggers)],
    enabled: input.enabled !== false,
    name: String(input.name ?? "")
      .trim()
      .slice(0, 60),
    digest,
    min,
    filters: cleaned.filters,
  };
  const same = current && serviceOf(current) === service;
  if (service === "generic") {
    const { url, error } = checkUrl(input.url);
    if (error) return { error, field: "url" };
    const headers = cleanHeaders(
      input.headers ?? (same ? current.headers : []),
      same ? current.headers : [],
    );
    if (headers.error) return { error: headers.error, field: "headers" };
    return { hook: { ...hook, url: url.toString(), headers: headers.headers } };
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
  for (const raw of serviceUrls(service, config)) {
    const checked = checkUrl(raw);
    if (checked.error) return { error: checked.error, field: "config" };
  }
  return { hook: { ...hook, url: "", config } };
}

export async function saveWebhooks(siteKey, hooks) {
  if (hooks.length > MAX_WEBHOOKS) return false;
  const previous = await getWebhooks(siteKey);
  await db.set(`webhooks:${siteKey}`, JSON.stringify(hooks));
  cache.delete(siteKey);
  for (const old of previous) {
    const next = hooks.find((h) => h.id === old.id);
    if (!next) {
      queues.delete(old.id);
      digests.delete(old.id);
    } else if (queues.has(old.id)) queues.get(old.id).hook = next;
  }
  return true;
}

export const newWebhookSecret = () =>
  `whsec_${randomBytes(24).toString("base64url")}`;
export const newWebhookId = () => `wh_${randomBytes(6).toString("hex")}`;

export function matches(hook, event) {
  if (!hook.enabled) return false;
  const f = hook.filters ?? {};
  if (f.countries?.length) {
    const listed = f.countries.includes(event.country);
    if (listed === !!f.exceptCountries) return false;
  }
  const any = (list, v) => !list?.length || list.includes(v);
  return hook.triggers.some((t) => {
    if (t === "all") return true;
    if (t === "challenge") return event.type === "challenge";
    if (t === "solve")
      return event.type === "redeem" && event.outcome === "pass";
    if (t === "siteverify") return event.type === "siteverify";
    if (t === "siteverify_fail")
      return event.type === "siteverify" && event.outcome !== "pass";
    if (t === "block") return event.outcome === "block";
    if (t === "fail") return event.outcome === "fail";
    if (t === "limit") return event.outcome === "limit";
    if (t === "score")
      return (
        typeof event.score === "number" && event.score >= (f.score ?? 0.75)
      );
    if (t === "reason")
      return (
        !!event.reason &&
        (!f.reasons?.length || f.reasons.includes(event.reason))
      );
    if (t === "flagged")
      return (
        event.type === "redeem" &&
        event.outcome === "pass" &&
        event.flags?.length > 0 &&
        (!f.flags?.length || event.flags.some((x) => f.flags.includes(x)))
      );
    if (t === "agent") return !!event.agent && any(f.agents, event.agent);
    if (t === "rule") return !!event.rule && any(f.rules, event.rule);
    return false;
  });
}

export function sign(secret, timestamp, body) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

const failureText = (status) =>
  status ? `Couldn't reach the URL (HTTP ${status})` : "Couldn't reach the URL";

async function logDelivery(hookId, entry) {
  const key = `webhook:${hookId}:log`;
  await db.send("LPUSH", [key, JSON.stringify(entry)]);
  await db.send("LTRIM", [key, "0", "49"]);
  await db.send("EXPIRE", [key, String(7 * 86400)]);
}

export async function deliveryLog(hookId) {
  const rows =
    (await db.send("LRANGE", [`webhook:${hookId}:log`, "0", "49"])) ?? [];
  return rows.map((r) => {
    const entry = JSON.parse(r);
    return { ...entry, error: entry.ok ? null : failureText(entry.status) };
  });
}

async function pinnedFetch(rawUrl, init) {
  const url = new URL(rawUrl);
  if (allowPrivate()) return fetch(url, init);
  const address = await resolvePublicAddress(url.hostname);
  if (!address) throw new Error("blocked");
  if (address.unresolved) return fetch(url, init);
  const target = new URL(url);
  target.hostname =
    address.family === 6 ? `[${address.address}]` : address.address;
  const named = target.hostname !== url.hostname;
  return fetch(target, {
    ...init,
    headers: { ...init.headers, host: url.host },
    ...(named &&
      url.protocol === "https:" && {
        tls: { serverName: url.hostname.replace(/^\[|\]$/g, "") },
      }),
  });
}

async function send(url, init) {
  let status = 0;
  try {
    const res = await pinnedFetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
      ...init,
      headers: { "user-agent": "Cap-Webhooks/1", ...init.headers },
    });
    status = res.status;
    await res.body?.cancel();
  } catch {}
  return status;
}

async function keyContext(siteKey) {
  if (!siteKey) return {};
  const hit = names.get(siteKey);
  if (hit && Date.now() - hit.ts < 60_000) return hit.context;
  const [keyName, rules] = await Promise.all([
    db.hget(`key:${siteKey}`, "name").catch(() => ""),
    getRules(siteKey).catch(() => []),
  ]);
  const context = {
    keyName: keyName || "",
    ruleNames: Object.fromEntries(
      rules.filter((r) => r.name).map((r) => [r.id, r.name]),
    ),
  };
  names.set(siteKey, { context, ts: Date.now() });
  return context;
}

async function requestsFor(hook, payload) {
  const service = serviceOf(hook);
  if (service === "generic") {
    const body = JSON.stringify(payload);
    const t = Math.floor(Date.now() / 1000);
    return [
      {
        url: hook.url,
        method: "POST",
        body,
        headers: {
          ...Object.fromEntries(
            (hook.headers ?? []).map((h) => [h.name, h.value]),
          ),
          "content-type": "application/json",
          "cap-webhook-id": hook.id,
          "cap-signature": `t=${t},v1=${sign(hook.secret, t, body)}`,
        },
      },
    ];
  }
  const message = formatMessage(payload, {
    ...(await keyContext(payload.site_key)),
  });
  return buildRequests(service, hook.config, message);
}

export async function deliver(hook, payload, attempt = 0) {
  const started = Date.now();
  let status = 0;
  try {
    const requests = await requestsFor(hook, payload);
    for (const { url, ...init } of requests) {
      status = await send(url, init);
      if (status < 200 || status >= 300) break;
    }
  } catch {
    status = 0;
  }
  const ok = status >= 200 && status < 300;
  const error = ok ? null : failureText(status);
  await logDelivery(hook.id, {
    at: started,
    ms: Date.now() - started,
    status,
    ok,
    error,
    attempt,
    event: payload.event?.id ?? null,
    count: payload.count ?? undefined,
    kind: payload.type,
  }).catch(() => {});
  return { ok, status, error };
}

async function settle(hook, payload, ok) {
  const key = `webhook:${hook.id}:fails`;
  if (ok) {
    await db.del(key).catch(() => {});
    return;
  }
  const fails = Number(await db.send("INCR", [key]).catch(() => 0));
  await db.send("EXPIRE", [key, String(86400)]).catch(() => {});
  if (fails < PAUSE_AFTER) return;
  await db.del(key).catch(() => {});
  const siteKey = hook.siteKey ?? payload.site_key;
  const hooks = await getWebhooks(siteKey);
  if (!hooks.some((h) => h.id === hook.id && h.enabled)) return;
  await saveWebhooks(
    siteKey,
    hooks.map((h) =>
      h.id === hook.id
        ? { ...h, enabled: false, paused: { at: Date.now(), fails } }
        : h,
    ),
  );
}

function queueFor(hook) {
  let q = queues.get(hook.id);
  if (!q) {
    q = { hook, items: [], running: 0, window: 0, sent: 0, dropped: 0 };
    queues.set(hook.id, q);
  }
  q.hook = hook;
  return q;
}

function retry(hook, payload, attempt) {
  later(() => {
    getWebhooks(hook.siteKey ?? payload.site_key)
      .then((hooks) => {
        const current = hooks.find((h) => h.id === hook.id);
        if (!current?.enabled || current.url !== hook.url) return;
        const next = queueFor({ ...current, siteKey: hook.siteKey });
        next.items.push({ payload, attempt: attempt + 1 });
        pump(next);
      })
      .catch(() => {});
  }, RETRIES[attempt]);
}

function pump(q) {
  while (q.running < 4 && q.items.length) {
    if (queues.get(q.hook.id) !== q) {
      q.items.length = 0;
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    if (q.window !== now) {
      q.window = now;
      q.sent = 0;
    }
    if (q.sent >= RATE_PER_SEC) {
      later(() => pump(q), 1000 - (Date.now() % 1000));
      return;
    }
    q.sent++;
    const { payload, attempt } = q.items.shift();
    const hook = q.hook;
    q.running++;
    const delivery = deliver(hook, payload, attempt)
      .then(({ ok, status }) => {
        const retryable =
          !ok && (status === 0 || status === 429 || status >= 500);
        if (retryable && attempt < RETRIES.length)
          retry(hook, payload, attempt);
        else return settle(hook, payload, ok);
      })
      .finally(() => {
        q.running--;
        pump(q);
      });
    defer(delivery);
  }
}

export async function notifyInstance(event) {
  const hooks = await getWebhooks(INSTANCE).catch(() => []);
  const payload = { type: "cap.instance", at: Date.now(), ...event };
  const automated = event.actor && event.actor.type !== "dashboard";
  let sent = 0;
  for (const hook of hooks) {
    if (!hook.enabled) continue;
    const wants =
      hook.triggers.includes(event.trigger) ||
      (automated &&
        hook.triggers.includes("automation") &&
        CHANGE_TRIGGERS.includes(event.trigger));
    if (!wants) continue;
    enqueue({ ...hook, siteKey: INSTANCE }, payload);
    sent++;
  }
  return sent;
}

function enqueue(hook, payload) {
  const q = queueFor(hook);
  if (q.items.length >= QUEUE_MAX) {
    q.dropped++;
    return;
  }
  q.items.push({ payload, attempt: 0 });
  pump(q);
}

const slim = (e) => ({
  id: e.id,
  ts: e.ts,
  type: e.type,
  outcome: e.outcome,
  reason: e.reason,
  rule: e.rule,
  agent: e.agent,
  flags: e.flags,
  ip: e.ip,
  country: e.country,
  city: e.city,
  asn_org: e.asn_org,
  origin: e.origin,
});

function collect(hook, event) {
  let d = digests.get(hook.id);
  if (!d) {
    d = { from: Date.now(), count: 0, events: [] };
    digests.set(hook.id, d);
    later(() => {
      if (digests.get(hook.id) !== d) return;
      digests.delete(hook.id);
      getWebhooks(event.site_key)
        .then((hooks) => {
          const current = hooks.find((h) => h.id === hook.id);
          if (!current?.enabled || d.count < (current.min ?? 0)) return;
          enqueue(current, {
            type: "cap.digest",
            site_key: event.site_key,
            from: d.from,
            to: Date.now(),
            count: d.count,
            events: d.events,
          });
        })
        .catch(() => {});
    }, hook.digest * 1000);
  }
  d.count++;
  if (d.events.length < DIGEST_KEEP) d.events.push(slim(event));
}

export async function resendEvent(siteKey, hook, eventId) {
  const event = await getQueries()
    ?.get(siteKey, eventId)
    .catch(() => null);
  if (!event) return null;
  return deliver(hook, { type: "cap.event", site_key: siteKey, event });
}

export function testPayload(siteKey, hook) {
  if (
    siteKey === INSTANCE &&
    !hook.triggers.every((t) => NOTICE_TRIGGERS.includes(t))
  )
    return {
      type: "cap.instance",
      test: true,
      at: Date.now(),
      trigger: "login",
      summary: "Someone signed in to the dashboard",
      actor: { type: "dashboard", name: "Admin key" },
      ip: "198.51.100.7",
      ua: "Firefox 133 on macOS",
    };
  if (hook.triggers.every((t) => NOTICE_TRIGGERS.includes(t)))
    return {
      type: hook.triggers.includes("security") ? "cap.security" : "cap.update",
      test: true,
      current: "4.0.0",
      latest: {
        version: "4.0.1",
        url: "https://github.com/tiagozip/cap/releases",
      },
      advisories: hook.triggers.includes("security")
        ? [
            {
              id: "test",
              summary: "This is a test advisory.",
              severity: "high",
              url: "https://github.com/tiagozip/cap/security/advisories",
              fixedIn: "4.0.1",
            },
          ]
        : [],
    };
  return {
    type: "cap.test",
    site_key: siteKey,
    event: {
      id: "test",
      ts: Date.now(),
      site_key: siteKey,
      type: "redeem",
      outcome: "block",
      reason: "rule:test",
      flags: ["bh_linear_path"],
    },
  };
}

export async function notifyUpdates({ current, latest, advisories }) {
  if (!latest && !advisories?.length) return 0;
  let sent = 0;
  for (const hook of await getWebhooks(INSTANCE)) {
    if (!hook.enabled) continue;
    const target = { ...hook, siteKey: INSTANCE };
    if (advisories?.length && hook.triggers.includes("security"))
      enqueue(target, { type: "cap.security", current, latest, advisories });
    else if (latest && hook.triggers.includes("update"))
      enqueue(target, { type: "cap.update", current, latest });
    else continue;
    sent++;
  }
  return sent;
}

export function startWebhooks() {
  onEvent((event) => {
    const queued = getWebhooks(event.site_key)
      .then((hooks) => {
        for (const hook of hooks) {
          if (!matches(hook, event)) continue;
          if (hook.digest) collect(hook, event);
          else
            enqueue(hook, {
              type: "cap.event",
              site_key: event.site_key,
              event,
            });
        }
      })
      .catch(() => {});
    defer(queued);
  });
}
