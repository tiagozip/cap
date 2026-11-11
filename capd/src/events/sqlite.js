import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";
import { COLUMNS } from "./schema.js";

const dialect = {
  name: "sqlite",
  param: (name) => `$${name}`,
  bucket: (size) => `CAST((ts / ${size}) * ${size} AS INTEGER)`,
  bin: (col, scale, cap) =>
    `CAST(floor(min(${col}, ${cap}) * ${scale} + 0.001) AS INTEGER)`,
  flagHas: (p) => `EXISTS (SELECT 1 FROM json_each(events.flags) WHERE value = ${p})`,
  flagged: "json_array_length(flags) > 0",
  explodeSelect: "j.value",
  explodeFrom: ", json_each(events.flags) AS j",
  ilike: (col, p) => `${col} LIKE ${p}`,
  final: "",
};

const TYPES = {
  string: "TEXT NOT NULL DEFAULT ''",
  int: "INTEGER NOT NULL DEFAULT 0",
  nint: "INTEGER",
  nfloat: "REAL",
  array: "TEXT NOT NULL DEFAULT '[]'",
};

const toJs = (v) =>
  typeof v === "bigint" ? Number(v) : Array.isArray(v) ? v.map(toJs) : v;

const fileSize = (path) =>
  [path, `${path}-wal`, `${path}-shm`]
    .filter(existsSync)
    .reduce((sum, f) => sum + statSync(f).size, 0);

export async function createSqliteStore({
  path,
}) {
  const dbDir = path === ":memory:" ? null : dirname(path);
  if (dbDir && !existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const dbPath = path === ":memory:" ? ":memory:" : join(dbDir, "events.sqlite");
  const db = new Database(dbPath);

  if (dbPath !== ":memory:") {
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
  }

  db.run(
    `CREATE TABLE IF NOT EXISTS events (${COLUMNS.map(([n, k]) => `${n} ${TYPES[k]}`).join(", ")})`,
  );
  db.run(`CREATE TABLE IF NOT EXISTS rollup (
    site_key TEXT NOT NULL,
    hour INTEGER NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    ratelimited INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (site_key, hour)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events (site_key, ts DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_type_outcome ON events (type, outcome)`);

  const colNames = COLUMNS.map(([n]) => n);
  const placeholders = colNames.map((n) => `$${n}`).join(", ");
  const insertStmt = db.prepare(
    `INSERT INTO events (${colNames.join(", ")}) VALUES (${placeholders})`,
  );

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      const bound = {};
      for (const [name, kind] of COLUMNS) {
        let v = row[name];
        if (kind === "array") {
          v = Array.isArray(v) ? JSON.stringify(v) : typeof v === "string" ? v : "[]";
        } else if (kind === "string") {
          v = v == null ? "" : String(v);
        } else if (kind === "int") {
          v = Math.trunc(Number(v)) || 0;
        } else if (kind === "nint") {
          v = v == null || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v));
        } else if (kind === "nfloat") {
          v = v == null || !Number.isFinite(Number(v)) ? null : Number(v);
        }
        bound[`$${name}`] = v;
      }
      insertStmt.run(bound);
    }
  });

  const upsertRollupStmt = db.prepare(`INSERT INTO rollup (site_key, hour, verified, failed, ratelimited)
    VALUES ($site_key, $hour, $verified, $failed, $ratelimited)
    ON CONFLICT (site_key, hour) DO UPDATE SET
      verified = excluded.verified,
      failed = excluded.failed,
      ratelimited = excluded.ratelimited`);

  const upsertRollups = db.transaction((rows) => {
    for (const r of rows) {
      upsertRollupStmt.run({
        $site_key: r.site_key,
        $hour: Math.trunc(Number(r.hour)) || 0,
        $verified: Math.trunc(Number(r.verified)) || 0,
        $failed: Math.trunc(Number(r.failed)) || 0,
        $ratelimited: Math.trunc(Number(r.ratelimited)) || 0,
      });
    }
  });

  return {
    kind: "sqlite",
    dialect,
    async insert(rows) {
      if (rows && rows.length) insertMany(rows);
    },
    async insertRollups(rows) {
      if (rows && rows.length) upsertRollups(rows);
    },
    async query(sql, params = {}) {
      const bound = {};
      for (const [k, v] of Object.entries(params)) {
        const paramKey = k.startsWith("$") ? k : `$${k}`;
        bound[paramKey] = typeof v === "bigint" ? Number(v) : v;
      }
      const rows = db.prepare(sql).all(bound);
      return rows.map((row) => {
        const out = {};
        for (const k in row) out[k] = toJs(row[k]);
        return out;
      });
    },
    async deleteSite(siteKey) {
      db.run("DELETE FROM events WHERE site_key = $s", { $s: siteKey });
      db.run("DELETE FROM rollup WHERE site_key = $s", { $s: siteKey });
    },
    async prune(retentionDays) {
      const cutoff = Date.now() - retentionDays * 86_400_000;
      const res = db.run("DELETE FROM events WHERE ts < $t", { $t: cutoff });
      return Number(res.changes);
    },
    async setRetention() {},
    async info() {
      const row = db.query("SELECT count(*) AS n FROM events").get() || { n: 0 };
      return {
        events: Number(row.n),
        bytes: dbPath === ":memory:" ? 0 : fileSize(dbPath),
        path: dbPath,
      };
    },
    async ping() {
      db.query("SELECT 1").get();
      return true;
    },
    async close() {
      db.close();
    },
  };
}
