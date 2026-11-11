import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLUMNS } from "../../src/events/schema.js";

const [path, count, mode] = process.argv.slice(2);
const src = join(import.meta.dir, "..", "..", "src", "events");
const copy = join(mkdtempSync(join(tmpdir(), "cap-duckdb2-")), "duckdb.js");
writeFileSync(
  copy,
  readFileSync(join(src, "duckdb.js"), "utf8")
    .replace(
      '"@duckdb/node-api"',
      JSON.stringify(Bun.resolveSync("duckdb-v2", src)),
    )
    .replace('"./schema.js"', JSON.stringify(join(src, "schema.js"))),
);
const { createDuckdbStore } = await import(copy);
const store = await createDuckdbStore({ path });
const rows = Array.from({ length: Number(count) }, (_, i) => {
  const row = {};
  for (const [name, kind] of COLUMNS)
    row[name] =
      kind === "string"
        ? ""
        : kind === "int"
          ? 0
          : kind === "array"
            ? []
            : null;
  return {
    ...row,
    id: `e${i}`,
    ts: 1_700_000_000_000 + i * 1000,
    site_key: `site${i % 3}`,
    type: "redeem",
    outcome: i % 4 ? "pass" : "fail",
    flags: i % 2 ? ["agent:codex"] : [],
    solve_ms: 100 + i,
    score: i / Number(count),
  };
});
await store.insert(rows);
await store.insertRollups([
  { site_key: "site0", hour: 1, verified: 5, failed: 1, ratelimited: 0 },
]);
const [{ v }] = await store.query(
  "SELECT library_version AS v FROM pragma_version()",
);
console.log(v);
if (mode !== "keep-wal") await store.close();
