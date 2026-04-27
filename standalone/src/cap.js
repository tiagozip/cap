import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { db } from "./db.js";
import {
  generateInstrumentationChallenge,
  verifyInstrumentationResult,
} from "./instrumentation.js";
import { isLoaded as ipdbIsLoaded, lookup as ipLookup } from "./ipdb.js";
import valkeyRateLimit from "./ratelimit.js";
import { checkCorsOrigin, getFiltering, getHeaders, getRatelimit } from "./settings-cache.js";

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
    const ip = request.headers.get(headerName) || request.headers.get(headerName.toLowerCase());
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

function matchTier(count, tiers) {
  const sorted = [...tiers].sort((a, b) => b.minRequests - a.minRequests);
  for (const tier of sorted) {
    if (count >= tier.minRequests) {
      return Math.min(tier.challengeCount, 500);
    }
  }
  return null;
}

function hashIp(ip, siteKey) {
  return createHmac("sha256", siteKey).update(ip).digest("hex").slice(0, 16);
}

async function adaptiveChallengeCount(ip, siteKey, baseCount, adaptiveConfig) {
  if (!adaptiveConfig?.enabled) return baseCount;

  const windowMs = adaptiveConfig.windowMs || 60_000;
  const windowSecs = Math.ceil(windowMs / 1000);
  const window = Math.floor(Date.now() / windowMs);

  let perIpResult = null;
  if (ip && adaptiveConfig.tiers?.length) {
    const ipHash = hashIp(ip, siteKey);
    const ipKey = `ac:${siteKey}:${ipHash}:${window}`;
    const ipCount = Number(await db.incr(ipKey));
    if (ipCount === 1) {
      await db.expire(ipKey, windowSecs + 1);
    }
    perIpResult = matchTier(ipCount, adaptiveConfig.tiers);
  }

  let globalResult = null;
  if (adaptiveConfig.globalTiers?.length) {
    const globalKey = `ac:g:${siteKey}:${window}`;
    const globalCount = Number(await db.incr(globalKey));
    if (globalCount === 1) {
      await db.expire(globalKey, windowSecs + 1);
    }
    globalResult = matchTier(globalCount, adaptiveConfig.globalTiers);
  }

  return Math.max(baseCount, perIpResult ?? baseCount, globalResult ?? baseCount);
}

const b64url = (buf) =>
  (buf instanceof Uint8Array ? Buffer.from(buf) : Buffer.from(buf, "utf8")).toString("base64url");

const b64urlDecode = (str) => Buffer.from(str, "base64url");

function jwtSign(payload, secret) {
  const header = b64url('{"alg":"HS256","typ":"JWT"}');
  const body = b64url(JSON.stringify(payload));
  const sigInput = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(sigInput).digest();
  return `${sigInput}.${b64url(sig)}`;
}

function jwtVerify(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, sig] = parts;
  const sigInput = `${header}.${body}`;
  const expected = createHmac("sha256", secret).update(sigInput).digest();
  const actual = b64urlDecode(sig);

  if (actual.length !== expected.length) return null;

  const a = new Uint8Array(expected);
  const b = new Uint8Array(actual);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return null;

  try {
    return JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return null;
  }
}

function jwtSigHex(token) {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  return b64urlDecode(token.slice(lastDot + 1)).toString("hex");
}

function deriveEncKey(jwtSecret) {
  return createHmac("sha256", jwtSecret).update("cap:instr-enc-v1").digest();
}

