/**
 * Per-site routing helpers: site key format, input validation for the admin
 * API, the per-isolate site cache and the scope / storage key of a site.
 *
 * Kept free of `cloudflare:workers` imports so it can be unit tested outside a
 * Worker; the registry is passed in.
 */

import { SITE_SETTING_RANGES } from "./config.js";

/** 10 lowercase hex characters, like upstream standalone's site keys. */
export const SITE_KEY_PATTERN = /^[0-9a-f]{10}$/;

const SITE_PATH = /^\/([0-9a-f]{10})\/(challenge|redeem|siteverify)$/;

/** `/<siteKey>/<action>` -> `{ siteKey, action }`, otherwise `null`. */
export function parseSitePath(pathname) {
  const match = SITE_PATH.exec(pathname);
  return match ? { siteKey: match[1], action: match[2] } : null;
}

/**
 * Challenge scope and token storage suffix of a site. The scope is signed
 * into the challenge JWT (`validateChallenge` rejects a mismatch), and the
 * suffix keeps every site's tokens apart in the token store: a token minted
 * for one site can neither be redeemed at nor verified by another. The suffix
 * goes after the challenge signature, so the key's first character — which
 * picks the shard — stays uniformly distributed.
 */
export function siteTenant(siteKey) {
  return { scope: `site:${siteKey}`, keySuffix: `@${siteKey}` };
}

/** The Worker-wide config with a site's overrides and origins applied. */
export function siteConfig(config, site) {
  return {
    ...config,
    ...site.settings,
    allowedOrigins: new Set(site.origins),
  };
}

export class ValidationError extends Error {}

export const MAX_ORIGINS = 50;
/** Kept small on purpose: every isolate holds the whole registry in memory. */
export const MAX_SITES = 200;

function isLoopback(hostname) {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

/**
 * Admin input -> list of bare origins. `https:` only, except loopback hosts,
 * which may use `http:` for local development.
 */
export function validateOrigins(input) {
  if (!Array.isArray(input))
    throw new ValidationError("origins must be a list");
  const origins = [];
  for (const raw of input) {
    const entry = String(raw ?? "").trim();
    if (!entry) continue;
    let url;
    try {
      url = new URL(entry);
    } catch {
      throw new ValidationError(`not a URL: ${entry}`);
    }
    if (url.origin !== entry.replace(/\/$/, "")) {
      throw new ValidationError(`must be a bare origin (no path): ${entry}`);
    }
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && isLoopback(url.hostname))
    ) {
      throw new ValidationError(`must use https: ${entry}`);
    }
    if (!origins.includes(url.origin)) origins.push(url.origin);
  }
  if (origins.length > MAX_ORIGINS) {
    throw new ValidationError(`at most ${MAX_ORIGINS} origins`);
  }
  return origins;
}

export function validateName(input) {
  const name = String(input ?? "").trim();
  if (!name || name.length > 80) {
    throw new ValidationError("name must be 1-80 characters");
  }
  return name;
}

/**
 * Admin input -> settings object. Only the keys in `SITE_SETTING_RANGES` plus
 * `blockAutomatedBrowsers` are accepted; `null` or `""` drops an override.
 */
export function validateSettings(input) {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("settings must be an object");
  }
  const settings = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === "") continue;
    if (key === "blockAutomatedBrowsers") {
      if (typeof value !== "boolean") {
        throw new ValidationError("blockAutomatedBrowsers must be a boolean");
      }
      settings[key] = value;
      continue;
    }
    const range = SITE_SETTING_RANGES[key];
    if (!range) throw new ValidationError(`unknown setting: ${key}`);
    const number = Number(value);
    if (!Number.isInteger(number) || number < range[0] || number > range[1]) {
      throw new ValidationError(
        `${key} must be an integer in [${range[0]}, ${range[1]}]`,
      );
    }
    settings[key] = number;
  }
  return settings;
}

/**
 * Per-isolate snapshot of the whole registry (at most `MAX_SITES` rows),
 * refreshed at most once per `CACHE_TTL_MS`. Caching the whole list instead
 * of single keys bounds registry reads by time, not by key: a flood of
 * requests for random site keys costs no more Durable Object requests than
 * real traffic does. An admin change therefore reaches other isolates within
 * `CACHE_TTL_MS`; the isolate that handled the change drops its snapshot
 * immediately (`forgetSites`).
 */
export const CACHE_TTL_MS = 30_000;
let snapshot = null; // { at, sites: Map }
let pending = null;

export async function loadSite(registry, siteKey, now = Date.now()) {
  if (!snapshot || now - snapshot.at >= CACHE_TTL_MS) {
    // One registry read per isolate at a time, however many requests miss.
    pending ??= registry
      .listSites()
      .then((list) => {
        snapshot = {
          at: now,
          sites: new Map(list.map((site) => [site.siteKey, site])),
        };
      })
      .finally(() => {
        pending = null;
      });
    await pending;
  }
  return snapshot.sites.get(siteKey) ?? null;
}

export function forgetSites() {
  snapshot = null;
}
