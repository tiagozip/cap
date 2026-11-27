import { afterAll, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  redisAvailable = true;
} catch (e) {
  console.warn(
    "[settings-file-test] redis not available, skipping:",
    e.message,
  );
}

const writeJson = (name, value) => {
  const path = `${tmpdir()}/cap-settings-${process.pid}-${name}.json`;
  writeFileSync(
    path,
    typeof value === "string" ? value : JSON.stringify(value),
  );
  return path;
};

if (!redisAvailable) {
  test.skip(`settings file skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  process.env.REDIS_PREFIX = `settings-file-test-${process.pid}:`;
  process.env.ADMIN_KEY ||= "test-admin-key-1234567890";
  process.env.HIDE_RATELIMIT_IP_WARNING = "true";
  process.env.CAP_UPDATE_CHECK = "false";
  process.env.DUCKDB_PATH = `${tmpdir()}/cap-settings-${process.pid}.duckdb`;

  await (await import("../src/events/index.js")).initEvents();
  const { auth } = await import("../src/auth.js");
  const { server } = await import("../src/server.js");
  const { policyRoutes } = await import("../src/policy-routes.js");
  const { db } = await import("../src/db.js");
  const { getRatelimit, getCorsDefault, getHeaders } = await import(
    "../src/settings-cache.js"
  );
  const { applySettingsFile, readSettingsFile } = await import(
    "../src/settings-file.js"
  );

  const app = new Elysia().use(auth).use(server).use(policyRoutes);
  const call = async (method, path, { body, auth: authHeader } = {}) => {
    const headers = {};
    if (authHeader) headers.Authorization = authHeader;
    if (body) headers["Content-Type"] = "application/json";
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    return { status: res.status, json: await res.json() };
  };
  const login = await call("POST", "/auth/login", {
    body: { admin_key: process.env.ADMIN_KEY },
  });
  const admin = `Bearer ${btoa(
    JSON.stringify({
      token: login.json.session_token,
      hash: login.json.hashed_token,
    }),
  )}`;

  afterAll(async () => {
    const events = await import("../src/events/index.js");
    await events.updateSettings(events.analyticsDefaults);
    const keys = await db.send("KEYS", [`${process.env.REDIS_PREFIX}*`]);
    if (keys.length) await db.send("DEL", keys);
  });

  describe("settings file", () => {
    test("does nothing without CAP_SETTINGS_FILE", async () => {
      expect(await applySettingsFile(undefined)).toEqual([]);
    });

    test("applies an exported file to the stored settings and caches", async () => {
      await call("PUT", "/server/settings/headers", {
        body: { ipHeader: "x-old", countryHeader: "cf-ipcountry" },
        auth: admin,
      });
      const path = writeJson("good", {
        cap: "settings",
        version: 1,
        settings: {
          ratelimit: { max: 77, duration: 9000 },
          cors: { origins: ["https://shop.example"] },
          filtering: { blockNonBrowserUA: true },
          headers: { ipHeader: "x-real-ip" },
          analytics: { retentionDays: 14, ipMode: "truncate" },
          updateCheck: { interval: "weekly" },
        },
      });
      expect(await applySettingsFile(path)).toEqual([
        "ratelimit",
        "cors",
        "filtering",
        "headers",
        "analytics",
        "updateCheck",
      ]);

      expect(getRatelimit()).toEqual({ max: 77, duration: 9000 });
      expect(getCorsDefault()).toEqual({ origins: ["https://shop.example"] });
      expect(getHeaders()).toEqual({
        ipHeader: "x-real-ip",
        countryHeader: "cf-ipcountry",
        asnHeader: "",
      });

      const get = async (p) => (await call("GET", p, { auth: admin })).json;
      expect(await get("/server/settings/ratelimit")).toEqual({
        max: 77,
        duration: 9000,
      });
      expect((await get("/server/settings/filtering")).blockNonBrowserUA).toBe(
        true,
      );
      expect((await get("/server/settings/headers")).countryHeader).toBe(
        "cf-ipcountry",
      );
      const analytics = (await get("/server/settings/analytics")).settings;
      expect(analytics.retentionDays).toBe(14);
      expect(analytics.ipMode).toBe("truncate");
      expect((await get("/server/settings/update-check")).interval).toBe(
        "weekly",
      );
    });

    test("rejects values the API would reject, and names them", () => {
      const path = writeJson("bad", {
        cap: "settings",
        settings: {
          ratelimit: { max: 0 },
          analytics: { ipMode: "everything" },
          sitekeys: {},
        },
      });
      let message = "";
      try {
        readSettingsFile(path);
      } catch (e) {
        message = e.message;
      }
      expect(message).toContain("ratelimit.max");
      expect(message).toContain("analytics.ipMode");
      expect(message).toContain('unknown section "sitekeys"');
    });

    test("rejects files that aren't Cap settings files", () => {
      expect(() => readSettingsFile(writeJson("json", "{nope"))).toThrow(
        "can't read as JSON",
      );
      expect(() =>
        readSettingsFile(writeJson("other", { settings: {} })),
      ).toThrow("isn't a Cap settings file");
    });
  });
}
