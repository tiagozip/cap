import { createHmac, randomBytes } from "node:crypto";
import { db } from "#db";
import { defer, later } from "#platform";
import { onEvent } from "../events/index.js";
import { isLocalHostname, resolvePublicAddress } from "./address.js";

export const WEBHOOK_TRIGGERS = [
  "block",
  "fail",
  "flagged",
  "agent",
  "rule",
  "all",
];

const MAX_WEBHOOKS = 10;
const QUEUE_MAX = 1000;
const RATE_PER_SEC = 50;
const RETRIES = [1_000, 5_000, 30_000];
const CACHE_TTL = 5_000;

const cache = new Map();
const queues = new Map();

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

export const publicWebhook = ({ secret, ...hook }) => ({
  ...hook,
  secretHint: `${secret.slice(0, 8)}…`,
});

export function validateWebhook(input) {
  let url;
  try {
    url = new URL(String(input?.url ?? ""));
  } catch {
    return { error: "Enter a valid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { error: "Webhooks must use http or https" };
  if (url.username || url.password)
    return { error: "Put credentials in the webhook secret, not the URL" };
  if (!allowPrivate() && isLocalHostname(url.hostname))
    return { error: "Webhooks can't point at private or local addresses" };
  const triggers = (Array.isArray(input.triggers) ? input.triggers : []).filter(
    (t) => WEBHOOK_TRIGGERS.includes(t),
  );
  if (!triggers.length) return { error: "Pick at least one trigger" };
  return {
    hook: {
      url: url.toString(),
      triggers: [...new Set(triggers)],
      enabled: input.enabled !== false,
      name: String(input.name ?? "")
        .trim()
        .slice(0, 60),
    },
  };
}

export async function saveWebhooks(siteKey, hooks) {
  if (hooks.length > MAX_WEBHOOKS) return false;
  const previous = await getWebhooks(siteKey);
  await db.set(`webhooks:${siteKey}`, JSON.stringify(hooks));
  cache.delete(siteKey);
  for (const old of previous) {
    const next = hooks.find((h) => h.id === old.id);
    if (!next) queues.delete(old.id);
    else if (queues.has(old.id)) queues.get(old.id).hook = next;
  }
  return true;
}

export const newWebhookSecret = () =>
  `whsec_${randomBytes(24).toString("base64url")}`;
export const newWebhookId = () => `wh_${randomBytes(6).toString("hex")}`;

function matches(hook, event) {
  if (!hook.enabled) return false;
  return hook.triggers.some((t) => {
    if (t === "all") return true;
    if (t === "block") return event.outcome === "block";
    if (t === "fail") return event.outcome === "fail";
    if (t === "flagged")
      return (
        event.type === "redeem" &&
        event.outcome === "pass" &&
        event.flags.length > 0
      );
    if (t === "agent") return !!event.agent;
    if (t === "rule") return !!event.rule;
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

export async function deliver(hook, payload, attempt = 0) {
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const started = Date.now();
  let status = 0;
  try {
    const res = await pinnedFetch(hook.url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "user-agent": "Cap-Webhooks/1",
        "cap-webhook-id": hook.id,
        "cap-signature": `t=${t},v1=${sign(hook.secret, t, body)}`,
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    status = res.status;
    await res.body?.cancel();
  } catch {}
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
    kind: payload.type,
  }).catch(() => {});
  return { ok, status, error };
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
    getWebhooks(payload.site_key)
      .then((hooks) => {
        const current = hooks.find((h) => h.id === hook.id);
        if (!current?.enabled || current.url !== hook.url) return;
        const next = queueFor(current);
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
      })
      .finally(() => {
        q.running--;
        pump(q);
      });
    defer(delivery);
  }
}

export function startWebhooks() {
  onEvent((event) => {
    const queued = getWebhooks(event.site_key)
      .then((hooks) => {
        for (const hook of hooks) {
          if (!matches(hook, event)) continue;
          const q = queueFor(hook);
          if (q.items.length >= QUEUE_MAX) {
            q.dropped++;
            continue;
          }
          q.items.push({
            payload: { type: "cap.event", site_key: event.site_key, event },
            attempt: 0,
          });
          pump(q);
        }
      })
      .catch(() => {});
    defer(queued);
  });
}
