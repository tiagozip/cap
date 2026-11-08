import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { loadIPDB } from "#ipdb";
import { liveServer, startLive } from "#live";
import { uuidv7 } from "#platform";
import { publicStatic, servePage } from "#static";
import pkg from "../package.json";
import { assetsServer, startAssets } from "./assets.js";
import { auth } from "./auth.js";
import { capServer } from "./cap.js";
import { initEvents } from "./events/index.js";
import { migrateOldHashes } from "./hash-migration.js";
import { healthServer } from "./health.js";
import { migrateLegacyBlocks } from "./policy/rules.js";
import { startWebhooks } from "./policy/webhooks.js";
import { policyRoutes } from "./policy-routes.js";
import { server } from "./server.js";
import {
  checkCorsOrigin,
  corsTarget,
  loadCorsDefault,
  loadFiltering,
  loadHeaders,
  loadRatelimit,
} from "./settings-cache.js";
import { shareServer } from "./share.js";
import { siteverifyServer } from "./siteverify.js";

export async function startup() {
  await initEvents();
  await migrateLegacyBlocks().catch((e) =>
    console.warn("[cap] blocklist migration:", e.message),
  );
  await migrateOldHashes().catch((e) =>
    console.warn("[cap] hash migration:", e.message),
  );
  startWebhooks();
  await startLive();
  startAssets();
  await loadSettingsCaches();
  loadIPDB().catch((e) => console.warn("[cap] IP DB load:", e.message));
}

export async function loadSettingsCaches() {
  await Promise.all([
    loadHeaders(),
    loadRatelimit(),
    loadCorsDefault(),
    loadFiltering(),
  ]);
}

export function createApp(options = {}, { docs = true } = {}) {
  const app = new Elysia(options);
  if (docs)
    app.use(
      swagger({
        scalarConfig: {
          customCss: `.section-header-wrapper .section-header.tight { margin-top: 10px; }`,
        },
        exclude: ["/", "/auth/login", "/share"],
        documentation: {
          tags: [
            {
              name: "Keys",
              description:
                "Managing, creating and viewing keys. Requires API or session token",
            },
            {
              name: "Settings",
              description:
                "Managing sessions, API keys, and other settings. Requires API or session token",
            },
            {
              name: "Challenges",
              description: "Creating and managing challenges and tokens",
            },
            {
              name: "Assets",
              description: "Reading static assets from the assets server",
            },
            {
              name: "Share",
              description:
                "Read-only stats for a site key via a share link token. No authentication required",
            },
            {
              name: "Analytics",
              description:
                "Event log, charts and top lists per site key. Requires API or session token",
            },
            {
              name: "Rules",
              description:
                "Per-key rules evaluated on every challenge and redeem",
            },
            {
              name: "Lists",
              description:
                "Instance-wide lists of IPs, ranges, networks, countries, user agents and visitors that rules can reference",
            },
            {
              name: "Webhooks",
              description:
                "Signed POST notifications for blocks, flags, agents and rule matches",
            },
            {
              name: "Health",
              description:
                "Liveness and Valkey readiness checks. No authentication required",
            },
          ],
          info: {
            title: "capd",
            version: pkg.version,
            description:
              "API endpoints for capd. Both Keys and Settings endpoints require an API key or session token.\n\n[Learn more](https://trycap.dev)",
          },
          securitySchemes: {
            apiKey: {
              type: "http",
            },
          },
        },
      }),
    );
  return app
    .onBeforeHandle(({ set }) => {
      set.headers["X-Powered-By"] = "capd";
    })
    .onError(({ error, code }) => {
      const serializeError = (err) =>
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack,
              ...(err.code ? { code: err.code } : {}),
              ...(err.cause ? { cause: String(err.cause) } : {}),
            }
          : err;

      if (["VALIDATION", "NOT_FOUND"].includes(code)) {
        return {
          success: false,
          error: error.code || code || "Request rejected",
        };
      }

      const errorId = uuidv7().split("-").pop();

      console.error(
        `[${error.code || "ERR"} ${errorId}]`,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          error: serializeError(error),
          env: {
            bun: process.versions.bun,
            platform: process.platform,
            mem: process.memoryUsage?.(),
          },
        }),
      );

      return {
        success: false,
        error: error.code || "Internal server error",
        detail: { id: errorId },
      };
    })
    .onRequest(async ({ request, set }) => {
      const target = corsTarget(new URL(request.url).pathname);
      if (!target) return;
      set.headers.vary = "Origin";
      const from = request.headers.get("origin");
      if (from && (target.any || (await checkCorsOrigin(target.siteKey, from))))
        set.headers["access-control-allow-origin"] = target.any ? "*" : from;
      if (request.method !== "OPTIONS") return;
      set.headers["access-control-allow-methods"] = "GET, POST";
      const asked = request.headers.get("access-control-request-headers");
      if (asked) set.headers["access-control-allow-headers"] = asked;
      set.headers["access-control-max-age"] = "600";
      return new Response(null, { status: 204, headers: set.headers });
    })
    .use(publicStatic)
    .use(healthServer)
    .get("/", ({ cookie, set }) =>
      servePage(
        cookie.cap_authed?.value === "yes" ? "index.html" : "login.html",
        set,
      ),
    )
    .use(auth)
    .use(liveServer)
    .use(server)
    .use(policyRoutes)
    .use(shareServer)
    .use(assetsServer)
    .use(capServer)
    .use(siteverifyServer);
}
