import { Elysia } from "elysia";
import { db } from "./db.js";
import { getHeaders } from "./settings-cache.js";

let scopeCounter = 0;

const DEFAULT_IP_HEADERS = ["X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP"];

const generator = (req, server) => {
  const cachedHeaders = getHeaders();
  const headerFromSettings = cachedHeaders?.ipHeader;
  const headerName = headerFromSettings || process.env.RATELIMIT_IP_HEADER;
  if (headerName) {
    const header = headerName;
    const ip = req.headers.get(header) || req.headers.get(header.toLowerCase());

    if (ip) {
      const parts = ip.split(",").filter((e) => !!e.trim());
      return parts[0].trim();
    }

    console.error(
      `⚠️  [ratelimit] Unable to find the IP in the header "${header}". Make sure to set the RATELIMIT_IP_HEADER env variable \n   to a header which returns the user's IP.`,
    );
    return "";
  }

  for (const h of DEFAULT_IP_HEADERS) {
    const val = req.headers.get(h);
    if (val) {
      const parts = val.split(",").filter((e) => !!e.trim());
      return parts[0].trim();
    }
  }

  const ip = server?.requestIP(req)?.address;

  if (!server || !req || !ip) {
    if (process.env.HIDE_RATELIMIT_IP_WARNING !== "true") {
      console.warn(
        `⚠️  [ratelimit] Unable to determine client IP, rate limiting disabled. If you're running locally, it should be safe \n   to ignore this warning. Otherwise, make sure to set the RATELIMIT_IP_HEADER env variable to a header \n   which returns the user's IP. Hide this warning with env.HIDE_RATELIMIT_IP_WARNING=true`,
      );
    }

    return "";
  }

  return ip ?? "";
};

export default function valkeyRateLimit({
  max: defaultMax = 30,
  duration: defaultDuration = 5000,
  getLimits,
  onLimited,
} = {}) {
  const scope = scopeCounter++;

  return new Elysia({ name: `cap-ratelimit-${scope}`, scoped: true }).onBeforeHandle(
    async ({ request, set, server: srv, params }) => {
      const ip = generator(request, srv);
      if (!ip) return;

      let max = defaultMax;
      let duration = defaultDuration;

      if (getLimits) {
        const limits = await getLimits(params);
        if (limits) {
          max = limits.max;
          duration = limits.duration;
        }
      }

      const windowMs = duration;
      const windowSecs = Math.ceil(duration / 1000);
      const window = Math.floor(Date.now() / windowMs);
      const key = `rl:${scope}:${ip}:${windowMs}:${window}`;

      const count = await db.incr(key);
      if (count === 1) {
        await db.expire(key, windowSecs + 1);
      }

      set.headers["X-RateLimit-Limit"] = String(max);
      set.headers["X-RateLimit-Remaining"] = String(Math.max(0, max - count));

      if (count > max) {
        if (onLimited) {
          try { await onLimited(request, ip); } catch { }
        }
        set.status = 429;
        return { error: "Rate limit exceeded" };
      }
    },
  );
}
