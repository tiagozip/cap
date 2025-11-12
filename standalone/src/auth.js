import { randomBytes, timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";
import { db } from "./db.js";
import { ratelimitGenerator } from "./ratelimit.js";

const { ADMIN_KEY } = process.env;

if (!ADMIN_KEY) throw new Error("auth: Admin key missing. Please add one");
if (ADMIN_KEY.length < 30)
  throw new Error(
    "auth: Admin key too short. Please use one that's at least 30 characters"
  );

export const auth = new Elysia({
  prefix: "/auth",
})
  .use(
    rateLimit({
      duration: 30_000,
      max: 20_000,
      scoping: "scoped",
      generator: ratelimitGenerator,
    })
  )
  .post("/login", async ({ body, set, cookie }) => {
    const { admin_key } = body;

    const a = Buffer.from(admin_key, "utf8");
    const b = Buffer.from(ADMIN_KEY, "utf8");

    if (!a || !b || a.length !== b.length) {
      set.status = 401;
      return { success: false };
    }

    if (!timingSafeEqual(a, b)) {
      set.status = 401;
      return { success: false };
    }

    if (admin_key !== ADMIN_KEY) {
      // as a last check, in case an attacker somehow bypasses
      // timingSafeEqual, we're checking AGAIN to see if the tokens
      // are right.

      // yes, this is vulnerable to timing attacks, but those are
      // hard to execute and literally just accepting an invalid token
      // is worse.

      set.status = 401;
      return { success: false };
    }

    const session_token = randomBytes(30).toString("hex");
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const created = Date.now();

    const hashedToken = await Bun.password.hash(session_token);

    await db`
      INSERT INTO sessions (token, created, expires)
      VALUES (${hashedToken}, ${created}, ${expires})
    `;

    cookie.cap_authed.set({
      value: "yes",
      expires: new Date(expires),
    });

    return { success: true, session_token, hashed_token: hashedToken, expires };
  });

export const authBeforeHandle = async ({ set, headers }) => {
  const { authorization } = headers;

  set.headers["X-Content-Type-Options"] = "nosniff";
  set.headers["X-Frame-Options"] = "DENY";
  set.headers["X-XSS-Protection"] = "1; mode=block";

  if (authorization?.startsWith("Bot ")) {
    const botToken = authorization.replace("Bot ", "").trim();
    const [id, token] = botToken.split("_");

    if (!id || !token) {
      set.status = 401;
      return { success: false, error: "Unauthorized. Invalid bot token." };
    }

    const apiKey = await db`SELECT * FROM api_keys WHERE id = ${id}`.then(
      (rows) => rows[0]
    );

    if (!apiKey || !apiKey.tokenHash) {
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized. Deleted or non-existent bot token.",
      };
    }

    if (!(await Bun.password.verify(token, apiKey.tokenHash))) {
      set.status = 401;
      return { success: false, error: "Unauthorized. Invalid bot token." };
    }

    return;
  }

  if (!authorization || !authorization.startsWith("Bearer ")) {
    set.status = 401;
    return {
      success: false,
      error:
        "Unauthorized. An API key or session token is required to use this endpoint.",
    };
  }

  const { token, hash } = JSON.parse(
    atob(authorization.replace("Bearer ", "").trim())
  );

  const [validToken] = await db`
    SELECT * FROM sessions WHERE token = ${hash} AND expires > ${Date.now()} LIMIT 1
  `;

  if (!validToken) {
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized. An invalid session token was used.",
    };
  }

  if (!(await Bun.password.verify(token, validToken.token))) {
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized. An invalid session token was used.",
    };
  }
};
