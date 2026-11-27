import { randomBytes } from "node:crypto";
import { db, hgetall } from "#db";
import { BACKEND, fallbackStore, openStore } from "#event-store";
import { bufferEvents, defer, every, later, uuidv7 } from "#platform";
import { maskIp, setVisitorSalt } from "./context.js";
import { createQueries } from "./queries.js";
import { normalizeEvent } from "./schema.js";

const FLUSH_MS = 1000;
const FLUSH_AT = 1000;
const BUFFER_MAX = 100_000;
const SPLIT_AFTER = 3;
const DAY = 86_400_000;
const ANONYMIZE_WINDOWS = 30;
const ANONYMIZE_CHUNK = 500;

export const analyticsDefaults = {
  retentionDays: 0,
  anonymizeDays: 60,
  ipMode: "full",
  logChallenges: true,
};

let settings = structuredClone(analyticsDefaults);
let store = null;
let queries = null;
let buffer = [];
let dropped = 0;
let flushing = null;
let failures = 0;
let lastError = null;
const listeners = new Set();
const flushListeners = new Set();

export async function importLegacyCounters(target) {
  const marker = `analytics:legacy:${target.kind}`;
  if (await db.get(marker)) return;
  const done = `${marker}:done`;
  const siteKeys = await db.smembers("keys");
  for (const sk of siteKeys) {
    if (await db.sismember(done, sk)) continue;
    const [verified, failed, limited] = await Promise.all([
      hgetall(`metrics:verified:${sk}`),
      hgetall(`metrics:failed:${sk}`),
      hgetall(`metrics:ratelimited:${sk}`),
    ]);
    const hours = new Set([
      ...Object.keys(verified),
      ...Object.keys(failed),
      ...Object.keys(limited),
    ]);
    const rows = [...hours]
      .map((h) => ({
        site_key: sk,
        hour: Number(h) * 1000,
        verified: Number(verified[h] || 0),
        failed: Number(failed[h] || 0),
        ratelimited: Number(limited[h] || 0),
      }))
      .filter((r) =>
        [r.hour, r.verified, r.failed, r.ratelimited].every(Number.isFinite),
      );
    for (let i = 0; i < rows.length; i += 5000) {
      await target.insertRollups(rows.slice(i, i + 5000));
    }
    await db.sadd(done, sk);
  }
  await db.set(marker, String(Date.now()));
  await db.del(done);
}

export async function initEvents() {
  try {
    const raw = await db.get("settings:analytics");
    if (raw) {
      const { retentionDays, anonymizeDays, ipMode, logChallenges } =
        JSON.parse(raw);
      settings = {
        ...settings,
        ...(retentionDays != null && { retentionDays }),
        ...(anonymizeDays != null && { anonymizeDays }),
        ...(ipMode && { ipMode }),
        ...(logChallenges != null && { logChallenges }),
      };
    }
  } catch {}

  let salt = await db.get("analytics:salt");
  if (!salt) {
    salt = randomBytes(16).toString("hex");
    await db.set("analytics:salt", salt);
  }
  setVisitorSalt(salt);

  try {
    store = await openStore(settings);
  } catch (e) {
    lastError = e.message;
    console.error(
      `[cap] ${BACKEND} event store unavailable, falling back to DuckDB:`,
      e.message,
    );
    store = await fallbackStore();
  }
  queries = store.queries ?? createQueries(store);

  if (store.insertRollups)
    defer(
      importLegacyCounters(store).catch((e) =>
        console.warn(
          `[cap] Couldn't import the analytics counters from Cap 3, so it will retry on the next start: ${e.message}`,
        ),
      ),
    );

  if (!bufferEvents) return;
  every(flush, FLUSH_MS);
  later(pruneEvents, 30_000);
  every(pruneEvents, 3_600_000);
}

async function anonymizeIps() {
  if (!store?.replaceIps || !settings.anonymizeDays) return 0;
  if (settings.ipMode === "none") return 0;
  const p = store.dialect.param;
  const cutoff = Date.now() - settings.anonymizeDays * DAY;
  const range = `ts >= ${p("p0", "Int64")} AND ts < ${p("p1", "Int64")}`;
  let from = Number(await db.get("analytics:anonymized")) || 0;
  let changed = 0;
  for (let i = 0; i < ANONYMIZE_WINDOWS && from < cutoff; i++) {
    const [next] = await store.query(
      `SELECT min(ts) AS t FROM events WHERE ${range} AND ip <> ''`,
      { p0: from, p1: cutoff },
    );
    const first = Number(next?.t);
    if (next?.t == null || first < from) {
      from = cutoff;
      break;
    }
    from = first;
    const to = Math.min(from + DAY, cutoff);
    const rows = await store.query(
      `SELECT DISTINCT ip FROM events WHERE ${range} AND ip <> ''`,
      { p0: from, p1: to },
    );
    const pairs = rows
      .map(({ ip }) => [ip, maskIp(ip, "truncate")])
      .filter(([a, b]) => a !== b);
    for (let j = 0; j < pairs.length; j += ANONYMIZE_CHUNK)
      await store.replaceIps(pairs.slice(j, j + ANONYMIZE_CHUNK), from, to);
    changed += pairs.length;
    from = to;
    await db.set("analytics:anonymized", String(from));
  }
  await db.set("analytics:anonymized", String(from));
  return changed;
}

