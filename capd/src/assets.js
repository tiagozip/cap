import { Elysia } from "elysia";
import { db } from "#db";
import { defer, every } from "#platform";
import pkg from "../package.json";
import { deprecated } from "./config.js";

export const ASSET_SOURCE = "https://cdn.jsdelivr.net";
export const BUILT_WITH = {
  widget: pkg.capAssets.widget,
  wasm: pkg.capAssets.wasm,
};
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,32})?$/;
const CHECK_MS = 60 * 60 * 1000;
const SETTINGS_TTL = 10_000;

const FILES = [
  { key: "widget.js", pkg: "widget", path: "" },
  { key: "floating.js", pkg: "widget", path: "/cap-floating.min.js" },
  { key: "cap_wasm_bg.wasm", pkg: "wasm", path: "/browser/cap_wasm_bg.wasm" },
  { key: "cap_wasm.js", pkg: "wasm", path: "/browser/cap_wasm.min.js" },
  {
    key: "hashwx.wasm",
    pkg: "wasm",
    path: "/browser/hashwx.wasm",
    optional: true,
  },
];

let settings = { enabled: false, ...BUILT_WITH };
let loadedAt = 0;
let refreshing = null;

export const validVersion = (v) => typeof v === "string" && VERSION.test(v);

const fileUrl = (file, versions) =>
  `${ASSET_SOURCE}/npm/@cap.js/${file.pkg}@${versions[file.pkg]}${file.path}`;

const readCache = async () => {
  try {
    return JSON.parse((await db.get("asset:cache-config")) || "{}");
  } catch {
    return {};
  }
};

const fromEnv = () => {
  const env = process.env;
  if (env.CACHE_HOST)
    deprecated(
      "CACHE_HOST",
      `CACHE_HOST is no longer read. Cap downloads widget files from ${ASSET_SOURCE}.`,
    );
  const names = ["ENABLE_ASSETS_SERVER", "WIDGET_VERSION", "WASM_VERSION"];
  const set = names.filter((n) => env[n]);
  if (!set.length) return null;
  return {
    names: set,
    value: {
      enabled: env.ENABLE_ASSETS_SERVER === "true",
      widget: validVersion(env.WIDGET_VERSION)
        ? env.WIDGET_VERSION
        : BUILT_WITH.widget,
      wasm: validVersion(env.WASM_VERSION) ? env.WASM_VERSION : BUILT_WITH.wasm,
    },
  };
};

export async function loadAssetSettings() {
  const raw = await db.get("settings:assets");
  const seed = fromEnv();
  if (seed) {
    const list = seed.names.join(", ");
    deprecated(
      "ENABLE_ASSETS_SERVER",
      raw
        ? `${list} ${seed.names.length > 1 ? "are" : "is"} deprecated and ignored, because Settings > Widget files is already saved. Remove ${seed.names.length > 1 ? "them" : "it"}.`
        : `${list} ${seed.names.length > 1 ? "are" : "is"} deprecated. Cap copied ${seed.names.length > 1 ? "them" : "it"} into Settings > Widget files, so change it there and remove ${seed.names.length > 1 ? "them" : "it"}.`,
    );
  }
  if (!raw && seed) await db.set("settings:assets", JSON.stringify(seed.value));
  let saved = raw ? null : seed?.value;
  if (raw)
    try {
      saved = JSON.parse(raw);
    } catch {}
  loadedAt = Date.now();
  settings = {
    enabled: saved?.enabled === true,
    widget: validVersion(saved?.widget) ? saved.widget : BUILT_WITH.widget,
    wasm: validVersion(saved?.wasm) ? saved.wasm : BUILT_WITH.wasm,
  };
  return settings;
}

export const getAssetSettings = () => settings;

export async function saveAssetSettings(patch) {
  const next = {
    enabled: patch.enabled ?? settings.enabled,
    widget: patch.widget ?? settings.widget,
    wasm: patch.wasm ?? settings.wasm,
  };
  if (!validVersion(next.widget) || !validVersion(next.wasm))
    return { error: "Use a version number such as 0.1.58" };
  settings = next;
  await db.set("settings:assets", JSON.stringify(next));
  defer(refreshAssets().catch(() => {}));
  return { settings: next };
}

