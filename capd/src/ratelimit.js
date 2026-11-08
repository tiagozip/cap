import { isIP } from "node:net";
import { Elysia } from "elysia";
import { incrWithTtl } from "#db";
import { getClientIp } from "./events/context.js";
import { embeddedIpv4 } from "./policy/address.js";
import { ipv6ToBytes } from "./policy/ip.js";

let scopeCounter = 0;

export function rateLimitBucket(ip) {
  const address = String(ip).split("%")[0];
  if (isIP(address) !== 6) return ip;
  const v4 = embeddedIpv4(address);
  if (v4) return v4;
  const bytes = ipv6ToBytes(address.toLowerCase());
  const groups = [0, 2, 4, 6].map((i) =>
    ((bytes[i] << 8) | bytes[i + 1]).toString(16),
  );
  return `${groups.join(":")}::/64`;
}

let warnedNoIp = false;

const generator = (req, server) => {
  const ip = getClientIp(req, server);
  if (ip) return rateLimitBucket(ip);
  if (!warnedNoIp) {
    warnedNoIp = true;
    console.warn(
      "[ratelimit] Couldn't find the client IP of a request, so it isn't rate limited. Cap logs this once.",
    );
  }
  return "";
};

export default function valkeyRateLimit({
  max: defaultMax = 30,
  duration: defaultDuration = 5000,
  getLimits,
  onLimited,
} = {}) {
  const scope = scopeCounter++;

  return new Elysia({
    name: `cap-ratelimit-${scope}`,
  })
    .onBeforeHandle(async ({ request, set, server: srv, params }) => {
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

      const count = await incrWithTtl(key, windowSecs + 1);

      set.headers["X-RateLimit-Limit"] = String(max);
      set.headers["X-RateLimit-Remaining"] = String(Math.max(0, max - count));

      if (count > max) {
        if (onLimited) {
          try {
            await onLimited(request, ip, srv);
          } catch {}
        }
        set.status = 429;
        return { error: "Rate limit exceeded" };
      }
    })
    .as("scoped");
}
