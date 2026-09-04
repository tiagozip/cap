import { Elysia } from "elysia";

const DEFAULT_TIMEOUT_MS = 2_000;

async function withTimeout(operation, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Health check timed out")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([Promise.resolve().then(operation), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthServer({
  checkRedis,
  isInitialized = () => true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const readiness = async ({ set }) => {
    if (!isInitialized()) {
      set.status = 503;
      return {
        status: "starting",
        checks: { initialization: "pending" },
      };
    }

    try {
      const response = await withTimeout(checkRedis, timeoutMs);
      if (response !== "PONG") throw new Error("Unexpected Redis response");

      return {
        status: "ok",
        checks: { initialization: "ok", redis: "ok" },
      };
    } catch {
      set.status = 503;
      return {
        status: "unhealthy",
        checks: { initialization: "ok", redis: "unavailable" },
      };
    }
  };

  return new Elysia({
    detail: {
      tags: ["Health"],
    },
  })
    .get("/health/live", () => ({ status: "ok" }))
    .get("/health/ready", readiness)
    .get("/health", readiness);
}
