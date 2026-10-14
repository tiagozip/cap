/**
 * Request handlers for the API routes.
 *
 * `/challenge` and `/redeem` wrap capjs-core (`consumeNonce` + token storage),
 * `/siteverify` mirrors the standalone contract, and `/demo/siteverify` is the
 * same-origin shortcut used by the demo page so the browser never sees the
 * siteverify secret.
 *
 * Tenants: every challenge belongs to one tenant, `{ scope, keySuffix }`.
 * The scope is signed into the challenge JWT (capjs-core's `scope` option,
 * stored as `sk` and enforced by `validateChallenge`) and the suffix is
 * appended to the token's storage key, so tenants are isolated twice over:
 *
 *   - a challenge minted for one tenant fails `scope_mismatch` when redeemed
 *     at another tenant's `/redeem`;
 *   - even a token that somehow reached the wrong store cannot be consumed,
 *     because its storage key differs.
 *
 * The tenants are the Worker-wide production one (`SITE_TENANT`, the legacy
 * `/challenge` routes with the env secrets), the demo page (`DEMO_TENANT`) and
 * one per registered site (`siteTenant()` in `sites.js`). `/demo/siteverify`
 * therefore only ever accepts demo tokens: it cannot be used as a secret-free
 * `/siteverify` for real ones.
 */

import { randomHex, sha256Hex } from "../../core/src/crypto.js";
import { generateChallenge, validateChallenge } from "../../core/src/index.js";
import { corsHeaders } from "./cors.js";
import { shardNameForKey } from "./shards.js";
import {
  constantTimeSecretMatch,
  consumeRedeemToken,
  storageKeyFor,
} from "./siteverify.js";

export const SITE_TENANT = Object.freeze({ scope: "site", keySuffix: "" });
export const DEMO_TENANT = Object.freeze({ scope: "demo", keySuffix: "@demo" });

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function tokenStoreFor(env, key) {
  return env.TOKEN_STORE.getByName(shardNameForKey(key));
}

/** Maps capjs-core failure reasons onto standalone-style statuses/messages. */
function redeemFailure(result, headers) {
  const known = {
    invalid_body: [400, "Invalid request body"],
    missing_token: [400, "Missing challenge token"],
    missing_solutions: [400, "Missing solutions"],
    invalid_solutions: [400, "Invalid solutions"],
    expired: [403, "Challenge expired"],
    scope_mismatch: [403, "Challenge token does not match scope"],
    invalid_token: [403, "Invalid challenge token"],
    already_redeemed: [403, "Challenge already redeemed"],
    invalid_solution: [403, "Invalid solution"],
    instr_timeout: [429, "Instrumentation timeout"],
    nonce_store_error: [500, "Nonce store unavailable"],
  };
  const [status, error] = known[result.reason] ?? [
    403,
    result.instr_error ? "Blocked by instrumentation" : "Validation failed",
  ];
  return jsonResponse(
    {
      success: false,
      reason: result.reason,
      error,
      ...(result.instr_error ? { instr_error: true } : {}),
      ...(result.blockedBy ? { blockedBy: result.blockedBy } : {}),
    },
    status,
    headers,
  );
}

function challengeOptions(config, scope) {
  const instrumentation = {
    blockAutomatedBrowsers: config.blockAutomatedBrowsers,
    obfuscationLevel: config.instrumentationLevel,
  };

  if (config.protocols.length === 0) {
    return {
      scope,
      challengeCount: config.challengeCount,
      challengeSize: config.challengeSize,
      challengeDifficulty: config.challengeDifficulty,
      instrumentation,
    };
  }

  const options = {
    scope,
    format: 2,
    protocols: config.protocols,
    instrumentation,
  };
  if (config.protocols.includes("sha256-pow")) {
    options.challengeCount = config.challengeCount;
    options.challengeSize = config.challengeSize;
    options.challengeDifficulty = config.challengeDifficulty;
  }
  if (config.protocols.includes("hashwx")) {
    options.hashwxDifficulty = config.hashwxDifficulty;
    options.hashwxChallengeCount = config.hashwxChallengeCount;
  }
  return options;
}

export async function handleChallenge(
  _request,
  _env,
  config,
  origin,
  tenant = SITE_TENANT,
) {
  if (!config.capSecret) {
    return jsonResponse(
      { error: "CAP_SECRET is not configured" },
      500,
      corsHeaders(origin),
    );
  }
  const challenge = await generateChallenge(
    config.capSecret,
    challengeOptions(config, tenant.scope),
  );
  return jsonResponse(challenge, 200, corsHeaders(origin));
}

