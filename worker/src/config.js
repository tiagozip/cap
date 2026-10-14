/**
 * Worker configuration, read from `env` on every request.
 *
 * Secrets (`CAP_SECRET`, `SITEVERIFY_SECRET`) come from `.dev.vars` locally and
 * `wrangler secret put` in production. Everything else is a plain `vars` entry
 * in `wrangler.jsonc`, so it can be tuned without touching code.
 */

const DEFAULT_ALLOWED_ORIGINS = "https://verify.rakko.cn";

const SUPPORTED_PROTOCOLS = new Set([
  "sha256-pow",
  "hashwx",
  "instrumentation",
]);

export const DEFAULTS = {
  challengeCount: 50,
  challengeSize: 32,
  challengeDifficulty: 4,
  instrumentationLevel: 3,
  blockAutomatedBrowsers: false,
  tokenTtlMs: 20 * 60 * 1000,
  hashwxDifficulty: 1_000_000,
  hashwxChallengeCount: 4,
};

function intVar(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `[config] ${name} must be an integer in [${min}, ${max}], got ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

function boolVar(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = String(raw).trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(
    `[config] ${name} must be a boolean, got ${JSON.stringify(raw)}`,
  );
}

/**
 * Settings an admin may override per site (`sites.settings` in the
 * `SiteRegistry`). Anything a site leaves out inherits the Worker-wide value
 * from `vars`, and the ranges are the same as for the env vars.
 */
export const SITE_SETTING_RANGES = {
  challengeCount: [1, 1000],
  challengeSize: [1, 256],
  challengeDifficulty: [1, 16],
  tokenTtlMs: [1000, 24 * 60 * 60 * 1000],
};

export function parseAllowedOrigins(raw) {
  const list = String(raw ?? DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const origins = new Set();
  for (const entry of list) {
    let url;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(`[config] ALLOWED_ORIGINS entry is not a URL: ${entry}`);
    }
    if (url.origin !== entry.replace(/\/$/, "")) {
      throw new Error(
        `[config] ALLOWED_ORIGINS entries must be bare origins (no path), got ${entry}`,
      );
    }
    origins.add(url.origin);
  }
  return origins;
}

export function parseProtocols(raw) {
  const protocols = String(raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const protocol of protocols) {
    if (!SUPPORTED_PROTOCOLS.has(protocol)) {
      throw new Error(
        `[config] CHALLENGE_PROTOCOLS has unsupported protocol '${protocol}' (supported: ${[...SUPPORTED_PROTOCOLS].join(", ")})`,
      );
    }
  }
  return protocols;
}

const DEFAULT_PRIESTESS_API_BASE = "https://api.rakko.cn/auth/priestess/oidc";
const DEFAULT_PRIESTESS_APP_ID = "priestess-verification";

/**
 * `/admin` login settings. The admin console signs in through Priestess (the
 * Phainon Worker's native login-code flow) and then additionally requires the
 * Priestess `sub` to be listed in `ADMIN_ALLOWED_SUBS`; an empty list lets
 * nobody in.
 */
export function readAdminConfig(env) {
  const apiBase = String(
    env.PRIESTESS_API_BASE || DEFAULT_PRIESTESS_API_BASE,
  ).replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(apiBase);
  } catch {
    throw new Error(`[config] PRIESTESS_API_BASE is not a URL: ${apiBase}`);
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1") {
    throw new Error(`[config] PRIESTESS_API_BASE must be https: ${apiBase}`);
  }
  return {
    apiBase,
    appId: String(env.PRIESTESS_APP_ID || DEFAULT_PRIESTESS_APP_ID),
    allowedSubs: new Set(
      String(env.ADMIN_ALLOWED_SUBS ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  };
}

export function readConfig(env) {
  return {
    capSecret: env.CAP_SECRET ?? "",
    siteverifySecret: env.SITEVERIFY_SECRET ?? "",
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    protocols: parseProtocols(env.CHALLENGE_PROTOCOLS),
    challengeCount: intVar(
      env,
      "CHALLENGE_COUNT",
      DEFAULTS.challengeCount,
      1,
      1000,
    ),
    challengeSize: intVar(
      env,
      "CHALLENGE_SIZE",
      DEFAULTS.challengeSize,
      1,
      256,
    ),
    challengeDifficulty: intVar(
      env,
      "CHALLENGE_DIFFICULTY",
      DEFAULTS.challengeDifficulty,
      1,
      16,
    ),
    instrumentationLevel: intVar(
      env,
      "INSTRUMENTATION_LEVEL",
      DEFAULTS.instrumentationLevel,
      1,
      10,
    ),
    blockAutomatedBrowsers: boolVar(
      env,
      "BLOCK_AUTOMATED_BROWSERS",
      DEFAULTS.blockAutomatedBrowsers,
    ),
    tokenTtlMs: intVar(
      env,
      "TOKEN_TTL_MS",
      DEFAULTS.tokenTtlMs,
      1000,
      24 * 60 * 60 * 1000,
    ),
    hashwxDifficulty: intVar(
      env,
      "HASHWX_DIFFICULTY",
      DEFAULTS.hashwxDifficulty,
      1,
      1_000_000_000,
    ),
    hashwxChallengeCount: intVar(
      env,
      "HASHWX_CHALLENGE_COUNT",
      DEFAULTS.hashwxChallengeCount,
      1,
      64,
    ),
  };
}