export const pruneEvents = () =>
  Promise.all([
    settings.retentionDays > 0 && store?.prune(settings.retentionDays),
    anonymizeIps(),
  ]).catch((e) => console.warn("[cap] event prune:", e.message));

export async function flush() {
  if (flushing || !buffer.length || !store) return flushing;
  const batch = buffer;
  buffer = [];
  flushing = (async () => {
    let saved = batch;
    try {
      await store.insert(batch);
      failures = 0;
      lastError = null;
    } catch (e) {
      lastError = e.message;
      console.error("[cap] event insert failed:", e.message);
      failures++;
      const reachable =
        failures >= SPLIT_AFTER &&
        (await store.ping().then(
          () => true,
          () => false,
        ));
      if (!reachable) {
        if (buffer.length + batch.length <= BUFFER_MAX)
          buffer = batch.concat(buffer);
        else dropped += batch.length;
        return;
      }
      failures = 0;
      const salvage = async (rows) => {
        const mid = Math.ceil(rows.length / 2);
        const kept = [];
        for (const part of [rows.slice(0, mid), rows.slice(mid)]) {
          if (!part.length) continue;
          try {
            await store.insert(part);
            kept.push(...part);
          } catch (err) {
            if (part.length > 1) {
              kept.push(...(await salvage(part)));
              continue;
            }
            dropped++;
            console.warn(
              `[cap] Dropped event ${part[0].id} because the ${store.kind} event store kept rejecting it: ${err.message}`,
            );
          }
        }
        return kept;
      };
      saved = await salvage(batch);
    }
    const keys = [...new Set(saved.map((e) => e.site_key))];
    for (const fn of flushListeners) {
      try {
        fn(keys);
      } catch {}
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function onEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onFlush(fn) {
  flushListeners.add(fn);
  return () => flushListeners.delete(fn);
}

export function recordEvent(raw, extra) {
  if (
    raw.type === "challenge" &&
    raw.outcome === "pass" &&
    !settings.logChallenges
  )
    return null;
  const event = normalizeEvent({
    ...raw,
    id: raw.id || uuidv7(),
    ts: raw.ts || Date.now(),
    ip: maskIp(raw.ip, settings.ipMode),
  });
  if (!bufferEvents) {
    defer(
      store?.insert([event]).then(
        () => {
          lastError = null;
          for (const fn of flushListeners) fn([event.site_key]);
        },
        (e) => {
          lastError = e.message;
          console.error("[cap] event insert failed:", e.message);
        },
      ),
    );
  } else if (buffer.length >= BUFFER_MAX) {
    dropped++;
  } else {
    buffer.push(event);
    if (buffer.length >= FLUSH_AT) flush();
  }
  for (const fn of listeners) {
    try {
      fn(event, extra);
    } catch {}
  }
  return event;
}

export function contextFields(ctx) {
  if (!ctx) return {};
  return Object.fromEntries(
    Object.entries(ctx).filter(([k]) => k !== "headers"),
  );
}

export const getQueries = () => queries;
export const getStore = () => store;
export const getSettings = () => settings;

export async function storageStatus() {
  let info = null;
  let healthy = true;
  try {
    info = await store.info();
  } catch (e) {
    healthy = false;
    lastError = e.message;
  }
  return {
    backend: store?.kind ?? BACKEND,
    configured: BACKEND,
    healthy: healthy && !lastError,
    lastError,
    buffered: buffer.length,
    dropped,
    info,
  };
}

export const getPublicSettings = () => ({ ...settings });

export async function updateSettings(patch) {
  const next = {
    retentionDays: patch.retentionDays ?? settings.retentionDays,
    anonymizeDays: patch.anonymizeDays ?? settings.anonymizeDays,
    ipMode: patch.ipMode ?? settings.ipMode,
    logChallenges: patch.logChallenges ?? settings.logChallenges,
  };
  if (next.retentionDays !== settings.retentionDays) {
    await store.setRetention(next.retentionDays).catch(() => {});
  }
  settings = next;
  await db.set("settings:analytics", JSON.stringify(next));
  return { success: true, settings: getPublicSettings() };
}

export async function closeEvents() {
  let attempts = 0;
  while ((buffer.length || flushing) && attempts < 5) {
    if (!flushing) attempts++;
    await flush();
  }
  await store?.close();
}
