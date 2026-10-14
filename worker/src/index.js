/**
 * Priestess Verification on Cloudflare Workers — router for verify.rakko.cn.
 *
 * Routes:
 *   GET  /                    showcase page (seven widget variants + same-origin verify)
 *   GET  /widget.js           the repo's widget/src/cap.min.js, byte for byte
 *   GET  /widget-floating.js  the repo's widget/src/cap-floating.min.js
 *   GET  /cap_wasm_bg.wasm    the repo's PoW wasm (window.CAP_CUSTOM_WASM_URL)
 *   GET  /hashwx.wasm         the repo's hashwx wasm (window.CAP_CUSTOM_HASHWX_URL)
 *   GET  /pako_inflate.min.js pako@2.1.0 (window.CAP_PAKO_URL)
 *   GET  /mascot/checking.webp  data-cap-mascot art, served from this origin
 *   GET  /mascot/error.webp     (the widget's default <script dir>/mascot/ base)
 *   GET  /mascot/done.webp
 *   GET  /design/ripple.js    Rakko Design ripple runtime for the demo page
 *   GET  /design/ripple-geometry.js
 *   POST /challenge           challenge generation        (scope "site", CORS)
 *   POST /redeem              challenge redemption        (scope "site", CORS)
 *   POST /siteverify          server-to-server validation (no CORS)
 *   POST /demo/challenge      challenge generation        (scope "demo", CORS)
 *   POST /demo/redeem         challenge redemption        (scope "demo", CORS)
 *   POST /demo/siteverify     same-origin-only validation for the demo page,
 *                             accepts demo-scoped tokens only
 *   POST /<siteKey>/challenge   a registered site's challenge (site scope, site origins)
 *   POST /<siteKey>/redeem      a registered site's redemption
 *   POST /<siteKey>/siteverify  a registered site's validation (site secret, no CORS)
 *   *    /admin…               admin console, Priestess sign-in (see admin/index.js)
 */

import { setHashwxModule } from "../../core/src/index.js";
import hashwxWasmModule from "../../core/vendor/hashwx.wasm";
import { handleAdmin, isAdminPath } from "./admin/index.js";
import { readConfig } from "./config.js";
import { corsHeaders, preflightHeaders, resolveAllowedOrigin } from "./cors.js";
import { renderDemoPage } from "./demo-page.js";
import {
  DEMO_TENANT,
  SITE_TENANT,
  handleChallenge,
  handleDemoSiteverify,
  handleRedeem,
  handleSiteSiteverify,
  handleSiteverify,
  jsonResponse,
} from "./handlers.js";
import { registryFor } from "./site-registry.js";
import { loadSite, parseSitePath, siteConfig, siteTenant } from "./sites.js";
import {
  ASSET_PATHS,
  isWidgetPath,
  versionedPath,
  widgetResponse,
} from "./widget.js";

// Cloudflare Workers forbid `WebAssembly.compile()` at runtime, and capjs-core
// normally compiles its embedded hashwx blob on first use. Hand it the module
// that wrangler compiled from `core/vendor/hashwx.wasm` instead. A packaging
// change must not take the whole Worker down: on failure hashwx stays on its
// JS fallback path (and hashwx is opt-in anyway).
try {
  setHashwxModule(hashwxWasmModule);
} catch (error) {
  console.error("[priestess-verification] hashwx module not injected", error);
}

export { SiteRegistry } from "./site-registry.js";
export { TokenStore } from "./token-store.js";

// Content-versioned URLs for everything the demo page loads, hashed once per
// isolate on first use (see `versionedPath`).
let demoAssets = null;
function demoAssetUrls() {
  demoAssets ??= {
    widget: versionedPath("/widget.js"),
    capWasm: versionedPath(ASSET_PATHS.capWasm),
    hashwx: versionedPath(ASSET_PATHS.hashwx),
    pako: versionedPath(ASSET_PATHS.pako),
    ripple: versionedPath(ASSET_PATHS.ripple),
  };
  return demoAssets;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    let config;
    try {
      config = readConfig(env);
    } catch (error) {
      // The message can quote the raw env var, so it stays in the logs.
      console.error("[priestess-verification]", error);
      return jsonResponse({ success: false, error: "Internal error" }, 500);
    }

    const sitePath = parseSitePath(url.pathname);
    if (sitePath) {
      try {
        return await handleSiteRequest(request, env, config, sitePath);
      } catch (error) {
        console.error("[priestess-verification]", error);
        return jsonResponse({ success: false, error: "Internal error" }, 500, {
          Vary: "Origin",
        });
      }
    }

    if (isAdminPath(url.pathname)) {
      try {
        return await handleAdmin(request, env, config, url);
      } catch (error) {
        console.error("[priestess-verification]", error);
        return jsonResponse({ success: false, error: "Internal error" }, 500, {
          "Cache-Control": "no-store",
        });
      }
    }

    const origin = resolveAllowedOrigin(request, config.allowedOrigins);

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: preflightHeaders(origin),
      });
    }

    try {
      if (url.pathname === "/" && request.method === "GET") {
        return new Response(renderDemoPage(demoAssetUrls()), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      if (isWidgetPath(url.pathname) && request.method === "GET") {
        return widgetResponse(request, url.pathname);
      }

      if (
        (url.pathname === "/challenge" || url.pathname === "/demo/challenge") &&
        request.method === "POST"
      ) {
        const tenant = url.pathname.startsWith("/demo/")
          ? DEMO_TENANT
          : SITE_TENANT;
        return await handleChallenge(request, env, config, origin, tenant);
      }

      if (
        (url.pathname === "/redeem" || url.pathname === "/demo/redeem") &&
        request.method === "POST"
      ) {
        const tenant = url.pathname.startsWith("/demo/")
          ? DEMO_TENANT
          : SITE_TENANT;
        return await handleRedeem(request, env, config, origin, tenant);
      }

      if (url.pathname === "/siteverify" && request.method === "POST") {
        return await handleSiteverify(request, env, config);
      }

      if (url.pathname === "/demo/siteverify" && request.method === "POST") {
        return await handleDemoSiteverify(request, env, config);
      }
    } catch (error) {
      console.error("[priestess-verification]", error);
      return jsonResponse(
        { success: false, error: "Internal error" },
        500,
        corsHeaders(origin),
      );
    }

    return jsonResponse({ success: false, error: "Not found" }, 404);
  },
};

/**
 * `/<siteKey>/challenge|redeem|siteverify` for a site registered in the admin
 * console. Unknown and disabled sites look the same: 404, no CORS headers.
 */
async function handleSiteRequest(request, env, config, { siteKey, action }) {
  const site = await loadSite(registryFor(env), siteKey);
  const cfg = site?.enabled ? siteConfig(config, site) : null;
  const origin = cfg ? resolveAllowedOrigin(request, cfg.allowedOrigins) : null;

  if (request.method === "OPTIONS") {
    if (!origin || action === "siteverify") {
      return new Response(null, { status: 403, headers: { Vary: "Origin" } });
    }
    return new Response(null, {
      status: 204,
      headers: preflightHeaders(origin),
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Not found" }, 404, {
      Vary: "Origin",
    });
  }

  if (!cfg) {
    return jsonResponse(
      { success: false, error: "Site not found" },
      404,
      action === "siteverify" ? {} : corsHeaders(origin),
    );
  }

  const tenant = siteTenant(siteKey);
  if (action === "challenge") {
    return handleChallenge(request, env, cfg, origin, tenant);
  }
  if (action === "redeem") {
    return handleRedeem(request, env, cfg, origin, tenant);
  }
  return handleSiteSiteverify(request, env, site, tenant.keySuffix);
}
