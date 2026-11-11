import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDuckdbStore } from "../src/events/duckdb.js";

test("parallel analytics queries and writes all succeed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cap-concurrency-"));
  const store = await createDuckdbStore({
    path: join(dir, "events.duckdb"),
    threads: 2,
  });
  const queries = [
    "SELECT count(*) AS n FROM events",
    "SELECT site_key, count(*) AS n FROM events GROUP BY 1 ORDER BY 2 DESC LIMIT 10",
    "SELECT count(DISTINCT site_key) AS n FROM events",
    "SELECT * FROM rollup",
  ];
  const results = await Promise.allSettled(
    Array.from({ length: 40 }, (_, round) => [
      ...queries.map((q) => store.query(q)),
      store.insertRollups([
        {
          site_key: `s${round}`,
          hour: round,
          verified: 1,
          failed: 0,
          ratelimited: 0,
        },
      ]),
      store.info(),
      store.ping(),
    ]).flat(),
  );
  const failures = results.filter((r) => r.status === "rejected");
  expect(failures.map((f) => f.reason.message)).toEqual([]);
  expect(await store.query("SELECT count(*) AS n FROM rollup")).toEqual([
    { n: 40 },
  ]);
  await store.close();
});
