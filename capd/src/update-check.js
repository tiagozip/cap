import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { db } from "#db";
import { BACKEND } from "#event-store";
import { getStatus as ipdbStatus } from "#ipdb";
import { every, later, runtime } from "#platform";
import pkg from "../package.json";
import { assetStatus } from "./assets.js";
import { solvesByKey } from "./events/analytics.js";
import { listLists } from "./policy/lists.js";
import { getRules } from "./policy/rules.js";
import { getWebhooks, notifyUpdates } from "./policy/webhooks.js";
import { proxyAuthSettings } from "./proxy-auth.js";

const KEY = "settings:update-check";
const LOCK = "update-check:lock";
const NOTICES = "usage:notices";
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,32})?$/;
const GITHUB = "https://github.com/";
const DAY = 86_400_000;
export const INTERVALS = { daily: 1, "4d": 4, weekly: 7, monthly: 30 };
const LABELS = {
  daily: "once a day",
  "4d": "every 4 days",
  weekly: "once a week",
  monthly: "once a month",
};
export const UPDATE_CHECK_DOCS = "https://trycap.dev/guide/capd/update-checks";

const falsy = (v) => /^(0|false|off|no)$/i.test(String(v ?? "").trim());

export const envDisabled = () => falsy(process.env.CAP_UPDATE_CHECK);

export const FEATURES = [
  "instrumentation",
  "blockAutomatedBrowsers",
  "behavior",
  "blockAgents",
  "requireInteraction",
  "sha256",
  "rules",
  "webhooks",
  "sharedLists",
  "proxySignIn",
  "ipDatabase",
  "widgetFiles",
  "apiKeys",
  "mcp",
];
const ANALYTICS = ["duckdb", "clickhouse", "redis", "d1", "off"];
const ID = /^[A-Za-z0-9_-]{8}$/;

const bucket = (n) => (n > 0 ? 10 ** Math.floor(Math.log10(n)) : 0);
const memoryMb = () => {
  const mb = (process.memoryUsage?.().rss ?? 0) / 1048576;
  return mb >= 1 ? 2 ** Math.floor(Math.log2(mb)) : null;
};

export function packVars({ docker, analytics, features }) {
  const bits = FEATURES.reduce(
    (m, f, i) => (features[f] ? m | (1 << i) : m),
    0,
  );
  return Buffer.from([
    (docker ? 1 : 0) | (Math.max(0, ANALYTICS.indexOf(analytics)) << 1),
    bits >> 8,
    bits & 255,
  ]).toString("base64url");
}

async function load() {
  let saved = {};
  try {
    saved = JSON.parse((await db.get(KEY)) || "{}");
  } catch {}
  if (!ID.test(saved.id ?? "")) {
    saved = { ...saved, id: randomBytes(6).toString("base64url") };
    await db.set(KEY, JSON.stringify(saved));
  }
  return {
    enabled: saved.enabled !== false,
    sidebar: saved.sidebar !== false,
    id: saved.id,
    lastSent: saved.lastSent ?? 0,
    sentVersion: saved.sentVersion ?? null,
    interval: INTERVALS[saved.interval] ? saved.interval : "daily",
  };
}

async function save(patch) {
  const current = await load();
  await db.set(KEY, JSON.stringify({ ...current, ...patch }));
}

export async function usageReport() {
  const { id } = await load();
  const siteKeys = await db.smembers("keys");
  const configs = await Promise.all(
    siteKeys.map(async (sk) => {
      try {
        return JSON.parse((await db.hget(`key:${sk}`, "config")) || "{}");
      } catch {
        return {};
      }
    }),
  );
  const any = (fn) => configs.some(fn);
  const [counts, rules, hooks, lists, proxy, assets, apiKeys, mcp] =
    await Promise.all([
      solvesByKey(siteKeys).catch(() => ({})),
      Promise.all(siteKeys.map((sk) => getRules(sk).catch(() => []))),
      Promise.all(siteKeys.map((sk) => getWebhooks(sk).catch(() => []))),
      listLists().catch(() => []),
      proxyAuthSettings().catch(() => ({ mode: "off" })),
      assetStatus().catch(() => ({ enabled: false })),
      db.smembers("apikeys").catch(() => []),
      db.get("usage:mcp").catch(() => null),
    ]);
  const solves = Object.values(counts).reduce(
    (sum, c) => sum + (c.current || 0),
    0,
  );
  const ipdb = ipdbStatus();
  return {
    id,
    version: pkg.version,
    runtime,
    keys: bucket(siteKeys.length),
    solves: bucket(solves),
    memory: runtime === "bun" ? memoryMb() : null,
    vars: packVars({
      docker: runtime === "bun" && existsSync("/.dockerenv"),
      analytics: BACKEND,
      features: {
        instrumentation: any((c) => c.instrumentation !== false),
        blockAutomatedBrowsers: any((c) => c.blockAutomatedBrowsers === true),
        behavior: any((c) => c.behavior && c.behavior !== "off"),
        blockAgents: any((c) => c.blockAgents && c.blockAgents !== "off"),
        requireInteraction: any((c) => c.requireInteraction === true),
        sha256: any((c) => c.protocol === "sha256"),
        rules: rules.some((r) => r.some((x) => x.id !== "blocklist")),
        webhooks: hooks.some((h) => h.length > 0),
        sharedLists: lists.some((l) => !l.id.startsWith("blk_")),
        proxySignIn: proxy.mode !== "off",
        ipDatabase: ipdb.mode !== "" && ipdb.mode !== "cloudflare",
        widgetFiles: assets.enabled === true,
        apiKeys: apiKeys.length > 0,
        mcp: !!mcp,
      },
    }),
  };
}

