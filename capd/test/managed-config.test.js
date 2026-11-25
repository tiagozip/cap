import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";
import { ConfigError, parseConfig, readConfig } from "../src/managed-config.js";

setDefaultTimeout(30_000);

const REDIS_URL =
  process.env.VALKEY_URL || process.env.REDIS_URL || "redis://127.0.0.1:6379";
const CAPD = join(import.meta.dir, "..");
const ADMIN_KEY = "managed-config-admin-key-0123456789ab";
const dir = mkdtempSync(join(tmpdir(), "cap-managed-"));

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

const writeConfig = (name, config) => {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(config));
  return path;
};

describe("config parsing", () => {
  test("fills in defaults for the fields a section leaves out", () => {
    expect(
      parseConfig({
        instance: {
          ratelimit: { max: 50 },
          headers: { ipHeader: "X-Forwarded-For" },
          filtering: {},
        },
      }),
    ).toEqual({
      ratelimit: { max: 50, duration: 5000 },
      headers: {
        ipHeader: "X-Forwarded-For",
        countryHeader: "",
        asnHeader: "",
      },
      filtering: { blockNonBrowserUA: false, requiredHeaders: [] },
    });
    expect(parseConfig({ $schema: "./x.json" })).toEqual({});
  });

  test("names the field that's wrong", () => {
    const cases = [
      [{ instance: { ratelimit: { max: 0 } } }, "instance.ratelimit.max"],
      [{ instance: { ratelimit: { maxx: 5 } } }, "instance.ratelimit.maxx"],
      [{ instance: { cors: {} } }, "instance.cors.origins"],
      [{ instance: { assets: { widget: "latest" } } }, "version numbers"],
      [{ instance: { proxy: {} } }, "unknown section instance.proxy"],
      [{ sites: {} }, "sites isn't supported yet"],
      [{ instanse: {} }, 'unknown key "instanse"'],
      [[], "must be a JSON object"],
    ];
    for (const [config, message] of cases) {
      expect(() => parseConfig(config, "CAP_CONFIG")).toThrow(ConfigError);
      expect(() => parseConfig(config, "CAP_CONFIG")).toThrow(message);
    }
  });

  test("reads a file or inline JSON, but not both", () => {
    const path = writeConfig("read.json", {
      instance: { cors: { origins: null } },
    });
    expect(readConfig({})).toBe(null);
    expect(readConfig({ CAP_CONFIG: path })).toEqual({
      source: "CAP_CONFIG",
      instance: { cors: { origins: null } },
    });
    expect(
      readConfig({ CAP_CONFIG_JSON: '{"instance":{"ratelimit":{}}}' }),
    ).toEqual({
      source: "CAP_CONFIG_JSON",
      instance: { ratelimit: { max: 30, duration: 5000 } },
    });
    expect(() =>
      readConfig({ CAP_CONFIG: path, CAP_CONFIG_JSON: "{}" }),
    ).toThrow("not both");
    expect(() => readConfig({ CAP_CONFIG: join(dir, "missing.json") })).toThrow(
      "can't read",
    );
    expect(() => readConfig({ CAP_CONFIG_JSON: "{nope" })).toThrow(
      "isn't valid JSON",
    );
  });
});

