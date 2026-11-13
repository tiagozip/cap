import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { clickhouseConfig } from "../config.js";
import { createClickhouseStore } from "./clickhouse.js";

const NEWEST_READABLE_STORAGE = 67;

export const storageVersion = async (path) => {
  try {
    const head = Buffer.from(await Bun.file(path).slice(0, 20).arrayBuffer());
    if (head.length < 20 || head.toString("latin1", 8, 12) !== "DUCK")
      return null;
    return Number(head.readBigUInt64LE(12));
  } catch {
    return null;
  }
};

const moveWithWal = (from, to) => {
  renameSync(from, to);
  if (existsSync(`${from}.wal`)) renameSync(`${from}.wal`, `${to}.wal`);
};

export async function convertFromDuckdb2(path) {
  const version = await storageVersion(path);
  if (version === null || version <= NEWEST_READABLE_STORAGE) return false;
  const target = `${path}.converting`;
  const backup = `${path}.duckdb2`;
  rmSync(target, { force: true });
  rmSync(`${target}.wal`, { force: true });
  console.log(
    "[cap] Converting the event store to the DuckDB 1.4 format. This runs once.",
  );
  const proc = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "duckdb2-convert.js"),
      path,
      target,
    ],
    { stdout: "inherit", stderr: "inherit", env: process.env },
  );
  const code = await proc.exited;
  moveWithWal(path, backup);
  if (code !== 0) {
    rmSync(target, { force: true });
    rmSync(`${target}.wal`, { force: true });
    console.error(
      `[cap] Couldn't convert the event store, so Cap is starting a new one. The old file is at ${backup}.`,
    );
    return false;
  }
  moveWithWal(target, path);
  console.log(
    `[cap] Converted the event store. The old file is at ${backup}, and you can delete it once analytics look right.`,
  );
  return true;
}

const duckdbOptions = (env = process.env) => {
  const dir = env.DATA_DIR || join(import.meta.dir, "..", "..", "data");
  return {
    path: env.DUCKDB_PATH || join(dir, "events.duckdb"),
    memoryLimit: env.DUCKDB_MEMORY_LIMIT || "256MB",
    threads: Math.max(1, Math.trunc(Number(env.DUCKDB_THREADS)) || 2),
  };
};

const openDuckdb = async () => {
  const options = duckdbOptions();
  if (options.path !== ":memory:") await convertFromDuckdb2(options.path);
  const { createDuckdbStore } = await import("./duckdb.js");
  return createDuckdbStore(options);
};

const [CLICKHOUSE, configError] = (() => {
  try {
    return [clickhouseConfig(), null];
  } catch (e) {
    return [null, e.message];
  }
})();
export const BACKEND =
  CLICKHOUSE || configError
    ? "clickhouse"
    : process.env.EVENT_BACKEND === "sqlite"
      ? "sqlite"
      : "duckdb";

export async function openStore(s) {
  if (configError) throw new Error(configError);
  if (BACKEND === "clickhouse") {
    const ch = createClickhouseStore({
      ...CLICKHOUSE,
      retentionDays: s.retentionDays,
    });
    await ch.init();
    return ch;
  }
  if (BACKEND === "sqlite") {
    const { createSqliteStore } = await import("./sqlite.js");
    return createSqliteStore(duckdbOptions());
  }
  try {
    return await openDuckdb();
  } catch (err) {
    console.warn(
      `[cap] DuckDB event store unavailable (${err.message}), falling back to SQLite.`,
    );
    const { createSqliteStore } = await import("./sqlite.js");
    return createSqliteStore(duckdbOptions());
  }
}

export const fallbackStore = async () => {
  try {
    return await openDuckdb();
  } catch {
    const { createSqliteStore } = await import("./sqlite.js");
    return createSqliteStore(duckdbOptions());
  }
};
