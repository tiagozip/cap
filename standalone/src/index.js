import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { assetsServer } from "./assets.js";
import { auth } from "./auth.js";
import { capServer } from "./cap.js";
import { db } from "./db.js";
import { isDemoMode } from "./demo.js";
import { healthServer } from "./health.js";
import { loadIPDB } from "./ipdb.js";
import { loadRswKeypair, startRswRefresh } from "./rsw-store.js";
import { server } from "./server.js";
import {
  checkCorsOrigin,
  loadCorsDefault,
  loadFiltering,
  loadHeaders,
  loadRatelimit,
} from "./settings-cache.js";
import { shareServer } from "./share.js";
import { siteverifyServer } from "./siteverify.js";
import { publicStatic, servePage } from "./static.js";

const serverPort = process.env.SERVER_PORT || 3000;
const serverHostname = process.env.SERVER_HOSTNAME || "0.0.0.0";
const SHUTDOWN_TIMEOUT_MS = 8_000;

const app = new Elysia({
  serve: {
    port: serverPort,
    hostname: serverHostname,
  },
})
  .use(
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
            name: "Health",
            description:
              "Liveness and Redis readiness checks. No authentication required",
          },
        ],
        info: {
          title: "Cap Standalone",
          version: "3.0.1",
          description:
            "API endpoints for Cap Standalone. Both Keys and Settings endpoints require an API key or session token.\n\n[Learn more](https://trycap.dev)",
        },
        securitySchemes: {
          apiKey: {
            type: "http",
          },
        },
      },
    }),
  )
  .onBeforeHandle(({ set }) => {
    set.headers["X-Powered-By"] = "Cap Standalone";
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
        ...(process.env.SHOW_ERRORS === "true"
          ? { detail: serializeError(error) }
          : {}),
      };
    }

    const errorId = Bun.randomUUIDv7().split("-").pop();

    if (process.env.DISABLE_ERROR_LOGGING !== "true") {
      console.error(
        `[${error.code || "ERR"} ${errorId}]`,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          error: serializeError(error),
          env: {
            bun: process.versions.bun,
            platform: process.platform,
            mem: process.memoryUsage(),
          },
        }),
      );
    }

    return {
      success: false,
      error: error.code || "Internal server error",
      detail:
        process.env.SHOW_ERRORS === "true"
          ? serializeError(error)
          : {
              troubleshooting:
                "http://trycap.dev/guide/standalone/options.html#error-messages",
              id: errorId,
            },
    };
  })
  .use(
    cors({
      origin: (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/assets" || path.startsWith("/assets/")) return true;
        return checkCorsOrigin(request);
      },
      methods: ["GET", "POST"],
    }),
  )
  .use(publicStatic)
  .use(healthServer)
  .get("/", ({ cookie, set }) =>
    servePage(
      isDemoMode() || cookie.cap_authed?.value === "yes"
        ? "index.html"
        : "login.html",
      set,
    ),
  )
  .use(auth)
  .use(server)
  .use(shareServer)
  .use(assetsServer)
  .use(capServer)
  .use(siteverifyServer)
  .listen(serverPort);

console.log(`🧢 Cap running on http://${serverHostname}:${serverPort}`);

let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    if (shuttingDown) process.exit(1);
    shuttingDown = true;
    console.log(`🧢 ${signal} received, finishing in-flight requests`);
    setTimeout(() => {
      console.error("🧢 requests still running after 8 s, exiting anyway");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
    await app.stop();
    db.close();
    process.exit(0);
  });
}

await loadHeaders();
await loadRatelimit();
await loadCorsDefault();
await loadFiltering();
loadRswKeypair().catch((e) =>
  console.warn("[cap] RSW keypair load:", e.message),
);
startRswRefresh();
loadIPDB().catch((e) => console.warn("[cap] IP DB load:", e.message));