describe("server with a config file", () => {
  if (!redisAvailable) return;
  const prefix = `mgdtest:${process.pid}:`;
  const procs = [];

  const spawn = (env) => {
    const port = 20_000 + Math.floor(Math.random() * 20_000);
    const eventsDb = join(dir, `events-${port}.duckdb`);
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
    procs.push(proc);
    return { proc, base: `http://127.0.0.1:${port}` };
  };

  const output = async (proc) =>
    `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}`;

  const start = async (env) => {
    const { proc, base } = spawn(env);
    for (let i = 0; i < 200; i++) {
      if (proc.exitCode != null) throw new Error(await output(proc));
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
    const call = async (method, path, body) => {
      const res = await fetch(`${base}/server${path}`, {
        method,
        headers: {
          authorization,
          ...(body && { "content-type": "application/json" }),
        },
        ...(body && { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: await res.json() };
    };
    const stop = async () => {
      proc.kill();
      await proc.exited;
      return output(proc);
    };
    return { call, stop };
  };

  afterAll(async () => {
    for (const p of procs) {
      p.kill();
      await p.exited;
    }
    const client = new RedisClient(REDIS_URL);
    const keys = await client.send("KEYS", [`${prefix}*`]);
    if (keys.length) await client.send("DEL", keys);
    client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test("applies the sections it lists and locks only those", async () => {
    const server = await start({
      CAP_CONFIG: writeConfig("apply.json", {
        instance: {
          headers: { ipHeader: "X-Forwarded-For" },
          ratelimit: { max: 50, duration: 10000 },
          analytics: { retentionDays: 7, ipMode: "truncate" },
        },
      }),
    });

    expect((await server.call("GET", "/settings/managed")).body).toEqual({
      source: "CAP_CONFIG",
      sections: ["headers", "ratelimit", "analytics"],
    });
    expect((await server.call("GET", "/settings/headers")).body).toEqual({
      ipHeader: "X-Forwarded-For",
      countryHeader: "",
      asnHeader: "",
    });
    expect((await server.call("GET", "/settings/ratelimit")).body).toEqual({
      max: 50,
      duration: 10000,
    });
    expect(
      (await server.call("GET", "/settings/analytics")).body.settings,
    ).toMatchObject({ retentionDays: 7, ipMode: "truncate" });

    for (const [path, body] of [
      ["/settings/headers", { ipHeader: "X-Real-IP" }],
      ["/settings/ratelimit", { max: 5 }],
      ["/settings/analytics", { retentionDays: 30 }],
    ]) {
      const res = await server.call("PUT", path, body);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain("set by CAP_CONFIG");
    }
    expect((await server.call("GET", "/settings/ratelimit")).body.max).toBe(50);

    const cors = await server.call("PUT", "/settings/cors", {
      origins: ["https://a.example"],
    });
    expect(cors.status).toBe(200);
    expect((await server.call("GET", "/settings/cors")).body.origins).toEqual([
      "https://a.example",
    ]);

    expect(await server.stop()).toContain(
      "CAP_CONFIG sets headers, ratelimit, analytics",
    );
  });

  test("puts back its values on restart and unlocks sections it drops", async () => {
    const client = new RedisClient(REDIS_URL);
    await client.send("SET", [
      `${prefix}settings:ratelimit`,
      JSON.stringify({ max: 1, duration: 1000 }),
    ]);
    client.close();

    const server = await start({
      CAP_CONFIG_JSON: JSON.stringify({
        instance: { ratelimit: { max: 50, duration: 10000 } },
      }),
    });
    expect((await server.call("GET", "/settings/ratelimit")).body).toEqual({
      max: 50,
      duration: 10000,
    });
    expect(
      (await server.call("GET", "/settings/managed")).body.sections,
    ).toEqual(["ratelimit"]);
    const headers = await server.call("PUT", "/settings/headers", {
      ipHeader: "X-Real-IP",
    });
    expect(headers.status).toBe(200);
    await server.stop();

    const plain = await start({});
    expect((await plain.call("GET", "/settings/managed")).body).toEqual({
      source: null,
      sections: [],
    });
    expect(
      (await plain.call("PUT", "/settings/ratelimit", { max: 40 })).status,
    ).toBe(200);
    await plain.stop();
  });

  test("refuses to start with a broken config", async () => {
    const { proc } = spawn({
      CAP_CONFIG: writeConfig("broken.json", {
        instance: { ratelimit: { max: "lots" } },
      }),
    });
    expect(await proc.exited).toBe(1);
    expect(await output(proc)).toContain(
      "[cap] CAP_CONFIG: instance.ratelimit.max: Expected number",
    );
  });
});
