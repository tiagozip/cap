import { getPublicSettings, getQueries } from "./index.js";
import { FILTER_FIELDS, TOP_DIMENSIONS } from "./schema.js";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const RANGES = {
  "1h": [HOUR, MIN],
  "24h": [DAY, 15 * MIN],
  "7d": [7 * DAY, HOUR],
  "30d": [30 * DAY, 6 * HOUR],
  "90d": [90 * DAY, DAY],
};

const BUCKETS = [
  MIN,
  5 * MIN,
  15 * MIN,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  DAY,
  7 * DAY,
];

const MAX_BUCKETS = 2000;

export function resolveRange({ range = "24h", from, to, bucket: forced } = {}) {
  const now = Date.now();
  const f0 = Number(from);
  const t0 = Number(to);
  if (from != null && to && Number.isFinite(f0) && Number.isFinite(t0)) {
    const floor = now - (getPublicSettings().retentionDays || 30) * DAY;
    const f = forced ? f0 : Math.max(f0, floor);
    const t = Math.max(f, Math.min(t0, now + MIN));
    const span = Math.max(MIN, t - f);
    let bucket = forced ?? BUCKETS.find((b) => span / b <= 200) ?? 7 * DAY;
    if (span / bucket > MAX_BUCKETS)
      bucket = BUCKETS.find((b) => span / b <= MAX_BUCKETS) ?? 7 * DAY;
    const start = Math.max(
      Math.floor(f / bucket) * bucket,
      Math.floor(t / bucket) * bucket - (MAX_BUCKETS - 1) * bucket,
    );
    return { from: start, to: t, bucket, span: t - start };
  }
  const [span, bucket] = RANGES[range] ?? RANGES["24h"];
  const end = Math.floor(now / bucket) * bucket + bucket;
  const start = end - Math.ceil(span / bucket) * bucket;
  return { from: start, to: end, bucket, span: end - start };
}

export function parseFilters(input) {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  const filters = [];
  for (const raw of list.slice(0, 24)) {
    const s = String(raw);
    const neg = s.startsWith("-");
    const body = neg ? s.slice(1) : s;
    const i = body.indexOf(":");
    if (i < 1) continue;
    const field = body.slice(0, i);
    const value = body.slice(i + 1);
    if (!FILTER_FIELDS.has(field) || !value || value.length > 200) continue;
    filters.push({ field, neg, value });
  }
  return filters;
}

const emptyBucket = (b) => ({
  b,
  challenges: 0,
  solved: 0,
  failed: 0,
  blocked: 0,
  limited: 0,
  verified: 0,
  flagged: 0,
});

export async function overview(
  siteKey,
  { range, from, to, bucket, filters = [], q } = {},
) {
  const queries = getQueries();
  const r = resolveRange({ range, from, to, bucket });
  const ctx = { siteKey, from: r.from, to: r.to, filters, q };
  const prevCtx = { ...ctx, from: r.from - r.span, to: r.from };

  const [summary, previous, rows, firstTs] = await Promise.all([
    queries.summary(ctx),
    queries.summary(prevCtx),
    queries.series(ctx, r.bucket),
    filters.length || q ? null : queries.firstEventTs(siteKey),
  ]);

  const buckets = new Map();
  for (let b = r.from; b < r.to; b += r.bucket) buckets.set(b, emptyBucket(b));
  for (const row of rows) {
    const bucket =
      buckets.get(row.b) ?? buckets.set(row.b, emptyBucket(row.b)).get(row.b);
    if (row.outcome === "block") bucket.blocked += row.n;
    else if (row.outcome === "limit") bucket.limited += row.n;
    else if (row.type === "challenge" && row.outcome === "pass")
      bucket.challenges += row.n;
    else if (row.type === "redeem" && row.outcome === "pass")
      bucket.solved += row.n;
    else if (row.type === "redeem" && row.outcome === "fail")
      bucket.failed += row.n;
    else if (row.type === "siteverify" && row.outcome === "pass")
      bucket.verified += row.n;
    bucket.flagged += row.flagged;
  }

  let legacy = false;
  if (!filters.length && !q) {
    const cutoff = firstTs ?? r.to;
    if (cutoff > r.from) {
      const roll = await queries.rollups(
        siteKey,
        r.from - r.span,
        Math.min(cutoff, r.to),
      );
      for (const row of roll) {
        if (row.hour >= cutoff) continue;
        if (row.hour >= r.from) {
          legacy = true;
          const b =
            Math.floor((row.hour - r.from) / r.bucket) * r.bucket + r.from;
          const bucket = buckets.get(b);
          if (!bucket) continue;
          bucket.solved += row.verified;
          bucket.failed += row.failed;
          bucket.limited += row.ratelimited;
          summary.solved += row.verified;
          summary.failed += row.failed;
          summary.limited += row.ratelimited;
        } else {
          previous.solved += row.verified;
          previous.failed += row.failed;
          previous.limited += row.ratelimited;
        }
      }
    }
  }

  return {
    range: { from: r.from, to: r.to, bucket: r.bucket },
    summary,
    previous,
    series: [...buckets.values()].sort((a, b) => a.b - b.b),
    legacy,
  };
}

