import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clickhouseConfig } from "../config.js";
import { createClickhouseStore } from "./clickhouse.js";

export const missingCpuFeatures = (
  arch = process.arch,
  platform = process.platform,
  cpuinfo = () => readFileSync("/proc/cpuinfo", "utf8"),
) => {
  if (arch !== "x64" || platform !== "linux") return [];
  try {
    const line = /^flags\s*:(.*)$/m.exec(cpuinfo())?.[1];
    if (!line) return [];
    const flags = new Set(line.trim().split(/\s+/));
    return ["avx2", "fma"].filter((f) => !flags.has(f));
  } catch {
    return [];
  }
};

const noDuckdb = (missing) =>
  `This CPU has no ${missing.join(" or ")}, which DuckDB needs. Set CLICKHOUSE_URL to keep analytics. Captchas keep working without them.`;

export const emptyStore = (reason) => ({
  kind: "none",
  dialect: {
    name: "none",
    param: (name) => `$${name}`,
    bucket: () => "0",
    bin: () => "0",
    flagHas: () => "false",
    flagged: "false",
    explodeSelect: "''",
    explodeFrom: "",
    ilike: () => "false",
    final: "",
  },
  async insert() {},
  async insertRollups() {},
  async query() {
    return [];
  },
  async deleteSite() {},
  async prune() {
    return 0;
  },
  async setRetention() {},
  async info() {
    return { events: 0, bytes: 0, disabled: reason };
  },
  async ping() {
    return true;
  },
  async close() {},
});

const openDuckdb = async () => {
  const missing = missingCpuFeatures();
  if (missing.length) throw new Error(noDuckdb(missing));
  const { createDuckdbStore } = await import("./duckdb.js");
  return createDuckdbStore(duckdbOptions());
};

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
  return openDuckdb();
}

export const fallbackStore = async () => {
  const missing = missingCpuFeatures();
  if (missing.length) return emptyStore(noDuckdb(missing));
  return openDuckdb();
};
