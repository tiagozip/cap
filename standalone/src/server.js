import { randomBytes } from "node:crypto";
import { Elysia, t } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { authBeforeHandle } from "./auth.js";
import {dateFromDb, db, numberFromDb} from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

const keyDefaults = {
  difficulty: 4,
  challengeCount: 80,
  saltSize: 32,
};

export const server = new Elysia({
  prefix: "/server",
  detail: {
    security: [
      {
        apiKey: [],
      },
    ],
  },
})
  .use(
    rateLimit({
      scoping: "scoped",
      max: 150,
      duration: 10_000,
      generator: ratelimitGenerator,
    })
  )
  .onBeforeHandle(authBeforeHandle)
  .get(
    "/keys",
    async () => {
      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;

      const currentStart = now - day;
      const previousStart = now - 2 * day;

      const keys = await db`SELECT * FROM keys ORDER BY created DESC`;

      return await Promise.all(
        keys.map(async (key) => {
          const [currentResult] = await db`
            SELECT SUM(count) as total FROM solutions WHERE siteKey = ${key.sitekey || key.siteKey} AND bucket >= ${currentStart}
          `;
          const [previousResult] = await db`
            SELECT SUM(count) as total FROM solutions
            WHERE siteKey = ${key.sitekey || key.siteKey} AND bucket >= ${previousStart} AND bucket < ${currentStart}
          `;

          const current = numberFromDb(currentResult?.total || 0);
          const previous = numberFromDb(previousResult?.total || 0);

          let change = 0;
          let direction = "";

          if (previous > 0) {
            change = ((current - previous) / previous) * 100;
            direction =
              current > previous ? "up" : current < previous ? "down" : "";
          } else if (current > 0) {
            change = 100;
            direction = "up";
          }

          return {
            siteKey: key.sitekey || key.siteKey,
            name: key.name,
            created: numberFromDb(key.created),
            solvesLast24h: current,
            difference: {
              value: change.toFixed(2),
              direction,
            },
          };
        })
      );
    },
    {
      detail: {
        tags: ["Keys"],
      },
    }
  )
  .post(
    "/keys",
    async ({ body }) => {
      const siteKey = randomBytes(5).toString("hex");
      const secretKey = randomBytes(40)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "");

      await db`
        INSERT INTO keys (siteKey, name, secretHash, config, created)
        VALUES (${siteKey}, ${body?.name || siteKey}, ${await Bun.password.hash(secretKey)}, ${JSON.stringify(keyDefaults)}, ${Date.now()})
      `;

      return {
        siteKey,
        secretKey,
      };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Keys"],
      },
    }
  )
  .get(
    "/keys/:siteKey",
    async ({ params, query }) => {
      const [key] = await db`SELECT * FROM keys WHERE siteKey = ${params.siteKey}`;
      if (!key) {
        return { success: false, error: "Key not found" };
      }

      const chartDuration = query.chartDuration || "today";

      const now = Math.floor(Date.now() / 1000);
      const day = 24 * 60 * 60;

      const currentStart = now - day;
      let dataQuery;
      let bucketSize;
      let startTime;

      switch (chartDuration) {
        case "today":
          bucketSize = 3600;
          startTime = Math.floor(Date.now() / 1000 / 86400) * 86400;
          dataQuery = { type: "today" };
          break;
        case "yesterday":
          bucketSize = 3600;
          startTime = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
          dataQuery = { type: "yesterday" };
          break;
        case "last7days":
          bucketSize = 86400;
          startTime = Math.floor((now - 7 * 86400) / 86400) * 86400;
          dataQuery = { type: "aggregate" };
          break;
        case "last28days":
          bucketSize = 86400;
          startTime = Math.floor((now - 28 * 86400) / 86400) * 86400;
          dataQuery = { type: "aggregate" };
          break;
        case "last91days":
          bucketSize = 86400;
          startTime = Math.floor((now - 91 * 86400) / 86400) * 86400;
          dataQuery = { type: "aggregate" };
          break;
        case "alltime":
          bucketSize = 86400;
          startTime = 0;
          dataQuery = { type: "aggregate" };
          break;
        default:
          bucketSize = 3600;
          startTime = currentStart;
          dataQuery = { type: "default" };
      }

      let historyData;
      if (chartDuration === "yesterday") {
        historyData = await db`
          SELECT bucket, SUM(count) as count
          FROM solutions
          WHERE siteKey = ${params.siteKey} AND bucket >= ${startTime} AND bucket < ${startTime + 86400}
          GROUP BY bucket
          ORDER BY bucket
        `;
      } else if (chartDuration === "today") {
        const currentHourBucket = Math.floor(now / 3600) * 3600;
        historyData = await db`
          SELECT bucket, SUM(count) as count
          FROM solutions
          WHERE siteKey = ${params.siteKey} AND bucket >= ${startTime} AND bucket <= ${currentHourBucket}
          GROUP BY bucket
          ORDER BY bucket
        `;
      } else if (dataQuery.type === "aggregate") {
        historyData = await db`
          SELECT (bucket / 86400) * 86400 as bucket, SUM(count) as count
          FROM solutions
          WHERE siteKey = ${params.siteKey} AND bucket >= ${startTime}
          GROUP BY (bucket / 86400) * 86400
          ORDER BY bucket
        `;
      } else {
        historyData = await db`
          SELECT bucket, SUM(count) as count
          FROM solutions
          WHERE siteKey = ${params.siteKey} AND bucket >= ${startTime}
          GROUP BY bucket
          ORDER BY bucket
        `;
      }

      if (
        chartDuration === "last7days" ||
        chartDuration === "last28days" ||
        chartDuration === "last91days"
      ) {
        const days =
          chartDuration === "last7days"
            ? 7
            : chartDuration === "last28days"
            ? 28
            : 91;
        const completeData = [];
        const dataMap = new Map(
          historyData.map((item) => [numberFromDb(item.bucket), numberFromDb(item.count)])
        );

        const currentDayStart = Math.floor(now / 86400) * 86400;

        for (let i = 0; i < days; i++) {
          const dayBucket = currentDayStart - (days - 1 - i) * 86400;
          completeData.push({
            bucket: dayBucket,
            count: dataMap.get(dayBucket) || 0,
          });
        }

        historyData = completeData;
      } else if (chartDuration === "today") {
        const completeData = [];
        const dataMap = new Map(
          historyData.map((item) => [numberFromDb(item.bucket), numberFromDb(item.count)])
        );

        const currentHour = Math.floor(now / 3600);
        const startHour = Math.floor(startTime / 3600);

        for (let hour = startHour; hour <= currentHour; hour++) {
          const hourBucket = hour * 3600;
          completeData.push({
            bucket: hourBucket,
            count: dataMap.get(hourBucket) || 0,
          });
        }

        historyData = completeData;
      }

      const [currentSolvesResult] = await db`
        SELECT SUM(count) as total FROM solutions WHERE siteKey = ${params.siteKey} AND bucket >= ${currentStart}
      `;
      const currentSolves = numberFromDb(currentSolvesResult?.total || 0);

      return {
        key: {
          siteKey: key.sitekey || key.siteKey,
          name: key.name,
          created: key.created,
          config: JSON.parse(key.config),
        },
        stats: {
          solvesLast24h: currentSolves,
        },
        chartData: {
          duration: chartDuration,
          bucketSize,
          data: historyData,
        },
      };
    },
    {
      params: t.Object({
        siteKey: t.String(),
      }),
      query: t.Object({
        chartDuration: t.Optional(
          t.Union([
            t.Literal("today"),
            t.Literal("yesterday"),
            t.Literal("last7days"),
            t.Literal("last28days"),
            t.Literal("last91days"),
            t.Literal("alltime"),
          ])
        ),
      }),
      detail: {
        tags: ["Keys"],
      },
    }
  )
  .put(
    "/keys/:siteKey/config",
    async ({ params, body }) => {
      const [key] = await db`SELECT * FROM keys WHERE siteKey = ${params.siteKey}`;
      if (!key) {
        return { success: false, error: "Key not found" };
      }

      const { name, difficulty, challengeCount, saltSize } = body;
      const config = {
        ...keyDefaults,
        name,
        difficulty,
        challengeCount,
        saltSize,
      };

      await db`UPDATE keys SET name = ${config.name || key.name}, config = ${JSON.stringify(config)} WHERE siteKey = ${params.siteKey}`;

      return { success: true };
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        difficulty: t.Optional(t.Number()),
        challengeCount: t.Optional(t.Number()),
        saltSize: t.Optional(t.Number()),
      }),
      detail: {
        tags: ["Keys"],
      },
    }
  )
  .delete(
    "/keys/:siteKey",
    async ({ params, set }) => {
      const [key] = await db`SELECT * FROM keys WHERE siteKey = ${params.siteKey}`;
      if (!key) {
        set.status = 404;
        return { success: false, error: "Key not found" };
      }

      await db`DELETE FROM keys WHERE siteKey = ${params.siteKey}`;
      await db`DELETE FROM solutions WHERE siteKey = ${params.siteKey}`;

      return { success: true };
    },
    {
      params: t.Object({
        siteKey: t.String(),
      }),
      detail: {
        tags: ["Keys"],
      },
    }
  )
  .post(
    "/keys/:siteKey/rotate-secret",
    async ({ params }) => {
      const [key] = await db`SELECT * FROM keys WHERE siteKey = ${params.siteKey}`;
      if (!key) {
        return { success: false, error: "Key not found" };
      }
      const newSecretKey = randomBytes(40)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "");

      await db`UPDATE keys SET secretHash = ${await Bun.password.hash(newSecretKey)} WHERE siteKey = ${params.siteKey}`;
      return {
        secretKey: newSecretKey,
      };
    },
    {
      params: t.Object({
        siteKey: t.String(),
      }),
      detail: {
        tags: ["Keys"],
      },
    }
  )
  .get(
    "/settings/sessions",
    async () => {
      const sessions = await db`SELECT * FROM sessions`;
      return sessions.map((session) => ({
        token: session.token.slice(-14),
        expires: dateFromDb(session.expires).toISOString(),
        created: dateFromDb(session.created).toISOString(),
      }));
    },
    {
      detail: {
        tags: ["Settings"],
      },
    }
  )
  .get(
    "/settings/apikeys",
    async () => {
      const apikeys = await db`SELECT * FROM api_keys`;

      return apikeys.map((key) => ({
        name: key.name,
        id: key.id,
        created: dateFromDb(key.created).toISOString(),
      }));
    },
    {
      detail: {
        tags: ["Settings"],
      },
    }
  )
  .post(
    "/settings/apikeys",
    async ({ body }) => {
      const id = randomBytes(16).toString("hex");
      const token = randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "")
        .replace(/\//g, "")
        .replace(/=+$/, "");

      const name = body.name;

      await db`
        INSERT INTO api_keys (id, name, tokenHash, created)
        VALUES (${id}, ${name}, ${await Bun.password.hash(token)}, ${Date.now()})
      `;
      return {
        apiKey: `${id}_${token}`,
      };
    },
    {
      body: t.Object({
        name: t.String(),
      }),
      detail: {
        tags: ["Settings"],
      },
    }
  )
  .delete(
    "/settings/apikeys/:id",
    async ({ params, set }) => {
      const [key] = await db`SELECT * FROM api_keys WHERE id = ${params.id}`;
      if (!key) {
        set.status = 404;
        return { success: false, error: "API key not found" };
      }
      await db`DELETE FROM api_keys WHERE id = ${params.id}`;
      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Settings"],
      },
    }
  )
  .get(
    "/about",
    async () => {
      const pkg = await import("../package.json", { assert: { type: "json" } });

      return {
        bun: Bun.version,
        ver: pkg.default.version,
      };
    },
    {}
  )
  .post(
    "/logout",
    async ({ body, headers, set }) => {
      const { authorization } = headers;
      if (!authorization) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      const { hash } = JSON.parse(
        atob(authorization.replace("Bearer ", "").trim())
      );

      let session = hash;

      if (body.session) {
        // body.session are the last characters of the session token
        // e.g. body.session = (...)8KdbcHjqxWPR6Q

        const sessionRows = await db`SELECT token FROM sessions WHERE token LIKE ${'%' + body.session}`;
        const sessionRow = sessionRows[0];

        if (!sessionRow) {
          set.status = 404;
          return { success: false, error: "Session not found" };
        }
        session = sessionRow.token;
      }

      await db`DELETE FROM sessions WHERE token = ${session}`;

      return { success: true };
    },
    {
      body: t.Optional(
        t.Object({
          session: t.Optional(t.String()),
        })
      ),
      detail: {
        tags: ["Settings"],
      },
    }
  );
