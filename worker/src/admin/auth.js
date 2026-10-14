/**
 * Admin console sign-in through Priestess (the Phainon Worker's native
 * login-code flow), with every token exchange done server-side:
 *
 *   1. `GET /admin/login` mints `state` + a PKCE verifier, keeps both in a
 *      signed, short-lived `__Host-pv_oauth` cookie and redirects to
 *      `<PRIESTESS_API_BASE>/login`.
 *   2. Priestess sends the browser back to `/admin/callback#login_code=…&state=…`.
 *      The fragment never reaches a server, so the callback page posts it to
 *      `POST /admin/api/session`.
 *   3. That route checks `state` against the cookie, exchanges the code with
 *      the verifier, reads `/me`, immediately revokes the Priestess refresh
 *      token (the Worker keeps no Priestess token) and requires the user's
 *      `sub` to be in `ADMIN_ALLOWED_SUBS`.
 *   4. The browser gets the Worker's own session cookie, `__Host-pv_admin`
 *      (HttpOnly, Secure, SameSite=Strict, 8 hours). Only its sha256 is
 *      stored, in the `SiteRegistry`.
 *
 * Revoking someone in Priestess does not end a session that already exists;
 * it expires on its own within `SESSION_TTL_MS`.
 */

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { registryFor } from "../site-registry.js";

export const OAUTH_COOKIE = "__Host-pv_oauth";
export const SESSION_COOKIE = "__Host-pv_admin";
export const OAUTH_TTL_MS = 10 * 60_000;
export const SESSION_TTL_MS = 8 * 60 * 60_000;
const PRIESTESS_TIMEOUT_MS = 10_000;

export function callbackUrl(requestUrl) {
  return new URL("/admin/callback", requestUrl).toString();
}

export function parseCookies(request) {
  const cookies = new Map();
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    cookies.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
  }
  return cookies;
}

