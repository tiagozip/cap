/**
 * Static assets served by the Worker.
 *
 * `/widget.js` and `/widget-floating.js` come straight from the minified
 * artifacts that `widget/build.js` writes into `widget/src/`. Nothing is
 * regenerated or edited here: wrangler's `Text` rule embeds the exact bytes of
 * those files into the bundle (see `rules` in wrangler.jsonc).
 *
 * The widget would otherwise fetch three files from `cdn.jsdelivr.net` at
 * runtime — the PoW wasm (`window.CAP_CUSTOM_WASM_URL`), the hashwx wasm
 * (`window.CAP_CUSTOM_HASHWX_URL`) and, on browsers without
 * `DecompressionStream`, pako (`window.CAP_PAKO_URL`). All three are served
 * here byte for byte from the repo, so an embedder can keep every request on
 * their own origin:
 *
 *   /cap_wasm_bg.wasm      wasm/src/browser/cap_wasm_bg.wasm
 *   /hashwx.wasm           wasm/src/browser/hashwx.wasm (== core/vendor/hashwx.wasm,
 *                          also embedded as base64 in core/src/hashwx-wasm.js)
 *   /pako_inflate.min.js   pako@2.1.0 dist/pako_inflate.min.js
 *                          sha256 fa226c8e1e3556993260e6a5c1fe94e225da59b3418a06811fdc51d308f8bb43,
 *                          identical to the jsDelivr copy
 *
 * The `data-cap-mascot` card fetches three state images; they are served here
 * so the Worker's `/widget.js` resolves its default `<script dir>/mascot/` base
 * to `/mascot/*.webp` on this origin:
 *
 *   /mascot/checking.webp  widget/src/mascot/checking.webp
 *   /mascot/error.webp     widget/src/mascot/error.webp
 *   /mascot/done.webp      widget/src/mascot/done.webp
 *
 * Every response carries `Vary: Origin` unconditionally (see `cors.js`).
 *
 * The images use WIDGET_CACHE_CONTROL rather than the immutable wasm/pako
 * policy: unlike a versioned wasm build, the mascot art may be replaced under
 * the same URL.
 *
 * The demo page installs Rakko Design's ripple feedback from two ES modules,
 * served byte for byte from the synced vendor copy (`scripts/sync-design.sh`);
 * `ripple.js` imports `./ripple-geometry.js`, so both live under `/design/`:
 *
 *   /design/ripple.js           vendor/rakko-design/design-system/src/ripple.js
 *   /design/ripple-geometry.js  vendor/rakko-design/design-system/src/ripple-geometry.js
 */

import { createHash } from "node:crypto";
import { HASHWX_WASM_BASE64 } from "../../core/src/hashwx-wasm.js";
import capWasmBytes from "../../wasm/src/browser/cap_wasm_bg.wasm";
import capFloatingMinJs from "../../widget/src/cap-floating.min.js";
import capMinJs from "../../widget/src/cap.min.js";
import mascotChecking from "../../widget/src/mascot/checking.webp";
import mascotDone from "../../widget/src/mascot/done.webp";
import mascotError from "../../widget/src/mascot/error.webp";
import rippleJs from "../../vendor/rakko-design/design-system/src/ripple.js";
import rippleGeometryJs from "../../vendor/rakko-design/design-system/src/ripple-geometry.js";
import pakoInflateMinJs from "../vendor/pako_inflate.min.js";
import { corsHeaders } from "./cors.js";

const WIDGET_CACHE_CONTROL = "public, max-age=300";
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const JS_CONTENT_TYPE = "application/javascript; charset=utf-8";
const WASM_CONTENT_TYPE = "application/wasm";
const WEBP_CONTENT_TYPE = "image/webp";

export const ASSET_PATHS = {
  capWasm: "/cap_wasm_bg.wasm",
  hashwx: "/hashwx.wasm",
  pako: "/pako_inflate.min.js",
  mascotChecking: "/mascot/checking.webp",
  mascotError: "/mascot/error.webp",
  mascotDone: "/mascot/done.webp",
  ripple: "/design/ripple.js",
  rippleGeometry: "/design/ripple-geometry.js",
};

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("unexpected wasm import; expected bytes");
}

const ASSETS = new Map([
  [
    "/widget.js",
    {
      body: capMinJs,
      contentType: JS_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
  [
    "/widget-floating.js",
    {
      body: capFloatingMinJs,
      contentType: JS_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.capWasm,
    {
      body: toBytes(capWasmBytes),
      contentType: WASM_CONTENT_TYPE,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.hashwx,
    {
      body: Buffer.from(HASHWX_WASM_BASE64, "base64"),
      contentType: WASM_CONTENT_TYPE,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.pako,
    {
      body: pakoInflateMinJs,
      contentType: JS_CONTENT_TYPE,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.mascotChecking,
    {
      body: toBytes(mascotChecking),
      contentType: WEBP_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.mascotError,
    {
      body: toBytes(mascotError),
      contentType: WEBP_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.mascotDone,
    {
      body: toBytes(mascotDone),
      contentType: WEBP_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.ripple,
    {
      body: rippleJs,
      contentType: JS_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
  [
    ASSET_PATHS.rippleGeometry,
    {
      body: rippleGeometryJs,
      contentType: JS_CONTENT_TYPE,
      cacheControl: WIDGET_CACHE_CONTROL,
    },
  ],
]);

const etagCache = new Map();

function etagFor(body) {
  let etag = etagCache.get(body);
  if (!etag) {
    const hash = createHash("sha256");
    hash.update(typeof body === "string" ? Buffer.from(body, "utf8") : body);
    etag = `"sha256-${hash.digest("hex").slice(0, 32)}"`;
    etagCache.set(body, etag);
  }
  return etag;
}

/**
 * `pathname` plus a `?v=` content hash, for the pages this Worker renders
 * itself. The demo page is served `no-store`, so a deploy that changes an
 * asset also changes its URL there, and no browser keeps running a copy it
 * cached before the deploy (`/widget.js` is cacheable for five minutes, the
 * wasm for a year). The query string is ignored when the asset is served.
 */
export function versionedPath(pathname) {
  const asset = ASSETS.get(pathname);
  if (!asset) throw new Error(`versionedPath: unknown asset ${pathname}`);
  // etagFor() returns `"sha256-<32 hex>"`; 12 hex digits are plenty here.
  return `${pathname}?v=${etagFor(asset.body).slice(8, 20)}`;
}

export function isWidgetPath(pathname) {
  return ASSETS.has(pathname);
}

/** Serves any of the static assets, including the conditional-request path. */
export function widgetResponse(request, pathname, origin) {
  const asset = ASSETS.get(pathname);
  if (!asset) return new Response("Not found", { status: 404 });
  const etag = etagFor(asset.body);
  const headers = {
    "Content-Type": asset.contentType,
    "Cache-Control": asset.cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(origin),
  };
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(asset.body, { status: 200, headers });
}
