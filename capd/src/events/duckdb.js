import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { DuckDBInstance, LIST, listValue, VARCHAR } from "@duckdb/node-api";
import { COLUMNS } from "./schema.js";

const dialect = {
  name: "duckdb",
  param: (name) => `$${name}`,
  bucket: (size) => `(ts // ${size}) * ${size}`,
  bin: (col, scale, cap) =>
    `CAST(floor(least(${col}, ${cap}) * ${scale} + 0.001) AS BIGINT)`,
  flagHas: (p) => `list_contains(flags, ${p})`,
  flagged: "len(flags) > 0",
  explodeSelect: "fj.v",
  explodeFrom: ", unnest(events.flags) AS fj(v)",
  ilike: (col, p) => `${col} ILIKE ${p}`,
  final: "",
};

const TYPES = {
  string: "VARCHAR NOT NULL DEFAULT ''",
  int: "BIGINT NOT NULL DEFAULT 0",
  nint: "BIGINT",
  nfloat: "DOUBLE",
  array: "VARCHAR[] NOT NULL DEFAULT []",
};
const FLAGS = LIST(VARCHAR);

const toJs = (v) =>
  typeof v === "bigint" ? Number(v) : Array.isArray(v) ? v.map(toJs) : v;

const fileSize = (path) =>
  [path, `${path}.wal`]
    .filter(existsSync)
    .reduce((sum, f) => sum + statSync(f).size, 0);

export async function createDuckdbStore({
  path,
  memoryLimit = "256MB",
  threads = 2,
}) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const instance = await DuckDBInstance.create(path, {
    memory_limit: memoryLimit,
    threads: String(threads),
    autoinstall_known_extensions: "false",
    autoload_known_extensions: "false",
  });
  const writer = await instance.connect();
  const reader = await instance.connect();

  await writer.run(
    `CREATE TABLE IF NOT EXISTS events (${COLUMNS.map(([n, k]) => `${n} ${TYPES[k]}`).join(", ")})`,
  );
  await writer.run(`CREATE TABLE IF NOT EXISTS rollup (
    site_key VARCHAR NOT NULL,
    hour BIGINT NOT NULL,
    verified BIGINT NOT NULL DEFAULT 0,
    failed BIGINT NOT NULL DEFAULT 0,
    ratelimited BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (site_key, hour)
  )`);

  const append = async (rows) => {
    const appender = await writer.createAppender("events");
    for (const row of rows) {
      for (const [name, kind] of COLUMNS) {
        const v = row[name];
        if (kind === "string") appender.appendVarchar(v);
        else if (kind === "int") appender.appendBigInt(BigInt(v));
        else if (v == null && kind !== "array") appender.appendNull();
        else if (kind === "nint") appender.appendBigInt(BigInt(v));
        else if (kind === "nfloat") appender.appendDouble(v);
        else appender.appendList(listValue(v), FLAGS);
      }
      appender.endRow();
    }
    appender.closeSync();
  };

  const upsertRollups = async (rows) => {
    const keys = new Map();
    const unique = new Map();
    for (const r of rows) {
      if (!keys.has(r.site_key)) keys.set(r.site_key, `k${keys.size}`);
      unique.set(`${r.site_key}|${r.hour}`, r);
    }
    const values = [...unique.values()].map((r) => {
      const nums = [r.hour, r.verified, r.failed, r.ratelimited].map((n) =>
        BigInt(Math.trunc(n)),
      );
      return `($${keys.get(r.site_key)}, ${nums.join(", ")})`;
    });
    await writer.run(
      `INSERT OR REPLACE INTO rollup VALUES ${values.join(", ")}`,
      Object.fromEntries([...keys].map(([k, name]) => [name, k])),
    );
  };

  return {
    kind: "duckdb",
    dialect,
    async insert(rows) {
      if (rows.length) await append(rows);
    },
    async insertRollups(rows) {
      if (rows.length) await upsertRollups(rows);
    },
    async query(sql, params = {}) {
      const bound = {};
      for (const [k, v] of Object.entries(params)) {
        bound[k] = Number.isInteger(v) ? BigInt(v) : v;
      }
      const result = await reader.runAndReadAll(sql, bound);
      return result.getRowObjectsJS().map((row) => {
        const out = {};
        for (const k in row) out[k] = toJs(row[k]);
        return out;
      });
    },
    async deleteSite(siteKey) {
      await writer.run("DELETE FROM events WHERE site_key = $s", {
        s: siteKey,
      });
      await writer.run("DELETE FROM rollup WHERE site_key = $s", {
        s: siteKey,
      });
    },
    async prune(retentionDays) {
      const cutoff = BigInt(Date.now() - retentionDays * 86_400_000);
      const result = await writer.run("DELETE FROM events WHERE ts < $t", {
        t: cutoff,
      });
      const changes = Number(result.rowsChanged);
      if (changes > 50_000) await writer.run("CHECKPOINT");
      return changes;
    },
    async setRetention() {},
    async info() {
      const result = await reader.runAndReadAll(
        "SELECT count(*) AS n FROM events",
      );
      const [{ n }] = result.getRowObjectsJS();
      return {
        events: Number(n),
        bytes: path === ":memory:" ? 0 : fileSize(path),
        path,
      };
    },
    async ping() {
      await reader.run("SELECT 1");
      return true;
    },
    async close() {
      await writer.run("CHECKPOINT").catch(() => {});
      reader.closeSync();
      writer.closeSync();
      instance.closeSync();
    },
  };
}
