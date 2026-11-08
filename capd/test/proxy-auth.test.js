import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";
const ADMIN_KEY = "proxy-auth-test-admin-key-0123456789";
const PREFIX = `proxytest:${process.pid}:`;

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch (e) {
  console.warn("[proxy-auth-test] redis not available, skipping:", e.message);
}

describe.skipIf(!redisAvailable)("proxy sign-in", () => {
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const base = `http://127.0.0.1:${port}`;
  const eventsDb = join(tmpdir(), `cap-proxy-${process.pid}.duckdb`);
  let proc;
  let session;
  let secret;

  const post = (path, body, headers = {}) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
    });
  const admin = (method, path, body, headers = {}) =>
    fetch(`${base}/server${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const bearer = (data) =>
    btoa(
      JSON.stringify({ token: data.session_token, hash: data.hashed_token }),
    );

  beforeAll(async () => {
    proc = Bun.spawn(["bun", "src/index.js"], {
      cwd: join(import.meta.dir, ".."),
      env: {
        ...process.env,
        REDIS_URL,
        REDIS_PREFIX: PREFIX,
        SERVER_PORT: String(port),
        SERVER_HOSTNAME: "127.0.0.1",
        ADMIN_KEY,
        DUCKDB_PATH: eventsDb,
        HIDE_RATELIMIT_IP_WARNING: "true",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    for (let i = 0; i < 200; i++) {
      try {
        if ((await fetch(`${base}/health/live`)).ok) break;
      } catch {}
      await Bun.sleep(50);
    }
    const login = await (
      await post("/auth/login", { admin_key: ADMIN_KEY })
    ).json();
    session = bearer(login);
  });

  afterAll(async () => {
    proc?.kill();
    await proc?.exited;
    for (const f of [eventsDb, `${eventsDb}.wal`]) rmSync(f, { force: true });
    const client = new RedisClient(REDIS_URL);
    const keys = await client.send("KEYS", [`${PREFIX}*`]);
    if (keys.length) await client.send("DEL", keys);
    client.close();
  });

  test("is off until you turn it on", async () => {
    expect((await post("/auth/proxy")).status).toBe(404);
    const res = await admin("PUT", "/settings/proxy-auth", { mode: "allow" });
    expect(res.status).toBe(409);
  });

  test("rejects standard header names", async () => {
    const res = await admin("PUT", "/settings/proxy-auth", {
      mode: "off",
      header: "Authorization",
    });
    expect(res.status).toBe(422);
  });

  test("signs in only with the right secret", async () => {
    ({ secret } = await (
      await admin("POST", "/settings/proxy-auth/secret")
    ).json());
    expect(secret).toMatch(/^cps_/);
    expect(
      (await admin("PUT", "/settings/proxy-auth", { mode: "allow" })).status,
    ).toBe(200);
    expect((await post("/auth/proxy")).status).toBe(401);
    expect(
      (await post("/auth/proxy", {}, { "X-Cap-Proxy-Secret": "nope" })).status,
    ).toBe(401);
    const ok = await post("/auth/proxy", {}, { "X-Cap-Proxy-Secret": secret });
    expect(ok.status).toBe(200);
    expect((await ok.json()).session_token).toBeString();
    expect(ok.headers.get("set-cookie")).toContain("cap_authed=yes");
    expect((await post("/auth/login", { admin_key: ADMIN_KEY })).status).toBe(
      200,
    );
  });

  test("proxy-only refuses to lock you out", async () => {
    const res = await admin("PUT", "/settings/proxy-auth", { mode: "require" });
    expect(res.status).toBe(409);
  });

  test("proxy-only turns off the admin key and needs the header on every request", async () => {
    const proxied = { "X-Cap-Proxy-Secret": secret };
    expect(
      (await admin("PUT", "/settings/proxy-auth", { mode: "require" }, proxied))
        .status,
    ).toBe(200);
    expect((await post("/auth/login", { admin_key: ADMIN_KEY })).status).toBe(
      403,
    );
    expect((await admin("GET", "/keys")).status).toBe(401);
    expect((await admin("GET", "/keys", null, proxied)).status).toBe(200);
    expect(
      (await admin("POST", "/settings/proxy-auth/secret", null, proxied))
        .status,
    ).toBe(409);
    expect(
      (await admin("PUT", "/settings/proxy-auth", { mode: "off" }, proxied))
        .status,
    ).toBe(200);
    expect((await admin("GET", "/keys")).status).toBe(200);
  });
});
