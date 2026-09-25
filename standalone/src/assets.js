import { Elysia } from "elysia";
import { db } from "./db.js";

// The widget is distributed from the fork through jsDelivr's GitHub channel,
// so WIDGET_VERSION is a git ref of this repository: "latest" (or unset) tracks
// `main`, anything else is used as-is as a release tag, commit or branch name.
// Upstream's npm releases (e.g. "0.1.58") are not git refs: jsDelivr answers
// 404 for them, so they are ignored in favor of `main`.
const NPM_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

const isNpmWidgetVersion = (value) =>
  typeof value === "string" && NPM_VERSION_PATTERN.test(value);

const resolveWidgetRef = () => {
  const version = process.env.WIDGET_VERSION;
  if (isNpmWidgetVersion(version)) return "main";
  if (!version || version === "latest") return "main";
  return version;
};

if (
  process.env.ENABLE_ASSETS_SERVER === "true" &&
  (process.env.WIDGET_VERSION === "latest" ||
    process.env.WASM_VERSION === "latest")
) {
  console.warn(
    "📦 [asset server] using 'latest' for assets is not recommended for production!\n   set WIDGET_VERSION to a release tag or commit (e.g. v1.0.0) and WASM_VERSION to an @cap.js/wasm version.",
  );
}

if (
  process.env.ENABLE_ASSETS_SERVER === "true" &&
  isNpmWidgetVersion(process.env.WIDGET_VERSION)
) {
  console.warn(
    `📦 [asset server] WIDGET_VERSION="${process.env.WIDGET_VERSION}" looks like an upstream npm version of @cap.js/widget.\n   the fork distributes the widget from jsDelivr's GitHub channel, so WIDGET_VERSION must be a git ref of KurisuRakko/priestess-verification (a release tag such as "v1.0.0", a commit sha or a branch name).\n   ignoring "${process.env.WIDGET_VERSION}" and using "main" instead; pin a tag or commit for production.`,
  );
}

const ASSET_NOT_CACHED =
  "Asset not cached yet. If this persists, check the server logs for asset fetch errors.";

// A widget cached by an older, npm-based release did not come from the fork.
const WIDGET_ASSET_KEYS = ["asset:widget.js", "asset:floating.js"];
const CACHE_CONFIG_KEY = "asset:cache-config";

// Cache headers: a served asset never changes under its URL, so it can be
// cached forever. A 503 is the opposite: the next request must reach the
// server again, so it must not be stored anywhere.
const CACHE_CONTROL_IMMUTABLE = "max-age=31536000, immutable";
const CACHE_CONTROL_NO_STORE = "no-store";

// A failed refresh is retried on a later request (or on the hourly tick), but
// not on every single request, so a broken CACHE_HOST cannot be hammered.
const RETRY_COOLDOWN_MS = 5000;
const FETCH_TIMEOUT_MS = 30_000;
const UPDATE_INTERVAL_MS = 1000 * 60 * 60 * 24; // 1 day

let refreshPromise = null;
let lastAttemptAt = 0;
// Set by the read path when an asset key is missing although the config claims
// the cache is current; the next runUpdateCache() must not return early.
let forceRefresh = false;

const fetchAsset = async (url, binary) => {
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(`${url} could not be fetched: ${e?.message ?? e}`);
  }
  if (!response.ok) {
    throw new Error(`${url} responded with ${response.status}`);
  }
  if (binary) {
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) throw new Error(`${url} returned an empty body`);
    return body;
  }
  const body = await response.text();
  if (body.length === 0) throw new Error(`${url} returned an empty body`);
  return body;
};

const readCacheConfig = async () => {
  try {
    return JSON.parse((await db.get(CACHE_CONFIG_KEY)) || "{}");
  } catch {
    return {};
  }
};

const resolveVersions = () => {
  // Bare npm versions (e.g. "0.1.58") resolve to `main` here; the ignored
  // value is reported by the startup warning above.
  const WIDGET_REF = resolveWidgetRef();
  return {
    WIDGET_REF,
    WASM_VERSION: process.env.WASM_VERSION || "latest",
    // The "gh:" prefix marks the jsDelivr GitHub source, so caches written by
    // older releases (npm widget) are invalidated instead of being served.
    WIDGET_CACHE_KEY: `gh:${WIDGET_REF}`,
  };
};

