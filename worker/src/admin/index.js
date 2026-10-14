/**
 * `/admin` router.
 *
 *   GET  /admin                 console page (sign-in panel or site list)
 *   GET  /admin/login           start the Priestess sign-in (302)
 *   GET  /admin/callback        Priestess return page (posts the login code)
 *   POST /admin/api/session     finish sign-in        (no session needed)
 *   POST /admin/api/logout
 *   GET  /admin/api/me          current admin          (session)
 *   *    /admin/api/sites…      site management        (session, see api.js)
 *
 * Every response is `no-store`, unframeable and sent with a strict CSP; the
 * pages get a per-request nonce for their inline styles and scripts. Every
 * non-GET API call must come from this origin with a JSON body: the session
 * cookie is SameSite=Strict already, and the `Content-Type` requirement means
 * a cross-origin page cannot even send the request without a preflight, which
 * this router never answers.
 */

import { randomBytes } from "node:crypto";
import { readAdminConfig } from "../config.js";
import { isSameOriginRequest } from "../handlers.js";
import { ASSET_PATHS, versionedPath } from "../widget.js";
import { handleSitesApi } from "./api.js";
import {
  handleAdminLogin,
  handleAdminLogout,
  handleAdminSession,
  readAdminSession,
} from "./auth.js";
import { renderAdminPage, renderCallbackPage } from "./page.js";

function securityHeaders(nonce) {
  const scriptSrc = nonce ? `'self' 'nonce-${nonce}'` : "'none'";
  const styleSrc = nonce ? `'nonce-${nonce}'` : "'none'";
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      // The ripple runtime positions its ink with inline style attributes.
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function withHeaders(response, nonce = null) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(nonce))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function html(body) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function isJsonRequest(request) {
  return (request.headers.get("Content-Type") ?? "")
    .toLowerCase()
    .startsWith("application/json");
}

let rippleUrl = null;

export function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export async function handleAdmin(request, env, config, url) {
  const { pathname } = url;
  const method = request.method;
  const adminConfig = readAdminConfig(env);

  if (pathname === "/admin" || pathname === "/admin/") {
    if (method !== "GET")
      return withHeaders(json({ error: "method not allowed" }, 405));
    const nonce = randomBytes(16).toString("base64");
    rippleUrl ??= versionedPath(ASSET_PATHS.ripple);
    return withHeaders(
      html(renderAdminPage({ nonce, ripple: rippleUrl })),
      nonce,
    );
  }

  if (pathname === "/admin/callback" && method === "GET") {
    const nonce = randomBytes(16).toString("base64");
    return withHeaders(html(renderCallbackPage({ nonce })), nonce);
  }

  if (pathname === "/admin/login" && method === "GET") {
    if (!config.capSecret) {
      return withHeaders(json({ error: "CAP_SECRET is not configured" }, 500));
    }
    return withHeaders(
      handleAdminLogin(request, adminConfig, config.capSecret),
    );
  }

  if (!pathname.startsWith("/admin/api/")) {
    return withHeaders(json({ error: "not found" }, 404));
  }

  if (method !== "GET") {
    if (!isSameOriginRequest(request) || !isJsonRequest(request)) {
      return withHeaders(json({ error: "forbidden" }, 403));
    }
  }

  if (pathname === "/admin/api/session" && method === "POST") {
    if (!config.capSecret) {
      return withHeaders(json({ error: "CAP_SECRET is not configured" }, 500));
    }
    return withHeaders(
      await handleAdminSession(request, env, adminConfig, config.capSecret),
    );
  }

  if (pathname === "/admin/api/logout" && method === "POST") {
    return withHeaders(await handleAdminLogout(request, env));
  }

  const session = await readAdminSession(request, env, adminConfig);
  if (!session) {
    return withHeaders(json({ error: "unauthenticated" }, 401));
  }

  if (pathname === "/admin/api/me" && method === "GET") {
    return withHeaders(
      json({ user: { ...session.profile, sub: session.sub } }, 200),
    );
  }

  if (
    pathname === "/admin/api/sites" ||
    pathname.startsWith("/admin/api/sites/")
  ) {
    const response = await handleSitesApi(request, env, pathname);
    if (response) return withHeaders(response);
  }

  return withHeaders(json({ error: "not found" }, 404));
}
