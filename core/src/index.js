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
import { generateInstrumentation, verifyInstrumentationResult } from "./instrumentation.js";
import { fnv1a, fnv1aResume, prngFromHash } from "./prng.js";
import {
  buildRswMinter as _buildRswMinter,
  deserializeRswKeypair,
  verifyRswSolution,
} from "./rsw.js";

export {
  buildRswMinter,
  generateRswKeypair,
  serializeRswKeypair,
  deserializeRswKeypair,
} from "./rsw.js";

const DEFAULT_RSW_T = 75_000;

const _minterCache = new WeakMap();

function resolveRswMinter(opts) {
  if (opts.rsw && typeof opts.rsw.mint === "function") return opts.rsw;

  if (!opts.keypair) {
    throw new Error(
      "[capjs-core] format-2 with 'rsw' requires opts.keypair (from generateRswKeypair) or opts.rsw (from buildRswMinter).",
    );
  }

  const kp = typeof opts.keypair.N === "string"
    ? deserializeRswKeypair(opts.keypair)
    : opts.keypair;

  const t = opts.t ?? DEFAULT_RSW_T;
  let byT = _minterCache.get(opts.keypair);
  if (!byT) {
    byT = new Map();
    _minterCache.set(opts.keypair, byT);
  }
  let minter = byT.get(t);
  if (!minter) {
    minter = _buildRswMinter({ ...kp, t });
    byT.set(t, minter);
  }
  return minter;
}

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
  const len = typeof secret === "string" ? Buffer.byteLength(secret, "utf8") : secret.length;
  if (len < 16) {
    throw new Error("[capjs-core] secret must be at least 16 bytes for security");
  }
}

export async function generateChallenge(secret, opts = {}) {
  assertSecret(secret);

  if (opts.format === 2) {
    return generateChallengeV2(secret, opts);
  }

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
    const instrOpts = typeof opts.instrumentation === "object" ? opts.instrumentation : {};
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
  if (!body.token || typeof body.token !== "string") return fail("missing_token");
  const solutions = body.solutions;
  if (!Array.isArray(solutions)) return fail("missing_solutions");

  const payload = jwtVerify(body.token, secret);
  if (!payload) return fail("invalid_token");

  if (payload.f === 2) {
    return validateChallengeV2(secret, body, payload, opts);
  }

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
      if (!r.valid) return fail(r.reason || "instr_failed", { instr_error: true });
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

async function generateChallengeV2(secret, opts) {
  const protocols =
    Array.isArray(opts.protocols) && opts.protocols.length ? opts.protocols : ["rsw"];
  const ttlMs = opts.expiresMs ?? DEFAULT_CHALLENGE_TTL_MS;
  const now = Date.now();
  const exp = now + ttlMs;

  const challenges = [];
  const expected = [];

  for (const proto of protocols) {
    if (proto === "sha256-pow") {
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
          `[capjs-core] invalid params: c≤${MAX_CHALLENGE_COUNT}, s≤${MAX_CHALLENGE_SIZE}, d∈[1,${MAX_CHALLENGE_DIFFICULTY}]`,
        );
      }
      const target = "0".repeat(d);
      for (let i = 0; i < c; i++) {
        const salt = randomHex(s);
        challenges.push({ protocol: "sha256-pow", payload: { salt, target } });
        expected.push({ protocol: "sha256-pow", salt, target });
      }
    } else if (proto === "rsw") {
      const minter = resolveRswMinter(opts);
      const { x_hex, y_hex } = minter.mint();
      challenges.push({
        protocol: "rsw",
        payload: { N: minter.N_hex, x: x_hex, t: minter.t },
      });
      expected.push({ protocol: "rsw", y: y_hex });
    } else if (proto === "instrumentation") {
      const instrOpts =
        typeof opts.instrumentation === "object" && opts.instrumentation !== null
          ? opts.instrumentation
          : {};
      const generator = opts.instrumentationGenerator || generateInstrumentation;
      const instr = await generator({ ...instrOpts, ttlMs });
      challenges.push({ protocol: "instrumentation", payload: { blob: instr.instrumentation } });
      expected.push({
        protocol: "instrumentation",
        instrMeta: {
          id: instr.id,
          expectedVals: instr.expectedVals,
          vars: instr.vars,
          blockAutomatedBrowsers: instr.blockAutomatedBrowsers,
          expires: exp,
        },
      });
    } else {
      throw new Error(`[capjs-core] unknown protocol '${proto}'`);
    }
  }

  const tokenPayload = {
    f: 2,
    n: randomHex(16),
    exp,
    iat: now,
    ev: encryptGcm({ expected }, secret, "cap:fmt2-v1"),
  };
  if (opts.scope) tokenPayload.sk = String(opts.scope);
  if (opts.extra && typeof opts.extra === "object") tokenPayload.x = opts.extra;

  const token = jwtSign(tokenPayload, secret);
  return { token, format: 2, challenges, expires: exp };
}

async function validateChallengeV2(secret, body, payload, opts = {}) {
  if (opts.scope && payload.sk !== opts.scope) return fail("scope_mismatch");
  if (!payload.exp || payload.exp < Date.now()) return fail("expired");

  const decrypted = decryptGcm(payload.ev, secret, "cap:fmt2-v1");
  if (!decrypted || !Array.isArray(decrypted.expected)) return fail("invalid_token");
  const expected = decrypted.expected;
  const solutions = body.solutions;

  if (solutions.length !== expected.length) return fail("invalid_solutions");

  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const s = solutions[i];
    if (!s || typeof s !== "object") return fail("invalid_solution");

    if (e.protocol === "sha256-pow") {
      const nonce = s.nonce;
      if (typeof nonce !== "number" && typeof nonce !== "string") return fail("invalid_solution");
      const hash = sha256Bytes(e.salt + nonce);
      if (!powMatchesPrefix(hash, parseHexPrefix(e.target))) return fail("invalid_solution");
    } else if (e.protocol === "rsw") {
      if (!verifyRswSolution(e.y, s.y)) return fail("invalid_solution");
    } else if (e.protocol === "instrumentation") {
      const meta = e.instrMeta;
      if (!meta) return fail("instr_corrupted", { instr_error: true });
      if (meta.expires && Date.now() > meta.expires) {
        return fail("instr_expired", { instr_error: true });
      }
      if (s.blocked === true) {
        if (meta.blockAutomatedBrowsers) {
          return fail("instr_automated_browser", { instr_error: true });
        }
      } else if (s.timeout === true) {
        return fail("instr_timeout", { instr_error: true });
      } else if (s.instr) {
        const r = verifyInstrumentationResult(meta, s.instr);
        if (!r.valid) return fail(r.reason || "instr_failed", { instr_error: true });
      } else {
        return fail("instr_missing", { instr_error: true });
      }
    } else {
      return fail("invalid_solution");
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
