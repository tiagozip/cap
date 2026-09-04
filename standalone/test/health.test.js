import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createHealthServer } from "../src/health.js";

const request = (app, path) =>
  app.handle(new Request(`http://localhost${path}`));

describe("standalone health checks", () => {
  test("liveness does not depend on initialization or Redis", async () => {
    const app = new Elysia().use(
      createHealthServer({
        checkRedis: () => {
          throw new Error("unavailable");
        },
        isInitialized: () => false,
      }),
    );

    const response = await request(app, "/health/live");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("readiness reports startup initialization", async () => {
    const app = new Elysia().use(
      createHealthServer({
        checkRedis: () => "PONG",
        isInitialized: () => false,
      }),
    );

    const response = await request(app, "/health/ready");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "starting",
      checks: { initialization: "pending" },
    });
  });

  test("readiness succeeds when initialization and Redis are healthy", async () => {
    const app = new Elysia().use(
      createHealthServer({ checkRedis: () => "PONG" }),
    );

    const response = await request(app, "/health/ready");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      checks: { initialization: "ok", redis: "ok" },
    });
  });

  test("readiness fails without exposing Redis errors", async () => {
    const app = new Elysia().use(
      createHealthServer({
        checkRedis: () => {
          throw new Error("redis://user:secret@example.test:6379");
        },
      }),
    );

    const response = await request(app, "/health/ready");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "unhealthy",
      checks: { initialization: "ok", redis: "unavailable" },
    });
  });

  test("readiness times out slow Redis probes", async () => {
    const app = new Elysia().use(
      createHealthServer({
        checkRedis: () => new Promise(() => {}),
        timeoutMs: 10,
      }),
    );

    const response = await request(app, "/health/ready");
    expect(response.status).toBe(503);
    expect((await response.json()).checks.redis).toBe("unavailable");
  });

  test("/health aliases the readiness check", async () => {
    const app = new Elysia().use(
      createHealthServer({ checkRedis: () => "PONG" }),
    );

    const response = await request(app, "/health");
    expect(response.status).toBe(200);
    expect((await response.json()).checks.redis).toBe("ok");
  });
});
