import {
  FILTER_FIELDS,
  TOP_DIMENSIONS,
} from "../../../capd/src/events/schema.js";
import {
  cohortsByPrefix,
  DAY,
  decodeEventId,
  decodeFp,
  decodeVisit,
  encodeEventId,
  encodeFp,
  encodeVisit,
  HOUR,
  h3,
  hourRate,
  ipIndex,
  ipOf,
  MAX_SPAN,
  MIN,
  materialize,
  minuteRate,
  modelFor,
  PROFILES,
  quickIdx,
  scoreHist,
  solveHist,
  solveMean,
  unit,
  visitAt,
  visitCount,
} from "./model.js";

const P = PROFILES.length;
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
const CLIENT_FIELDS = new Set([
  "ip",
  "country",
  "asn",
  "asn_org",
  "browser",
  "os",
  "platform",
  "lang",
  "fp",
  "ua",
]);

export function resolveRange(
  { range = "24h", from, to, bucket: forced } = {},
  retentionDays = 90,
) {
  const now = Date.now();
  const f0 = Number(from);
  const t0 = Number(to);
  if (from != null && to && Number.isFinite(f0) && Number.isFinite(t0)) {
    const floor = now - retentionDays * DAY;
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

const cohortValue = (field, cohort) => {
  if (field === "asn_org") return cohort.org ?? "";
  if (field === "asn") return cohort.asn ?? 0;
  return cohort[field] ?? "";
};

const eventValue = (field, ev, cohort, model) => {
  if (!ev.client && CLIENT_FIELDS.has(field)) return field === "asn" ? 0 : "";
  if (field === "protocol") return model.protocol;
  if (field === "origin") return cohort.origin ?? "";
  if (field in ev) return ev[field];
  return cohortValue(field, cohort);
};

const parseIp = (value) => {
  const parts = String(value).split(".");
  if (parts.length !== 4) return null;
  const n = parts.map(Number);
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  return n;
};

const idxForIp = (model, cohort, value) => {
  const n = parseIp(value);
  if (!n) return -1;
  const hit = cohortsByPrefix().get(`${n[0]}.${n[1]}`);
  if (!hit || hit[0] !== model || hit[1] !== cohort) return -1;
  return ipIndex(cohort, n[2], n[3]);
};

const idxForFp = (model, cohort, value) => {
  const d = decodeFp(value);
  if (!d || d.k !== model.k || d.c !== cohort.i || d.idx >= cohort.U) return -1;
  return d.idx;
};

const partialCache = new Map();
const partialIps = (cohort, q) => {
  const id = `${cohort.a}.${cohort.b}.${cohort.off}:${q}`;
  const hit = partialCache.get(id);
  if (hit) return hit;
  const set = new Set();
  for (let i = 0; i < cohort.U; i++)
    if (ipOf(cohort, i).startsWith(q)) set.add(i);
  if (partialCache.size > 200) partialCache.clear();
  partialCache.set(id, set);
  return set;
};

const intersect = (a, b) => {
  if (!a) return b;
  return new Set([...a].filter((x) => b.has(x)));
};

export function compile(model, filters = [], q) {
  const groups = new Map();
  for (const f of filters) {
    const key = `${f.field}:${f.neg ? 1 : 0}`;
    if (!groups.has(key))
      groups.set(key, { field: f.field, neg: f.neg, values: [] });
    groups.get(key).values.push(f.value);
  }
  let visits = null;
  for (const g of groups.values()) {
    if (g.field !== "token_id" || g.neg) continue;
    const found = g.values
      .map(decodeVisit)
      .filter((v) => v && v.k === model.k && model.templates[v.j]);
    visits = (visits ?? found).filter((v) =>
      found.some((x) => x.m === v.m && x.j === v.j && x.s === v.s),
    );
  }
  const query = q?.trim();
  if (query) {
    const ev = decodeEventId(query);
    const visit = ev ?? decodeVisit(query);
    if (visit && visit.k === model.k && model.templates[visit.j]) {
      const target = { ...visit, only: ev ? ev.e : null };
      visits = visits
        ? visits.filter(
            (v) => v.m === target.m && v.j === target.j && v.s === target.s,
          )
        : [target];
    }
  }
  const ql = query && !visits ? query.toLowerCase() : null;
  const plain = [...groups.values()].filter(
    (g) => !["ip", "fp", "token_id"].includes(g.field),
  );
  const pools = [...groups.values()].filter(
    (g) => g.field === "ip" || g.field === "fp",
  );
  const templates = [];
  let constrained = 0;
  for (const t of model.templates) {
    const cohort = model.cohorts[t.c];
    let inc = null;
    let exc = null;
    let clientOk = true;
    let serverOk = true;
    for (const g of pools) {
      const ids = new Set(
        g.values
          .map((v) =>
            g.field === "ip"
              ? idxForIp(model, cohort, v)
              : idxForFp(model, cohort, v),
          )
          .filter((i) => i >= 0),
      );
      if (g.neg) {
        if (ids.size) exc = new Set([...(exc ?? []), ...ids]);
      } else {
        serverOk = false;
        if (!ids.size) clientOk = false;
        else inc = intersect(inc, ids);
      }
    }
    if (ql) {
      serverOk = false;
      const prefix = `${cohort.a}.${cohort.b}.`;
      const full =
        (cohort.ua ?? "").toLowerCase().includes(ql) ||
        (cohort.org ?? "").toLowerCase().includes(ql) ||
        prefix.startsWith(ql);
      if (!full) {
        if (ql.startsWith(prefix)) inc = intersect(inc, partialIps(cohort, ql));
        else clientOk = false;
      }
    }
    if (inc && !inc.size) clientOk = false;
    let mask = 0;
    for (const ev of t.events) {
      if (ev.client ? !clientOk : !serverOk) continue;
      let ok = true;
      for (const g of plain) {
        const any = g.values.some((v) => {
          if (g.field === "flag") return ev.flags.includes(v);
          const value = eventValue(g.field, ev, cohort, model);
          if (g.field === "asn") return value === (Number(v) || 0);
          return value === v;
        });
        if (g.neg ? any : !any) {
          ok = false;
          break;
        }
      }
      if (ok) mask |= 1 << ev.i;
    }
    if (!mask) continue;
    const clientMask = t.events.reduce(
      (acc, ev) => (ev.client && mask & (1 << ev.i) ? acc | (1 << ev.i) : acc),
      0,
    );
    if (inc && clientMask) constrained++;
    const size = cohort.U;
    let fc = 1;
    if (inc) fc = inc.size / size;
    if (exc) fc *= 1 - [...exc].filter((i) => !inc || inc.has(i)).length / size;
    templates.push({ t, cohort, mask, clientMask, inc, exc, fc });
  }
  return {
    model,
    templates,
    visits,
    exact: !!visits || (constrained > 0 && constrained === templates.length),
  };
}

const profileRates = (model, m, out) => {
  for (let p = 0; p < P; p++) out[p] = minuteRate(model, p, m);
  return out;
};

function volumes(model, from, to, bucket, start, nb, fine = bucket < HOUR) {
  const out = new Float64Array(nb * P);
  const end = Math.min(to, Date.now());
  if (end <= from) return out;
  if (!fine) {
    for (let h = Math.floor(from / HOUR); h * HOUR < end; h++) {
      const hs = h * HOUR;
      const ov = (Math.min(hs + HOUR, end) - Math.max(hs, from)) / HOUR;
      if (ov <= 0) continue;
      const bi = Math.floor((Math.max(hs, from) - start) / bucket);
      if (bi < 0 || bi >= nb) continue;
      for (let p = 0; p < P; p++) out[bi * P + p] += hourRate(model, p, h) * ov;
    }
    return out;
  }
  for (let m = Math.floor(from / MIN); m * MIN < end; m++) {
    const ms = m * MIN;
    const ov = (Math.min(ms + MIN, end) - Math.max(ms, from)) / MIN;
    if (ov <= 0) continue;
    const bi = Math.floor((Math.max(ms, from) - start) / bucket);
    if (bi < 0 || bi >= nb) continue;
    for (let p = 0; p < P; p++) out[bi * P + p] += minuteRate(model, p, m) * ov;
  }
  return out;
}

const totalVolume = (model, from, to) =>
  volumes(model, from, to, to - from + 1, from, 1, to - from <= 2 * HOUR);

const CATS = [
  "challenges",
  "solved",
  "failed",
  "blocked",
  "limited",
  "verified",
  "flagged",
];

const categoryOf = (type, outcome) => {
  if (outcome === "block") return "blocked";
  if (outcome === "limit") return "limited";
  if (type === "challenge" && outcome === "pass") return "challenges";
  if (type === "redeem" && outcome === "pass") return "solved";
  if (type === "redeem" && outcome === "fail") return "failed";
  if (type === "siteverify" && outcome === "pass") return "verified";
  return "other";
};

const eachEvent = (plan, fn) => {
  for (const tp of plan.templates) {
    for (const ev of tp.t.events) {
      if (!(tp.mask & (1 << ev.i))) continue;
      fn(tp, ev, tp.t.w * (ev.client ? tp.fc : 1));
    }
  }
};

function units(plan) {
  const u = Array.from({ length: P }, () => ({
    challenges: 0,
    solved: 0,
    failed: 0,
    blocked: 0,
    limited: 0,
    verified: 0,
    flagged: 0,
    other: 0,
    agents: 0,
    solveSum: 0,
    solveN: 0,
  }));
  eachEvent(plan, (tp, ev, x) => {
    const row = u[tp.t.p];
    row[categoryOf(ev.type, ev.outcome)] += x;
    if (ev.agent) row.agents += x;
    if (ev.type === "redeem" && ev.outcome === "pass") {
      if (ev.flags.length) row.flagged += x;
      if (tp.t.solve) {
        row.solveSum += x * solveMean(tp.t.solve);
        row.solveN += x;
      }
    }
  });
  return u;
}

const distinct = (plan, vol) => {
  const perCohort = new Map();
  for (const tp of plan.templates) {
    if (!tp.clientMask) continue;
    const n = vol[tp.t.p] * tp.t.w * tp.fc;
    const size = Math.max(1, tp.cohort.U * tp.fc);
    const cur = perCohort.get(tp.cohort) ?? [0, size];
    cur[0] += n;
    perCohort.set(tp.cohort, cur);
  }
  let total = 0;
  for (const [n, size] of perCohort.values())
    total += size * (1 - Math.exp(-n / size));
  return Math.round(total);
};

const dither = (x, k, b, c) => Math.max(0, Math.floor(x + unit(h3(k, b, c))));

function analyticSeries(plan, from, to, bucket) {
  const nb = Math.max(1, Math.ceil((to - from) / bucket));
  const vol = volumes(plan.model, from, to, bucket, from, nb);
  const u = units(plan);
  const series = [];
  const k = plan.model.k;
  for (let i = 0; i < nb; i++) {
    const b = from + i * bucket;
    const row = { b };
    for (const [ci, cat] of CATS.entries()) {
      let x = 0;
      for (let p = 0; p < P; p++) x += vol[i * P + p] * u[p][cat];
      row[cat] = dither(x, k, Math.floor(b / MIN), ci);
    }
    let other = 0;
    for (let p = 0; p < P; p++) other += vol[i * P + p] * u[p].other;
    row.other = dither(other, k, Math.floor(b / MIN), 9);
    series.push(row);
  }
  return { series, u };
}

function analyticSummary(plan, from, to, bucket) {
  const { series, u } = analyticSeries(plan, from, to, bucket);
  const vol = totalVolume(plan.model, from, to);
  const out = {
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
  for (const row of series) {
    for (const cat of CATS) out[cat] += row[cat];
    out.total += row.other;
  }
  out.total +=
    out.challenges +
    out.solved +
    out.failed +
    out.blocked +
    out.limited +
    out.verified;
  let agents = 0;
  let solveSum = 0;
  let solveN = 0;
  for (let p = 0; p < P; p++) {
    agents += vol[p] * u[p].agents;
    solveSum += vol[p] * u[p].solveSum;
    solveN += vol[p] * u[p].solveN;
  }
  out.agents = Math.round(agents);
  out.avg_solve = solveN > 0.5 ? Math.round(solveSum / solveN) : 0;
  out.ips = distinct(plan, vol);
  out.clients = out.ips;
  return { summary: out, series };
}

function scan(
  plan,
  from,
  to,
  { onRow, stopAt, descending = false, settled = false } = {},
) {
  const now = Date.now();
  const end = Math.min(to, now + 1);
  const model = plan.model;
  if (plan.visits) {
    for (const v of plan.visits) {
      const tp = plan.templates.find((x) => x.t.j === v.j);
      if (!tp) continue;
      const visit = visitAt(model, v.m, v.j, v.s);
      if (settled && tp.t.events.some((x) => visit.times[x.i] > now)) continue;
      if (tp.clientMask && (tp.inc || tp.exc)) {
        if (tp.inc && !tp.inc.has(visit.idx)) continue;
        if (tp.exc?.has(visit.idx)) continue;
      }
      for (const ev of tp.t.events) {
        if (!(tp.mask & (1 << ev.i))) continue;
        if (v.only != null && v.only !== ev.i) continue;
        if (ev.type === "challenge" && v.only == null) continue;
        const ts = visit.times[ev.i];
        if (ts < from || ts >= end || ts > now) continue;
        onRow(visit, ev.i, ts);
      }
    }
    return;
  }
  const lo = Math.floor((from - MAX_SPAN) / MIN);
  const hi = Math.floor((end - 1) / MIN);
  const rates = new Float64Array(P);
  const step = descending ? -1 : 1;
  for (
    let m = descending ? hi : lo;
    descending ? m >= lo : m <= hi;
    m += step
  ) {
    profileRates(model, m, rates);
    for (const tp of plan.templates) {
      const t = tp.t;
      const count = Math.min(127, visitCount(model, t, m, rates));
      for (let s = 0; s < count; s++) {
        let clientPass = true;
        if (tp.inc || tp.exc) {
          const idx = quickIdx(model, m, t.j, s);
          if ((tp.inc && !tp.inc.has(idx)) || tp.exc?.has(idx))
            clientPass = false;
        }
        if (!clientPass && tp.mask === tp.clientMask) continue;
        let visit = null;
        for (const ev of t.events) {
          if (!(tp.mask & (1 << ev.i))) continue;
          if (ev.client && !clientPass) continue;
          if (!visit) {
            visit = visitAt(model, m, t.j, s);
            if (settled && t.events.some((x) => visit.times[x.i] > now)) break;
          }
          const ts = visit.times[ev.i];
          if (ts < from || ts >= end || ts > now) continue;
          onRow(visit, ev.i, ts);
        }
      }
    }
    if (stopAt?.(m)) return;
  }
}

const rowsFor = (plan, from, to) => {
  const rows = [];
  scan(plan, from, to, { onRow: (v, e) => rows.push(materialize(v, e)) });
  return rows;
};

const isFlaggedRow = (r) =>
  r.type === "redeem" && r.outcome === "pass" && r.flags.length > 0;

function summaryRows(rows) {
  const out = {
    total: rows.length,
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
  let sum = 0;
  let n = 0;
  const ips = new Set();
  const fps = new Set();
  for (const r of rows) {
    const cat = categoryOf(r.type, r.outcome);
    if (cat !== "other") out[cat]++;
    if (isFlaggedRow(r)) out.flagged++;
    if (r.agent) out.agents++;
    if (r.type === "redeem" && r.outcome === "pass" && r.solve_ms != null) {
      sum += r.solve_ms;
      n++;
    }
    ips.add(r.ip ?? "");
    fps.add(r.fp ?? "");
  }
  out.avg_solve = n ? Math.round(sum / n) : 0;
  out.ips = ips.size;
  out.clients = fps.size;
  return out;
}

function seriesRows(rows, from, to, bucket) {
  const nb = Math.max(1, Math.ceil((to - from) / bucket));
  const series = Array.from({ length: nb }, (_, i) => ({
    b: from + i * bucket,
    challenges: 0,
    solved: 0,
    failed: 0,
    blocked: 0,
    limited: 0,
    verified: 0,
    flagged: 0,
  }));
  for (const r of rows) {
    const row = series[Math.floor((r.ts - from) / bucket)];
    if (!row) continue;
    const cat = categoryOf(r.type, r.outcome);
    if (cat !== "other") row[cat]++;
    if (isFlaggedRow(r)) row.flagged++;
  }
  return series;
}

const rowValues = (r, dim) => {
  if (dim === "flag") return r.flags;
  const v = r[dim];
  if (v == null || v === "" || v === 0) return [];
  return [v];
};

function topRows(rows, dim, limit) {
  const map = new Map();
  for (const r of rows) {
    for (const v of rowValues(r, dim)) {
      const cur = map.get(v) ?? { value: v, n: 0, blocked: 0, flagged: 0 };
      cur.n++;
      if (r.outcome === "block") cur.blocked++;
      if (isFlaggedRow(r)) cur.flagged++;
      if (dim === "asn") cur.label = r.asn_org;
      if (dim === "asn_org") cur.label = r.asn;
      map.set(v, cur);
    }
  }
  const out = [...map.values()].sort((a, b) => b.n - a.n).slice(0, limit);
  if (dim === "flag") return out.map(({ flagged, ...x }) => x);
  return out;
}

function distRows(rows, col, scale, cap) {
  const map = new Map();
  for (const r of rows) {
    if (r.type !== "redeem" || !["pass", "block"].includes(r.outcome)) continue;
    if (r[col] == null) continue;
    const b = Math.floor(Math.min(r[col], cap) * scale + 0.001);
    const key = `${b}:${r.outcome}`;
    const cur = map.get(key) ?? { b, outcome: r.outcome, n: 0, flagged: 0 };
    cur.n++;
    if (r.flags.length) cur.flagged++;
    map.set(key, cur);
  }
  return [...map.values()];
}

function flowRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = `${r.type}:${r.outcome}`;
    const cur = map.get(key) ?? { type: r.type, outcome: r.outcome, n: 0 };
    cur.n++;
    map.set(key, cur);
  }
  return [...map.values()];
}

function sharedRows(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!r.fp) continue;
    const cur = map.get(r.fp) ?? {
      fp: r.fp,
      ips: new Set(),
      n: 0,
      networks: new Set(),
      countries: new Set(),
      blocked: 0,
      flagged: 0,
      browser: "",
      os: "",
      first: r.ts,
      last: r.ts,
    };
    cur.ips.add(r.ip);
    cur.networks.add(r.asn);
    cur.countries.add(r.country);
    cur.n++;
    if (r.outcome === "block") cur.blocked++;
    if (r.type === "redeem" && r.flags.length) cur.flagged++;
    if ((r.browser ?? "") > cur.browser) cur.browser = r.browser;
    if ((r.os ?? "") > cur.os) cur.os = r.os;
    cur.first = Math.min(cur.first, r.ts);
    cur.last = Math.max(cur.last, r.ts);
    map.set(r.fp, cur);
  }
  return [...map.values()]
    .filter((x) => x.ips.size >= 3)
    .map((x) => ({
      ...x,
      ips: x.ips.size,
      networks: x.networks.size,
      countries: x.countries.size,
    }))
    .sort((a, b) => b.ips - a.ips || b.n - a.n)
    .slice(0, 8);
}