export async function topDimensions(
  siteKey,
  { range, from, to, filters = [], q, dims, limit = 10 } = {},
) {
  const queries = getQueries();
  const r = resolveRange({ range, from, to });
  const ctx = { siteKey, from: r.from, to: r.to, filters, q };
  const wanted = (dims ?? []).filter((d) => TOP_DIMENSIONS.has(d)).slice(0, 16);
  const results = await Promise.all(
    wanted.map((d) =>
      queries.top(ctx, d, Math.min(100, Math.max(1, Math.floor(limit) || 10))),
    ),
  );
  return Object.fromEntries(wanted.map((d, i) => [d, results[i]]));
}

export async function insights(
  siteKey,
  { range, from, to, filters = [], q } = {},
) {
  const queries = getQueries();
  const r = resolveRange({ range, from, to });
  const ctx = { siteKey, from: r.from, to: r.to, filters, q };
  const prevCtx = { ...ctx, from: r.from - r.span, to: r.from };
  const [scores, solve, hours, flow, shared, countries, previous] =
    await Promise.all([
      queries.distribution(ctx, "score", 100, 1),
      queries.distribution(ctx, "solve_ms", 1 / 50, 60_000),
      queries.series(ctx, HOUR),
      queries.flow(ctx),
      queries.sharedClients(ctx),
      queries.top(ctx, "country", 250),
      queries.top(prevCtx, "country", 250),
    ]);
  const byHour = new Map();
  for (const row of hours) {
    const h = byHour.get(row.b) ?? { b: row.b, n: 0, bad: 0 };
    h.n += row.n;
    h.bad += row.flagged + (row.outcome === "block" ? row.n : 0);
    byHour.set(row.b, h);
  }
  return {
    range: { from: r.from, to: r.to },
    scores,
    solve: { size: 50, rows: solve },
    hours: [...byHour.values()],
    flow,
    shared,
    countries: { current: countries, previous },
  };
}

export async function listEvents(
  siteKey,
  { range, from, to, filters = [], q, cursor, limit = 50 } = {},
) {
  const r = resolveRange({ range, from, to });
  let c = null;
  if (cursor) {
    const i = cursor.indexOf(".");
    c = { ts: Number(cursor.slice(0, i)), id: cursor.slice(i + 1) };
    if (!Number.isFinite(c.ts)) c = null;
  }
  return getQueries().list(
    { siteKey, from: r.from, to: r.to, filters, q },
    { cursor: c, limit: Math.min(200, Math.max(1, Math.floor(limit) || 50)) },
  );
}

const CHALLENGE_WINDOW = 15 * 60_000;

export async function eventDetail(siteKey, id) {
  const queries = getQueries();
  const event = await queries.get(siteKey, id);
  if (!event) return null;
  const window = { siteKey, from: event.ts - DAY, to: event.ts + DAY };
  const [sameIp, sameVisitor, chain, issued] = await Promise.all([
    event.ip
      ? queries.list(
          { ...window, filters: [{ field: "ip", value: event.ip }] },
          { limit: 25 },
        )
      : { events: [] },
    event.fp
      ? queries.summary({
          ...window,
          filters: [{ field: "fp", value: event.fp }],
        })
      : null,
    event.token_id
      ? queries.list(
          { siteKey, filters: [{ field: "token_id", value: event.token_id }] },
          { limit: 10 },
        )
      : { events: [] },
    event.type === "redeem" && event.ip
      ? queries.list(
          {
            siteKey,
            from: event.ts - CHALLENGE_WINDOW,
            to: event.ts + 1,
            filters: [
              { field: "ip", value: event.ip },
              { field: "type", value: "challenge" },
            ],
          },
          { limit: 10 },
        )
      : { events: [] },
  ]);
  const challenge =
    issued.events.find(
      (e) => e.outcome === "pass" && e.fp === event.fp && e.ts <= event.ts,
    ) ?? null;
  return {
    event,
    related: {
      ip: sameIp.events.filter((e) => e.id !== event.id),
      visitor: sameVisitor,
      chain: chain.events.filter((e) => e.id !== event.id),
      challenge,
    },
  };
}

