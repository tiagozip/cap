import { COLUMN_NAMES, presentEvent } from "./schema.js";

const INT_FIELDS = new Set(["asn"]);

class Params {
  constructor(dialect) {
    this.dialect = dialect;
    this.values = {};
    this.n = 0;
  }

  add(value, type = "String") {
    const name = `p${this.n++}`;
    this.values[name] = value;
    return this.dialect.param(name, type);
  }
}

function buildWhere(d, ps, { siteKey, from, to, filters = [], q }) {
  const clauses = [];
  if (siteKey) clauses.push(`site_key = ${ps.add(siteKey)}`);
  if (from != null) clauses.push(`ts >= ${ps.add(from, "Int64")}`);
  if (to != null) clauses.push(`ts < ${ps.add(to, "Int64")}`);

  const groups = new Map();
  for (const f of filters) {
    const key = `${f.field}:${f.neg ? 1 : 0}`;
    if (!groups.has(key)) groups.set(key, { ...f, values: [] });
    groups.get(key).values.push(f.value);
  }

  for (const { field, neg, values } of groups.values()) {
    const parts = values.map((v) => {
      if (field === "flag") return d.flagHas(ps.add(String(v)));
      if (INT_FIELDS.has(field))
        return `${field} = ${ps.add(Number(v) || 0, "UInt32")}`;
      return `${field} = ${ps.add(String(v))}`;
    });
    const joined = parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
    clauses.push(neg ? `NOT ${joined}` : joined);
  }

  if (q) {
    const prefix = ps.add(`${q}%`);
    const contains = ps.add(`%${q}%`);
    clauses.push(
      `(ip LIKE ${prefix} OR id = ${ps.add(q)} OR token_id = ${ps.add(q)} OR ${d.ilike("ua", contains)} OR ${d.ilike("asn_org", contains)})`,
    );
  }

  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

const when = (cond, value = "1") =>
  `sum(CASE WHEN ${cond} THEN ${value} ELSE 0 END)`;

export function createQueries(store) {
  const d = store.dialect;

  const run = async (build) => {
    const ps = new Params(d);
    const sql = build(ps);
    return store.query(sql, ps.values);
  };

  return {
    async summary(ctx) {
      const [row] = await run(
        (ps) => `SELECT
          count(*) AS total,
          ${when("type = 'challenge' AND outcome = 'pass'")} AS challenges,
          ${when("type = 'redeem' AND outcome = 'pass'")} AS solved,
          ${when("type = 'redeem' AND outcome = 'fail'")} AS failed,
          ${when("outcome = 'block'")} AS blocked,
          ${when("outcome = 'limit'")} AS limited,
          ${when("type = 'siteverify' AND outcome = 'pass'")} AS verified,
          ${when(`type = 'redeem' AND outcome = 'pass' AND ${d.flagged}`)} AS flagged,
          ${when("agent != ''")} AS agents,
          avg(CASE WHEN type = 'redeem' AND outcome = 'pass' THEN solve_ms END) AS avg_solve,
          count(DISTINCT ip) AS ips,
          count(DISTINCT fp) AS clients
        FROM events ${buildWhere(d, ps, ctx)}`,
      );
      const out = {};
      for (const [k, v] of Object.entries(row ?? {})) {
        const n = Number(v);
        out[k] = Number.isFinite(n) ? n : 0;
      }
      out.avg_solve = Math.round(out.avg_solve || 0);
      return out;
    },

    async series(ctx, bucketMs) {
      const rows = await run(
        (
          ps,
        ) => `SELECT ${d.bucket(ps.add(bucketMs, "Int64"))} AS b, type, outcome, count(*) AS n,
          ${when(`type = 'redeem' AND outcome = 'pass' AND ${d.flagged}`)} AS flagged
        FROM events ${buildWhere(d, ps, ctx)}
        GROUP BY b, type, outcome`,
      );
      return rows.map((r) => ({
        b: Number(r.b),
        type: r.type,
        outcome: r.outcome,
        n: Number(r.n),
        flagged: Number(r.flagged),
      }));
    },

    async top(ctx, dim, limit = 10) {
      if (dim === "flag") {
        const rows = await run(
          (
            ps,
          ) => `SELECT ${d.explodeSelect} AS v, count(*) AS n, ${when("outcome = 'block'")} AS blocked
          FROM events ${d.explodeFrom} ${buildWhere(d, ps, ctx)}
          GROUP BY v ORDER BY n DESC LIMIT ${ps.add(limit, "UInt32")}`,
        );
        return rows.map((r) => ({
          value: r.v,
          n: Number(r.n),
          blocked: Number(r.blocked),
        }));
      }
      const empty = dim === "asn" ? "asn != 0" : `${dim} != ''`;
      const rows = await run((ps) => {
        const where = buildWhere(d, ps, ctx);
        return `SELECT ${dim} AS v, count(*) AS n,
          ${when("outcome = 'block'")} AS blocked,
          ${when(`type = 'redeem' AND outcome = 'pass' AND ${d.flagged}`)} AS flagged
          ${dim === "asn" ? ", max(asn_org) AS label" : dim === "asn_org" ? ", max(asn) AS label" : ""}
        FROM events ${where ? `${where} AND ${empty}` : `WHERE ${empty}`}
        GROUP BY v ORDER BY n DESC LIMIT ${ps.add(limit, "UInt32")}`;
      });
      return rows.map((r) => ({
        value: dim === "asn" ? Number(r.v) : r.v,
        ...(r.label != null &&
          r.label !== "" &&
          r.label !== 0 && { label: r.label }),
        n: Number(r.n),
        blocked: Number(r.blocked),
        flagged: Number(r.flagged),
      }));
    },

    async distribution(ctx, column, scale, cap) {
      const rows = await run((ps) => {
        const where = buildWhere(d, ps, ctx);
        const extra = `type = 'redeem' AND outcome IN ('pass', 'block') AND ${column} IS NOT NULL`;
        return `SELECT ${d.bin(column, ps.add(scale, "Float64"), ps.add(cap, "Float64"))} AS b, outcome, count(*) AS n,
          ${when(d.flagged)} AS flagged
        FROM events ${where ? `${where} AND ${extra}` : `WHERE ${extra}`}
        GROUP BY b, outcome`;
      });
      return rows.map((r) => ({
        b: Number(r.b),
        outcome: r.outcome,
        n: Number(r.n),
        flagged: Number(r.flagged),
      }));
    },

    async flow(ctx) {
      const rows = await run(
        (ps) => `SELECT type, outcome, count(*) AS n
        FROM events ${buildWhere(d, ps, ctx)}
        GROUP BY type, outcome`,
      );
      return rows.map((r) => ({
        type: r.type,
        outcome: r.outcome,
        n: Number(r.n),
      }));
    },

    async sharedClients(ctx, limit = 8) {
      const rows = await run((ps) => {
        const where = buildWhere(d, ps, ctx);
        return `SELECT fp, count(DISTINCT ip) AS ips, count(*) AS n,
          count(DISTINCT asn) AS networks, count(DISTINCT country) AS countries,
          ${when("outcome = 'block'")} AS blocked,
          ${when(`type = 'redeem' AND ${d.flagged}`)} AS flagged,
          max(browser) AS browser, max(os) AS os, min(ts) AS first, max(ts) AS last
        FROM events ${where ? `${where} AND fp != ''` : "WHERE fp != ''"}
        GROUP BY fp HAVING count(DISTINCT ip) >= 3
        ORDER BY ips DESC, n DESC LIMIT ${ps.add(limit, "UInt32")}`;
      });
      return rows.map((r) => ({
        fp: r.fp,
        ips: Number(r.ips),
        n: Number(r.n),
        networks: Number(r.networks),
        countries: Number(r.countries),
        blocked: Number(r.blocked),
        flagged: Number(r.flagged),
        browser: r.browser,
        os: r.os,
        first: Number(r.first),
        last: Number(r.last),
      }));
    },

    async list(ctx, { cursor, limit = 50 } = {}) {
      const rows = await run((ps) => {
        let where = buildWhere(d, ps, ctx);
        if (cursor) {
          const c = `(ts < ${ps.add(cursor.ts, "Int64")} OR (ts = ${ps.add(cursor.ts, "Int64")} AND id < ${ps.add(cursor.id)}))`;
          where = where ? `${where} AND ${c}` : `WHERE ${c}`;
        }
        return `SELECT ${COLUMN_NAMES.join(", ")} FROM events ${where}
          ORDER BY ts DESC, id DESC LIMIT ${ps.add(limit + 1, "UInt32")}`;
      });
      const events = rows.slice(0, limit).map(presentEvent);
      const last = events.at(-1);
      return {
        events,
        next: rows.length > limit && last ? `${last.ts}.${last.id}` : null,
      };
    },

    async get(siteKey, id) {
      const rows = await run(
        (ps) => `SELECT ${COLUMN_NAMES.join(", ")} FROM events
          WHERE site_key = ${ps.add(siteKey)} AND id = ${ps.add(id)} LIMIT 1`,
      );
      return rows[0] ? presentEvent(rows[0]) : null;
    },

    async rollups(siteKey, from, to) {
      const rows = await run(
        (ps) => `SELECT hour, verified, failed, ratelimited
          FROM rollup${d.final} WHERE site_key = ${ps.add(siteKey)} AND hour >= ${ps.add(from ?? 0, "Int64")} AND hour < ${ps.add(to ?? 8e15, "Int64")}`,
      );
      return rows.map((r) => ({
        hour: Number(r.hour),
        verified: Number(r.verified),
        failed: Number(r.failed),
        ratelimited: Number(r.ratelimited),
      }));
    },

    async firstEventTs(siteKey) {
      const [row] = await run(
        (ps) =>
          `SELECT min(ts) AS t FROM events WHERE site_key = ${ps.add(siteKey)}`,
      );
      const t = Number(row?.t);
      return t > 0 ? t : null;
    },
  };
}
