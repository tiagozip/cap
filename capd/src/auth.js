import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { db, incrWithTtl } from "#db";
import { getClientIp } from "./events/context.js";
import { OLD_API_KEY_ERROR } from "./hash-migration.js";
import { proxyAuthPasses, proxyAuthSettings } from "./proxy-auth.js";
import valkeyRateLimit, { rateLimitBucket } from "./ratelimit.js";
import {
  isCurrentHash,
  sameHex,
  tokenId,
  verifySecret,
} from "./secret-hash.js";

const { ADMIN_KEY } = process.env;

if (!ADMIN_KEY) throw new Error("auth: Admin key missing. Please add one");
if (ADMIN_KEY.length < 12)
  throw new Error(
    "auth: Admin key too short. Please use one that's at least 12 characters",
  );
if (ADMIN_KEY.length < 32)
  console.warn(
    "[cap] ADMIN_KEY is shorter than 32 characters. Anyone who reaches the login page can guess at it, so use a longer one, for example from: openssl rand -hex 24",
  );

const LOGIN_WINDOW_MS = 10 * 60_000;
const CLIENT_FAILURES = 10;

const windowId = () => Math.floor(Date.now() / LOGIN_WINDOW_MS);

const throttled = async (scope, limit) => {
  const failures = Number(await db.get(`auth:failures:${scope}:${windowId()}`));
  if (!(failures >= limit)) return false;
  const slot = await db.send("SET", [
    `auth:login-slot:${scope}`,
    "1",
    "PX",
    "1000",
    "NX",
  ]);
  return slot !== "OK";
};

async function recordLoginFailure(client) {
  const key = `auth:failures:ip:${client}:${windowId()}`;
  await incrWithTtl(key, Math.ceil(LOGIN_WINDOW_MS / 1000) + 1);
}

export const auth = new Elysia({
  prefix: "/auth",
})
  .use(
    valkeyRateLimit({
      duration: 20_000,
      max: 200,
    }),
  )
  .post("/login", async ({ body, set, cookie, request, server: srv }) => {
    const admin_key = body?.admin_key;
    const ip = getClientIp(request, srv);
    const client = ip ? rateLimitBucket(ip) : null;

    if ((await proxyAuthSettings()).mode === "require") {
      set.status = 403;
      return {
        success: false,
        error:
          "Signing in with the admin key is turned off. Open the dashboard through your sign-in proxy.",
      };
    }

    if (client && (await throttled(`ip:${client}`, CLIENT_FAILURES))) {
      set.status = 429;
      set.headers["retry-after"] = "1";
      return {
        success: false,
        error: "Too many failed logins. Try again in a few seconds.",
      };
    }

    const hash = (v) => createHash("sha256").update(v).digest();

    if (
      typeof admin_key !== "string" ||
      !ADMIN_KEY ||
      !timingSafeEqual(hash(admin_key), hash(ADMIN_KEY))
    ) {
      if (client) await recordLoginFailure(client);
      set.status = 401;
      return { success: false };
    }

    return createSession(cookie);
  })
  .post("/proxy", async ({ set, cookie, request, server: srv }) => {
    const { mode } = await proxyAuthSettings();
    if (mode === "off") {
      set.status = 404;
      return { success: false, mode };
    }
    const ip = getClientIp(request, srv);
    const client = ip ? rateLimitBucket(ip) : null;
    if (client && (await throttled(`ip:${client}`, CLIENT_FAILURES))) {
      set.status = 429;
      set.headers["retry-after"] = "1";
      return { success: false, mode };
    }
    if (!(await proxyAuthPasses(request))) {
      if (client && request.headers.has((await proxyAuthSettings()).header))
        await recordLoginFailure(client);
      set.status = 401;
      return { success: false, mode };
    }
    return createSession(cookie);
  });

async function createSession(cookie) {
  const session_token = randomBytes(30).toString("hex");
  const created = Date.now();
  const expires = created + 30 * 24 * 60 * 60 * 1000;
  const hashedToken = tokenId(session_token);
  const ttlSeconds = Math.ceil((expires - Date.now()) / 1000);

  await db.set(`session:${hashedToken}`, JSON.stringify({ created, expires }));
  await db.expire(`session:${hashedToken}`, ttlSeconds);
  await db.sadd("sessions", hashedToken);

  cookie.cap_authed.set({
    value: "yes",
    expires: new Date(expires),
  });

  return { success: true, session_token, hashed_token: hashedToken, expires };
}

export const authBeforeHandle = async (ctx) => {
  const { set, headers } = ctx;
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

    const fields = await db.hmget(`apikey:${id}`, [
      "tokenHash",
      "siteKeys",
      "readonly",
    ]);
    const tokenHash = fields?.[0];

    if (!tokenHash) {
      set.status = 401;
      return {
        success: false,
        error: "Unauthorized. Deleted or non-existent bot token.",
      };
    }

    if (!isCurrentHash(tokenHash)) {
      set.status = 401;
      return { success: false, error: OLD_API_KEY_ERROR };
    }

    if (!verifySecret(token, tokenHash)) {
      set.status = 401;
      return { success: false, error: "Unauthorized. Invalid bot token." };
    }

    ctx.scope = {
      siteKeys: fields[1] ? JSON.parse(fields[1]) : null,
      readonly: fields[2] === "true",
    };
    return;
  }

  if (!authorization?.startsWith("Bearer ")) {
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

  if (typeof token !== "string" || !sameHex(tokenId(token), hash)) {
    set.status = 401;
    return {
      success: false,
      error: "Unauthorized. An invalid session token was used.",
    };
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

  if (
    (await proxyAuthSettings()).mode === "require" &&
    !(await proxyAuthPasses(ctx.request))
  ) {
    set.status = 401;
    return {
      success: false,
      error:
        "Unauthorized. This server only accepts dashboard sessions that come through its sign-in proxy.",
    };
  }
};
