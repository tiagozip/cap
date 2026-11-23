import { db, hgetall } from "#db";

const HOUR = 3_600_000;
const countsKey = (siteKey) => `analytics:counts:${siteKey}`;

const EMPTY_SUMMARY = {
  total: 0,
  challenges: 0,
  solved: 0,
  failed: 0,
  blocked: 0,
  limited: 0,
  verified: 0,
  flagged: 0,
  agents: 0,
  avg_solve: 0,
  ips: 0,
  clients: 0,
};

const emptyQueries = {
  summary: async () => ({ ...EMPTY_SUMMARY }),
  series: async () => [],
  top: async () => [],
  distribution: async () => [],
  flow: async () => [],
  sharedClients: async () => [],
  list: async () => ({ events: [], next: null }),
  get: async () => null,
  rollups: async () => [],
  firstEventTs: async () => null,
};

export const createOffStore = () => ({
  kind: "off",
  queries: emptyQueries,
  async insert() {},
  async deleteSite() {},
  async prune() {
    return 0;
  },
  async setRetention() {},
  async info() {
    return { events: 0 };
  },
  async ping() {
    return true;
  },
  async close() {},
});

const parseField = (field, count) => {
  const [hour, type, outcome] = field.split("|");
  const n = Number(count);
  const h = Number(hour);
  if (!Number.isFinite(h) || !Number.isFinite(n) || !type || !outcome)
    return null;
  return { hour: h, type, outcome, n };
};

async function readCounts(siteKey) {
  const raw = await hgetall(countsKey(siteKey));
  const rows = [];
  for (const [field, count] of Object.entries(raw)) {
    const row = parseField(field, count);
    if (row) rows.push(row);
  }
  return rows;
}

async function inRange({ siteKey, from, to, filters, q }) {
  if (!siteKey || filters?.length || q) return [];
  const start = from == null ? -Infinity : Math.floor(from / HOUR) * HOUR;
  const end = to ?? Infinity;
  return (await readCounts(siteKey)).filter(
    (r) => r.hour >= start && r.hour < end,
  );
}

const SUMMARY_FIELDS = [
  ["challenges", (r) => r.type === "challenge" && r.outcome === "pass"],
  ["solved", (r) => r.type === "redeem" && r.outcome === "pass"],
  ["failed", (r) => r.type === "redeem" && r.outcome === "fail"],
  ["blocked", (r) => r.outcome === "block"],
  ["limited", (r) => r.outcome === "limit"],
  ["verified", (r) => r.type === "siteverify" && r.outcome === "pass"],
];

const grouped = (rows, keyOf) => {
  const groups = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    const g = groups.get(key);
    if (g) g.n += r.n;
    else groups.set(key, { ...r, hour: undefined });
  }
  return [...groups.values()];
};

const LEGACY = ["verified", "failed", "ratelimited"];

const counterQueries = {
  ...emptyQueries,

  async summary(ctx) {
    const out = { ...EMPTY_SUMMARY };
    for (const r of await inRange(ctx)) {
      out.total += r.n;
      for (const [name, match] of SUMMARY_FIELDS)
        if (match(r)) out[name] += r.n;
    }
    return out;
  },

  async series(ctx, bucketMs) {
    const rows = (await inRange(ctx)).map((r) => ({
      ...r,
      b: Math.floor(r.hour / bucketMs) * bucketMs,
    }));
    return grouped(rows, (r) => `${r.b}|${r.type}|${r.outcome}`).map(
      ({ b, type, outcome, n }) => ({ b, type, outcome, n, flagged: 0 }),
    );
  },

  async flow(ctx) {
    return grouped(await inRange(ctx), (r) => `${r.type}|${r.outcome}`).map(
      ({ type, outcome, n }) => ({ type, outcome, n }),
    );
  },

  async rollups(siteKey, from, to) {
    const [verified, failed, limited] = await Promise.all(
      LEGACY.map((name) => hgetall(`metrics:${name}:${siteKey}`)),
    );
    const hours = new Set([
      ...Object.keys(verified),
      ...Object.keys(failed),
      ...Object.keys(limited),
    ]);
    return [...hours]
      .map((h) => ({
        hour: Number(h) * 1000,
        verified: Number(verified[h] || 0),
        failed: Number(failed[h] || 0),
        ratelimited: Number(limited[h] || 0),
      }))
      .filter(
        (r) =>
          [r.hour, r.verified, r.failed, r.ratelimited].every(
            Number.isFinite,
          ) &&
          r.hour >= (from ?? 0) &&
          r.hour < (to ?? Infinity),
      );
  },

  async firstEventTs(siteKey) {
    let first = null;
    for (const r of await readCounts(siteKey))
      if (first === null || r.hour < first) first = r.hour;
    return first;
  },
};

export const createRedisStore = () => ({
  kind: "redis",
  queries: counterQueries,

  async insert(rows) {
    const bySite = new Map();
    for (const e of rows) {
      if (!e.site_key || !e.type || !e.outcome) continue;
      const field = `${Math.floor(e.ts / HOUR) * HOUR}|${e.type}|${e.outcome}`;
      const counts = bySite.get(e.site_key) ?? new Map();
      counts.set(field, (counts.get(field) ?? 0) + 1);
      bySite.set(e.site_key, counts);
    }
    await Promise.all(
      [...bySite].flatMap(([siteKey, counts]) =>
        [...counts].map(([field, n]) =>
          db.hincrby(countsKey(siteKey), field, n),
        ),
      ),
    );
  },

  async deleteSite(siteKey) {
    await db.del(countsKey(siteKey));
  },

  async prune(retentionDays) {
    const cutoff = Date.now() - retentionDays * 86_400_000;
    let removed = 0;
    for (const siteKey of await db.smembers("keys")) {
      const old = Object.keys(await hgetall(countsKey(siteKey))).filter(
        (field) => Number(field.split("|")[0]) < cutoff,
      );
      if (!old.length) continue;
      await db.send("HDEL", [countsKey(siteKey), ...old]);
      removed += old.length;
    }
    return removed;
  },

  async setRetention() {},

  async info() {
    let events = 0;
    for (const siteKey of await db.smembers("keys")) {
      for (const count of Object.values(await hgetall(countsKey(siteKey))))
        events += Number(count) || 0;
    }
    return { events };
  },

  async ping() {
    await db.send("PING", []);
    return true;
  },

  async close() {},
});