const LEGACY_DURATIONS = {
  today: () => {
    const start = Math.floor(Date.now() / DAY) * DAY;
    return {
      from: start,
      to: Math.floor(Date.now() / HOUR) * HOUR + HOUR,
      bucket: HOUR,
      prev: true,
    };
  },
  yesterday: () => {
    const start = Math.floor(Date.now() / DAY) * DAY - DAY;
    return { from: start, to: start + DAY, bucket: HOUR, prev: true };
  },
  last7days: () => ({
    from: Math.floor(Date.now() / DAY) * DAY - 6 * DAY,
    to: Math.floor(Date.now() / DAY) * DAY + DAY,
    bucket: DAY,
    prev: true,
  }),
  last28days: () => ({
    from: Math.floor(Date.now() / DAY) * DAY - 27 * DAY,
    to: Math.floor(Date.now() / DAY) * DAY + DAY,
    bucket: DAY,
    prev: true,
  }),
  last91days: () => ({
    from: Math.floor(Date.now() / DAY) * DAY - 90 * DAY,
    to: Math.floor(Date.now() / DAY) * DAY + DAY,
    bucket: DAY,
    prev: true,
  }),
  alltime: () => ({
    from: 0,
    to: Math.floor(Date.now() / DAY) * DAY + DAY,
    bucket: DAY,
    prev: false,
  }),
};

export async function legacyKeyStats(siteKey, chartDuration = "today") {
  const spec = (LEGACY_DURATIONS[chartDuration] ?? LEGACY_DURATIONS.today)();
  let from = spec.from;
  if (chartDuration === "alltime") {
    const queries = getQueries();
    const [first, roll] = await Promise.all([
      queries.firstEventTs(siteKey),
      queries.rollups(siteKey, 0, Date.now()),
    ]);
    const earliest = Math.min(first ?? Date.now(), ...roll.map((r) => r.hour));
    from = Math.floor(earliest / DAY) * DAY;
  }
  const o = await overview(siteKey, { from, to: spec.to, bucket: spec.bucket });
  const series = new Map();
  for (const s of o.series) {
    const b = Math.floor(s.b / spec.bucket) * spec.bucket;
    const cur = series.get(b) ?? { solved: 0, failed: 0, limited: 0 };
    cur.solved += s.solved;
    cur.failed += s.failed;
    cur.limited += s.limited;
    series.set(b, cur);
  }
  const data = [];
  for (
    let b = Math.floor(from / spec.bucket) * spec.bucket;
    b < spec.to;
    b += spec.bucket
  ) {
    const v = series.get(b) ?? { solved: 0, failed: 0, limited: 0 };
    data.push({
      bucket: b / 1000,
      challenges: v.solved + v.failed,
      verified: v.solved,
      failed: v.failed,
      rateLimited: v.limited,
    });
  }
  const shape = (s) => ({
    challenges: s.solved + s.failed,
    verified: s.solved,
    failed: s.failed,
    avgLatency: s.avg_solve,
    rateLimited: s.limited,
  });
  return {
    stats: shape(o.summary),
    prevStats: spec.prev ? shape(o.previous) : null,
    chartData: {
      duration: chartDuration,
      bucketSize: spec.bucket / 1000,
      data,
    },
  };
}

export async function legacyGeoStats(siteKey) {
  const top = await topDimensions(siteKey, {
    from: 0,
    to: Date.now() + MIN,
    filters: [{ field: "type", value: "challenge" }],
    dims: ["country", "asn_org", "platform", "os"],
    limit: 100,
  });
  const shape = (rows, key = "name") =>
    rows.map((r) => ({ [key]: r.value, count: r.n }));
  const sum = (rows) => rows.reduce((s, r) => s + r.n, 0);
  return {
    countries: shape(top.country, "code"),
    totalCountry: sum(top.country),
    asns: top.asn_org.map((r) => ({
      name: r.label ? `AS${r.label} ${r.value}` : r.value,
      count: r.n,
    })),
    totalAsn: sum(top.asn_org),
    platforms: shape(top.platform),
    totalPlatform: sum(top.platform),
    oses: shape(top.os),
    totalOs: sum(top.os),
  };
}

export async function solvesByKey(siteKeys) {
  const now = Date.now();
  const out = {};
  await Promise.all(
    siteKeys.map(async (sk) => {
      const [cur, prev] = await Promise.all([
        getQueries().summary({ siteKey: sk, from: now - DAY, to: now + MIN }),
        getQueries().summary({
          siteKey: sk,
          from: now - 2 * DAY,
          to: now - DAY,
        }),
      ]);
      out[sk] = { current: cur.solved, previous: prev.solved };
    }),
  );
  return out;
}