const emptySummary = () => summaryRows([]);

const dimValues = (model, tp, ev, dim) => {
  if (dim === "flag") return ev.flags;
  if (dim === "ip" || dim === "fp") return [];
  if (!ev.client && CLIENT_FIELDS.has(dim)) return [];
  const v = eventValue(dim, ev, tp.cohort, model);
  if (v == null || v === "" || v === 0) return [];
  return [v];
};

function analyticTop(plan, dims, limit, vol) {
  const out = {};
  for (const dim of dims) {
    const map = new Map();
    eachEvent(plan, (tp, ev, x) => {
      const w = vol[tp.t.p] * x;
      if (!w) return;
      for (const v of dimValues(plan.model, tp, ev, dim)) {
        const cur = map.get(v) ?? { value: v, n: 0, blocked: 0, flagged: 0 };
        cur.n += w;
        if (ev.outcome === "block") cur.blocked += w;
        if (ev.type === "redeem" && ev.outcome === "pass" && ev.flags.length)
          cur.flagged += w;
        if (dim === "asn") cur.label = tp.cohort.org;
        if (dim === "asn_org") cur.label = tp.cohort.asn;
        map.set(v, cur);
      }
    });
    if (dim === "ip" || dim === "fp") {
      for (const tp of plan.templates) {
        if (!tp.clientMask || tp.cohort.U > 512) continue;
        for (const ev of tp.t.events) {
          if (!(tp.clientMask & (1 << ev.i))) continue;
          const w = (vol[tp.t.p] * tp.t.w * tp.fc) / tp.cohort.U;
          for (let i = 0; i < tp.cohort.U; i++) {
            if (tp.inc && !tp.inc.has(i)) continue;
            const v =
              dim === "ip"
                ? ipOf(tp.cohort, i)
                : encodeFp(plan.model.k, tp.cohort.i, i);
            const cur = map.get(v) ?? {
              value: v,
              n: 0,
              blocked: 0,
              flagged: 0,
            };
            cur.n += w;
            if (ev.outcome === "block") cur.blocked += w;
            map.set(v, cur);
          }
        }
      }
    }
    const rows = [...map.values()]
      .map((r) => ({
        ...r,
        n: Math.round(r.n),
        blocked: Math.round(r.blocked),
        flagged: Math.round(r.flagged),
      }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, limit)
      .map(({ label, ...r }) =>
        label != null && label !== "" && label !== 0
          ? {
              value: r.value,
              label,
              n: r.n,
              blocked: r.blocked,
              flagged: r.flagged,
            }
          : r,
      );
    out[dim] = dim === "flag" ? rows.map(({ flagged, ...r }) => r) : rows;
  }
  return out;
}

function analyticDist(plan, vol, kind) {
  const acc = new Map();
  eachEvent(plan, (tp, ev, x) => {
    if (ev.type !== "redeem" || !["pass", "block"].includes(ev.outcome)) return;
    const cls = kind === "score" ? ev.score : tp.t.solve;
    if (!cls) return;
    const id = `${kind === "score" ? cls : cls.join(":")}|${ev.outcome}|${ev.flags.length ? 1 : 0}`;
    const cur = acc.get(id) ?? {
      cls,
      outcome: ev.outcome,
      flagged: ev.flags.length > 0,
      w: 0,
    };
    cur.w += vol[tp.t.p] * x;
    acc.set(id, cur);
  });
  const bins = new Map();
  for (const { cls, outcome, flagged, w } of acc.values()) {
    const hist = kind === "score" ? scoreHist(cls) : solveHist(cls);
    for (let b = 0; b < hist.length; b++) {
      if (!hist[b]) continue;
      const key = `${b}:${outcome}`;
      const cur = bins.get(key) ?? { b, outcome, n: 0, flagged: 0 };
      cur.n += w * hist[b];
      if (flagged) cur.flagged += w * hist[b];
      bins.set(key, cur);
    }
  }
  const k = plan.model.k;
  return [...bins.values()]
    .map((r) => {
      const n = dither(r.n, k, r.b, r.outcome === "pass" ? 11 : 12);
      return {
        b: r.b,
        outcome: r.outcome,
        n,
        flagged: Math.min(n, Math.round(r.flagged)),
      };
    })
    .filter((r) => r.n > 0);
}

function analyticFlow(plan, vol) {
  const map = new Map();
  eachEvent(plan, (tp, ev, x) => {
    const key = `${ev.type}:${ev.outcome}`;
    const cur = map.get(key) ?? { type: ev.type, outcome: ev.outcome, n: 0 };
    cur.n += vol[tp.t.p] * x;
    map.set(key, cur);
  });
  return [...map.values()]
    .map((r) => ({ ...r, n: Math.round(r.n) }))
    .filter((r) => r.n > 0);
}

const planFor = (siteKey, filters, q) => {
  const model = modelFor(siteKey);
  return model ? compile(model, filters, q) : null;
};

export function overview(siteKey, opts, retention) {
  const r = resolveRange(opts, retention);
  const plan = planFor(siteKey, opts.filters, opts.q);
  const empty = (from, to) => seriesRows([], from, to, r.bucket);
  if (!plan) {
    return {
      range: { from: r.from, to: r.to, bucket: r.bucket },
      summary: emptySummary(),
      previous: emptySummary(),
      series: empty(r.from, r.to),
      legacy: false,
    };
  }
  if (plan.exact) {
    const rows = rowsFor(plan, r.from, r.to);
    const prev = rowsFor(plan, r.from - r.span, r.from);
    return {
      range: { from: r.from, to: r.to, bucket: r.bucket },
      summary: summaryRows(rows),
      previous: summaryRows(prev),
      series: seriesRows(rows, r.from, r.to, r.bucket),
      legacy: false,
    };
  }
  const cur = analyticSummary(plan, r.from, r.to, r.bucket);
  const prev = analyticSummary(plan, r.from - r.span, r.from, r.bucket);
  return {
    range: { from: r.from, to: r.to, bucket: r.bucket },
    summary: cur.summary,
    previous: prev.summary,
    series: cur.series.map(({ other, ...row }) => row),
    legacy: false,
  };
}

export function topDimensions(siteKey, opts, retention) {
  const r = resolveRange(
    { range: opts.range, from: opts.from, to: opts.to },
    retention,
  );
  const dims = (opts.dims ?? [])
    .filter((d) => TOP_DIMENSIONS.has(d))
    .slice(0, 16);
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit) || 10));
  const plan = planFor(siteKey, opts.filters, opts.q);
  if (!plan) return Object.fromEntries(dims.map((d) => [d, []]));
  if (plan.exact) {
    const rows = rowsFor(plan, r.from, r.to);
    return Object.fromEntries(dims.map((d) => [d, topRows(rows, d, limit)]));
  }
  const vol = totalVolume(plan.model, r.from, r.to);
  return analyticTop(plan, dims, limit, vol);
}