// Whether the stored config claims the cache holds the current versions and
// was refreshed recently. That is only a claim about the config: the read path
// checks the asset keys themselves, because a config written before its assets
// (or an evicted key) would otherwise keep /assets/* at 503 for a day.
const cacheConfigIsCurrent = (cacheConfig, WIDGET_CACHE_KEY, WASM_VERSION) => {
  const intervalExceeded =
    Date.now() - (cacheConfig.lastUpdate || 0) > UPDATE_INTERVAL_MS;
  const versions = cacheConfig.versions || {};
  const versionsChanged =
    versions.widget !== WIDGET_CACHE_KEY || versions.wasm !== WASM_VERSION;
  return !intervalExceeded && !versionsChanged;
};

const runUpdateCache = async () => {
  if (process.env.ENABLE_ASSETS_SERVER !== "true") return;

  const cacheConfig = await readCacheConfig();
  const { WIDGET_REF, WASM_VERSION, WIDGET_CACHE_KEY } = resolveVersions();

  // A forced refresh comes from the read path: the config says "current" but
  // an asset key is gone, so the "nothing to do" shortcut must not apply.
  const forced = forceRefresh;
  forceRefresh = false;

  if (
    !forced &&
    cacheConfigIsCurrent(cacheConfig, WIDGET_CACHE_KEY, WASM_VERSION)
  ) {
    return;
  }

  const currentTime = Date.now();
  if (currentTime - lastAttemptAt < RETRY_COOLDOWN_MS) return;
  lastAttemptAt = currentTime;

  const CACHE_HOST = process.env.CACHE_HOST || "https://cdn.jsdelivr.net";

  try {
    const [
      widgetSource,
      floatingSource,
      wasmSource,
      wasmLoaderSource,
      hashwxSource,
    ] = await Promise.all([
      fetchAsset(
        `${CACHE_HOST}/gh/KurisuRakko/priestess-verification@${WIDGET_REF}/widget/src/cap.min.js`,
      ),
      fetchAsset(
        `${CACHE_HOST}/gh/KurisuRakko/priestess-verification@${WIDGET_REF}/widget/src/cap-floating.min.js`,
      ),
      fetchAsset(
        `${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm_bg.wasm`,
        true,
      ),
      fetchAsset(
        `${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm.min.js`,
      ),
      fetchAsset(
        `${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/hashwx.wasm`,
        true,
      ).catch((e) => {
        console.warn(
          `📦 [asset server] no hashwx.wasm in @cap.js/wasm@${WASM_VERSION}, HashWX keys will fall back to jsdelivr:`,
          e.message,
        );
        return null;
      }),
    ]);

    if (!cacheConfig.versions) cacheConfig.versions = {};
    cacheConfig.lastUpdate = currentTime;
    cacheConfig.versions.widget = WIDGET_CACHE_KEY;
    cacheConfig.versions.wasm = WASM_VERSION;

    // The assets are written first and the config last: the config is the
    // "everything above is in place" marker, so a failed or partial write
    // leaves it describing the previous (or no) state, and the next request
    // refreshes again instead of trusting a fresh config whose keys are gone.
    const writtenKeys = [];
    await Promise.all(
      [
        ["asset:widget.js", widgetSource],
        ["asset:floating.js", floatingSource],
        ["asset:cap_wasm_bg.wasm", Buffer.from(wasmSource)],
        ["asset:cap_wasm.js", wasmLoaderSource],
        ["asset:hashwx.wasm", hashwxSource ? Buffer.from(hashwxSource) : null],
      ].map(async ([key, value]) => {
        if (value === null) {
          await db.del(key);
          return;
        }
        await db.set(key, value);
        writtenKeys.push(key);
      }),
    );

    // `assets` records what the successful refresh actually wrote, so an asset
    // the CDN legitimately does not ship (hashwx.wasm is optional) is not
    // mistaken for a lost key on the read path.
    cacheConfig.assets = writtenKeys.sort();
    await db.set(CACHE_CONFIG_KEY, JSON.stringify(cacheConfig));
  } catch (e) {
    console.error(
      `📦 [asset server] failed to update assets cache: ${e?.message ?? e}`,
    );
    console.error(
      "📦 [asset server] /assets/* will keep serving the last fork build, or 503 if there is none; retrying on the next request or on the hourly refresh.",
    );

    // A cache key without the "gh:" prefix means the cached widget came from
    // the upstream npm package: drop it, so a failing refresh can never keep
    // serving upstream-branded content silently.
    // Re-read the stored config: the in-memory copy may already hold the new
    // versions if the fetch succeeded but a later write failed.
    const cachedWidgetVersion = (await readCacheConfig()).versions?.widget;
    if (
      typeof cachedWidgetVersion !== "string" ||
      !cachedWidgetVersion.startsWith("gh:")
    ) {
      try {
        await Promise.all(WIDGET_ASSET_KEYS.map((key) => db.del(key)));
      } catch (cleanupError) {
        console.error(
          "📦 [asset server] failed to drop the stale widget cache:",
          cleanupError,
        );
      }
    }
  }
};

