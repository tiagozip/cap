import { Elysia } from "elysia";
import { db } from "./db.js";

if (
  process.env.ENABLE_ASSETS_SERVER === "true" &&
  (process.env.WIDGET_VERSION === "latest" ||
    process.env.WASM_VERSION === "latest")
) {
  console.warn(
    "📦 [asset server] using 'latest' version for assets is not recommended for production!\n   make sure to pin it to a set version using the WIDGET_VERSION and WASM_VERSION env variables.",
  );
}

const updateCache = async () => {
  if (process.env.ENABLE_ASSETS_SERVER !== "true") return;

  let cacheConfig = {};
  try {
    cacheConfig = JSON.parse((await db.get("asset:cache-config")) || "{}");
  } catch {}

  const lastUpdate = cacheConfig.lastUpdate || 0;
  const currentTime = Date.now();
  const updateInterval = 1000 * 60 * 60 * 24; // 1 day
  const intervalExceeded = currentTime - lastUpdate > updateInterval;

  const WIDGET_VERSION = process.env.WIDGET_VERSION || "latest";
  const WASM_VERSION = process.env.WASM_VERSION || "latest";

  if (!cacheConfig.versions) cacheConfig.versions = {};
  const versionsChanged =
    cacheConfig.versions.widget !== WIDGET_VERSION ||
    cacheConfig.versions.wasm !== WASM_VERSION;

  if (!intervalExceeded && !versionsChanged) return;

  const CACHE_HOST = process.env.CACHE_HOST || "https://cdn.jsdelivr.net";

  const fetchAsset = async (url, binary) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} responded with ${r.status}`);
    return binary ? r.arrayBuffer() : r.text();
  };

  try {
    const [widgetSource, floatingSource, wasmSource, wasmLoaderSource] =
      await Promise.all([
        fetchAsset(`${CACHE_HOST}/npm/@cap.js/widget@${WIDGET_VERSION}`),
        fetchAsset(
          `${CACHE_HOST}/npm/@cap.js/widget@${WIDGET_VERSION}/cap-floating.min.js`,
        ),
        fetchAsset(
          `${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm_bg.wasm`,
          true,
        ),
        fetchAsset(
          `${CACHE_HOST}/npm/@cap.js/wasm@${WASM_VERSION}/browser/cap_wasm.min.js`,
        ),
      ]);

    cacheConfig.lastUpdate = currentTime;
    cacheConfig.versions.widget = WIDGET_VERSION;
    cacheConfig.versions.wasm = WASM_VERSION;

    await Promise.all([
      db.set("asset:cache-config", JSON.stringify(cacheConfig)),
      db.set("asset:widget.js", widgetSource),
      db.set("asset:floating.js", floatingSource),
      db.set("asset:cap_wasm_bg.wasm", Buffer.from(wasmSource)),
      db.set("asset:cap_wasm.js", wasmLoaderSource),
    ]);
  } catch (e) {
    console.error("📦 [asset server] failed to update assets cache:", e);
  }
};

updateCache();
setInterval(updateCache, 1000 * 60 * 60);

export const assetsServer = new Elysia({
  prefix: "/assets",
  detail: { tags: ["Assets"] },
})
  .onBeforeHandle(({ set }) => {
    if (process.env.ENABLE_ASSETS_SERVER !== "true") {
      set.status = 404;
      return "Asset server is disabled. Set ENABLE_ASSETS_SERVER=true to enable it.";
    }
    set.headers["Cache-Control"] = "max-age=31536000, immutable";
  })
  .get("/widget.js", async ({ set }) => {
    set.headers["Content-Type"] = "text/javascript";
    const content = await db.get("asset:widget.js");
    if (!content) {
      set.status = 503;
      return "Asset not cached yet. If this persists, check the server logs for asset fetch errors.";
    }
    return content;
  })
  .get("/floating.js", async ({ set }) => {
    set.headers["Content-Type"] = "text/javascript";
    const content = await db.get("asset:floating.js");
    if (!content) {
      set.status = 503;
      return "Asset not cached yet. If this persists, check the server logs for asset fetch errors.";
    }
    return content;
  })
  .get("/cap_wasm_bg.wasm", async ({ set }) => {
    set.headers["Content-Type"] = "application/wasm";
    const content = await db.getBuffer("asset:cap_wasm_bg.wasm");
    if (!content) {
      set.status = 503;
      return "Asset not cached yet. If this persists, check the server logs for asset fetch errors.";
    }
    return content;
  })
  .get("/cap_wasm.js", async ({ set }) => {
    set.headers["Content-Type"] = "text/javascript";
    const content = await db.get("asset:cap_wasm.js");
    if (!content) {
      set.status = 503;
      return "Asset not cached yet. If this persists, check the server logs for asset fetch errors.";
    }
    return content;
  });
