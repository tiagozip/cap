import { db } from "#db";
import { stopLive } from "#live";
import { createApp, startup } from "./app.js";
import { closeEvents } from "./events/index.js";

const serverPort = process.env.SERVER_PORT || 3000;
const serverHostname = process.env.SERVER_HOSTNAME || "0.0.0.0";
const SHUTDOWN_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 1024 * 1024;

await startup();

const app = createApp({
  serve: {
    port: serverPort,
    hostname: serverHostname,
    maxRequestBodySize: MAX_BODY_BYTES,
  },
  websocket: { maxPayloadLength: 4096, idleTimeout: 60 },
}).listen(serverPort);

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
    stopLive();
    await app.stop();
    await closeEvents().catch(() => {});
    db.close();
    process.exit(0);
  });
}