function encrypt(data, jwtSecret) {
  const key = deriveEncKey(jwtSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(blob, jwtSecret) {
  try {
    const buf = Buffer.from(blob, "base64url");
    if (buf.length < 28) return null; // iv(12) + tag(16)
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const key = deriveEncKey(jwtSecret);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

function prng(seed, length) {
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  let state = fnv1a(seed);
  let result = "";

  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }

  while (result.length < length) {
    const rnd = next();
    result += rnd.toString(16).padStart(8, "0");
  }

  return result.substring(0, length);
}

async function sha256(str) {
  return new Bun.CryptoHasher("sha256").update(str).digest("hex");
}

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
  return a.split(":").map((g) => g.padStart(4, "0")).join(":");
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
        if ((ipBytes[fullBytes] & mask) !== (rangeBytes[fullBytes] & mask)) return false;
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
              if (config.ratelimitMax != null && config.ratelimitDuration != null) {
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
            await db.hincrby(`metrics:ratelimited:${siteKey}`, hourlyBucket(), 1);
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

  .post("/:siteKey/challenge", async ({ set, params, request, server: srv }) => {
    const fields = await db.hmget(`key:${params.siteKey}`, ["config", "jwtSecret"]);

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

    const bucket = hourlyBucket();
    const fnf = (p) => { p.catch(() => {}); };

    (async () => {
      if (!ip) return;
      const cachedHeaders = getHeaders();
      const hs = cachedHeaders || {};
      let country = null,
        asnValue = null;

      if (hs.countryHeader) {
        country =
          request.headers.get(hs.countryHeader) ||
          request.headers.get(hs.countryHeader.toLowerCase());
      }
      if (hs.asnHeader) {
        asnValue =
          request.headers.get(hs.asnHeader) || request.headers.get(hs.asnHeader.toLowerCase());
      }

      if ((!country || !asnValue) && ipdbIsLoaded()) {
        const geo = await ipLookup(ip);
        if (!country && geo.country) country = geo.country;
        if (!asnValue && geo.asn) asnValue = geo.org ? `${geo.asn} ${geo.org}` : geo.asn;
      }

      if (country) {
        fnf(db.hincrby(`metrics:country:${params.siteKey}`, country.toUpperCase(), 1));
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
    const blockUA = keyConfig.blockNonBrowserUA ?? globalFilter.blockNonBrowserUA;
    const reqHeaders = keyConfig.requiredHeaders?.length
      ? keyConfig.requiredHeaders
      : globalFilter.requiredHeaders;

    if (blockUA) {
      const ua = request.headers.get("user-agent") || "";
      const browserPattern = /Mozilla\/|Chrome\/|Safari\/|Firefox\/|Opera\/|Edg\//i;
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

    const baseCount = keyConfig.challengeCount ?? 80;
    const adaptiveConfig = keyConfig.adaptiveChallengeCount ?? null;

    const c = await adaptiveChallengeCount(ip, params.siteKey, baseCount, adaptiveConfig);
    const s = keyConfig.saltSize ?? 32;
    const d = keyConfig.difficulty ?? 4;
    const expires = Date.now() + CHALLENGE_TTL_MS;

    const nonce = randomBytes(25).toString("hex");

    const jwtPayload = {
      sk: params.siteKey,
      n: nonce,
      c,
      s,
      d,
      exp: expires,
      iat: Date.now(),
    };

    let instrBytes = null;
    if (keyConfig.instrumentation) {
      const instr = await generateInstrumentationChallenge(keyConfig);

      jwtPayload.ei = encrypt(
        {
          id: instr.id,
          expectedVals: instr.expectedVals,
          vars: instr.vars,
          blockAutomatedBrowsers: instr.blockAutomatedBrowsers,
          expires,
        },
        jwtSecret,
      );

      instrBytes = instr.instrumentation;

    }

    const token = jwtSign(jwtPayload, jwtSecret);

    const response = {
      challenge: { c, s, d },
      token,
      expires,
    };

    if (instrBytes) {
      response.instrumentation = instrBytes;
    }

    return response;
  })

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

    const jwtSecretField = await db.hget(`key:${params.siteKey}`, "jwtSecret");

    if (!jwtSecretField) {
      set.status = 404;
      return { error: "Invalid site key" };
    }

    const jwtSecret = jwtSecretField;

    const payload = jwtVerify(body.token, jwtSecret);

    if (!payload) {
      return failAndTrack(403, { error: "Invalid challenge token" });
    }

    if (payload.sk !== params.siteKey) {
      return failAndTrack(403, {
        error: "Challenge token does not match site key",
      });
    }

    if (!payload.exp || payload.exp < Date.now()) {
      return failAndTrack(403, { error: "Challenge expired" });
    }

    const sig = jwtSigHex(body.token);
    if (!sig) {
      return failAndTrack(403, { error: "Malformed challenge token" });
    }

    const ttlMs = payload.exp - Date.now();
    const ttlSecs = Math.max(1, Math.ceil(ttlMs / 1000));
    const claim = await db.send("SET", [`blocklist:${sig}`, "1", "NX", "EX", String(ttlSecs)]);
    if (claim !== "OK") {
      return failAndTrack(403, { error: "Challenge already redeemed" });
    }

    const { c, s: size, d: difficulty } = payload;
    const solutions = body.solutions;

    if (
      !Array.isArray(solutions) ||
      solutions.length !== c ||
      solutions.some((v) => typeof v !== "number")
    ) {
      return failAndTrack(400, { error: "Invalid solutions" });
    }

    const prngSeed = body.token;

    let idx = 0;
    const challenges = Array.from({ length: c }, () => {
      idx++;
      return [prng(`${prngSeed}${idx}`, size), prng(`${prngSeed}${idx}d`, difficulty)];
    });

    const hashes = await Promise.all(
      challenges.map(([salt, target], i) => sha256(salt + solutions[i]).then((h) => [h, target])),
    );

    const isValid = hashes.every(([h, target]) => h.startsWith(target));

    if (!isValid) {
      return failAndTrack(403, { error: "Invalid solution" });
    }

    let instrMeta = null;
    if (payload.ei) {
      instrMeta = decrypt(payload.ei, jwtSecret);
      if (!instrMeta) {
        return failAndTrack(403, {
          instr_error: true,
          error: "Blocked by instrumentation",
          reason: "corrupted_instrumentation_data",
        });
      }
    }

    if (instrMeta) {
      if (body.instr_blocked === true) {
        if (instrMeta.blockAutomatedBrowsers) {
          return failAndTrack(403, {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: "automated_browser_detected",
          });
        }
      } else if (body.instr) {
        let instrResult;
        if (instrMeta.expires && Date.now() > instrMeta.expires) {
          instrResult = { valid: false, env: null, reason: "expired" };
        } else {
          instrResult = verifyInstrumentationResult(instrMeta, body.instr);
        }

        if (!instrResult.valid) {
          return failAndTrack(403, {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: instrResult.reason || "failed_challenge",
          });
        }
      } else if (body.instr_timeout === true) {
        return failAndTrack(429, {
          instr_error: true,
          error: "Instrumentation timeout",
          reason: "timeout",
        });
      } else {
        return failAndTrack(403, {
          instr_error: true,
          error: "Blocked by instrumentation",
          reason: "missing_instrumentation_response",
        });
      }
    }

    const redeemId = randomBytes(8).toString("hex");
    const redeemSecret = randomBytes(15).toString("hex");
    const redeemToken = `${params.siteKey}:${redeemId}:${redeemSecret}`;
    const tokenExpires = Date.now() + TOKEN_TTL_MS;
    const tokenTtlSecs = Math.ceil(TOKEN_TTL_MS / 1000);
    await db.set(`token:${redeemToken}`, String(tokenExpires));
    await db.expire(`token:${redeemToken}`, tokenTtlSecs);

    await db.hincrby(`metrics:verified:${params.siteKey}`, bucket, 1);

    if (payload.iat) {
      const latencyMs = Date.now() - payload.iat;
      await db.hincrby(`metrics:latency_sum:${params.siteKey}`, bucket, latencyMs);
      await db.hincrby(`metrics:latency_count:${params.siteKey}`, bucket, 1);
    }
    return {
      success: true,
      token: redeemToken,
      expires: tokenExpires,
    };
  });

