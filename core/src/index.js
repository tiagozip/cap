import {
  decryptGcm,
  encryptGcm,
  jwtSigHex,
  jwtSign,
  jwtVerify,
  parseHexPrefix,
  powMatchesPrefix,
  randomHex,
  sha256Bytes,
  sha256Hex,
} from "./crypto.js";
import {
  generateInstrumentation,
  verifyInstrumentationResult,
} from "./instrumentation.js";
import { fnv1a, fnv1aResume, prngFromHash } from "./prng.js";

const DEFAULT_CHALLENGE_COUNT = 50;
const DEFAULT_CHALLENGE_SIZE = 32;
const DEFAULT_CHALLENGE_DIFFICULTY = 4;
const DEFAULT_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 20 * 60 * 1000;

const MAX_CHALLENGE_COUNT = 1000;
const MAX_CHALLENGE_SIZE = 256;
const MAX_CHALLENGE_DIFFICULTY = 16;

function assertSecret(secret) {
  if (!secret) {
    throw new Error(
      "[capjs-core] secret is required. Pass a long, random, high-entropy string and keep it consistent across processes.",
    );
  }
  if (typeof secret !== "string" && !Buffer.isBuffer(secret)) {
    throw new Error("[capjs-core] secret must be a string or Buffer");
  }
  const len =
    typeof secret === "string"
      ? Buffer.byteLength(secret, "utf8")
      : secret.length;
  if (len < 16) {
    throw new Error("[capjs-core] secret must be at least 16 bytes for security");
  }
}

export async function generateChallenge(secret, opts = {}) {
  assertSecret(secret);

  const c = opts.challengeCount ?? DEFAULT_CHALLENGE_COUNT;
  const s = opts.challengeSize ?? DEFAULT_CHALLENGE_SIZE;
  const d = opts.challengeDifficulty ?? DEFAULT_CHALLENGE_DIFFICULTY;
  if (
    !Number.isInteger(c) ||
    c < 1 ||
    c > MAX_CHALLENGE_COUNT ||
    !Number.isInteger(s) ||
    s < 1 ||
    s > MAX_CHALLENGE_SIZE ||
    !Number.isInteger(d) ||
    d < 1 ||
    d > MAX_CHALLENGE_DIFFICULTY
  ) {
    throw new Error(
      `[capjs-core] invalid params: c, s must be positive ints (c≤${MAX_CHALLENGE_COUNT}, s≤${MAX_CHALLENGE_SIZE}), d in [1, ${MAX_CHALLENGE_DIFFICULTY}]`,
    );
  }
  const ttlMs = opts.expiresMs ?? DEFAULT_CHALLENGE_TTL_MS;
  const now = Date.now();
  const expires = now + ttlMs;

  const payload = {
    n: randomHex(25),
    c,
    s,
    d,
    exp: expires,
    iat: now,
  };
  if (opts.scope) payload.sk = String(opts.scope);
  if (opts.extra && typeof opts.extra === "object") payload.x = opts.extra;

  let instrumentation;
  if (opts.instrumentation) {
    const instrOpts =
      typeof opts.instrumentation === "object" ? opts.instrumentation : {};
    const generator = opts.instrumentationGenerator || generateInstrumentation;
    const instr = await generator({ ...instrOpts, ttlMs });
    payload.ei = encryptGcm(
      {
        id: instr.id,
        expectedVals: instr.expectedVals,
        vars: instr.vars,
        blockAutomatedBrowsers: instr.blockAutomatedBrowsers,
        expires,
      },
      secret,
    );
    instrumentation = instr.instrumentation;
  }

  const token = jwtSign(payload, secret);
  const result = { challenge: { c, s, d }, token, expires };
  if (instrumentation) result.instrumentation = instrumentation;
  return result;
}

function fail(reason, extra) {
  return { success: false, reason, ...(extra || {}) };
}

