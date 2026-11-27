import { setHashwxModule } from "capjs-core";
import hashwxModule from "capjs-core/hashwx.wasm";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { createApp, loadSettingsCaches, startup } from "../app.js";
import { refreshAssets } from "../assets.js";
import { getClientIp } from "../events/context.js";
import { pruneEvents } from "../events/index.js";
import { rateLimitBucket } from "../ratelimit.js";
import { sendUpdateCheck } from "../update-check.js";
import { sweep } from "./db.js";
import { liveUnavailable } from "./live.js";

setHashwxModule(hashwxModule);

const SETTINGS_TTL_MS = 10_000;
const app = createApp(
  { adapter: CloudflareAdapter },
  { docs: false },
).compile();
let started = false;
let settingsAt = 0;

export default {
  async fetch(request, env, ctx) {
    const live = liveUnavailable(request);
    if (live) return live;
    if (!started) {
      await startup();
      started = true;
      settingsAt = Date.now();
    } else if (Date.now() - settingsAt > SETTINGS_TTL_MS) {
      settingsAt = Date.now();
      ctx.waitUntil(loadSettingsCaches().catch(() => {}));
    }
    const ip = getClientIp(request);
    const limiter = new URL(request.url).pathname.endsWith("/siteverify")
      ? env.SITEVERIFY_LIMIT
      : env.EDGE_LIMIT;
    if (ip && limiter) {
      const { success } = await limiter.limit({
        key: rateLimitBucket(ip),
      });
      if (!success)
        return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
    return app.fetch(request);
  },
  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil(
      Promise.allSettled([
        sweep(),
        (started
          ? Promise.resolve()
          : startup().then(() => {
              started = true;
            })
        ).then(() =>
          Promise.all([pruneEvents(), refreshAssets(), sendUpdateCheck()]),
        ),
      ]),
    );
  },
};