// Single-flight so concurrent requests and the hourly tick share one refresh.
const updateCache = () => {
  refreshPromise ??= runUpdateCache().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
};

updateCache();
setInterval(updateCache, 1000 * 60 * 60);

// A request that finds the cache empty doubles as a retry trigger, so a
// transient failure (CDN 5xx, network error) recovers without waiting for the
// next hourly tick. The refresh runs in the background; the triggering request
// still gets the 503 below, and the next one serves the recovered asset.
const readCachedAsset = async (key, read) => {
  const content = await read(key);
  if (content) return content;

  const cacheConfig = await readCacheConfig();
  const { WASM_VERSION, WIDGET_CACHE_KEY } = resolveVersions();
  // A config written by an older release has no `assets` list, so every
  // missing key is suspicious (that is exactly the partial-write state this
  // check exists for). With a list, unmentioned keys are optional by design.
  const keyShouldExist =
    !Array.isArray(cacheConfig.assets) || cacheConfig.assets.includes(key);

  if (
    keyShouldExist &&
    cacheConfigIsCurrent(cacheConfig, WIDGET_CACHE_KEY, WASM_VERSION)
  ) {
    // The config says "current" while the key it describes is gone (partial
    // write, evicted or manually deleted key). Without this, updateCache()
    // would return early: no log, no fetch, and a 503 until the daily refresh.
    console.warn(
      `📦 [asset server] ${key} is missing while asset:cache-config says the cache is current; forcing a refresh.`,
    );
    // If a refresh is already running, it either writes this key or fails; a
    // failure leaves this flag set, so the next request retries immediately.
    if (!refreshPromise) forceRefresh = true;
  }

  updateCache().catch(() => {});
  return null;
};

const serveAsset = async ({ set }, key, read, contentType) => {
  set.headers["Content-Type"] = contentType;
  const content = await readCachedAsset(key, read);
  if (!content) {
    // Never let a cache store the 503: the next request is the retry.
    set.status = 503;
    set.headers["Cache-Control"] = CACHE_CONTROL_NO_STORE;
    return ASSET_NOT_CACHED;
  }
  set.headers["Cache-Control"] = CACHE_CONTROL_IMMUTABLE;
  return content;
};

export const assetsServer = new Elysia({
  prefix: "/assets",
  detail: { tags: ["Assets"] },
})
  .onBeforeHandle(({ set }) => {
    if (process.env.ENABLE_ASSETS_SERVER !== "true") {
      set.status = 404;
      return "Asset server is disabled. Set ENABLE_ASSETS_SERVER=true to enable it.";
    }
  })
  .get("/widget.js", (ctx) =>
    serveAsset(ctx, "asset:widget.js", db.get, "text/javascript"),
  )
  .get("/floating.js", (ctx) =>
    serveAsset(ctx, "asset:floating.js", db.get, "text/javascript"),
  )
  .get("/cap_wasm_bg.wasm", (ctx) =>
    serveAsset(ctx, "asset:cap_wasm_bg.wasm", db.getBuffer, "application/wasm"),
  )
  .get("/hashwx.wasm", (ctx) =>
    serveAsset(ctx, "asset:hashwx.wasm", db.getBuffer, "application/wasm"),
  )
  .get("/cap_wasm.js", (ctx) =>
    serveAsset(ctx, "asset:cap_wasm.js", db.get, "text/javascript"),
  );
