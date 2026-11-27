import { resolveRange } from "../events/analytics.js";
import { getQueries } from "../events/index.js";
import { getRules } from "./rules.js";

const emptyStats = (buckets) => ({
  hits: 0,
  previous: 0,
  outcomes: { pass: 0, fail: 0, block: 0, limit: 0 },
  ips: 0,
  visitors: 0,
  first: null,
  last: null,
  series: Array(buckets).fill(0),
});

const pickSource = (action, activity, id) => {
  const flagged = action === "flag";
  const has = (rows) => rows.some((r) => r.rule === id);
  const useFlags =
    flagged || (!action && !has(activity.series) && has(activity.flagSeries));
  return useFlags
    ? { series: activity.flagSeries, totals: activity.flagTotals }
    : { series: activity.series, totals: activity.totals };
};

export async function ruleStats(siteKey, { range } = {}) {
  const r = resolveRange({ range: range ?? "24h" });
  const span = r.to - r.from;
  const queries = getQueries();
  const ctx = { siteKey, from: r.from, to: r.to };
  const [rules, current, previous] = await Promise.all([
    getRules(siteKey),
    queries.ruleActivity(ctx, r.bucket),
    queries.ruleActivity({ ...ctx, from: r.from - span, to: r.from }, span),
  ]);
  const actions = new Map(rules.map((rule) => [rule.id, rule.action]));
  const ids = new Set([
    ...actions.keys(),
    ...current.series.map((row) => row.rule),
    ...current.flagSeries.map((row) => row.rule),
  ]);
  const buckets = Math.ceil(span / r.bucket);
  const out = {};
  for (const id of ids) {
    const action = actions.get(id);
    const stats = emptyStats(buckets);
    const now = pickSource(action, current, id);
    for (const row of now.series) {
      if (row.rule !== id) continue;
      stats.hits += row.n;
      if (stats.outcomes[row.outcome] != null)
        stats.outcomes[row.outcome] += row.n;
      const i = Math.floor((row.b - r.from) / r.bucket);
      if (i >= 0 && i < buckets) stats.series[i] += row.n;
    }
    const total = now.totals.find((row) => row.rule === id);
    if (total) {
      stats.ips = total.ips;
      stats.visitors = total.visitors;
      stats.first = total.first;
      stats.last = total.last;
    }
    for (const row of pickSource(action, previous, id).series)
      if (row.rule === id) stats.previous += row.n;
    if (!action) stats.removed = true;
    out[id] = stats;
  }
  return {
    range: { from: r.from, to: r.to, bucket: r.bucket },
    rules: out,
  };
}
