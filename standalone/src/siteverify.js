import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { db } from "./db.js";
import { checkCorsOrigin } from "./settings-cache.js";

function hourlyBucket() {
  return String(Math.floor(Date.now() / 1000 / 3600) * 3600);
}

export const siteverifyServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
})
  .use(
    cors({
      origin: checkCorsOrigin,
      methods: ["POST"],
    }),
  )
  .post("/:siteKey?/siteverify", async ({ body, set, params }) => {
    const sitekeyraw = params.siteKey || false;
    const { secret, response } = body;
    let sitekey = false;
    if (response.split(":").length != 3) {
      set.status = 400;
      return { success: false, error: "Missing required parameters" };
    }
    if (sitekeyraw) {
      sitekey = sitekeyraw; //Overwrite if given as a parameter
    } else {
      sitekey = response.split(":")[0]
    }
    if (sitekeyraw && !response.startsWith(sitekeyraw)) {
      set.status = 404;
      return { success: false, error: "Invalid site key or secret" };
    }
    if (!secret || !response) {
      set.status = 400;
      return { success: false, error: "Missing required parameters" };
    }

    const secretHash = await db.hget(`key:${sitekey}`, "secretHash");

    if (!secretHash || !secret) {
      set.status = 404;
      return { success: false, error: "Invalid site key or secret" };
    }

    const isValidSecret = await Bun.password.verify(secret, secretHash);

    if (!isValidSecret) {
      set.status = 403;
      return { success: false, error: "Invalid site key or secret" };
    }

    const tokenKey = `token:${response}`;
    const expires = await db.getdel(tokenKey);

    if (!expires) {
      set.status = 404;
      await db.hincrby(`metrics:failed:${sitekey}`, hourlyBucket(), 1);
      return { success: false, error: "Token not found" };
    }

    if (Number(expires) < Date.now()) {
      set.status = 403;
      await db.hincrby(`metrics:failed:${sitekey}`, hourlyBucket(), 1);
      return { success: false, error: "Token expired" };
    }

    await db.hincrby(`metrics:verified:${sitekey}`, hourlyBucket(), 1);
    return { success: true };
  });