function cookie(name, value, maxAgeSeconds, sameSite) {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=${sameSite}`;
}

export function clearCookie(name, sameSite = "Lax") {
  return cookie(name, "", 0, sameSite);
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function oauthMac(capSecret, payload) {
  return createHmac("sha256", capSecret)
    .update(`pv-admin-oauth\n${payload}`, "utf8")
    .digest("base64url");
}

/** `{ state, verifier, exp }` -> signed cookie value. */
export function sealOauthState(capSecret, value) {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  return `${payload}.${oauthMac(capSecret, payload)}`;
}

/** Signed cookie value -> `{ state, verifier, exp }`, or `null`. */
export function openOauthState(capSecret, sealed, now = Date.now()) {
  if (typeof sealed !== "string") return null;
  const [payload, mac, extra] = sealed.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const expected = Buffer.from(oauthMac(capSecret, payload));
  const provided = Buffer.from(mac);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return null;
  }
  let value;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof value?.state !== "string" ||
    typeof value?.verifier !== "string" ||
    !(Number(value?.exp) > now)
  ) {
    return null;
  }
  return value;
}

function pkceChallenge(verifier) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** `GET /admin/login`: redirect to Priestess with state + S256 PKCE. */
export function handleAdminLogin(request, adminConfig, capSecret) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const sealed = sealOauthState(capSecret, {
    state,
    verifier,
    exp: Date.now() + OAUTH_TTL_MS,
  });

  const login = new URL(`${adminConfig.apiBase}/login`);
  login.searchParams.set("app_id", adminConfig.appId);
  login.searchParams.set("return_to", callbackUrl(request.url));
  login.searchParams.set("state", state);
  login.searchParams.set("code_challenge", pkceChallenge(verifier));
  login.searchParams.set("code_challenge_method", "S256");

  return new Response(null, {
    status: 302,
    headers: {
      Location: login.toString(),
      "Cache-Control": "no-store",
      // Lax: the callback is a top-level navigation coming back from the
      // Priestess login page.
      "Set-Cookie": cookie(
        OAUTH_COOKIE,
        sealed,
        Math.floor(OAUTH_TTL_MS / 1000),
        "Lax",
      ),
    },
  });
}

class SignInError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function priestessJson(url, init) {
  let res;
  try {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(PRIESTESS_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[priestess-verification] priestess unreachable", error);
    throw new SignInError(502, "priestess_unreachable");
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // handled below
  }
  if (!res.ok) {
    const code =
      typeof body?.error?.code === "string"
        ? body.error.code
        : "priestess_error";
    throw new SignInError(res.status === 403 ? 403 : 401, code);
  }
  if (!body || typeof body !== "object") {
    throw new SignInError(502, "priestess_error");
  }
  return body;
}

function jsonHeaders(extra = {}) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra,
  };
}

function profileOf(user) {
  const name =
    [user.name, user.preferred_username, user.email, user.sub].find(
      (value) => typeof value === "string" && value.length > 0,
    ) ?? "";
  return {
    name: name.slice(0, 120),
    email: typeof user.email === "string" ? user.email.slice(0, 200) : null,
  };
}

/**
 * `POST /admin/api/session` `{ login_code, state }`: finishes the sign-in.
 * The oauth cookie is single use: every answer clears it.
 */
export async function handleAdminSession(request, env, adminConfig, capSecret) {
  const clear = clearCookie(OAUTH_COOKIE);
  const fail = (status, code) =>
    new Response(JSON.stringify({ ok: false, error: code }), {
      status,
      headers: jsonHeaders({ "Set-Cookie": clear }),
    });

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_body");
  }
  const loginCode = body?.login_code;
  const state = body?.state;
  if (typeof loginCode !== "string" || !loginCode || loginCode.length > 512) {
    return fail(400, "missing_login_code");
  }

  const sealed = openOauthState(
    capSecret,
    parseCookies(request).get(OAUTH_COOKIE),
  );
  if (
    !sealed ||
    typeof state !== "string" ||
    state.length !== sealed.state.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(sealed.state))
  ) {
    return fail(400, "invalid_state");
  }

  let user;
  try {
    const tokens = await priestessJson(`${adminConfig.apiBase}/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login_code: loginCode,
        code_verifier: sealed.verifier,
      }),
    });
    if (typeof tokens.access_token !== "string") {
      throw new SignInError(502, "priestess_error");
    }
    try {
      const me = await priestessJson(`${adminConfig.apiBase}/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (me.app_id !== adminConfig.appId || typeof me.user?.sub !== "string") {
        throw new SignInError(403, "wrong_app");
      }
      user = me.user;
    } finally {
      // The Worker never keeps a Priestess session around.
      if (typeof tokens.refresh_token === "string") {
        await fetch(`${adminConfig.apiBase}/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: tokens.refresh_token }),
          signal: AbortSignal.timeout(PRIESTESS_TIMEOUT_MS),
        }).catch(() => {});
      }
    }
  } catch (error) {
    if (error instanceof SignInError) return fail(error.status, error.code);
    throw error;
  }

  if (!adminConfig.allowedSubs.has(user.sub)) {
    return fail(403, "not_an_admin");
  }

  const sessionId = randomBytes(32).toString("hex");
  const profile = profileOf(user);
  await registryFor(env).createSession(
    sha256Hex(sessionId),
    user.sub,
    profile,
    Date.now() + SESSION_TTL_MS,
  );

  const headers = new Headers(jsonHeaders());
  headers.append("Set-Cookie", clear);
  headers.append(
    "Set-Cookie",
    cookie(
      SESSION_COOKIE,
      sessionId,
      Math.floor(SESSION_TTL_MS / 1000),
      "Strict",
    ),
  );
  return new Response(JSON.stringify({ ok: true, user: profile }), {
    status: 200,
    headers,
  });
}

function sessionIdHash(request) {
  const id = parseCookies(request).get(SESSION_COOKIE);
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return null;
  return sha256Hex(id);
}

/** The admin session behind the request's cookie, or `null`. */
export async function readAdminSession(request, env, adminConfig) {
  const idHash = sessionIdHash(request);
  if (!idHash) return null;
  const session = await registryFor(env).getSession(idHash);
  // A sub removed from ADMIN_ALLOWED_SUBS loses access on the next deploy,
  // even with a live session.
  if (!session || !adminConfig.allowedSubs.has(session.sub)) return null;
  return session;
}

/** `POST /admin/api/logout`. */
export async function handleAdminLogout(request, env) {
  const idHash = sessionIdHash(request);
  if (idHash) await registryFor(env).deleteSession(idHash);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders({
      "Set-Cookie": clearCookie(SESSION_COOKIE, "Strict"),
    }),
  });
}
