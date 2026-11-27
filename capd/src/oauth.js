import { createHash } from "node:crypto";
import { Elysia, t } from "elysia";
import { db } from "#db";
import { authBeforeHandle } from "./auth.js";
import {
  ACCESS_TTL,
  GRANT_TTL,
  randomToken,
  readJson,
  sha,
  toolLog,
  writeJson,
} from "./oauth-tokens.js";
import valkeyRateLimit from "./ratelimit.js";

const CLIENT_TTL = 90 * 86_400;
const NEW_CLIENT_TTL = 86_400;
const REQUEST_TTL = 600;
const CODE_TTL = 120;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const BLOCKED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:"]);

export const publicOrigin = (request) => {
  const u = new URL(request.url);
  const first = (h) => request.headers.get(h)?.split(",")[0].trim();
  const proto = first("x-forwarded-proto") || u.protocol.slice(0, -1);
  return `${proto}://${first("x-forwarded-host") || u.host}`;
};

const cors = { "access-control-allow-origin": "*" };

const oauthError = (set, error, description, status = 400) => {
  set.status = status;
  Object.assign(set.headers, cors, { "cache-control": "no-store" });
  return { error, error_description: description };
};

const parseUri = (value) => {
  try {
    const u = new URL(value);
    if (u.hash || BLOCKED_SCHEMES.has(u.protocol)) return null;
    if (u.protocol === "http:" && !LOOPBACK.has(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
};

const sameRedirect = (registered, given) => {
  if (registered === given) return true;
  const a = parseUri(registered);
  const b = parseUri(given);
  if (!a || !b || a.protocol !== "http:" || !LOOPBACK.has(a.hostname))
    return false;
  return (
    a.hostname === b.hostname &&
    a.pathname === b.pathname &&
    a.search === b.search
  );
};

const withParams = (uri, params) => {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  return u.toString();
};

const errorPage = (set, message) => {
  set.status = 400;
  set.headers["content-type"] = "text/plain; charset=utf-8";
  return `capd couldn't start this sign-in: ${message}`;
};

const issueTokens = async (grant, clientId) => {
  const access = `capo_${randomToken()}`;
  const refresh = `capr_${randomToken()}`;
  await writeJson(`oauth:at:${sha(access)}`, { grant: grant.id }, ACCESS_TTL);
  await writeJson(
    `oauth:rt:${sha(refresh)}`,
    { grant: grant.id, clientId },
    GRANT_TTL,
  );
  await writeJson(`oauth:grant:${grant.id}`, grant, GRANT_TTL);
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: refresh,
    scope: grant.access === "read" ? "read" : "capd",
  };
};

const take = async (key) => {
  const value = await readJson(key);
  if (!value) return null;
  return (await db.del(key)) ? value : null;
};

const sessionOnly = ({ scope, set }) => {
  if (!scope) return;
  set.status = 403;
  return {
    success: false,
    error: "Only dashboard sessions can approve or revoke app access.",
  };
};

const protectedResource = ({ request, set }) => {
  Object.assign(set.headers, cors);
  const origin = publicOrigin(request);
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["capd", "read"],
  };
};

export const oauthServer = new Elysia({ detail: { hide: true } })
  .use(valkeyRateLimit({ max: 60, duration: 60_000 }))
  .options("/oauth/*", ({ set }) => {
    Object.assign(set.headers, cors, {
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "600",
    });
    set.status = 204;
    return "";
  })
  .options("/.well-known/*", ({ set }) => {
    Object.assign(set.headers, cors, {
      "access-control-allow-methods": "GET",
      "access-control-allow-headers": "content-type, mcp-protocol-version",
    });
    set.status = 204;
    return "";
  })
  .get("/.well-known/oauth-protected-resource", protectedResource)
  .get("/.well-known/oauth-protected-resource/mcp", protectedResource)
  .get("/.well-known/oauth-authorization-server", ({ request, set }) => {
    Object.assign(set.headers, cors);
    const origin = publicOrigin(request);
    return {
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["capd", "read"],
    };
  })
  .post("/oauth/register", async ({ body, set }) => {
    const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
    if (
      !uris.length ||
      uris.length > 10 ||
      !uris.every(
        (u) => typeof u === "string" && u.length <= 500 && parseUri(u),
      )
    )
      return oauthError(
        set,
        "invalid_redirect_uri",
        "Send one to ten redirect URIs that use https, a loopback http address or an app scheme.",
      );
    const client = {
      client_id: `capc_${randomToken(16)}`,
      client_name: String(body.client_name ?? "An MCP client")
        .trim()
        .slice(0, 80),
      redirect_uris: uris,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    await writeJson(`oauth:client:${client.client_id}`, client, NEW_CLIENT_TTL);
    set.status = 201;
    Object.assign(set.headers, cors);
    return {
      ...client,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  })
  .get("/oauth/authorize", async ({ query, set, redirect }) => {
    const client = await readJson(`oauth:client:${query.client_id ?? ""}`);
    if (!client) return errorPage(set, "this app isn't registered.");
    const redirectUri = client.redirect_uris.find((u) =>
      sameRedirect(u, query.redirect_uri),
    )
      ? query.redirect_uri
      : client.redirect_uris.length === 1 && !query.redirect_uri
        ? client.redirect_uris[0]
        : null;
    if (!redirectUri)
      return errorPage(set, "the redirect address doesn't match the app.");
    const back = (error, description) =>
      redirect(
        withParams(redirectUri, {
          error,
          error_description: description,
          state: query.state,
        }),
        302,
      );
    if (query.response_type !== "code")
      return back("unsupported_response_type", "Only code is supported.");
    if (!query.code_challenge || query.code_challenge_method !== "S256")
      return back("invalid_request", "PKCE with S256 is required.");
    const id = randomToken(18);
    await writeJson(
      `oauth:req:${id}`,
      {
        clientId: client.client_id,
        clientName: client.client_name,
        redirectUri,
        challenge: String(query.code_challenge).slice(0, 128),
        state: query.state ? String(query.state).slice(0, 500) : undefined,
        readOnly: /(^|\s)read(\s|$)/.test(query.scope ?? ""),
      },
      REQUEST_TTL,
    );
    return redirect(`/#/oauth/${id}`, 302);
  })
  .post("/oauth/token", async ({ body, set }) => {
    Object.assign(set.headers, cors, { "cache-control": "no-store" });
    const b = body ?? {};
    if (b.grant_type === "authorization_code") {
      const code = await take(`oauth:code:${sha(String(b.code ?? ""))}`);
      if (!code || code.clientId !== b.client_id)
        return oauthError(
          set,
          "invalid_grant",
          "The code expired or was used.",
        );
      if (b.redirect_uri && !sameRedirect(code.redirectUri, b.redirect_uri))
        return oauthError(set, "invalid_grant", "The redirect URI changed.");
      const verifier = String(b.code_verifier ?? "");
      const computed = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      if (verifier.length < 43 || computed !== code.challenge)
        return oauthError(set, "invalid_grant", "The code verifier is wrong.");
      await db.sadd("oauth:grants", code.grant.id);
      return issueTokens(code.grant, code.clientId);
    }
    if (b.grant_type === "refresh_token") {
      const refresh = await take(
        `oauth:rt:${sha(String(b.refresh_token ?? ""))}`,
      );
      if (!refresh || (b.client_id && refresh.clientId !== b.client_id))
        return oauthError(set, "invalid_grant", "Sign in again.");
      const grant = await readJson(`oauth:grant:${refresh.grant}`);
      if (!grant)
        return oauthError(set, "invalid_grant", "Access was revoked.");
      await db.expire(`oauth:client:${refresh.clientId}`, CLIENT_TTL);
      return issueTokens(grant, refresh.clientId);
    }
    return oauthError(
      set,
      "unsupported_grant_type",
      "Use authorization_code or refresh_token.",
    );
  })
  .group("/server/oauth", (app) =>
    app
      .onBeforeHandle(authBeforeHandle)
      .onBeforeHandle(sessionOnly)
      .get("/requests/:id", async ({ params, set }) => {
        const req = await readJson(`oauth:req:${params.id}`);
        if (!req) {
          set.status = 404;
          return {
            success: false,
            error: "This sign-in request expired. Start it again from the app.",
          };
        }
        const u = new URL(req.redirectUri);
        return {
          clientName: req.clientName,
          redirectTo: u.protocol.startsWith("http") ? u.host : u.protocol,
          readOnly: req.readOnly,
        };
      })
      .post(
        "/requests/:id",
        async ({ params, body, set }) => {
          const req = await take(`oauth:req:${params.id}`);
          if (!req) {
            set.status = 404;
            return {
              success: false,
              error:
                "This sign-in request expired. Start it again from the app.",
            };
          }
          if (!body.allow)
            return {
              success: true,
              redirect: withParams(req.redirectUri, {
                error: "access_denied",
                state: req.state,
              }),
            };
          const grant = {
            id: randomToken(12),
            clientId: req.clientId,
            clientName: req.clientName,
            access: body.access === "read" ? "read" : "full",
            siteKeys: body.siteKeys?.length
              ? [...new Set(body.siteKeys)]
              : null,
            created: Date.now(),
            lastUsed: null,
          };
          await db.expire(`oauth:client:${req.clientId}`, CLIENT_TTL);
          const code = randomToken();
          await writeJson(
            `oauth:code:${sha(code)}`,
            {
              grant,
              clientId: req.clientId,
              redirectUri: req.redirectUri,
              challenge: req.challenge,
            },
            CODE_TTL,
          );
          return {
            success: true,
            redirect: withParams(req.redirectUri, { code, state: req.state }),
          };
        },
        {
          body: t.Object({
            allow: t.Boolean(),
            access: t.Optional(t.Union([t.Literal("full"), t.Literal("read")])),
            siteKeys: t.Optional(
              t.Array(t.String({ maxLength: 64 }), { maxItems: 500 }),
            ),
          }),
        },
      )
      .get("/grants", async () => {
        const ids = await db.smembers("oauth:grants");
        const grants = await Promise.all(
          ids.map((id) => readJson(`oauth:grant:${id}`)),
        );
        const gone = ids.filter((_, i) => !grants[i]);
        if (gone.length) await db.srem("oauth:grants", ...gone);
        return grants
          .filter(Boolean)
          .sort((a, b) => b.created - a.created)
          .map(({ id, clientName, access, siteKeys, created, lastUsed }) => ({
            id,
            clientName,
            access,
            siteKeys: siteKeys ?? null,
            created,
            lastUsed,
          }));
      })
      .get("/grants/:id/log", async ({ params, set }) => {
        if (!(await db.sismember("oauth:grants", params.id))) {
          set.status = 404;
          return { success: false, error: "App not found" };
        }
        return { calls: await toolLog(params.id) };
      })
      .delete("/grants/:id", async ({ params }) => {
        await db.del(`oauth:grant:${params.id}`);
        await db.del(`oauth:log:${params.id}`);
        await db.srem("oauth:grants", params.id);
        return { success: true };
      }),
  );
