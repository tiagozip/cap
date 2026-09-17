import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { pluginGracefulShutdown } from "../src/graceful-shutdown.js";

const request = (app, path) =>
  app.handle(new Request(`http://localhost${path}`));

describe("graceful shutdown plugin", () => {
  test("readiness check returns ready status initially", async () => {
    const app = new Elysia().use(pluginGracefulShutdown());

    const response = await request(app, "/readyz");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  test("liveness check returns uptime", async () => {
    const app = new Elysia().use(pluginGracefulShutdown());

    const response = await request(app, "/livez");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(typeof data.uptime).toBe("number");
    expect(data.uptime).toBeGreaterThanOrEqual(0);
  });
});
