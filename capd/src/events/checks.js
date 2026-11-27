import { resolveRange } from "./analytics.js";
import { getQueries } from "./index.js";

const DIMS = ["flag", "agent"];

export async function checkActivity(siteKey, { range } = {}) {
  const r = resolveRange({ range: range ?? "7d" });
  const span = r.to - r.from;
  const queries = getQueries();
  const ctx = { siteKey, from: r.from, to: r.to };
  const prevCtx = { siteKey, from: r.from - span, to: r.from };
  const solved = [{ field: "type", value: "redeem" }];
  const [now, before, ...rows] = await Promise.all([
    queries.summary({ ...ctx, filters: solved }),
    queries.summary({ ...prevCtx, filters: solved }),
    ...DIMS.flatMap((dim) => [
      queries.dimensionSeries(ctx, dim, r.bucket),
      queries.top(prevCtx, dim, 500),
    ]),
  ]);
  const buckets = Math.ceil(span / r.bucket);
  const out = {};
  DIMS.forEach((dim, i) => {
    const series = rows[i * 2];
    const previous = new Map(rows[i * 2 + 1].map((row) => [row.value, row.n]));
    const stats = new Map();
    for (const row of series) {
      if (dim === "flag" && String(row.value).startsWith("rule:")) continue;
      const s = stats.get(row.value) ?? {
        n: 0,
        blocked: 0,
        previous: previous.get(row.value) ?? 0,
        series: Array(buckets).fill(0),
      };
      s.n += row.n;
      s.blocked += row.blocked;
      const at = Math.floor((row.b - r.from) / r.bucket);
      if (at >= 0 && at < buckets) s.series[at] += row.n;
      stats.set(row.value, s);
    }
    for (const [value, n] of previous) {
      if (stats.has(value)) continue;
      if (dim === "flag" && String(value).startsWith("rule:")) continue;
      stats.set(value, {
        n: 0,
        blocked: 0,
        previous: n,
        series: Array(buckets).fill(0),
      });
    }
    out[dim === "flag" ? "flags" : "agents"] = Object.fromEntries(stats);
  });
  return {
    range: { from: r.from, to: r.to, bucket: r.bucket },
    attempts: { current: now.total, previous: before.total },
    ...out,
  };
}
