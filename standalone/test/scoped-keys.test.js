import { afterAll, describe, expect, test } from "bun:test";
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
  console.warn("[scoped-keys-test] redis not available, skipping:", e.message);
}

if (!redisAvailable) {
  test.skip(`scoped keys skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  process.env.ADMIN_KEY = "test-admin-key-1234567890";
  process.env.HIDE_RATELIMIT_IP_WARNING = "true";

  const { auth } = await import("../src/auth.js");
  const { server } = await import("../src/server.js");
  const { shareServer } = await import("../src/share.js");
  const { publicStatic } = await import("../src/static.js");
  const { db } = await import("../src/db.js");

  const app = new Elysia()
    .use(auth)
    .use(server)
    .use(shareServer)
    .use(publicStatic);

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

  const keyA = (
    await call("POST", "/server/keys", { body: { name: "A" }, auth: admin })
  ).json.siteKey;
  const keyB = (
    await call("POST", "/server/keys", { body: { name: "B" }, auth: admin })
  ).json.siteKey;

  const createdApiKeys = [];
  const makeApiKey = async (body) => {
    const res = await call("POST", "/server/settings/apikeys", {
      body,
      auth: admin,
    });
    if (res.json.apiKey) createdApiKeys.push(res.json.apiKey.split("_")[0]);
    return res;
  };

  afterAll(async () => {
    await call("DELETE", `/server/keys/${keyA}`, { auth: admin });
    await call("DELETE", `/server/keys/${keyB}`, { auth: admin });
    for (const id of createdApiKeys) {
      await call("DELETE", `/server/settings/apikeys/${id}`, { auth: admin });
    }
    await db.del(`session:${login.json.hashed_token}`);
    await db.srem("sessions", login.json.hashed_token);
  });

  describe("scoped api keys", () => {
    test("rejects unknown site keys at creation", async () => {
      const res = await makeApiKey({ name: "bad", siteKeys: ["nope"] });
      expect(res.status).toBe(400);
      expect(res.json.success).toBe(false);
    });

    test("lists scope on existing keys", async () => {
      await makeApiKey({
        name: "scoped-list",
        siteKeys: [keyA],
        readonly: true,
      });
      await makeApiKey({ name: "full-list" });
      const res = await call("GET", "/server/settings/apikeys", {
        auth: admin,
      });
      const scoped = res.json.find((k) => k.name === "scoped-list");
      const full = res.json.find((k) => k.name === "full-list");
      expect(scoped.siteKeys).toEqual([keyA]);
      expect(scoped.readonly).toBe(true);
      expect(full.siteKeys).toBeNull();
      expect(full.readonly).toBe(false);
    });

    test("read-only key scoped to A can only read A", async () => {
      const { json } = await makeApiKey({
        name: "scoped",
        siteKeys: [keyA],
        readonly: true,
      });
      const bot = `Bot ${json.apiKey}`;

      const list = await call("GET", "/server/keys", { auth: bot });
      expect(list.status).toBe(200);
      expect(list.json.map((k) => k.siteKey)).toEqual([keyA]);

      const a = await call("GET", `/server/keys/${keyA}`, { auth: bot });
      expect(a.status).toBe(200);
      expect(a.json.key.siteKey).toBe(keyA);

      const geo = await call("GET", `/server/keys/${keyA}/geo-stats`, {
        auth: bot,
      });
      expect(geo.status).toBe(200);
      expect(Array.isArray(geo.json.countries)).toBe(true);

      const b = await call("GET", `/server/keys/${keyB}`, { auth: bot });
      expect(b.status).toBe(403);

      const rotate = await call("POST", `/server/keys/${keyA}/rotate-secret`, {
        auth: bot,
      });
      expect(rotate.status).toBe(403);
      expect(rotate.json.error).toMatch(/read-only/);

      const settings = await call("GET", "/server/settings/apikeys", {
        auth: bot,
      });
      expect(settings.status).toBe(403);
    });

    test("scoped writable key can write its own key only", async () => {
      const { json } = await makeApiKey({
        name: "scoped-rw",
        siteKeys: [keyA],
      });
      const bot = `Bot ${json.apiKey}`;
      const own = await call("POST", `/server/keys/${keyA}/shares`, {
        body: {},
        auth: bot,
      });
      expect(own.status).toBe(200);
      expect(own.json.token).toBeDefined();
      await call("DELETE", `/server/keys/${keyA}/shares/${own.json.id}`, {
        auth: admin,
      });
      const other = await call("POST", `/server/keys/${keyB}/shares`, {
        body: {},
        auth: bot,
      });
      expect(other.status).toBe(403);
      const create = await call("POST", "/server/keys", {
        body: { name: "X" },
        auth: bot,
      });
      expect(create.status).toBe(403);
      const slash = await call("GET", "/server/keys/", { auth: bot });
      expect(slash.status).toBe(200);
      expect(slash.json.map((k) => k.siteKey)).toEqual([keyA]);
    });

    test("read-only unscoped key can read settings but not write", async () => {
      const { json } = await makeApiKey({ name: "ro", readonly: true });
      const bot = `Bot ${json.apiKey}`;
      expect(
        (await call("GET", "/server/settings/apikeys", { auth: bot })).status,
      ).toBe(200);
      expect(
        (await call("GET", `/server/keys/${keyB}`, { auth: bot })).status,
      ).toBe(200);
      const write = await call("POST", "/server/settings/apikeys", {
        body: { name: "x" },
        auth: bot,
      });
      expect(write.status).toBe(403);
    });

    test("scoped writable key cannot mint api keys", async () => {
      const { json } = await makeApiKey({
        name: "scoped-mint",
        siteKeys: [keyA],
      });
      const bot = `Bot ${json.apiKey}`;
      const mint = await call("POST", "/server/settings/apikeys", {
        body: { name: "escalated" },
        auth: bot,
      });
      expect(mint.status).toBe(403);
      const existing = await call("GET", "/server/settings/apikeys", {
        auth: admin,
      });
      expect(existing.json.some((k) => k.name === "escalated")).toBe(false);
    });

    test("read-only key cannot write a config with a valid body", async () => {
      const { json } = await makeApiKey({
        name: "ro-config",
        siteKeys: [keyA],
        readonly: true,
      });
      const bot = `Bot ${json.apiKey}`;
      const before = await db.hget(`key:${keyA}`, "config");
      const res = await call("PUT", `/server/keys/${keyA}/config`, {
        body: { name: "hijacked", difficulty: 6 },
        auth: bot,
      });
      expect(res.status).toBe(403);
      expect(res.json.error).toMatch(/read-only/);
      expect(await db.hget(`key:${keyA}`, "config")).toBe(before);
      expect(await db.hget(`key:${keyA}`, "name")).toBe("A");
    });

    test("unscoped key keeps full access", async () => {
      const { json } = await makeApiKey({ name: "full" });
      const bot = `Bot ${json.apiKey}`;
      const b = await call("GET", `/server/keys/${keyB}`, { auth: bot });
      expect(b.status).toBe(200);
      const settings = await call("GET", "/server/settings/apikeys", {
        auth: bot,
      });
      expect(settings.status).toBe(200);
    });
  });

  describe("share links", () => {
    test("create, read, list, revoke", async () => {
      const created = await call("POST", `/server/keys/${keyA}/shares`, {
        body: { name: "client" },
        auth: admin,
      });
      expect(created.status).toBe(200);
      expect(created.json.token).toHaveLength(32);

      const page = await call(
        "GET",
        `/share/${created.json.token}?chartDuration=last7days`,
      );
      expect(page.status).toBe(200);
      expect(page.json.name).toBe("client");
      expect(page.json.siteKey).toBeUndefined();
      expect(page.json.stats).toBeDefined();
      expect(page.json.chartData.duration).toBe("last7days");
      expect(page.json.config).toBeUndefined();
      expect(page.json.key).toBeUndefined();

      const geo = await call("GET", `/share/${created.json.token}/geo-stats`);
      expect(geo.status).toBe(200);
      expect(Array.isArray(geo.json.countries)).toBe(true);

      const list = await call("GET", `/server/keys/${keyA}/shares`, {
        auth: admin,
      });
      expect(list.json.map((s) => s.id)).toContain(created.json.id);
      expect(list.json[0].name).toBe("client");

      const unknown = await call("GET", "/server/keys/not-a-key/shares", {
        auth: admin,
      });
      expect(unknown.status).toBe(404);

      const otherKeyRevoke = await call(
        "DELETE",
        `/server/keys/${keyB}/shares/${created.json.id}`,
        { auth: admin },
      );
      expect(otherKeyRevoke.status).toBe(404);

      const revoke = await call(
        "DELETE",
        `/server/keys/${keyA}/shares/${created.json.id}`,
        {
          auth: admin,
        },
      );
      expect(revoke.json.success).toBe(true);

      const gone = await call("GET", `/share/${created.json.token}`);
      expect(gone.status).toBe(404);
    });

    test("an unlabelled link does not expose the site key name", async () => {
      const created = await call("POST", `/server/keys/${keyA}/shares`, {
        body: {},
        auth: admin,
      });
      const page = await call("GET", `/share/${created.json.token}`);
      expect(page.status).toBe(200);
      expect(page.json.name).toBe("Shared stats");
      await call("DELETE", `/server/keys/${keyA}/shares/${created.json.id}`, {
        auth: admin,
      });
    });

    test("a failed revoke leaves the link working", async () => {
      const created = await call("POST", `/server/keys/${keyA}/shares`, {
        body: { name: "kept" },
        auth: admin,
      });
      const res = await call(
        "DELETE",
        `/server/keys/${keyB}/shares/${created.json.id}`,
        { auth: admin },
      );
      expect(res.status).toBe(404);
      const list = await call("GET", `/server/keys/${keyA}/shares`, {
        auth: admin,
      });
      expect(list.json.map((s) => s.id)).toContain(created.json.id);
      await call("DELETE", `/server/keys/${keyA}/shares/${created.json.id}`, {
        auth: admin,
      });
    });

    test("rejects bogus and expired tokens", async () => {
      expect((await call("GET", "/share/notatoken")).status).toBe(404);
      const huge = await call("POST", `/server/keys/${keyA}/shares`, {
        body: { expiresIn: 1e16 },
        auth: admin,
      });
      expect(huge.status).toBeGreaterThanOrEqual(400);
      expect((await call("GET", `/share/${"a".repeat(32)}`)).status).toBe(404);

      const created = await call("POST", `/server/keys/${keyA}/shares`, {
        body: { expiresIn: 1 },
        auth: admin,
      });
      expect(created.json.expires).toBeGreaterThan(Date.now());
      await Bun.sleep(1100);
      expect((await call("GET", `/share/${created.json.token}`)).status).toBe(
        404,
      );
      const list = await call("GET", `/server/keys/${keyA}/shares`, {
        auth: admin,
      });
      expect(list.json.map((s) => s.id)).not.toContain(created.json.id);
    });

    test("share page assets load without a session", async () => {
      for (const asset of ["assets/style.css", "js/share.js", "js/geo.js"]) {
        const res = await app.handle(
          new Request(`http://localhost/public/${asset}`),
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("x-content-type-options")).toBe("nosniff");
        expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
        expect((await res.text()).length).toBeGreaterThan(0);
      }
      const dashboard = await app.handle(
        new Request("http://localhost/public/js/dashboard.js"),
      );
      expect(dashboard.status).toBe(401);
    });

    test("share page references its assets by content hash", async () => {
      const res = await app.handle(new Request("http://localhost/share"));
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-cache");
      const refs = [
        ...(await res.text()).matchAll(
          /"\.\/public\/([^"?]+\.(?:js|css))\?v=(\w+)"/g,
        ),
      ];
      expect(refs.map(([, rel]) => rel)).toEqual(
        expect.arrayContaining([
          "assets/style.css",
          "js/geo.js",
          "js/share.js",
        ]),
      );
      for (const [, rel, version] of refs) {
        const bytes = await Bun.file(`./public/${rel}`).arrayBuffer();
        expect(version).toBe(Bun.hash(bytes).toString(36));
        const asset = await app.handle(
          new Request(`http://localhost/public/${rel}?v=${version}`),
        );
        expect(asset.status).toBe(200);
      }
    });

    test("deleting the key removes its share links", async () => {
      const keyC = (
        await call("POST", "/server/keys", { body: { name: "C" }, auth: admin })
      ).json.siteKey;
      const created = await call("POST", `/server/keys/${keyC}/shares`, {
        body: {},
        auth: admin,
      });
      expect((await call("GET", `/share/${created.json.token}`)).status).toBe(
        200,
      );
      await call("DELETE", `/server/keys/${keyC}`, { auth: admin });
      expect((await call("GET", `/share/${created.json.token}`)).status).toBe(
        404,
      );
      expect(await db.exists(`share:${created.json.id}`)).toBeFalsy();
    });
  });
}
