import { describe, expect, mock, test } from "bun:test";
import { RedisClient } from "bun";
import { emptyStore, missingCpuFeatures } from "../src/events/open-store.js";

const cpuinfo = (flags) => () =>
  `processor\t: 0\nvendor_id\t: GenuineIntel\nflags\t\t: ${flags}\nbogomips\t: 4800.00\n`;

describe("missingCpuFeatures", () => {
  test("a Linux x64 CPU with only sse4.2 and popcnt is missing avx2 and fma", () => {
    expect(
      missingCpuFeatures("x64", "linux", cpuinfo("fpu sse4_2 popcnt")),
    ).toEqual(["avx2", "fma"]);
  });

  test("a Linux x64 CPU with avx2 and fma passes", () => {
    expect(
      missingCpuFeatures(
        "x64",
        "linux",
        cpuinfo("fpu sse4_2 avx avx2 fma bmi2"),
      ),
    ).toEqual([]);
  });

  test("other architectures and platforms are not checked", () => {
    const boom = () => {
      throw new Error("read");
    };
    expect(missingCpuFeatures("arm64", "linux", boom)).toEqual([]);
    expect(missingCpuFeatures("x64", "darwin", boom)).toEqual([]);
  });

  test("a cpuinfo without a flags line does not block startup", () => {
    expect(
      missingCpuFeatures("x64", "linux", () => "processor\t: 0\n"),
    ).toEqual([]);
  });

  test("an unreadable cpuinfo does not block startup", () => {
    expect(
      missingCpuFeatures("x64", "linux", () => {
        throw new Error("EACCES");
      }),
    ).toEqual([]);
  });
});

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";
let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

if (!redisAvailable) {
  test.skip(`empty store integration skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  const reason = "This CPU has no avx2 or fma, which DuckDB needs.";
  mock.module("../src/events/open-store.js", () => ({
    BACKEND: "duckdb",
    openStore: async () => {
      throw new Error(reason);
    },
    fallbackStore: async () => emptyStore(reason),
    emptyStore,
    missingCpuFeatures,
  }));

  const events = await import("../src/events/index.js");
  const analytics = await import("../src/events/analytics.js");
  await events.initEvents();

  test("capd runs analytics on the empty store without throwing", async () => {
    expect(events.getStore().kind).toBe("none");
    events.recordEvent({
      type: "redeem",
      outcome: "pass",
      siteKey: "nokey",
      ip: "198.51.100.7",
    });
    await events.flush();
    const status = await events.storageStatus();
    expect(status.backend).toBe("none");
    expect(status.lastError).toBe(reason);
    await analytics.overview("nokey", { range: "24h" });
    await analytics.topDimensions("nokey", { range: "24h" });
    await analytics.insights("nokey", { range: "24h" });
    await analytics.listEvents("nokey", {});
    await analytics.legacyKeyStats("nokey");
    await analytics.legacyGeoStats("nokey");
    await analytics.solvesByKey(["nokey"]);
    expect(await analytics.eventDetail("nokey", "missing")).toBeFalsy();
  });
}
