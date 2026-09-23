import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

setDefaultTimeout(30_000);

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probeClient = new RedisClient(REDIS_URL);
  await probeClient.send("PING", []);
  probeClient.close();
  redisAvailable = true;
} catch (e) {
  console.warn("[health-test] redis not available, skipping:", e.message);
}

if (!redisAvailable) {
  test.skip(`health skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  const { healthServer } = await import("../src/health.js");
  const app = new Elysia().use(healthServer);
  const get = (path) => app.handle(new Request(`http://localhost${path}`));

  describe("health routes", () => {
    test("/health is 200 while redis answers", async () => {
      const res = await get("/health");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    });

    test("/health/live is 200", async () => {
      const res = await get("/health/live");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    });
  });

  describe("shutdown", () => {
    const boot = async () => {
      const port = 20_000 + Math.floor(Math.random() * 20_000);
      const proc = Bun.spawn(["bun", "src/index.js"], {
        cwd: `${import.meta.dir}/..`,
        env: {
          ...process.env,
          REDIS_URL,
          REDIS_PREFIX: `test_shutdown_${port}:`,
          ADMIN_KEY: "shutdown-test-admin-key",
          SERVER_PORT: String(port),
          SERVER_HOSTNAME: "127.0.0.1",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      for (let i = 0; i < 100; i++) {
        const ok = await fetch(`http://127.0.0.1:${port}/health/live`)
          .then((r) => r.ok)
          .catch(() => false);
        if (ok) return { proc, port };
        await Bun.sleep(100);
      }
      proc.kill("SIGKILL");
      throw new Error("server did not start");
    };

    const stall = async (port) => {
      const body = JSON.stringify({ admin_key: "wrong-key" });
      const state = { response: "" };
      const socket = await Bun.connect({
        hostname: "127.0.0.1",
        port,
        socket: {
          data(_, chunk) {
            state.response += chunk.toString();
          },
        },
      });
      socket.write(
        `POST /auth/login HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body.slice(0, 5)}`,
      );
      await Bun.sleep(300);
      return {
        state,
        finish: () => socket.write(body.slice(5)),
        close: () => socket.end(),
      };
    };

    test("SIGTERM lets an in-flight request finish, then exits 0", async () => {
      const { proc, port } = await boot();
      const request = await stall(port);

      const signalledAt = performance.now();
      proc.kill("SIGTERM");
      await Bun.sleep(300);

      const refused = await fetch(`http://127.0.0.1:${port}/health/live`)
        .then(() => false)
        .catch(() => true);
      expect(refused).toBe(true);

      request.finish();
      const code = await proc.exited;
      const elapsedMs = performance.now() - signalledAt;
      request.close();

      expect(request.state.response).toStartWith("HTTP/1.1 401");
      expect(code).toBe(0);
      expect(elapsedMs).toBeLessThan(3_000);
    });

    test("a second signal exits at once while a request is stuck", async () => {
      const { proc, port } = await boot();
      const request = await stall(port);
      proc.kill("SIGTERM");
      await Bun.sleep(300);
      const signalledAt = performance.now();
      proc.kill("SIGTERM");
      const code = await proc.exited;
      request.close();
      expect(code).toBe(1);
      expect(performance.now() - signalledAt).toBeLessThan(1_000);
    });

    test("a stuck request cannot hold shutdown past 8 seconds", async () => {
      const { proc, port } = await boot();
      const request = await stall(port);
      const signalledAt = performance.now();
      proc.kill("SIGTERM");
      const code = await proc.exited;
      const elapsedMs = performance.now() - signalledAt;
      request.close();
      expect(code).toBe(1);
      expect(elapsedMs).toBeGreaterThan(7_500);
      expect(elapsedMs).toBeLessThan(9_500);
    });

    afterAll(async () => {
      const client = new RedisClient(REDIS_URL);
      const keys = await client.send("KEYS", ["test_shutdown_*"]);
      if (Array.isArray(keys) && keys.length) await client.send("DEL", keys);
      client.close();
    });
  });
}
