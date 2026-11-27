import { api, hasAuth, signOut } from "./api.js";

export const app = $state({
  ready: false,
  keys: [],
  keysError: null,
  key: null,
  loadingKey: false,
  focusHeading: false,
  route: { view: "home" },
  settings: {
    headers: null,
    ratelimit: null,
    cors: null,
    filtering: null,
    ipdb: null,
  },
  eventsPreset: null,
  createKeyOpen: false,
});

export const hasGeoSource = () =>
  !!(app.settings.headers?.countryHeader || app.settings.ipdb?.mode);

const parseHash = () => {
  const [view, a, b] = location.hash
    .replace(/^#\/?/, "")
    .split("?")[0]
    .split("/");
  if (view === "keys" && a)
    return { view: "key", siteKey: a, tab: b || "activity" };
  if (view === "lists") {
    history.replaceState(null, "", "#/settings/lists");
    return { view: "settings", section: "lists" };
  }
  if (view === "settings" && a === "apikeys") {
    history.replaceState(null, "", "#/api");
    return { view: "api" };
  }
  if (view === "settings") return { view: "settings", section: a || null };
  if (view === "api") return { view: "api" };
  if (view === "oauth" && a) return { view: "oauth", id: a };
  return { view: "home" };
};

export function navigate(route) {
  const hash =
    route.view === "key"
      ? `#/keys/${route.siteKey}/${route.tab || "activity"}`
      : route.view === "settings"
        ? `#/settings${route.section ? `/${route.section}` : ""}`
        : route.view === "api"
          ? "#/api"
          : "#/";
  if (location.hash !== hash) history.pushState(null, "", hash);
  app.focusHeading = true;
  applyRoute(parseHash());
}

async function applyRoute(route) {
  if (route.view === "home" && !route.error && app.keys.length) {
    let last = null;
    try {
      last = localStorage.getItem("cap_last_key");
    } catch {}
    const key = app.keys.find((k) => k.siteKey === last) ?? app.keys[0];
    history.replaceState(null, "", `#/keys/${key.siteKey}/activity`);
    route = { view: "key", siteKey: key.siteKey, tab: "activity" };
  }
  app.route = route;
  document.getElementById("main")?.scrollTo({ top: 0 });
  if (route.view === "key" && app.key?.siteKey !== route.siteKey)
    await loadKey(route.siteKey);
}

export function openEvents(filters = []) {
  app.eventsPreset = filters;
  navigate({ view: "key", siteKey: app.key.siteKey, tab: "events" });
}

export async function loadKeys() {
  const keys = await api("GET", "/keys");
  if (keys?.error) {
    app.keysError = keys.error;
    return;
  }
  app.keysError = null;
  app.keys = keys;
}

let keyRequest = 0;

export async function loadKey(siteKey, duration) {
  const request = ++keyRequest;
  app.loadingKey = true;
  const data = await api(
    "GET",
    `/keys/${siteKey}${duration ? `?chartDuration=${duration}` : ""}`,
  );
  if (request !== keyRequest) return;
  app.loadingKey = false;
  if (!data || data.error) {
    app.key = null;
    if (app.route.view === "key" && app.route.siteKey === siteKey)
      app.route = {
        view: "home",
        error: data?.error || "Couldn't load this key",
      };
    return;
  }
  try {
    localStorage.setItem("cap_last_key", siteKey);
  } catch {}
  app.key = {
    ...data.key,
    stats: data.stats,
    prevStats: data.prevStats,
    chartData: data.chartData,
  };
}

export async function refreshSettings() {
  const [headers, ratelimit, cors, filtering, ipdb] = await Promise.all(
    ["headers", "ratelimit", "cors", "filtering", "ipdb"].map((s) =>
      api("GET", `/settings/${s}`),
    ),
  );
  const ok = (r) => (r?.error ? null : r);
  app.settings = {
    headers: ok(headers),
    ratelimit: ok(ratelimit),
    cors: ok(cors),
    filtering: ok(filtering),
    ipdb: ok(ipdb),
  };
}

export async function init() {
  if (!hasAuth()) {
    signOut();
    return;
  }
  window.addEventListener("popstate", () => {
    app.focusHeading = true;
    applyRoute(parseHash());
  });
  await Promise.all([refreshSettings(), loadKeys()]);
  await applyRoute(parseHash());
  app.ready = true;
}
