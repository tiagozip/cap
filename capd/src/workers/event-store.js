import { env } from "cloudflare:workers";
import { COLUMN_NAMES, COLUMNS } from "../events/schema.js";

const dialect = {
  name: "d1",
  param: (name) => `?${Number(name.slice(1)) + 1}`,
  bucket: (size) => `(ts / ${size}) * ${size}`,
  bin: (col, scale, cap) =>
    `CAST(min(${col}, ${cap}) * ${scale} + 0.001 AS INTEGER)`,
  flagHas: (p) =>
    `EXISTS (SELECT 1 FROM json_each(events.flags) WHERE value = ${p})`,
  flagged: "flags <> '[]'",
  explodeSelect: "fj.value",
  explodeFrom: ", json_each(events.flags) AS fj",
  ilike: (col, p) => `${col} LIKE ${p}`,
  final: "",
};

const insertEvent = `INSERT OR IGNORE INTO events (${COLUMN_NAMES.join(", ")}) VALUES (${COLUMN_NAMES.map(() => "?").join(", ")})`;
const CHUNK = 50;

const run = async (statements) => {
  for (let i = 0; i < statements.length; i += CHUNK)
    await env.DB.batch(statements.slice(i, i + CHUNK));
};

const store = {
  kind: "d1",
  dialect,
  async insert(rows) {
    await run(
      rows.map((row) =>
        env.DB.prepare(insertEvent).bind(
          ...COLUMNS.map(([name, kind]) =>
            kind === "array" ? JSON.stringify(row[name] ?? []) : row[name],
          ),
        ),
      ),
    );
  },
  async insertRollups(rows) {
    await run(
      rows.map((r) =>
        env.DB.prepare(
          "INSERT OR REPLACE INTO rollup (site_key, hour, verified, failed, ratelimited) VALUES (?, ?, ?, ?, ?)",
        ).bind(
          r.site_key,
          Math.trunc(r.hour),
          Math.trunc(r.verified),
          Math.trunc(r.failed),
          Math.trunc(r.ratelimited),
        ),
      ),
    );
  },
  async query(sql, params = {}) {
    const values = Object.keys(params)
      .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      .map((k) => params[k]);
    const { results } = await env.DB.prepare(sql)
      .bind(...values)
      .all();
    return results;
  },
  async deleteSite(siteKey) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM events WHERE site_key = ?").bind(siteKey),
      env.DB.prepare("DELETE FROM rollup WHERE site_key = ?").bind(siteKey),
    ]);
  },
  async prune(retentionDays) {
    const res = await env.DB.prepare("DELETE FROM events WHERE ts < ?")
      .bind(Date.now() - retentionDays * 86_400_000)
      .run();
    return res.meta.changes ?? 0;
  },
  async setRetention() {},
  async info() {
    const res = await env.DB.prepare("SELECT count(*) AS n FROM events").run();
    return {
      events: res.results[0]?.n ?? 0,
      bytes: res.meta.size_after ?? 0,
      path: "D1",
    };
  },
  async ping() {
    await env.DB.prepare("SELECT 1").first();
    return true;
  },
  async close() {},
};

export const BACKEND = "d1";
export const openStore = async () => store;
export const fallbackStore = async () => store;
