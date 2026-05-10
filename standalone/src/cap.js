import { randomBytes } from "node:crypto";
import { cors } from "@elysiajs/cors";
import {
  generateChallenge as coreGenerateChallenge,
  validateChallenge as coreValidateChallenge,
} from "capjs-core";
import { Elysia } from "elysia";

import { db } from "./db.js";
import { isLoaded as ipdbIsLoaded, lookup as ipLookup } from "./ipdb.js";
import valkeyRateLimit from "./ratelimit.js";
import {
  checkCorsOrigin,
  getFiltering,
  getHeaders,
  getRatelimit,
} from "./settings-cache.js";

function hourlyBucket() {
  return String(Math.floor(Date.now() / 1000 / 3600) * 3600);
}

function parseUA(ua) {
  if (!ua) return { platform: null, os: null };

  let os = null;
  if (/iPad/.test(ua)) os = "iPadOS";
  else if (/iPhone/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";

  let platform = null;
  if (/iPhone|Android.*Mobile|Mobile.*Android/.test(ua)) platform = "Phone";
  else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) platform = "Tablet";
  else if (/Macintosh|Windows|Linux|CrOS/.test(ua)) platform = "Desktop";

  return { platform, os };
}

const DEFAULT_IP_HEADERS = ["X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP"];

function getClientIp(request, srv) {
  const cachedHeaders = getHeaders();
  const headerName = cachedHeaders?.ipHeader || process.env.RATELIMIT_IP_HEADER;
  if (headerName) {
    const ip =
      request.headers.get(headerName) ||
      request.headers.get(headerName.toLowerCase());
    if (ip) {
      const parts = ip.split(",").filter((e) => !!e.trim());
      return parts[0].trim();
    }
  }

  for (const h of DEFAULT_IP_HEADERS) {
    const val = request.headers.get(h);
    if (val) {
      const parts = val.split(",").filter((e) => !!e.trim());
      return parts[0].trim();
    }
  }
  return srv?.requestIP(request)?.address || null;
}

const CHALLENGE_TTL_MS = 15 * 60 * 1000; // 15min
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2h

function ipv4ToInt(a) {
  return a.split(".").reduce((r, b) => (r << 8) + parseInt(b, 10), 0) >>> 0;
}

function expandIPv6(addr) {
  let a = addr;
  if (a.includes("::")) {
    const [left, right] = a.split("::");
    const lParts = left ? left.split(":") : [];
    const rParts = right ? right.split(":") : [];
    const missing = 8 - lParts.length - rParts.length;
    a = [...lParts, ...Array(missing).fill("0"), ...rParts].join(":");
  }
  return a
    .split(":")
    .map((g) => g.padStart(4, "0"))
    .join(":");
}