export function refreshAssets({ force = false } = {}) {
  refreshing ??= (async () => {
    if (!settings.enabled) return;
    const cache = await readCache();
    const versions = { widget: settings.widget, wasm: settings.wasm };
    const current =
      cache.versions?.widget === versions.widget &&
      cache.versions?.wasm === versions.wasm &&
      (await db.exists("asset:widget.js"));
    if (current && !force) return;
    const fetchFile = async (file) => {
      const r = await fetch(fileUrl(file, versions), {
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) {
        if (file.optional) return null;
        throw new Error(
          `${fileUrl(file, versions)} responded with ${r.status}`,
        );
      }
      return Buffer.from(await r.arrayBuffer());
    };
    try {
      const bodies = await Promise.all(FILES.map(fetchFile));
      await Promise.all(
        FILES.map((file, i) =>
          bodies[i]
            ? db.set(`asset:${file.key}`, bodies[i])
            : db.del(`asset:${file.key}`),
        ),
      );
      await db.set(
        "asset:cache-config",
        JSON.stringify({
          lastUpdate: Date.now(),
          versions,
          hashwx: !!bodies.at(-1),
          error: null,
        }),
      );
    } catch (e) {
      console.error("[cap] widget files download failed:", e.message);
      await db.set(
        "asset:cache-config",
        JSON.stringify({ ...cache, error: e.message, failedAt: Date.now() }),
      );
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function assetStatus() {
  const cache = await readCache();
  return {
    ...settings,
    builtWith: BUILT_WITH,
    source: ASSET_SOURCE,
    updating: !!refreshing,
    cached: cache.lastUpdate
      ? {
          widget: cache.versions?.widget ?? null,
          wasm: cache.versions?.wasm ?? null,
          at: cache.lastUpdate,
          hashwx: cache.hashwx !== false,
        }
      : null,
    error: cache.error ?? null,
    failedAt: cache.failedAt ?? null,
  };
}

export async function latestVersions() {
  const resolve = async (name) => {
    const r = await fetch(
      `https://data.jsdelivr.com/v1/packages/npm/@cap.js/${name}/resolved?specifier=latest`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!r.ok) throw new Error(`jsDelivr responded with ${r.status}`);
    const { version } = await r.json();
    if (!validVersion(version)) throw new Error("jsDelivr sent no version");
    return version;
  };
  const [widget, wasm] = await Promise.all([
    resolve("widget"),
    resolve("wasm"),
  ]);
  return { widget, wasm };
}

export function startAssets() {
  defer(
    loadAssetSettings()
      .then(() => refreshAssets())
      .catch((e) => console.warn("[cap] widget files:", e.message)),
  );
  every(
    () =>
      loadAssetSettings()
        .then(() => refreshAssets())
        .catch(() => {}),
    CHECK_MS,
  );
}

const TYPES = {
  "widget.js": "text/javascript",
  "floating.js": "text/javascript",
  "cap_wasm.js": "text/javascript",
  "cap_wasm_bg.wasm": "application/wasm",
  "hashwx.wasm": "application/wasm",
};

export const assetsServer = new Elysia({
  prefix: "/assets",
  detail: { tags: ["Assets"] },
}).get("/:file", async ({ params, set }) => {
  const type = TYPES[params.file];
  if (type && Date.now() - loadedAt > SETTINGS_TTL)
    await loadAssetSettings().catch(() => {});
  if (!type || !settings.enabled) {
    set.status = 404;
    return "Not found. Turn on Settings > Widget files in the dashboard to serve the widget from this server.";
  }
  const content = await db.getBuffer(`asset:${params.file}`);
  if (!content) {
    set.status = 503;
    return "This file isn't downloaded yet. Settings > Widget files in the dashboard shows the download status.";
  }
  set.headers["Content-Type"] = type;
  set.headers["Cache-Control"] = "public, max-age=3600";
  return content;
});
