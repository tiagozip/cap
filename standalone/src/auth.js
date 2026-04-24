import { randomBytes } from "node:crypto";
import { Elysia } from "elysia";
import { db } from "./db.js";
import valkeyRateLimit from "./ratelimit.js";

const { ADMIN_KEY, DEMO_MODE } = process.env;

if (DEMO_MODE !== "true") {
  if (!ADMIN_KEY) throw new Error("auth: Admin key missing. Please add one");
  if (ADMIN_KEY.length < 12)
    throw new Error(
      "auth: Admin key too short. Please use one that's at least 12 characters",
    );
  const PLAIN_ADMIN = !ADMIN_KEY.startsWith("$") || ADMIN_KEY.split("$").length != 6
  if (PLAIN_ADMIN) {
    console.warn("ADMIN_KEY seems in plain format. Consider hashing the password.")
  }
}

export const auth = new Elysia({
  prefix: "/auth",
})
  .use(
    valkeyRateLimit({
      duration: 20_000,
      max: 200, // this is intentionally permissive
    }),
  )
  .post("/login", async ({ body, set, cookie }) => {
    const { admin_key } = body;

    const hash = (v) => new Bun.CryptoHasher("sha256").update(v).digest();
    if (PLAIN_ADMIN) {
      if (!crypto.timingSafeEqual(hash(admin_key), hash(ADMIN_KEY))) {
        set.status = 401;
        return { success: false };
      }
    } else {
      if (!Bun.password.verify(admin_key, ADMIN_KEY)) {
        set.status = 401;
        return { success: false };
      }
    }

    const session_token = randomBytes(30).toString("hex");
    const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const created = Date.now();

    const hashedToken = await Bun.password.hash(session_token);
    const ttlSeconds = Math.ceil((expires - Date.now()) / 1000);

    await db.set(
      `session:${hashedToken}`,
      JSON.stringify({ created, expires }),
    );
    await db.expire(`session:${hashedToken}`, ttlSeconds);
    await db.sadd("sessions", hashedToken);

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

    const fields = await db.hmget(`apikey:${id}`, ["tokenHash"]);
    const tokenHash = fields?.[0];

    if (!tokenHash) {
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized. Deleted or non-existent bot token.",
      };
    }

    if (!(await Bun.password.verify(token, tokenHash))) {
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

  let token, hash;
  try {
    ({ token, hash } = JSON.parse(
      atob(authorization.replace("Bearer ", "").trim()),
    ));
  } catch {
    set.status = 401;
    return { success: false, error: "Unauthorized. Malformed session token." };
  }

  const sessionData = await db.get(`session:${hash}`);

  if (!sessionData) {
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized. An invalid session token was used.",
    };
  }

  const session = JSON.parse(sessionData);

  if (session.expires <= Date.now()) {
    await db.del(`session:${hash}`);
    await db.srem("sessions", hash);
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized. An invalid session token was used.",
    };
  }

  if (!(await Bun.password.verify(token, hash))) {
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized. An invalid session token was used.",
    };
  }
};
