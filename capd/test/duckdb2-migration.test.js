import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDuckdbStore } from "../src/events/duckdb.js";
import {
  convertFromDuckdb2,
  storageVersion,
} from "../src/events/open-store.js";

const writeDuckdb2Store = async (path, count, mode = "") => {
  const proc = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "fixtures", "duckdb2-store.js"),
      path,
      String(count),
      mode,
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  expect(await proc.exited).toBe(0);
  expect((await new Response(proc.stdout).text()).trim()).toBe("v2.0.0");
};

const check = async (path, count) => {
  const store = await createDuckdbStore({ path });
  const [{ n, flagged, sites }] = await store.query(
    "SELECT count(*) AS n, count(*) FILTER (WHERE list_contains(flags, 'agent:codex')) AS flagged, count(DISTINCT site_key) AS sites FROM events",
  );
  expect({ n, flagged, sites }).toEqual({
    n: count,
    flagged: Math.floor(count / 2),
    sites: 3,
  });
  await store.insertRollups([
    { site_key: "site0", hour: 1, verified: 9, failed: 2, ratelimited: 1 },
  ]);
  const rollups = await store.query("SELECT * FROM rollup");
  expect(rollups).toEqual([
    { site_key: "site0", hour: 1, verified: 9, failed: 2, ratelimited: 1 },
  ]);
  await store.close();
};

describe("DuckDB 2.0 event store migration", () => {
  test("converts a capd 4.0 store and keeps a backup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cap-migrate-"));
    const path = join(dir, "events.duckdb");
    await writeDuckdb2Store(path, 500);
    expect(await storageVersion(path)).toBeGreaterThan(67);

    expect(await convertFromDuckdb2(path)).toBe(true);
    expect(await storageVersion(path)).toBeLessThanOrEqual(67);
    expect(existsSync(`${path}.duckdb2`)).toBe(true);
    expect(existsSync(`${path}.converting`)).toBe(false);
    await check(path, 500);
    expect(await convertFromDuckdb2(path)).toBe(false);
  });

  test("keeps events that were still in the write-ahead log", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cap-migrate-"));
    const path = join(dir, "events.duckdb");
    await writeDuckdb2Store(path, 300, "keep-wal");
    expect(existsSync(`${path}.wal`)).toBe(true);

    expect(await convertFromDuckdb2(path)).toBe(true);
    expect(existsSync(`${path}.duckdb2.wal`)).toBe(true);
    await check(path, 300);
  });

  test("leaves 1.4 stores and missing files alone", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cap-migrate-"));
    const path = join(dir, "events.duckdb");
    expect(await convertFromDuckdb2(path)).toBe(false);
    const store = await createDuckdbStore({ path });
    await store.close();
    expect(await convertFromDuckdb2(path)).toBe(false);
    expect(existsSync(`${path}.duckdb2`)).toBe(false);
  });

  test("a file that won't convert is moved aside and a new store starts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cap-migrate-"));
    const path = join(dir, "events.duckdb");
    const head = Buffer.alloc(4096);
    head.write("DUCK", 8, "latin1");
    head.writeBigUInt64LE(999n, 12);
    writeFileSync(path, head);

    expect(await convertFromDuckdb2(path)).toBe(false);
    expect(existsSync(`${path}.duckdb2`)).toBe(true);
    expect(existsSync(path)).toBe(false);
    const store = await createDuckdbStore({ path });
    expect(await store.query("SELECT count(*) AS n FROM events")).toEqual([
      { n: 0 },
    ]);
    await store.close();
  });
});