export async function validateChallenge(secret, body, opts = {}) {
  assertSecret(secret);

  if (!body || typeof body !== "object") return fail("invalid_body");
  if (!body.token || typeof body.token !== "string")
    return fail("missing_token");
  const solutions = body.solutions;
  if (!Array.isArray(solutions)) return fail("missing_solutions");

  const payload = jwtVerify(body.token, secret);
  if (!payload) return fail("invalid_token");

  if (opts.scope && payload.sk !== opts.scope) return fail("scope_mismatch");

  if (!payload.exp || payload.exp < Date.now()) return fail("expired");

  const c = payload.c;
  const size = payload.s;
  const difficulty = payload.d;

  if (
    !Number.isInteger(c) ||
    !Number.isInteger(size) ||
    !Number.isInteger(difficulty) ||
    c < 1 ||
    c > MAX_CHALLENGE_COUNT ||
    size < 1 ||
    size > MAX_CHALLENGE_SIZE ||
    difficulty < 1 ||
    difficulty > MAX_CHALLENGE_DIFFICULTY
  ) {
    return fail("invalid_token");
  }

  if (solutions.length !== c) return fail("invalid_solutions");
  for (let i = 0; i < c; i++) {
    if (typeof solutions[i] !== "number") return fail("invalid_solutions");
  }

  const token = body.token;
  const tokenFnv = fnv1a(token);
  for (let i = 0; i < c; i++) {
    const idxStr = String(i + 1);
    const saltSeed = fnv1aResume(tokenFnv, idxStr);
    const targetSeed = fnv1aResume(saltSeed, "d");
    const salt = prngFromHash(saltSeed, size);
    const target = prngFromHash(targetSeed, difficulty);
    const hash = sha256Bytes(salt + solutions[i]);
    if (!powMatchesPrefix(hash, parseHexPrefix(target))) {
      return fail("invalid_solution");
    }
  }

  if (payload.ei) {
    const instrMeta = decryptGcm(payload.ei, secret);
    if (!instrMeta) return fail("instr_corrupted", { instr_error: true });
    if (instrMeta.expires && Date.now() > instrMeta.expires) {
      return fail("instr_expired", { instr_error: true });
    }

    if (body.instr_blocked === true) {
      if (instrMeta.blockAutomatedBrowsers) {
        return fail("instr_automated_browser", { instr_error: true });
      }
    } else if (body.instr_timeout === true) {
      return fail("instr_timeout", { instr_error: true });
    } else if (body.instr) {
      const r = verifyInstrumentationResult(instrMeta, body.instr);
      if (!r.valid)
        return fail(r.reason || "instr_failed", { instr_error: true });
    } else {
      return fail("instr_missing", { instr_error: true });
    }
  }

  if (typeof opts.consumeNonce === "function") {
    const sig = jwtSigHex(body.token);
    if (!sig) return fail("invalid_token");
    const ttlMs = Math.max(1, payload.exp - Date.now());
    let claimed;
    try {
      claimed = await opts.consumeNonce(sig, ttlMs);
    } catch (err) {
      return fail("nonce_store_error", { error: String(err?.message || err) });
    }
    if (!claimed) return fail("already_redeemed");
  }

  const tokenTtlMs = opts.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS;
  const tokenExpires = Date.now() + tokenTtlMs;

  if (typeof opts.signToken === "function") {
    const signed = await opts.signToken({
      scope: payload.sk ?? null,
      expires: tokenExpires,
      iat: payload.iat,
    });
    return {
      success: true,
      token: signed,
      expires: tokenExpires,
      scope: payload.sk ?? null,
      iat: payload.iat,
    };
  }

  const id = randomHex(8);
  const verToken = randomHex(15);
  const tokenHash = sha256Hex(verToken);
  return {
    success: true,
    token: `${id}:${verToken}`,
    tokenKey: `${id}:${tokenHash}`,
    expires: tokenExpires,
    scope: payload.sk ?? null,
    iat: payload.iat,
  };
}
