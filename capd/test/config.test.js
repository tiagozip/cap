import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";
import { clickhouseConfig, parseClickhouseUrl } from "../src/config.js";

setDefaultTimeout(30_000);

const REDIS_URL =
  process.env.VALKEY_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379";
const CAPD = join(import.meta.dir, "..");
const ADMIN_KEY = "config-test-admin-key-0123456789abcdef";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

const captureWarnings = (fn) => {
  const original = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.join(" "));
  try {
    return { result: fn(), lines };
  } finally {
    console.warn = original;
  }
};

describe("CLICKHOUSE_URL parsing", () => {
  test("reads user, password and database from the URL", () => {
    expect(
      parseClickhouseUrl("http://cap:secret@clickhouse:8123/analytics"),
    ).toEqual({
      url: "http://clickhouse:8123",
      user: "cap",
      password: "secret",
      database: "analytics",
    });
    expect(parseClickhouseUrl("https://ch.example.com/")).toEqual({
      url: "https://ch.example.com",
      user: null,
      password: null,
      database: null,
    });
  });

  test("takes the password as written, up to the last @", () => {
    const password = "p@ss:w/rd #1?%41 x";
    expect(
      parseClickhouseUrl(`http://cap:${password}@clickhouse:8123/cap`),
    ).toEqual({
      url: "http://clickhouse:8123",
      user: "cap",
      password,
      database: "cap",
    });
    expect(parseClickhouseUrl("http://cap:@clickhouse:8123").password).toBe("");
  });

  test("refuses URLs it can't use", () => {
    expect(() => parseClickhouseUrl("clickhouse:8123")).toThrow(/http/);
    expect(() => parseClickhouseUrl("http://cap:x@exa mple:80")).toThrow(
      /invalid host/,
    );
  });

  test("defaults to the default user and the cap database", () => {
    const { result } = captureWarnings(() =>
      clickhouseConfig({ CLICKHOUSE_URL: "http://clickhouse:8123" }),
    );
    expect(result).toEqual({
      url: "http://clickhouse:8123",
      user: "default",
      password: "",
      database: "cap",
    });
    expect(clickhouseConfig({})).toBe(null);
  });
});

test("built-in widget versions match the widget and wasm packages", () => {
  const pkg = JSON.parse(readFileSync(join(CAPD, "package.json")));
  for (const [name, path] of [
    ["widget", "../widget/src/package.json"],
    ["wasm", "../wasm/src/package.json"],
  ]) {
    const file = join(CAPD, path);
    if (!existsSync(file)) continue;
    expect(pkg.capAssets[name]).toBe(JSON.parse(readFileSync(file)).version);
  }
});

