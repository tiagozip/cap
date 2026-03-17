import { db } from "./db.js";

let _headers = null;
let _ratelimit = null;

export async function loadHeaders() {
  const raw = await db.get("settings:headers");
  _headers = raw ? JSON.parse(raw) : { ipHeader: "", countryHeader: "", asnHeader: "" };
  return _headers;
}

export function getHeaders() {
  return _headers;
}

export function setHeaders(settings) {
  _headers = settings;
}

export async function loadRatelimit() {
  const raw = await db.get("settings:ratelimit");
  _ratelimit = raw ? JSON.parse(raw) : { max: 30, duration: 5000 };
  return _ratelimit;
}

export function getRatelimit() {
  return _ratelimit || { max: 30, duration: 5000 };
}

export function setRatelimit(settings) {
  _ratelimit = settings;
}

let _corsDefault = null;

export async function loadCorsDefault() {
  const raw = await db.get("settings:cors");
  _corsDefault = raw ? JSON.parse(raw) : { origins: null };
  return _corsDefault;
}

export function getCorsDefault() {
  return _corsDefault || { origins: null };
}

export function setCorsDefault(settings) {
  _corsDefault = settings;
}

let _filtering = null;

export async function loadFiltering() {
  const raw = await db.get("settings:filtering");
  _filtering = raw ? JSON.parse(raw) : { blockNonBrowserUA: false, requiredHeaders: [] };
  return _filtering;
}

export function getFiltering() {
  return _filtering || { blockNonBrowserUA: false, requiredHeaders: [] };
}

export function setFiltering(settings) {
  _filtering = settings;
}

const _corsCache = new Map();
const CORS_CACHE_TTL = 60_000;

export function checkCorsOrigin(request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const siteKey = parts[0];
  if (!siteKey) return true;

  const now = Date.now();
  const cached = _corsCache.get(siteKey);
  let origins = null;

  if (cached && now - cached.ts < CORS_CACHE_TTL) {
    origins = cached.origins;
  } else {
    populateCorsCache(siteKey);
    origins = getCorsDefault().origins ?? null;
  }

  if (!origins || !origins.length) return true;

  const from = request.headers.get("Origin") || "";
  return origins.includes(from);
}

function populateCorsCache(siteKey) {
  db.hget(`key:${siteKey}`, "config").then((configStr) => {
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        const origins = config.corsOrigins?.length
          ? config.corsOrigins
          : getCorsDefault().origins ?? null;
        _corsCache.set(siteKey, { origins, ts: Date.now() });
      } catch {}
    } else {
      const fallback = getCorsDefault().origins ?? null;
      _corsCache.set(siteKey, { origins: fallback, ts: Date.now() });
    }
  }).catch(() => {});
}

export function invalidateCorsCache(siteKey) {
  if (siteKey) {
    _corsCache.delete(siteKey);
  } else {
    _corsCache.clear();
  }
}
