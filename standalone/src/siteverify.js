import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { db } from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

export const siteverifyServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
})
  .use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") || true,
      methods: ["POST"],
    }),
  )
  .post("/:siteKey/siteverify", async ({ body, set, params, request, server }) => {
    const ip = ratelimitGenerator(request, server);
    const now = Date.now();

    if (ip) {
      const [ban] = await db`SELECT * FROM ip_bans WHERE ip = ${ip} AND expires > ${now}`;
      if (ban) {
        const retryAfter = Math.ceil((ban.expires - now) / 1000);
        set.status = 429;
        set.headers["Retry-After"] = retryAfter.toString();
        set.headers["X-RateLimit-Limit"] = "1";
        set.headers["X-RateLimit-Remaining"] = "0";
        set.headers["X-RateLimit-Reset"] = Math.ceil(ban.expires / 1000).toString();
        return {
          success: false,
          error:
            "You were temporarily blocked for using an invalid secret key. Please try again later.",
        };
      }
    }

    const sitekey = params.siteKey;
    const { secret, response } = body;

    if (!sitekey || !secret || !response) {
      set.status = 400;
      return { success: false, error: "Missing required parameters" };
    }

    const [keyData] = await db`SELECT * FROM keys WHERE siteKey = ${sitekey}`;
    const keyHash = keyData?.secretHash;
    if (!keyHash || !secret) {
      set.status = 404;
      return { success: false, error: "Invalid site key or secret" };
    }

    const isValidSecret = await Bun.password.verify(secret, keyHash);

    if (!isValidSecret) {
      if (ip) {
        const banExpires = now + 1_000;
        await db`
					INSERT INTO ip_bans (ip, reason, expires)
					VALUES (${ip}, ${"invalid_secret"}, ${banExpires})
					ON CONFLICT (ip)
					DO UPDATE SET reason = ${"invalid_secret"}, expires = ${banExpires}
				`;
      }
      set.status = 403;
      return { success: false, error: "Invalid site key or secret" };
    }

    const [token] =
      await db`DELETE FROM tokens WHERE siteKey = ${params.siteKey} AND token = ${response} RETURNING *`;

    if (!token) {
      set.status = 404;
      return { success: false, error: "Token not found" };
    }

    if (token.expires < Date.now()) {
      set.status = 403;
      return { success: false, error: "Token expired" };
    }

    return { success: true };
  });
