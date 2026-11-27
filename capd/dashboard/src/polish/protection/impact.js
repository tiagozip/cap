import { api, qs } from "../../lib/api.js";
import { catalog } from "../../lib/catalog.svelte.js";

const DAY = 86_400_000;
const WINDOWS = 12;
const PER_WINDOW = 100;
const TTL = 60_000;
const UNSUPPORTED = new Set(["header", "ip_velocity", "visitor_velocity"]);

const samples = new Map();
const listCache = new Map();

const windowTotals = (series, from, span) => {
  const totals = Array(WINDOWS).fill(0);
  for (const row of series ?? []) {
    const i = Math.floor((row.b - from) / span);
    if (i < 0 || i >= WINDOWS) continue;
    totals[i] +=
      (row.challenges ?? 0) +
      (row.solved ?? 0) +
      (row.failed ?? 0) +
      (row.blocked ?? 0) +
      (row.limited ?? 0);
  }
  return totals;
};

async function pool(tasks, size) {
  const out = Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: size }, worker));
  return out;
}

async function fetchSample(siteKey, type, days) {
  const to = Date.now();
  const from = to - days * DAY;
  const span = (days * DAY) / WINDOWS;
  const f = `type:${type}`;
  const [overview, ...pages] = await Promise.all([
    api("GET", `/keys/${siteKey}/analytics${qs({ from, to, f })}`),
    ...(await pool(
      Array.from(
        { length: WINDOWS },
        (_, i) => () =>
          api(
            "GET",
            `/keys/${siteKey}/events${qs({
              from: from + i * span,
              to: from + (i + 1) * span,
              f,
              limit: PER_WINDOW,
            })}`,
          ),
      ),
      4,
    )),
  ]);
  if (overview?.error || pages.some((p) => !Array.isArray(p?.events)))
    throw new Error("sample");
  const totals = windowTotals(overview.series, from, span);
  const windows = pages.map((p, i) => ({
    events: p.events,
    total: Math.max(totals[i], p.events.length),
  }));
  return { type, from, to, windows };
}

export function loadSample(siteKey, type, days = 1) {
  const id = `${siteKey}:${type}:${days}`;
  const hit = samples.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = fetchSample(siteKey, type, days).catch((e) => {
    samples.delete(id);
    throw e;
  });
  samples.set(id, { at: Date.now(), promise });
  return promise;
}

export function loadLists(ids) {
  return Promise.all(
    [...new Set(ids)].map((id) => {
      if (!listCache.has(id))
        listCache.set(
          id,
          api("GET", `/lists/${encodeURIComponent(id)}`).then((l) =>
            l?.items ? compileList(l.items) : null,
          ),
        );
      return listCache.get(id).then((m) => [id, m]);
    }),
  ).then(Object.fromEntries);
}

export const forgetList = (id) => listCache.delete(id);

const parseIp = (s) => {
  if (!s) return null;
  let ip = String(s).toLowerCase();
  if (ip.startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  if (ip.includes(".")) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !(n >= 0 && n <= 255)))
      return null;
    return {
      v: 4,
      n: parts.reduce((a, b) => (a << 8n) | BigInt(b), 0n),
      bits: 32,
    };
  }
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = tail == null ? [] : Array(8 - h.length - t.length).fill("0");
  const groups = [...h, ...fill, ...t];
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) {
    const x = Number.parseInt(g || "0", 16);
    if (Number.isNaN(x)) return null;
    n = (n << 16n) | BigInt(x);
  }
  return { v: 6, n, bits: 128 };
};

const parseCidr = (s) => {
  const [addr, len] = String(s).split("/");
  const ip = parseIp(addr);
  if (!ip) return null;
  const prefix = len == null ? ip.bits : Number(len);
  if (!(prefix >= 0 && prefix <= ip.bits)) return null;
  const shift = BigInt(ip.bits - prefix);
  return { v: ip.v, shift, base: ip.n >> shift };
};

const inCidr = (ip, cidr) =>
  !!ip && !!cidr && ip.v === cidr.v && ip.n >> cidr.shift === cidr.base;

function compileList(items) {
  const m = {
    ips: new Set(),
    cidrs: [],
    asns: new Set(),
    orgs: new Set(),
    countries: new Set(),
    uas: [],
    visitors: new Set(),
  };
  for (const { kind, value } of items) {
    const v = String(value).toLowerCase();
    if (kind === "ip") m.ips.add(v);
    else if (kind === "cidr") {
      const c = parseCidr(v);
      if (c) m.cidrs.push(c);
    } else if (kind === "asn") m.asns.add(Number(v.replace(/^as/, "")));
    else if (kind === "org") m.orgs.add(v);
    else if (kind === "country") m.countries.add(String(value).toUpperCase());
    else if (kind === "ua") m.uas.push(v);
    else if (kind === "visitor") m.visitors.add(String(value));
  }
  return m;
}

const onList = (m, e) => {
  if (!m) return false;
  const raw = e.ip
    ? String(e.ip)
        .toLowerCase()
        .replace(/^::ffff:/, "")
    : null;
  if (raw && m.ips.has(raw)) return true;
  if (raw && m.cidrs.length) {
    const ip = parseIp(raw);
    if (m.cidrs.some((c) => inCidr(ip, c))) return true;
  }
  if (e.asn && m.asns.has(Number(e.asn))) return true;
  if (e.asn_org && m.orgs.has(e.asn_org.toLowerCase())) return true;
  if (e.country && m.countries.has(e.country)) return true;
  if (e.ua && m.uas.length) {
    const ua = e.ua.toLowerCase();
    if (m.uas.some((n) => ua.includes(n))) return true;
  }
  return !!e.fp && m.visitors.has(e.fp);
};

