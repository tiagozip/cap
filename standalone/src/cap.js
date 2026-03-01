import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

import { db } from "./db.js";
import {
  generateInstrumentationChallenge,
  verifyInstrumentationResult,
  warmForConfigs,
} from "./instrumentation.js";
import { ratelimitGenerator } from "./ratelimit.js";

const CHALLENGE_TTL_MS = 15 * 60 * 1000; // 15min
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2h

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

export const capServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
})
  .use(
    rateLimit({
      scoping: "scoped",
      max: 45,
      duration: 5_000,
      generator: ratelimitGenerator,
    }),
  )
  .use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") || true,
      methods: ["POST"],
    }),
  )

  .post("/:siteKey/challenge", async ({ set, params }) => {
    const [keyRow] = await db`SELECT config, jwtSecret FROM keys WHERE siteKey = ${params.siteKey}`;

    if (!keyRow) {
      set.status = 404;
      return { error: "Invalid site key or secret" };
    }

    const keyConfig = JSON.parse(keyRow.config);
    const jwtSecret = keyRow.jwtsecret ?? keyRow.jwtSecret;

    if (!jwtSecret) {
      set.status = 500;
      return { error: "Site key is not configured for JWT challenges" };
    }

    const c = keyConfig.challengeCount ?? 80;
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
    };

    let instrBytes = null;
    if (keyConfig.instrumentation) {
      const instr = await generateInstrumentationChallenge(keyConfig);

      jwtPayload.ei = encrypt(
        {
          id: instr.id,
          validStates: instr.validStates,
          vars: instr.vars,
          blockAutomatedBrowsers: instr.blockAutomatedBrowsers,
          expires,
        },
        jwtSecret,
      );

      instrBytes = instr.instrumentation;

      warmForConfigs([keyConfig]);
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
    if (!body || !body.token || !body.solutions) {
      set.status = 400;
      return { error: "Missing required fields" };
    }

    const [keyRow] = await db`SELECT jwtSecret FROM keys WHERE siteKey = ${params.siteKey}`;

    if (!keyRow) {
      set.status = 404;
      return { error: "Invalid site key" };
    }

    const jwtSecret = keyRow.jwtsecret ?? keyRow.jwtSecret;

    if (!jwtSecret) {
      set.status = 500;
      return { error: "Site key is not configured for JWT challenges" };
    }

    const payload = jwtVerify(body.token, jwtSecret);

    if (!payload) {
      set.status = 403;
      return { error: "Invalid challenge token" };
    }

    if (payload.sk !== params.siteKey) {
      set.status = 403;
      return { error: "Challenge token does not match site key" };
    }

    if (!payload.exp || payload.exp < Date.now()) {
      set.status = 403;
      return { error: "Challenge expired" };
    }

    const sig = jwtSigHex(body.token);
    if (!sig) {
      set.status = 403;
      return { error: "Malformed challenge token" };
    }

    const [existing] = await db`SELECT 1 FROM challenge_blocklist WHERE sig = ${sig}`;
    if (existing) {
      set.status = 403;
      return { error: "Challenge already redeemed" };
    }

    const { c, s: size, d: difficulty } = payload;
    const solutions = body.solutions;

    if (
      !Array.isArray(solutions) ||
      solutions.length !== c ||
      solutions.some((v) => typeof v !== "number")
    ) {
      set.status = 400;
      return { error: "Invalid solutions" };
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
      set.status = 403;
      return { error: "Invalid solution" };
    }

    let instrMeta = null;
    if (payload.ei) {
      instrMeta = decrypt(payload.ei, jwtSecret);
      if (!instrMeta) {
        set.status = 403;
        return {
          instr_error: true,
          error: "Blocked by instrumentation",
          reason: "corrupted_instrumentation_data",
        };
      }
    }

    if (instrMeta) {
      if (body.instr_blocked === true) {
        if (instrMeta.blockAutomatedBrowsers) {
          set.status = 403;
          return {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: "automated_browser_detected",
          };
        }
      } else if (body.instr) {
        let instrResult;
        if (instrMeta.expires && Date.now() > instrMeta.expires) {
          instrResult = { valid: false, env: null, reason: "expired" };
        } else {
          instrResult = verifyInstrumentationResult(instrMeta, body.instr);
        }

        if (!instrResult.valid) {
          set.status = 403;
          return {
            instr_error: true,
            error: "Blocked by instrumentation",
            reason: instrResult.reason || "failed_challenge",
          };
        }
      } else if (body.instr_timeout === true) {
        set.status = 429;
        return { instr_error: true, error: "Instrumentation timeout", reason: "timeout" };
      } else {
        set.status = 403;
        return {
          instr_error: true,
          error: "Blocked by instrumentation",
          reason: "missing_instrumentation_response",
        };
      }
    }

    await db`
      INSERT INTO challenge_blocklist (sig, expires)
      VALUES (${sig}, ${payload.exp})
    `;

    const redeemId = randomBytes(8).toString("hex");
    const redeemSecret = randomBytes(15).toString("hex");
    const redeemToken = `${redeemId}:${redeemSecret}`;
    const tokenExpires = Date.now() + TOKEN_TTL_MS;

    await db`
      INSERT INTO tokens (siteKey, token, expires)
      VALUES (${params.siteKey}, ${redeemToken}, ${tokenExpires})
    `;

    const now = Math.floor(Date.now() / 1000);
    const hourlyBucket = Math.floor(now / 3600) * 3600;
    await db`
      INSERT INTO solutions (siteKey, bucket, count)
      VALUES (${params.siteKey}, ${hourlyBucket}, 1)
      ON CONFLICT (siteKey, bucket)
      DO UPDATE SET count = count + 1
    `;

    return {
      success: true,
      token: redeemToken,
      expires: tokenExpires,
    };
  });

export async function prewarmInstrumentation() {
  try {
    const keys = await db`SELECT config FROM keys`;
    const instrConfigs = keys
      .map((k) => {
        try {
          return JSON.parse(k.config);
        } catch {
          return null;
        }
      })
      .filter((c) => c?.instrumentation === true);
    if (instrConfigs.length > 0) warmForConfigs(instrConfigs);
  } catch (e) {
    console.warn("[cap] prewarmInstrumentation failed:", e);
  }
}
