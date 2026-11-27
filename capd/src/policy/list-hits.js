import { resolveRange } from "../events/analytics.js";
import { getQueries, getStore } from "../events/index.js";
import { getList } from "./lists.js";

const COLUMNS = { ip: "ip", asn: "asn", country: "country", visitor: "fp" };
const UNCOUNTED = new Set(["cidr", "ua"]);
const CHUNK = 90;
const MAX_ENTRIES = 1000;
const D1_MAX_ENTRIES = 200;

export async function listHits(id, { range } = {}) {
  const list = await getList(id);
  if (!list) return null;
  const r = resolveRange({ range: range ?? "7d" });
  const queries = getQueries();
  const window = { from: r.from, to: r.to };
  const cap = getStore()?.kind === "d1" ? D1_MAX_ENTRIES : MAX_ENTRIES;
  const items = list.items.slice(0, cap);
  const byKind = new Map();
  for (const item of items) {
    if (!COLUMNS[item.kind] && item.kind !== "org") continue;
    const values = byKind.get(item.kind) ?? [];
    values.push(item.value);
    byKind.set(item.kind, values);
  }
  const jobs = [];
  for (const [kind, values] of byKind) {
    if (kind === "org") {
      jobs.push(
        queries.top(window, "asn_org", 1000).then((rows) => {
          const wanted = new Set(values.map((v) => v.toLowerCase()));
          const out = new Map();
          for (const row of rows) {
            const key = String(row.value).toLowerCase();
            if (!wanted.has(key)) continue;
            const cur = out.get(key) ?? { n: 0, blocked: 0 };
            cur.n += row.n;
            cur.blocked += row.blocked;
            out.set(key, cur);
          }
          return [...out].map(([value, c]) => ({ kind, value, ...c }));
        }),
      );
      continue;
    }
    const field = COLUMNS[kind];
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK);
      jobs.push(
        queries
          .top(
            {
              ...window,
              filters: chunk.map((value) => ({ field, value })),
            },
            field,
            chunk.length,
          )
          .then((rows) =>
            rows.map((row) => ({
              kind,
              value: String(row.value),
              n: row.n,
              blocked: row.blocked,
            })),
          ),
      );
    }
  }
  const hits = {};
  for (const row of (await Promise.all(jobs)).flat())
    hits[`${row.kind}:${row.value}`] = { n: row.n, blocked: row.blocked };
  return {
    range: { from: r.from, to: r.to },
    counted: items.filter((item) => !UNCOUNTED.has(item.kind)).length,
    total: list.items.length,
    uncounted: [
      ...new Set(
        items.map((item) => item.kind).filter((k) => UNCOUNTED.has(k)),
      ),
    ],
    hits,
  };
}