export async function updateCheckStatus() {
  const { enabled, sidebar, lastSent, interval } = await load();
  return {
    enabled: enabled && !envDisabled(),
    sidebar,
    lockedByEnv: envDisabled(),
    interval,
    lastSent: lastSent || null,
    nextCheck: lastSent ? lastSent + INTERVALS[interval] * DAY : null,
    report: await usageReport(),
  };
}

export async function setUpdateCheck({ enabled, interval, sidebar }) {
  await save({
    ...(enabled !== undefined && { enabled }),
    ...(sidebar !== undefined && { sidebar }),
    ...(INTERVALS[interval] && { interval }),
  });
  if (enabled === false) await db.send("DEL", [NOTICES]).catch(() => {});
}

const newer = (a, b) => {
  const x = a.split(/[.-]/).slice(0, 3).map(Number);
  const y = b.split(/[.-]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

const clip = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);

const cleanNotices = (body) => {
  const latest =
    VERSION.test(body?.latest?.version ?? "") &&
    String(body.latest.url ?? "").startsWith(GITHUB)
      ? { version: body.latest.version, url: clip(body.latest.url, 300) }
      : null;
  const advisories = (Array.isArray(body?.advisories) ? body.advisories : [])
    .slice(0, 20)
    .filter((a) => String(a?.url ?? "").startsWith(GITHUB))
    .map((a) => ({
      id: clip(a.id, 40),
      summary: clip(a.summary, 300),
      severity: clip(a.severity, 20),
      url: clip(a.url, 300),
      fixedIn: clip(a.fixedIn, 40),
    }));
  return { latest, advisories };
};

export async function updateNotices() {
  const { enabled, sidebar, interval, lastSent } = await load();
  const off = envDisabled() || !enabled;
  let saved = null;
  if (!off) {
    try {
      saved = JSON.parse((await db.get(NOTICES)) || "null");
    } catch {}
  }
  const current = saved?.forVersion === pkg.version;
  return {
    enabled: !off,
    sidebar,
    interval,
    nextCheck: !off && lastSent ? lastSent + INTERVALS[interval] * DAY : null,
    version: pkg.version,
    checkedAt: saved?.checkedAt ?? null,
    latest:
      saved?.latest && newer(saved.latest.version, pkg.version)
        ? saved.latest
        : null,
    advisories: current ? saved.advisories : [],
  };
}

export async function sendUpdateCheck({ force = false } = {}) {
  if (envDisabled()) return false;
  const { enabled, lastSent, sentVersion, interval } = await load();
  const due =
    force ||
    sentVersion !== pkg.version ||
    Date.now() - lastSent >= INTERVALS[interval] * DAY - 3_600_000;
  if (!enabled || !due) return false;
  const locked = await db.send("SET", [LOCK, "1", "NX", "EX", "3600"]);
  if (!locked) return false;
  try {
    const r = await fetch(
      process.env.CAP_UPDATE_CHECK_URL || "https://updates.trycap.dev/v1/ping",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(await usageReport()),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!r.ok)
      throw new Error(`update check endpoint responded with ${r.status}`);
    const body = await r.json().catch(() => null);
    let before = null;
    try {
      before = JSON.parse((await db.get(NOTICES)) || "null");
    } catch {}
    const notices = cleanNotices(body);
    await db.set(
      NOTICES,
      JSON.stringify({
        ...notices,
        forVersion: pkg.version,
        checkedAt: Date.now(),
      }),
    );
    const known =
      before?.forVersion === pkg.version
        ? new Set(before.advisories.map((a) => a.id || a.url))
        : new Set();
    const fresh = notices.advisories.filter((a) => !known.has(a.id || a.url));
    const latest =
      notices.latest &&
      newer(notices.latest.version, pkg.version) &&
      notices.latest.version !== before?.latest?.version
        ? notices.latest
        : null;
    await notifyUpdates({
      current: pkg.version,
      latest: fresh.length ? notices.latest : latest,
      advisories: fresh,
    }).catch(() => {});
    await save({ lastSent: Date.now(), sentVersion: pkg.version });
    return true;
  } catch {
    await db.send("DEL", [LOCK]).catch(() => {});
    return false;
  }
}

export function startUpdateCheck() {
  if (envDisabled()) return;
  load()
    .then(({ enabled, interval }) => {
      if (!enabled) return;
      console.log(
        `🧢 Checking trycap.dev ${LABELS[interval]} for capd updates and security notices. The check includes anonymous usage numbers. See what's sent or turn it off: ${UPDATE_CHECK_DOCS}`,
      );
    })
    .catch(() => {});
  if (runtime !== "bun") return;
  later(() => sendUpdateCheck().catch(() => {}), 60_000);
  every(() => sendUpdateCheck().catch(() => {}), 3_600_000);
}
