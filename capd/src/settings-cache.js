import { db } from "#db";
import { deprecated } from "./config.js";

let _headers = null;
let _ratelimit = null;

const seedFromEnv = async (key, name, place, value) => {
  const raw = await db.get(key);
  if (!process.env[name]) return raw;
  deprecated(
    name,
    raw
      ? `${name} is deprecated and ignored, because ${place} is already saved. Remove the variable.`
      : `${name} is deprecated. Cap copied it into ${place}, so change it there and remove the variable.`,
  );
  if (raw) return raw;
  const seeded = JSON.stringify(value(process.env[name]));
  await db.set(key, seeded);
  return seeded;
};

export async function loadHeaders() {
  const raw = await seedFromEnv(
    "settings:headers",
    "RATELIMIT_IP_HEADER",
    "Settings > Visitor location > Your proxy or CDN",
    (v) => ({ ipHeader: v.trim(), countryHeader: "", asnHeader: "" }),
  );
  _headers = raw
    ? JSON.parse(raw)
    : { ipHeader: "", countryHeader: "", asnHeader: "" };
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
  const raw = await seedFromEnv(
    "settings:cors",
    "CORS_ORIGIN",
    "Settings > Default protection > Only allow my websites",
    (v) => {
      const origins = v
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o && o !== "*");
      return { origins: origins.length ? origins : null };
    },
  );
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
  _filtering = raw
    ? JSON.parse(raw)
    : { blockNonBrowserUA: false, requiredHeaders: [] };
  return _filtering;
}

export function getFiltering() {
  return _filtering || { blockNonBrowserUA: false, requiredHeaders: [] };
}

export function setFiltering(settings) {
  _filtering = settings;
}

const corsCache = new Map();
const CORS_CACHE_TTL = 60_000;
const CORS_CACHE_MAX = 5_000;
const WIDGET_ROUTE = /^\/([^/]{1,128})\/(challenge|redeem)\/?$/;

async function keyOrigins(siteKey) {
  const cached = corsCache.get(siteKey);
  if (cached && Date.now() - cached.ts < CORS_CACHE_TTL) return cached;
  let configStr;
  try {
    configStr = await db.hget(`key:${siteKey}`, "config");
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
  if (!configStr) {
    corsCache.delete(siteKey);
    return { exists: false, origins: null };
  }
  let origins = null;
  try {
    const list = JSON.parse(configStr).corsOrigins;
    if (Array.isArray(list) && list.length) origins = list;
  } catch {}
  const entry = { exists: true, origins, ts: Date.now() };
  corsCache.delete(siteKey);
  corsCache.set(siteKey, entry);
  if (corsCache.size > CORS_CACHE_MAX)
    corsCache.delete(corsCache.keys().next().value);
  return entry;
}

const wildcardCache = new Map();

const wildcardHost = (pattern) => {
  if (wildcardCache.has(pattern)) return wildcardCache.get(pattern);
  const labels = pattern.split(".");
  const valid =
    labels.length >= 3 &&
    labels.every((l) => /^[a-z0-9*-]+$/.test(l)) &&
    !labels.slice(-2).some((l) => l.includes("*")) &&
    labels.slice(1).every((l) => l !== "*");
  const re = valid
    ? new RegExp(
        `^${labels
          .map((l, i) =>
            i === 0 && l === "*"
              ? "(?:[a-z0-9-]+\\.)+"
              : `${l.replaceAll("*", "[a-z0-9-]+")}${i < labels.length - 1 ? "\\." : ""}`,
          )
          .join("")}$`,
      )
    : null;
  if (wildcardCache.size >= 1000) wildcardCache.clear();
  wildcardCache.set(pattern, re);
  return re;
};

const wildcardMatches = (entry, url) => {
  const m = /^(https?):\/\/([^/]+)\/?$/.exec(entry);
  if (m && `${m[1]}:` !== url.protocol) return false;
  const hostPort = m ? m[2] : entry;
  const colon = hostPort.lastIndexOf(":");
  const host = colon < 0 ? hostPort : hostPort.slice(0, colon);
  const port = colon < 0 ? "" : hostPort.slice(colon + 1);
  if (port !== url.port) return false;
  return !!wildcardHost(host)?.test(url.hostname);
};

export const originAllowed = (origins, from) => {
  if (!origins?.length) return true;
  if (origins.includes(from)) return true;
  let url;
  try {
    url = new URL(from);
  } catch {
    return false;
  }
  if (!url.host) return false;
  if (origins.includes(url.host)) return true;
  if (!["http:", "https:"].includes(url.protocol)) return false;
  return origins.some(
    (entry) =>
      typeof entry === "string" &&
      entry.includes("*") &&
      wildcardMatches(entry.toLowerCase(), url),
  );
};

export function corsTarget(pathname) {
  if (pathname === "/assets" || pathname.startsWith("/assets/"))
    return { any: true };
  const match = WIDGET_ROUTE.exec(pathname);
  return match ? { siteKey: match[1] } : null;
}

export async function checkCorsOrigin(siteKey, from) {
  let entry;
  try {
    entry = await keyOrigins(siteKey);
  } catch {
    return false;
  }
  const { exists, origins } = entry;
  return originAllowed(
    exists && origins ? origins : getCorsDefault().origins,
    from,
  );
}

export const corsCacheSize = () => corsCache.size;

export function invalidateCorsCache(siteKey) {
  if (siteKey) {
    corsCache.delete(siteKey);
  } else {
    corsCache.clear();
  }
}
