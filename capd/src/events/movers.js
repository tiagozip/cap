import { resolveRange } from "./analytics.js";
import { getQueries } from "./index.js";

const DIMS = [
  "country",
  "asn_org",
  "flag",
  "agent",
  "reason",
  "browser",
  "rule",
];
const PER_DIM = 50;
const MIN_COUNT = 20;
const LIMIT = 12;

const redundant = (dim, value) =>
  (dim === "flag" && /^(rule|agent):/.test(value)) ||
  (dim === "reason" && String(value).startsWith("rule:"));

export async function movers(siteKey, { range, filters = [], q } = {}) {
  const r = resolveRange({ range: range ?? "24h" });
  const queries = getQueries();
  const ctx = { siteKey, from: r.from, to: r.to, filters, q };
  const prevCtx = { ...ctx, from: r.from - (r.to - r.from), to: r.from };
  const [now, before, ...tops] = await Promise.all([
    queries.summary(ctx),
    queries.summary(prevCtx),
    ...DIMS.flatMap((d) => [
      queries.top(ctx, d, PER_DIM),
      queries.top(prevCtx, d, PER_DIM),
    ]),
  ]);
  const scale = before.total ? now.total / before.total : 1;
  const out = [];
  DIMS.forEach((dim, i) => {
    const current = tops[i * 2];
    const previous = new Map(tops[i * 2 + 1].map((row) => [row.value, row]));
    const complete = current.length < PER_DIM;
    const prevFloor =
      previous.size < PER_DIM
        ? 0
        : Math.min(...[...previous.values()].map((row) => row.n));
    const consider = (value, cur, prev) => {
      if (redundant(dim, value)) return;
      const n = cur?.n ?? 0;
      const p = prev?.n ?? prevFloor;
      if (Math.max(n, p) < MIN_COUNT) return;
      const expected = p * scale;
      const score = (n - expected) / Math.sqrt(expected + n + 1);
      if (Math.abs(score) < 3) return;
      const label = cur?.label ?? prev?.label;
      out.push({
        dim,
        value,
        ...(label != null && { label }),
        n,
        previous: p,
        expected: Math.round(expected),
        change: prev && p ? n / p - 1 : null,
        blocked: cur?.blocked ?? 0,
        score: Math.round(score * 10) / 10,
      });
    };
    const listed = new Set(current.map((row) => row.value));
    for (const row of current)
      consider(row.value, row, previous.get(row.value));
    if (complete)
      for (const row of previous.values())
        if (!listed.has(row.value)) consider(row.value, null, row);
  });
  out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return {
    range: { from: r.from, to: r.to },
    total: now.total,
    previousTotal: before.total,
    movers: out.slice(0, LIMIT),
  };
}
