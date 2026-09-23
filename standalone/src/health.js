import { Elysia } from "elysia";
import { db } from "./db.js";

const REDIS_TIMEOUT_MS = 2_000;
const REDIS_CHECK_REUSE_MS = 1_000;

let redisCheck = null;
let redisCheckedAt = 0;

export const healthServer = new Elysia({ detail: { tags: ["Health"] } })
  .get("/health/live", () => ({ status: "ok" }), {
    detail: { description: "Answers as long as the process is running" },
  })
  .get(
    "/health",
    async ({ set }) => {
      if (!redisCheck || Date.now() - redisCheckedAt >= REDIS_CHECK_REUSE_MS) {
        redisCheckedAt = Date.now();
        redisCheck = Promise.race([
          db.send("PING", []).then((reply) => reply === "PONG"),
          Bun.sleep(REDIS_TIMEOUT_MS).then(() => false),
        ]).catch(() => false);
      }
      if (await redisCheck) return { status: "ok" };
      set.status = 503;
      return { status: "unavailable" };
    },
    {
      detail: {
        description:
          "Returns 200 when Redis answers within 2 seconds, 503 otherwise",
      },
    },
  );
