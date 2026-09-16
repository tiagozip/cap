import { Elysia } from "elysia";

import { db } from "./db.js";
import { hashSecret, verifySecret } from "./secret-hash.js";

export const siteverifyServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
}).post("/:siteKey?/siteverify", async ({ body, set, params }) => {
  const sitekeyraw = params.siteKey || false;
  const { secret, response } = body;
  let sitekey = false;
  if (response.split(":").length !== 3) {
    set.status = 400;
    return { success: false, error: "Missing required parameters" };
  }
  if (sitekeyraw) {
    sitekey = sitekeyraw;
  } else {
    sitekey = response.split(":")[0];
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

  const { valid, legacy } = await verifySecret(secret, secretHash);

  if (!valid) {
    set.status = 403;
    return { success: false, error: "Invalid site key or secret" };
  }

  // Upgrade legacy password-KDF hashes to SHA-256
  if (legacy) {
    await db.hset(`key:${sitekey}`, "secretHash", hashSecret(secret));
  }

  const tokenKey = `token:${response}`;
  const expires = await db.getdel(tokenKey);

  if (!expires) {
    set.status = 404;
    return { success: false, error: "Token not found" };
  }

  if (Number(expires) < Date.now()) {
    set.status = 403;
    return { success: false, error: "Token expired" };
  }

  return { success: true };
});