export function insights(siteKey, opts, retention) {
  const r = resolveRange(
    { range: opts.range, from: opts.from, to: opts.to },
    retention,
  );
  const plan = planFor(siteKey, opts.filters, opts.q);
  const hoursOf = (series) =>
    series.map((s) => ({
      b: s.b,
      n:
        s.challenges +
        s.solved +
        s.failed +
        s.blocked +
        s.limited +
        s.verified +
        (s.other ?? 0),
      bad: s.flagged + s.blocked,
    }));
  if (!plan) {
    return {
      range: { from: r.from, to: r.to },
      scores: [],
      solve: { size: 50, rows: [] },
      hours: [],
      flow: [],
      shared: [],
      countries: { current: [], previous: [] },
    };
  }
  const hourFrom = Math.floor(r.from / HOUR) * HOUR;
  if (plan.exact) {
    const rows = rowsFor(plan, r.from, r.to);
    const prev = rowsFor(plan, r.from - r.span, r.from);
    return {
      range: { from: r.from, to: r.to },
      scores: distRows(rows, "score", 100, 1),
      solve: { size: 50, rows: distRows(rows, "solve_ms", 1 / 50, 60_000) },
      hours: hoursOf(seriesRows(rows, hourFrom, r.to, HOUR)).filter((h) => h.n),
      flow: flowRows(rows),
      shared: sharedRows(rows),
      countries: {
        current: topRows(rows, "country", 250),
        previous: topRows(prev, "country", 250),
      },
    };
  }
  const vol = totalVolume(plan.model, r.from, r.to);
  const prevVol = totalVolume(plan.model, r.from - r.span, r.from);
  return {
    range: { from: r.from, to: r.to },
    scores: analyticDist(plan, vol, "score"),
    solve: { size: 50, rows: analyticDist(plan, vol, "solve") },
    hours: hoursOf(analyticSeries(plan, hourFrom, r.to, HOUR).series).filter(
      (h) => h.n,
    ),
    flow: analyticFlow(plan, vol),
    shared: [],
    countries: {
      current: analyticTop(plan, ["country"], 250, vol).country,
      previous: analyticTop(plan, ["country"], 250, prevVol).country,
    },
  };
}

