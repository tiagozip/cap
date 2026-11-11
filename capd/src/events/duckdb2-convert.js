import { DuckDBInstance } from "duckdb-v2";

const [source, target] = process.argv.slice(2);
const quote = (s) => `'${s.replaceAll("'", "''")}'`;

const instance = await DuckDBInstance.create(source, {
  memory_limit: process.env.DUCKDB_MEMORY_LIMIT || "256MB",
  threads: String(
    Math.max(1, Math.trunc(Number(process.env.DUCKDB_THREADS)) || 2),
  ),
  autoinstall_known_extensions: "false",
  autoload_known_extensions: "false",
});
const conn = await instance.connect();
const [{ name }] = (
  await conn.runAndReadAll("SELECT current_database() AS name")
).getRowObjectsJS();
await conn.run(
  `ATTACH ${quote(target)} AS converted (STORAGE_VERSION 'v1.4.0')`,
);
await conn.run(
  `COPY FROM DATABASE "${name.replaceAll('"', '""')}" TO converted`,
);
await conn.run("DETACH converted");
conn.closeSync();
