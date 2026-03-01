import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { db } from "./db.js";

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
  .post("/:siteKey/siteverify", async ({ body, set, params }) => {
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