function ipv6ToBytes(addr) {
  const hex = expandIPv6(addr).replace(/:/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function ipInCIDR(ip, cidr) {
  try {
    const [range, prefix] = cidr.split("/");
    const bits = parseInt(prefix, 10);
    if (Number.isNaN(bits)) return false;

    const isV4 = ip.includes(".") && !ip.includes(":");
    const rangeIsV4 = range.includes(".") && !range.includes(":");

    if (isV4 && rangeIsV4) {
      if (bits < 0 || bits > 32) return false;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
    }

    if (!isV4 && !rangeIsV4) {
      if (bits < 0 || bits > 128) return false;
      const ipBytes = ipv6ToBytes(ip);
      const rangeBytes = ipv6ToBytes(range);
      const fullBytes = Math.floor(bits / 8);
      for (let i = 0; i < fullBytes; i++) {
        if (ipBytes[i] !== rangeBytes[i]) return false;
      }
      if (bits % 8 !== 0) {
        const mask = 0xff << (8 - (bits % 8));
        if ((ipBytes[fullBytes] & mask) !== (rangeBytes[fullBytes] & mask))
          return false;
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const _blockCache = new Map();
const BLOCK_CACHE_TTL = 5_000;

async function loadBlockRules(siteKey) {
  const cached = _blockCache.get(siteKey);
  if (cached && Date.now() - cached.ts < BLOCK_CACHE_TTL) return cached.entries;

  const blockedHash = await db.hgetall(`blocked:${siteKey}`);
  let entries;
  if (!blockedHash) {
    entries = [];
  } else if (Array.isArray(blockedHash)) {
    entries = [];
    for (let i = 0; i < blockedHash.length; i += 2) {
      entries.push([String(blockedHash[i]), String(blockedHash[i + 1])]);
    }
  } else {
    entries = Object.entries(blockedHash);
  }

  _blockCache.set(siteKey, { entries, ts: Date.now() });
  return entries;
}

export function invalidateBlockCache(siteKey) {
  if (siteKey) _blockCache.delete(siteKey);
  else _blockCache.clear();
}

async function isBlocked(siteKey, ip) {
  const entries = await loadBlockRules(siteKey);
  if (entries.length === 0) return false;

  const now = Date.now();
  let ipGeo = null;

  for (const [key, val] of entries) {
    if (val !== "0" && Number(val) <= now) continue;

    if (key === ip) return true;

    if (key.startsWith("cidr:")) {
      if (ipInCIDR(ip, key.slice(5))) return true;
      continue;
    }

    if (key.startsWith("asn:")) {
      if (!ipGeo && ipdbIsLoaded()) ipGeo = await ipLookup(ip);
      if (ipGeo) {
        const blockedAsn = key.slice(4);
        if (ipGeo.asn === blockedAsn || ipGeo.org === blockedAsn) return true;
      }
      continue;
    }

    if (key.startsWith("country:")) {
      if (!ipGeo && ipdbIsLoaded()) ipGeo = await ipLookup(ip);
      if (ipGeo?.country === key.slice(8)) return true;
    }
  }

  return false;
}

export const capServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
})
  .use(
    valkeyRateLimit({
      max: 30,
      duration: 5_000,
      getLimits: async (params) => {
        if (params?.siteKey) {
          const configStr = await db.hget(`key:${params.siteKey}`, "config");
          if (configStr) {
            try {
              const config = JSON.parse(configStr);
              if (
                config.ratelimitMax != null &&
                config.ratelimitDuration != null
              ) {
                return {
                  max: config.ratelimitMax,
                  duration: config.ratelimitDuration,
                };
              }
            } catch {}
          }
        }
        const global = getRatelimit();
        return { max: global.max, duration: global.duration };
      },
      onLimited: async (request) => {
        try {
          const url = new URL(request.url);
          const parts = url.pathname.split("/").filter(Boolean);
          const siteKey = parts[0];
          if (siteKey) {
            await db.hincrby(
              `metrics:ratelimited:${siteKey}`,
              hourlyBucket(),
              1,
            );
          }
        } catch {}
      },
    }),
  )
  .use(
    cors({
      origin: checkCorsOrigin,
      methods: ["POST"],
    }),
  )

  .post(
    "/:siteKey/challenge",
    async ({ set, params, request, server: srv }) => {
      const fields = await db.hmget(`key:${params.siteKey}`, [
        "config",
        "jwtSecret",
      ]);

      if (!fields[0]) {
        set.status = 404;
        return { error: "Invalid site key or secret" };
      }

      const ip = getClientIp(request, srv);

      try {
        if (ip && (await isBlocked(params.siteKey, ip))) {
          set.status = 403;
          return { error: "Blocked" };
        }
      } catch (e) {
        console.error("[cap] isBlocked check failed:", e);
      }

      const fnf = (p) => {
        p.catch(() => {});
      };

      (async () => {
        if (!ip) return;
        const cachedHeaders = getHeaders();
        const hs = cachedHeaders || {};
        let country = null;
        let asnValue = null;

        if (hs.countryHeader) {
          country =
            request.headers.get(hs.countryHeader) ||
            request.headers.get(hs.countryHeader.toLowerCase());
        }
        if (hs.asnHeader) {
          asnValue =
            request.headers.get(hs.asnHeader) ||
            request.headers.get(hs.asnHeader.toLowerCase());
        }

        if ((!country || !asnValue) && ipdbIsLoaded()) {
          const geo = await ipLookup(ip);
          if (!country && geo.country) country = geo.country;
          if (!asnValue && geo.asn)
            asnValue = geo.org ? `${geo.asn} ${geo.org}` : geo.asn;
        }

        if (country) {
          fnf(
            db.hincrby(
              `metrics:country:${params.siteKey}`,
              country.toUpperCase(),
              1,
            ),
          );
        }
        if (asnValue) {
          fnf(db.hincrby(`metrics:asn:${params.siteKey}`, asnValue, 1));
        }
      })().catch(() => {});

      try {
        const ua = request.headers.get("user-agent");
        const { platform, os } = parseUA(ua);
        if (platform) {
          fnf(db.hincrby(`metrics:platform:${params.siteKey}`, platform, 1));
        }
        if (os) {
          fnf(db.hincrby(`metrics:os:${params.siteKey}`, os, 1));
        }
      } catch {}

      const keyConfig = JSON.parse(fields[0]);
      const jwtSecret = fields[1];

      if (!jwtSecret) {
        set.status = 500;
        return { error: "Site key is not configured for JWT challenges" };
      }

      const globalFilter = getFiltering();
      const blockUA =
        keyConfig.blockNonBrowserUA ?? globalFilter.blockNonBrowserUA;
      const reqHeaders = keyConfig.requiredHeaders?.length
        ? keyConfig.requiredHeaders
        : globalFilter.requiredHeaders;

      if (blockUA) {
        const ua = request.headers.get("user-agent") || "";
        const browserPattern =
          /Mozilla\/|Chrome\/|Safari\/|Firefox\/|Opera\/|Edg\//i;
        if (!ua || !browserPattern.test(ua)) {
          set.status = 403;
          return { error: "Blocked" };
        }
      }

      if (reqHeaders?.length) {
        for (const h of reqHeaders) {
          if (!request.headers.get(h)) {
            set.status = 403;
            return { error: "Blocked" };
          }
        }
      }

      let result;
      try {
        result = await coreGenerateChallenge(jwtSecret, {
          challengeCount: keyConfig.challengeCount ?? 80,
          challengeSize: keyConfig.saltSize ?? 32,
          challengeDifficulty: keyConfig.difficulty ?? 4,
          expiresMs: CHALLENGE_TTL_MS,
          scope: params.siteKey,
          instrumentation: keyConfig.instrumentation
            ? {
                blockAutomatedBrowsers:
                  keyConfig.blockAutomatedBrowsers === true,
                obfuscationLevel: keyConfig.obfuscationLevel,
              }
            : false,
        });
      } catch (err) {
        console.error("[cap] generateChallenge failed:", err);
        set.status = 500;
        return { error: "Failed to generate challenge" };
      }

      return result;
    },
  )

  .post("/:siteKey/redeem", async ({ body, set, params }) => {
    const bucket = hourlyBucket();
    const failAndTrack = async (status, response) => {
      set.status = status;
      await db.hincrby(`metrics:failed:${params.siteKey}`, bucket, 1);
      return response;
    };

    if (!body || !body.token || !body.solutions) {
      set.status = 400;
      return { error: "Missing required fields" };
    }

    const jwtSecret = await db.hget(`key:${params.siteKey}`, "jwtSecret");
    if (!jwtSecret) {
      set.status = 404;
      return { error: "Invalid site key" };
    }

    const result = await coreValidateChallenge(
      jwtSecret,
      {
        token: body.token,
        solutions: body.solutions,
        instr: body.instr,
        instr_blocked: body.instr_blocked,
        instr_timeout: body.instr_timeout,
      },
      {
        scope: params.siteKey,
        consumeNonce: async (sigHex, ttlMs) => {
          const ttlSecs = Math.max(1, Math.ceil(ttlMs / 1000));
          const claim = await db.send("SET", [
            `blocklist:${sigHex}`,
            "1",
            "NX",
            "EX",
            String(ttlSecs),
          ]);
          return claim === "OK";
        },
        signToken: () => {
          const redeemId = randomBytes(8).toString("hex");
          const redeemSecret = randomBytes(15).toString("hex");
          return `${params.siteKey}:${redeemId}:${redeemSecret}`;
        },
        tokenTtlMs: TOKEN_TTL_MS,
      },
    );

    if (!result.success) {
      const reason = result.reason;
      if (
        reason === "missing_token" ||
        reason === "missing_solutions" ||
        reason === "invalid_solutions"
      ) {
        return failAndTrack(400, { error: "Invalid solutions" });
      }
      if (reason === "expired") {
        return failAndTrack(403, { error: "Challenge expired" });
      }
      if (reason === "scope_mismatch") {
        return failAndTrack(403, {
          error: "Challenge token does not match site key",
        });
      }
      if (reason === "invalid_token") {
        return failAndTrack(403, { error: "Invalid challenge token" });
      }
      if (reason === "already_redeemed") {
        return failAndTrack(403, { error: "Challenge already redeemed" });
      }
      if (reason === "invalid_solution") {
        return failAndTrack(403, { error: "Invalid solution" });
      }
      if (result.instr_error) {
        if (reason === "instr_corrupted") {
          return failAndTrack(403, {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: "corrupted_instrumentation_data",
          });
        }
        if (reason === "instr_expired") {
          return failAndTrack(403, {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: "expired",
          });
        }
        if (reason === "instr_automated_browser") {
          return failAndTrack(403, {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: "automated_browser_detected",
          });
        }
        if (reason === "instr_timeout") {
          return failAndTrack(429, {
            instr_error: true,
            error: "Instrumentation timeout",
            reason: "timeout",
          });
        }
        if (reason === "instr_missing") {
          return failAndTrack(403, {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: "missing_instrumentation_response",
          });
        }
        return failAndTrack(403, {
          instr_error: true,
          error: "Blocked by instrumentation",
          reason: reason || "failed_challenge",
        });
      }
      return failAndTrack(403, {
        error: result.error || "Validation failed",
        reason,
      });
    }

    const redeemToken = result.token;
    const tokenExpires = result.expires;
    const tokenTtlSecs = Math.ceil(TOKEN_TTL_MS / 1000);
    await db.set(`token:${redeemToken}`, String(tokenExpires));
    await db.expire(`token:${redeemToken}`, tokenTtlSecs);

    await db.hincrby(`metrics:verified:${params.siteKey}`, bucket, 1);

    if (result.iat) {
      const latencyMs = Date.now() - result.iat;
      await db.hincrby(
        `metrics:latency_sum:${params.siteKey}`,
        bucket,
        latencyMs,
      );
      await db.hincrby(`metrics:latency_count:${params.siteKey}`, bucket, 1);
    }

    return {
      success: true,
      token: redeemToken,
      expires: tokenExpires,
    };
  });