const splitValues = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((x) => String(x).trim())
    .filter(Boolean);

function compileCondition(c, lists) {
  if (UNSUPPORTED.has(c.field)) return null;
  const type = catalog.fields[c.field]?.type ?? "string";
  const get =
    c.field === "visitor"
      ? (e) => e.fp
      : c.field === "flag"
        ? (e) => e.flags ?? []
        : (e) => e[c.field];
  switch (c.op) {
    case "exists":
      return (e) => get(e) != null && get(e) !== "";
    case "not_exists":
      return (e) => get(e) == null || get(e) === "";
    case "is_true":
      return (e) => get(e) === true;
    case "is_false":
      return (e) => get(e) !== true;
    case "in_list":
    case "not_in_list": {
      if (!(c.value in lists)) return null;
      const m = lists[c.value];
      return c.op === "in_list" ? (e) => onList(m, e) : (e) => !onList(m, e);
    }
    case "has":
    case "not_has": {
      const v = String(c.value ?? "");
      const prefix = v.endsWith("*") ? v.slice(0, -1) : null;
      const found = (e) =>
        prefix != null
          ? get(e).some((f) => f.startsWith(prefix))
          : get(e).includes(v);
      return c.op === "has" ? found : (e) => !found(e);
    }
  }
  const empty = c.op === "neq" || c.op === "not_in" || c.op === "not_contains";
  const guard = (test) => (e) => {
    const v = get(e);
    return v == null || v === "" ? empty : test(v);
  };
  if (type === "number") {
    const n = Number(c.value);
    if (!Number.isFinite(n)) return null;
    const cmp = {
      eq: (x) => x === n,
      neq: (x) => x !== n,
      gt: (x) => x > n,
      gte: (x) => x >= n,
      lt: (x) => x < n,
      lte: (x) => x <= n,
    }[c.op];
    return cmp ? guard((v) => cmp(Number(v))) : null;
  }
  if (c.op === "in" || c.op === "not_in") {
    const values = splitValues(c.value);
    const lower = new Set(values.map((x) => x.toLowerCase()));
    const cidrs =
      c.field === "ip"
        ? values
            .filter((x) => x.includes("/"))
            .map(parseCidr)
            .filter(Boolean)
        : [];
    const found = (v) =>
      lower.has(String(v).toLowerCase()) ||
      (cidrs.length > 0 && cidrs.some((p) => inCidr(parseIp(v), p)));
    return guard(c.op === "in" ? found : (v) => !found(v));
  }
  const needle = String(c.value ?? "").toLowerCase();
  if (c.op === "matches") {
    let re;
    try {
      re = new RegExp(String(c.value), "i");
    } catch {
      return null;
    }
    return guard((v) => re.test(String(v).slice(0, 512)));
  }
  const tests = {
    eq: (s) => s === needle,
    neq: (s) => s !== needle,
    contains: (s) => s.includes(needle),
    not_contains: (s) => !s.includes(needle),
    starts_with: (s) => s.startsWith(needle),
  };
  const test = tests[c.op];
  return test ? guard((v) => test(String(v).toLowerCase())) : null;
}

export const stageOf = (rule) =>
  rule.conditions.every((c) => catalog.fields[c.field]?.stage !== "result")
    ? "challenge"
    : "redeem";

export const listIdsOf = (rule) =>
  rule.conditions
    .filter((c) => c.field === "list" && c.value)
    .map((c) => c.value);

export function compileRule(rule, lists = {}) {
  const tests = rule.conditions.map((c) => compileCondition(c, lists));
  const skipped = rule.conditions.filter((_, i) => !tests[i]);
  const live = tests.filter(Boolean);
  if (!live.length) return { skipped, test: null };
  const test =
    rule.match === "any"
      ? (e) => live.some((t) => t(e))
      : (e) => live.every((t) => t(e));
  return { skipped, test };
}

const top = (events, field, limit = 3) => {
  const counts = new Map();
  for (const e of events) {
    const v = e[field];
    if (v == null || v === "") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, n]) => ({ value, share: n / events.length }));
};

export function estimate(sample, test) {
  let total = 0;
  let matched = 0;
  let sampled = 0;
  let hits = 0;
  const hitEvents = [];
  const bars = sample.windows.map((w) => {
    const n = w.events.length;
    const m = n ? w.events.filter(test) : [];
    for (const e of m) hitEvents.push(e);
    const est = n ? (m.length / n) * w.total : 0;
    total += w.total;
    matched += est;
    sampled += n;
    hits += m.length;
    return { total: w.total, matched: est };
  });
  return {
    total,
    matched: Math.round(matched),
    share: total ? matched / total : 0,
    exact: sampled >= total,
    sampled,
    hits,
    bars,
    events: hitEvents,
    countries: top(hitEvents, "country"),
    networks: top(hitEvents, "asn_org"),
    ips: top(hitEvents, "ip", 2).filter((x) => x.share >= 0.05),
  };
}
