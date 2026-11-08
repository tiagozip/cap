import { join } from "node:path";
import { clickhouseConfig } from "../config.js";
import { createClickhouseStore } from "./clickhouse.js";
import { createDuckdbStore } from "./duckdb.js";

const duckdbOptions = (env = process.env) => {
  const dir = env.DATA_DIR || join(import.meta.dir, "..", "..", "data");
  return {
    path: env.DUCKDB_PATH || join(dir, "events.duckdb"),
    memoryLimit: env.DUCKDB_MEMORY_LIMIT || "256MB",
    threads: Math.max(1, Math.trunc(Number(env.DUCKDB_THREADS)) || 2),
  };
};
const [CLICKHOUSE, configError] = (() => {
  try {
    return [clickhouseConfig(), null];
  } catch (e) {
    return [null, e.message];
  }
})();
export const BACKEND = CLICKHOUSE || configError ? "clickhouse" : "duckdb";

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
  return createDuckdbStore(duckdbOptions());
}

export const fallbackStore = () => createDuckdbStore(duckdbOptions());
