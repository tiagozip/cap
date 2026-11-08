import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";
const PREFIX = `livetest:${process.pid}:`;
const ADMIN_KEY = "live-test-admin-key-0123456789abcdef";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

describe("live events socket", () => {
  if (!redisAvailable) return;
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const base = `http://127.0.0.1:${port}`;
  const eventsDb = join(tmpdir(), `cap-live-${process.pid}.duckdb`);
  let proc;
  let bearer;
  let siteKey;
  let otherKey;

  const call = async (method, path, body, authorization = bearer) =>
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

  const connect = (hello) =>
    new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/server/live`);
      const messages = [];
      ws.onopen = () => hello && ws.send(JSON.stringify(hello));
      ws.onmessage = ({ data }) => messages.push(JSON.parse(data));
      ws.onclose = ({ code }) => {
        ws.closedWith = code;
      };
      ws.messages = messages;
      setTimeout(() => resolve(ws), 300);
    });

  const waitFor = async (fn, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await Bun.sleep(50);
    }
    return false;
  };

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
      stdout: "ignore",
      stderr: "ignore",
    });
    for (let i = 0; i < 200; i++) {
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
    bearer = `Bearer ${btoa(
      JSON.stringify({ token: login.session_token, hash: login.hashed_token }),
    )}`;
    ({ siteKey } = await call("POST", "/server/keys", { name: "live" }));
    ({ siteKey: otherKey } = await call("POST", "/server/keys", {
      name: "other",
    }));
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

  test("pushes a signal after a key's events are stored", async () => {
    const ws = await connect({ authorization: bearer, siteKey });
    const other = await connect({ authorization: bearer, siteKey: otherKey });
    expect(
      await waitFor(() => ws.messages.some((m) => m.type === "ready")),
    ).toBe(true);
    await fetch(`${base}/${siteKey}/challenge`, { method: "POST" });
    expect(
      await waitFor(() => ws.messages.some((m) => m.type === "events")),
    ).toBe(true);
    const listed = await call(
      "GET",
      `/server/keys/${siteKey}/events?from=${Date.now() - 60_000}&to=${Date.now() + 60_000}`,
    );
    expect(listed.events.length).toBeGreaterThan(0);
    expect(other.messages.some((m) => m.type === "events")).toBe(false);
    ws.close();
    other.close();
  });

  test("closes sockets that never authenticate", async () => {
    const ws = await connect(null);
    expect(await waitFor(() => ws.closedWith === 4001, 7000)).toBe(true);
  }, 10_000);

  test("rejects a bad session and an unknown key", async () => {
    const bad = await connect({
      authorization: `Bearer ${btoa(JSON.stringify({ token: "x".repeat(60), hash: "0".repeat(64) }))}`,
      siteKey,
    });
    expect(await waitFor(() => bad.closedWith === 4001)).toBe(true);
    expect(bad.messages).toEqual([]);
    const missing = await connect({
      authorization: bearer,
      siteKey: "ffffffffff",
    });
    expect(await waitFor(() => missing.closedWith === 4004)).toBe(true);
  });

  test("enforces an API key's site key scope", async () => {
    const created = await call("POST", "/server/settings/apikeys", {
      name: "scoped",
      siteKeys: [otherKey],
    });
    const token = created.apiKey ?? created.token ?? created.key;
    expect(typeof token).toBe("string");
    const denied = await connect({ authorization: `Bot ${token}`, siteKey });
    expect(await waitFor(() => denied.closedWith === 4001)).toBe(true);
    const allowed = await connect({
      authorization: `Bot ${token}`,
      siteKey: otherKey,
    });
    expect(
      await waitFor(() => allowed.messages.some((m) => m.type === "ready")),
    ).toBe(true);
    allowed.close();
  });

  test("caps unauthenticated sockets per IP without counting signed in ones", async () => {
    const signedIn = [];
    for (let i = 0; i < 6; i++) {
      const ws = await connect({ authorization: bearer, siteKey });
      expect(
        await waitFor(() => ws.messages.some((m) => m.type === "ready")),
      ).toBe(true);
      signedIn.push(ws);
    }
    const pending = await Promise.all([1, 2, 3, 4, 5].map(() => connect(null)));
    expect(pending.some((ws) => ws.closedWith)).toBe(false);
    const extra = await connect(null);
    expect(await waitFor(() => extra.closedWith === 1013)).toBe(true);
    for (const ws of pending) ws.close();
    await waitFor(() => pending.every((ws) => ws.closedWith));
    await Bun.sleep(100);
    const after = await connect({ authorization: bearer, siteKey });
    expect(
      await waitFor(() => after.messages.some((m) => m.type === "ready")),
    ).toBe(true);
    for (const ws of [...signedIn, after]) ws.close();
  });
});