function listPlan(plan, from, to, cursor, limit) {
  const rows = [];
  const pastCursor = (ts, v, e) => {
    if (!cursor) return true;
    if (ts < cursor.ts) return true;
    if (ts > cursor.ts) return false;
    return (
      encodeEventId(ts, encodeVisit(plan.model.k, v.m, v.j, v.s), e) < cursor.id
    );
  };
  const top = cursor ? Math.min(to, cursor.ts + 1) : to;
  scan(plan, from, top, {
    descending: true,
    settled: true,
    onRow: (v, e, ts) => {
      if (pastCursor(ts, v, e)) rows.push([v, e, ts]);
    },
    stopAt: (m) => {
      const done = m * MIN + MAX_SPAN;
      let complete = 0;
      for (const row of rows) if (row[2] >= done) complete++;
      return complete > limit;
    },
  });
  const events = rows
    .map(([v, e]) => materialize(v, e))
    .sort((a, b) => b.ts - a.ts || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
  const page = events.slice(0, limit);
  const last = page.at(-1);
  return {
    events: page,
    next: events.length > limit && last ? `${last.ts}.${last.id}` : null,
  };
}

export function listEvents(siteKey, opts, retention) {
  const r = resolveRange(
    { range: opts.range, from: opts.from, to: opts.to },
    retention,
  );
  let cursor = null;
  if (opts.cursor) {
    const i = opts.cursor.indexOf(".");
    cursor = {
      ts: Number(opts.cursor.slice(0, i)),
      id: opts.cursor.slice(i + 1),
    };
    if (!Number.isFinite(cursor.ts)) cursor = null;
  }
  const limit = Math.min(200, Math.max(1, Math.floor(opts.limit) || 50));
  const plan = planFor(siteKey, opts.filters, opts.q);
  if (!plan) return { events: [], next: null };
  return listPlan(plan, r.from, r.to, cursor, limit);
}

export function eventDetail(siteKey, id) {
  const model = modelFor(siteKey);
  const d = decodeEventId(id);
  if (!model || !d || d.k !== model.k) return null;
  const t = model.templates[d.j];
  if (!t?.events[d.e]) return null;
  const visit = visitAt(model, d.m, d.j, d.s);
  if (visit.times[d.e] !== d.ts || d.ts > Date.now()) return null;
  const event = materialize(visit, d.e);
  const window = { from: event.ts - DAY, to: event.ts + DAY };
  const ipPlan = event.ip
    ? compile(model, [{ field: "ip", value: event.ip }])
    : null;
  const sameIp = ipPlan
    ? listPlan(ipPlan, window.from, window.to, null, 25).events
    : [];
  const visitor = event.fp
    ? summaryRows(
        rowsFor(
          compile(model, [{ field: "fp", value: event.fp }]),
          window.from,
          window.to,
        ),
      )
    : null;
  const token = encodeVisit(model.k, d.m, d.j, d.s);
  const chain = event.token_id
    ? listPlan(
        compile(model, [{ field: "token_id", value: token }]),
        0,
        Date.now() + MIN,
        null,
        10,
      ).events
    : [];
  const issued =
    event.type === "redeem" && event.ip
      ? listPlan(
          compile(model, [
            { field: "ip", value: event.ip },
            { field: "type", value: "challenge" },
          ]),
          event.ts - 15 * MIN,
          event.ts + 1,
          null,
          10,
        ).events
      : [];
  const challenge =
    issued.find(
      (e) => e.outcome === "pass" && e.fp === event.fp && e.ts <= event.ts,
    ) ?? null;
  return {
    event,
    related: {
      ip: sameIp.filter((e) => e.id !== event.id),
      visitor,
      chain: chain.filter((e) => e.id !== event.id),
      challenge,
    },
  };
}

export function solvesByKey(siteKey) {
  const model = modelFor(siteKey);
  if (!model) return { current: 0, previous: 0 };
  const plan = compile(model);
  const now = Date.now();
  const u = units(plan);
  const sum = (vol) => {
    let x = 0;
    for (let p = 0; p < P; p++) x += vol[p] * u[p].solved;
    return Math.round(x);
  };
  return {
    current: sum(totalVolume(model, now - DAY, now + MIN)),
    previous: sum(totalVolume(model, now - 2 * DAY, now - DAY)),
  };
}

const LEGACY = {
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
    from: Math.floor(Date.now() / DAY) * DAY - 90 * DAY,
    to: Math.floor(Date.now() / DAY) * DAY + DAY,
    bucket: DAY,
    prev: false,
  }),
};

export function legacyKeyStats(siteKey, chartDuration = "today") {
  const spec = (LEGACY[chartDuration] ?? LEGACY.today)();
  const o = overview(
    siteKey,
    { from: spec.from, to: spec.to, bucket: spec.bucket },
    3650,
  );
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
      data: o.series.map((s) => ({
        bucket: s.b / 1000,
        challenges: s.solved + s.failed,
        verified: s.solved,
        failed: s.failed,
        rateLimited: s.limited,
      })),
    },
  };
}
