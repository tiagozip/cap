import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { clickhouseConfig } from "../config.js";
import { createClickhouseStore } from "./clickhouse.js";
import { createOffStore, createRedisStore } from "./counters.js";

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

const MODES = {
  duckdb: "duckdb",
  clickhouse: "clickhouse",
  redis: "redis",
  valkey: "redis",
  off: "off",
};

export function analyticsMode(env = process.env) {
  const raw = String(env.ANALYTICS ?? "")
    .trim()
    .toLowerCase();
  const mode = raw ? MODES[raw] : null;
  if (raw && !mode)
    return {
      mode: "duckdb",
      error: `ANALYTICS must be duckdb, clickhouse, redis or off, not "${env.ANALYTICS}"`,
    };
  if (mode && mode !== "clickhouse") return { mode };
  try {
    const clickhouse = clickhouseConfig(env);
    if (clickhouse) return { mode: "clickhouse", clickhouse };
  } catch (e) {
    return { mode: "clickhouse", error: e.message };
  }
  if (mode === "clickhouse")
    return {
      mode,
      error: "ANALYTICS is clickhouse, so set CLICKHOUSE_URL too",
    };
  return { mode: "duckdb" };
}

const analytics = analyticsMode();
const configError = analytics.error;
export const BACKEND = analytics.mode;

export async function openStore(s) {
  if (configError) throw new Error(configError);
  if (BACKEND === "off") return createOffStore();
  if (BACKEND === "redis") return createRedisStore();
  if (BACKEND === "clickhouse") {
    const ch = createClickhouseStore({
      ...analytics.clickhouse,
      retentionDays: s.retentionDays,
    });
    await ch.init();
    return ch;
  }
  return openDuckdb();
}

export const fallbackStore = () => openDuckdb();
