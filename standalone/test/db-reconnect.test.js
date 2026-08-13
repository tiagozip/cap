import { afterAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
let probeClient;
try {
  probeClient = new RedisClient(REDIS_URL);
  await probeClient.send("PING", []);
  redisAvailable = true;
} catch (e) {
  console.warn(
    "[db-reconnect-test] redis not available, skipping reconnect tests:",
    e.message,
  );
}

if (!redisAvailable) {
  test.skip(`db reconnect skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  const backend = new URL(REDIS_URL);
  const backendHost = backend.hostname;
  const backendPort = Number(backend.port || 6379);

  let listener = null;

  function startProxy(port) {
    listener = Bun.listen({
      hostname: "127.0.0.1",
      port,
      socket: {
        open(socket) {
          socket.data = { upstream: null, buffered: [] };
          Bun.connect({
            hostname: backendHost,
            port: backendPort,
            socket: {
              open(upstream) {
                upstream.data = socket;
                socket.data.upstream = upstream;
                for (const chunk of socket.data.buffered) upstream.write(chunk);
                socket.data.buffered = [];
              },
              data(upstream, chunk) {
                upstream.data.write(chunk);
              },
              close(upstream) {
                upstream.data.end();
              },
            },
          }).catch(() => socket.end());
        },
        data(socket, chunk) {
          if (socket.data.upstream) {
            socket.data.upstream.write(chunk);
          } else {
            socket.data.buffered.push(chunk);
          }
        },
        close(socket) {
          socket.data.upstream?.end();
        },
      },
    });
    return listener.port;
  }

  function stopProxy() {
    listener.stop(true);
    listener = null;
  }

  const proxyPort = startProxy(0);
  const originalRedisUrl = process.env.REDIS_URL;
  process.env.REDIS_URL = `redis://127.0.0.1:${proxyPort}`;
  const { db } = await import("../src/db.js?reconnect");
  process.env.REDIS_URL = originalRedisUrl;

  afterAll(async () => {
    try {
      await db.del("test:reconnect");
    } catch {}
    listener?.stop(true);
    probeClient?.close();
  });

  describe("db reconnect", () => {
    test("recovers after the redis connection is lost", async () => {
      await db.set("test:reconnect", "before");
      expect(await db.get("test:reconnect")).toBe("before");

      stopProxy();
      await Bun.sleep(50);
      await expect(db.get("test:reconnect")).rejects.toThrow();

      startProxy(proxyPort);
      await Bun.sleep(50);

      expect(await db.get("test:reconnect")).toBe("before");
      await db.set("test:reconnect", "after");
      expect(await db.get("test:reconnect")).toBe("after");
    }, 60000);
  });
}
