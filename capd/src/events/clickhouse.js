import { COLUMN_NAMES } from "./schema.js";

const dialect = {
  name: "clickhouse",
  param: (name, type) => `{${name}:${type}}`,
  bucket: (size) => `intDiv(ts, ${size}) * ${size}`,
  bin: (col, scale, cap) =>
    `toInt64(floor(least(${col}, ${cap}) * ${scale} + 0.001))`,
  flagHas: (p) => `has(flags, ${p})`,
  flagged: "notEmpty(flags)",
  explodeSelect: "arrayJoin(flags)",
  explodeFrom: "",
  ilike: (col, p) => `${col} ILIKE ${p}`,
  final: " FINAL",
};

const ident = (s) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(s)) {
    throw new Error(`invalid ClickHouse identifier: ${s}`);
  }
  return s;
};

export function createClickhouseStore({
  url,
  user,
  password,
  database,
  retentionDays,
}) {
  const db = ident(database || "cap");
  const base = url.replace(/\/+$/, "");
  const headers = {
    ...(user && { "X-ClickHouse-User": user }),
    ...(password && { "X-ClickHouse-Key": password }),
  };

  const request = async (
    query,
    { body, params, useDb = true, format } = {},
  ) => {
    const qs = new URLSearchParams({
      ...(useDb && { database: db }),
      output_format_json_quote_64bit_integers: "0",
      date_time_input_format: "best_effort",
      ...(body !== undefined && { query }),
    });
    for (const [k, v] of Object.entries(params ?? {})) {
      qs.set(`param_${k}`, String(v));
    }
    const res = await fetch(`${base}/?${qs}`, {
      method: "POST",
      headers,
      body:
        body !== undefined
          ? body
          : format
            ? `${query} FORMAT ${format}`
            : query,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`ClickHouse ${res.status}: ${text.slice(0, 300)}`);
    }
    return text;
  };

  const ttl = (days) =>
    `toDateTime(intDiv(ts, 1000)) + INTERVAL ${Math.max(1, Math.trunc(days))} DAY`;

  return {
    kind: "clickhouse",
    dialect,
    async init() {
      await request(`CREATE DATABASE IF NOT EXISTS ${db}`, { useDb: false });
      await request(`CREATE TABLE IF NOT EXISTS events (
        id String,
        ts Int64,
        site_key LowCardinality(String),
        type LowCardinality(String),
        outcome LowCardinality(String),
        reason LowCardinality(String),
        ip String,
        country LowCardinality(String),
        asn UInt32,
        asn_org LowCardinality(String),
        ua String,
        browser LowCardinality(String),
        os LowCardinality(String),
        platform LowCardinality(String),
        origin LowCardinality(String),
        lang LowCardinality(String),
        fp String,
        protocol LowCardinality(String),
        solve_ms Nullable(UInt32),
        score Nullable(Float32),
        verdict LowCardinality(String),
        agent LowCardinality(String),
        agent_confidence LowCardinality(String),
        agent_verified UInt8,
        flags Array(LowCardinality(String)),
        rule String,
        token_id String,
        INDEX ip_idx ip TYPE bloom_filter GRANULARITY 4,
        INDEX id_idx id TYPE bloom_filter GRANULARITY 4
      ) ENGINE = MergeTree
      PARTITION BY toYYYYMM(toDateTime(intDiv(ts, 1000)))
      ORDER BY (site_key, ts)
      TTL ${ttl(retentionDays ?? 30)}`);
      await request(`CREATE TABLE IF NOT EXISTS rollup (
        site_key LowCardinality(String),
        hour Int64,
        verified UInt64,
        failed UInt64,
        ratelimited UInt64
      ) ENGINE = ReplacingMergeTree ORDER BY (site_key, hour)`);
    },
    async insert(rows) {
      if (!rows.length) return;
      await request(
        `INSERT INTO events (${COLUMN_NAMES.join(", ")}) FORMAT JSONEachRow`,
        {
          body: rows.map((r) => JSON.stringify(r)).join("\n"),
        },
      );
    },
    async insertRollups(rows) {
      if (!rows.length) return;
      await request("INSERT INTO rollup FORMAT JSONEachRow", {
        body: rows.map((r) => JSON.stringify(r)).join("\n"),
      });
    },
    async query(sql, params = {}) {
      const text = await request(sql, { params, format: "JSON" });
      return JSON.parse(text).data;
    },
    async deleteSite(siteKey) {
      const params = { sk: siteKey };
      await request("DELETE FROM events WHERE site_key = {sk:String}", {
        params,
      });
      await request("DELETE FROM rollup WHERE site_key = {sk:String}", {
        params,
      });
    },
    async prune() {
      return 0;
    },
    async setRetention(days) {
      await request(`ALTER TABLE events MODIFY TTL ${ttl(days)}`);
    },
    async info() {
      const text = await request(
        "SELECT sum(rows) AS events, sum(bytes_on_disk) AS bytes FROM system.parts WHERE database = {db:String} AND table = 'events' AND active",
        { params: { db }, format: "JSON" },
      );
      const [row] = JSON.parse(text).data;
      return {
        events: Number(row?.events) || 0,
        bytes: Number(row?.bytes) || 0,
        url: base,
        database: db,
      };
    },
    async ping() {
      await request("SELECT 1", { useDb: false });
      return true;
    },
    async close() {},
  };
}