export async function handleRedeem(
  request,
  env,
  config,
  origin,
  tenant = SITE_TENANT,
) {
  const headers = corsHeaders(origin);
  if (!config.capSecret) {
    return jsonResponse(
      { success: false, error: "CAP_SECRET is not configured" },
      500,
      headers,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        success: false,
        reason: "invalid_body",
        error: "Invalid request body",
      },
      400,
      headers,
    );
  }

  // `consumeNonce` both claims the challenge signature and stores the token
  // secret in the same row (one write instead of two). The token the client
  // receives is `<signature>:<secret>`, so verification can find that row again
  // from the token alone.
  let minted = null;
  const result = await validateChallenge(config.capSecret, body, {
    scope: tenant.scope,
    consumeNonce: async (sigHex, ttlMs) => {
      const verToken = randomHex(15);
      const ttlMs_ = Math.max(ttlMs, config.tokenTtlMs);
      const key = storageKeyFor(sigHex, tenant.keySuffix);
      const claimed = await tokenStoreFor(env, key).consumeNonce(
        key,
        ttlMs_,
        sha256Hex(verToken),
      );
      if (claimed) {
        minted = { token: `${sigHex}:${verToken}`, expires: Date.now() + ttlMs_ };
      }
      return claimed;
    },
    signToken: () => minted?.token,
    tokenTtlMs: config.tokenTtlMs,
  });

  if (!result.success) {
    if (result.reason === "nonce_store_error") {
      // The client only gets the generic message; the cause stays in the logs.
      console.error("[priestess-verification] nonce store error", result.error);
    }
    return redeemFailure(result, headers);
  }

  return jsonResponse(
    { success: true, token: result.token, expires: minted.expires },
    200,
    headers,
  );
}

async function consumeForTenant(response, env, keySuffix) {
  return consumeRedeemToken(
    response,
    (key, secretHash) => tokenStoreFor(env, key).consumeToken(key, secretHash),
    keySuffix,
  );
}

/** `/siteverify`: the Worker-wide tenant, checked against `SITEVERIFY_SECRET`. */
export async function handleSiteverify(request, env, config) {
  if (!config.siteverifySecret) {
    return jsonResponse(
      { success: false, error: "Siteverify is not configured" },
      500,
    );
  }
  return verifyWithSecret(
    request,
    env,
    (secret) => constantTimeSecretMatch(secret, config.siteverifySecret),
    SITE_TENANT.keySuffix,
  );
}

/**
 * `/<siteKey>/siteverify`: a registered site's tokens, checked against the
 * sha256 of that site's secret (`site.secretHash`).
 */
export async function handleSiteSiteverify(request, env, site, keySuffix) {
  return verifyWithSecret(
    request,
    env,
    (secret) =>
      constantTimeSecretMatch(sha256Hex(String(secret)), site.secretHash),
    keySuffix,
  );
}

async function verifyWithSecret(request, env, secretMatches, keySuffix) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { success: false, error: "Missing required parameters" },
      400,
    );
  }
  if (!body || typeof body !== "object") {
    return jsonResponse(
      { success: false, error: "Missing required parameters" },
      400,
    );
  }

  const { secret, response } = body;
  if (!secret || !response) {
    return jsonResponse(
      { success: false, error: "Missing required parameters" },
      400,
    );
  }

  if (!secretMatches(secret)) {
    return jsonResponse({ success: false, error: "Invalid secret" }, 403);
  }

  const result = await consumeForTenant(response, env, keySuffix);
  if (!result.ok) {
    return jsonResponse({ success: false, error: result.error }, result.status);
  }
  return jsonResponse({ success: true }, 200);
}

/**
 * Same-origin-only verification used by the demo page. It never accepts a
 * secret from the caller. Only demo-scoped tokens are stored under the
 * `@demo` suffix, so a production token is never accepted here.
 */
export async function handleDemoSiteverify(request, env, config) {
  if (!isSameOriginRequest(request)) {
    return jsonResponse({ success: false, error: "Forbidden" }, 403);
  }
  if (!config.siteverifySecret) {
    return jsonResponse(
      { success: false, error: "Siteverify is not configured" },
      500,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const token = body?.response;
  if (!token) {
    return jsonResponse(
      { success: false, error: "Missing required parameters" },
      400,
    );
  }

  const result = await consumeForTenant(token, env, DEMO_TENANT.keySuffix);
  if (!result.ok) {
    return jsonResponse({ success: false, error: result.error }, result.status);
  }
  return jsonResponse({ success: true }, 200);
}

export function isSameOriginRequest(request) {
  let selfOrigin;
  try {
    selfOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  const origin = request.headers.get("Origin");
  if (origin) return origin === selfOrigin;
  // `Sec-Fetch-Site` is a browser-set header; "none" means the user typed the
  // URL into the address bar, which is not a same-origin XHR and must not be
  // accepted for a JSON POST endpoint.
  return request.headers.get("Sec-Fetch-Site") === "same-origin";
}