describe("server env fallback", () => {
  if (!redisAvailable) return;
  const prefix = `cfgtest:${process.pid}:`;
  const servers = [];

  const clearPrefix = async () => {
    const client = new RedisClient(REDIS_URL);
    const keys = await client.send("KEYS", [`${prefix}*`]);
    if (keys.length) await client.send("DEL", keys);
    client.close();
  };

  const start = async (env) => {
    const port = 20_000 + Math.floor(Math.random() * 20_000);
    const eventsDb = join(tmpdir(), `cap-cfg-${process.pid}-${port}.duckdb`);
    const proc = Bun.spawn(["bun", "src/index.js"], {
      cwd: CAPD,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        VALKEY_URL: REDIS_URL,
        REDIS_PREFIX: prefix,
        SERVER_PORT: String(port),
        SERVER_HOSTNAME: "127.0.0.1",
        ADMIN_KEY,
        DUCKDB_PATH: eventsDb,
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 200; i++) {
      if (proc.exitCode != null) break;
      try {
        if ((await fetch(`${base}/health/live`)).ok) break;
      } catch {}
      await Bun.sleep(50);
    }
    const login = await (
      await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ admin_key: ADMIN_KEY }),
      })
    ).json();
    const authorization = `Bearer ${btoa(
      JSON.stringify({ token: login.session_token, hash: login.hashed_token }),
    )}`;
    const call = async (method, path, body) =>
      (
        await fetch(`${base}${path}`, {
          method,
          headers: {
            authorization,
            ...(body && { "content-type": "application/json" }),
          },
          ...(body && { body: JSON.stringify(body) }),
        })
      ).json();
    const server = {
      base,
      call,
      stop: async () => {
        proc.kill();
        await proc.exited;
        for (const f of [eventsDb, `${eventsDb}.wal`])
          rmSync(f, { force: true });
        return `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}`;
      },
    };
    servers.push(server);
    return server;
  };

  afterAll(async () => {
    for (const s of servers) await s.stop().catch(() => {});
    await clearPrefix();
  });

  const OLD_ENV = {
    RATELIMIT_IP_HEADER: "X-Real-IP",
    CORS_ORIGIN: "https://a.example, https://b.example",
    ENABLE_ASSETS_SERVER: "true",
    WIDGET_VERSION: "latest",
    WASM_VERSION: "0.0.7",
    CACHE_HOST: "https://mirror.example",
  };

  test("old variables seed unsaved settings and warn once each", async () => {
    await clearPrefix();
    const server = await start(OLD_ENV);
    expect(
      (await server.call("GET", "/server/settings/headers")).ipHeader,
    ).toBe("X-Real-IP");
    expect((await server.call("GET", "/server/settings/cors")).origins).toEqual(
      ["https://a.example", "https://b.example"],
    );
    const analytics = await server.call("GET", "/server/settings/analytics");
    expect(analytics.status.locked).toBeUndefined();
    const assets = await server.call("GET", "/server/settings/assets");
    expect(assets).toMatchObject({
      enabled: true,
      wasm: "0.0.7",
      widget: assets.builtWith.widget,
    });
    expect(analytics.status.backend).toBe("duckdb");

    const saved = await server.call("PUT", "/server/settings/analytics", {
      retentionDays: 14,
    });
    expect(saved.settings.retentionDays).toBe(14);

    const log = await server.stop();
    for (const [pattern, place] of [
      ["RATELIMIT_IP_HEADER is deprecated", "Settings > Visitor location"],
      ["CORS_ORIGIN is deprecated", "Settings > Default protection"],
      ["WIDGET_VERSION, WASM_VERSION", "Settings > Widget files"],
      ["CACHE_HOST is no longer read", ""],
    ]) {
      const lines = log.split("\n").filter((l) => l.includes(pattern));
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain(place);
    }
  });

  test("saved settings win over the old variables", async () => {
    const server = await start({
      ...OLD_ENV,
      RATELIMIT_IP_HEADER: "CF-Connecting-IP",
    });
    expect(
      (await server.call("GET", "/server/settings/headers")).ipHeader,
    ).toBe("X-Real-IP");
    const analytics = await server.call("GET", "/server/settings/analytics");
    expect(analytics.settings.retentionDays).toBe(14);
    const log = await server.stop();
    expect(log).toContain(
      "RATELIMIT_IP_HEADER is deprecated and ignored, because Settings > Visitor location",
    );
  });

  test("widget files follow the dashboard setting", async () => {
    await clearPrefix();
    const server = await start({});
    const off = await server.call("GET", "/server/settings/assets");
    expect(off).toMatchObject({
      enabled: false,
      widget: off.builtWith.widget,
      wasm: off.builtWith.wasm,
      source: "https://cdn.jsdelivr.net",
    });
    expect((await fetch(`${server.base}/assets/widget.js`)).status).toBe(404);

    const bad = await server.call("PUT", "/server/settings/assets", {
      widget: "latest",
    });
    expect(bad.success).toBe(false);

    const client = new RedisClient(REDIS_URL);
    await client.send("SET", [`${prefix}asset:widget.js`, "window.capTest=1"]);
    await client.send("SET", [
      `${prefix}asset:cache-config`,
      JSON.stringify({
        lastUpdate: Date.now(),
        versions: { widget: "0.1.1", wasm: "0.0.1" },
        hashwx: false,
      }),
    ]);
    client.close();

    const on = await server.call("PUT", "/server/settings/assets", {
      enabled: true,
      widget: "0.1.1",
      wasm: "0.0.1",
    });
    expect(on.success).toBe(true);
    expect(on.status).toMatchObject({
      enabled: true,
      widget: "0.1.1",
      cached: { widget: "0.1.1", wasm: "0.0.1", hashwx: false },
    });
    const served = await fetch(`${server.base}/assets/widget.js`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toContain("text/javascript");
    expect(await served.text()).toBe("window.capTest=1");
    expect((await fetch(`${server.base}/assets/floating.js`)).status).toBe(503);
    expect((await fetch(`${server.base}/assets/other.js`)).status).toBe(404);

    await server.call("PUT", "/server/settings/assets", { enabled: false });
    expect((await fetch(`${server.base}/assets/widget.js`)).status).toBe(404);
    await server.stop();
  });
});
