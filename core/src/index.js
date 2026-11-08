import {
  agentFromCodes,
  agentFromHeaders,
  agentFromTrace,
  summarizeAgent,
  verifyWebBotAuth,
} from "./agents.js";
import {
  analyzeBehavior,
  DEFAULT_BEHAVIOR_THRESHOLD,
  validateTrace,
} from "./behavior.js";
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

export {
  agentFromHeaders,
  agentFromTrace,
  parseSignatureAgent,
  summarizeAgent,
  verifyWebBotAuth,
} from "./agents.js";
export {
  analyzeBehavior,
  BEHAVIOR_WEIGHTS,
  DEFAULT_BEHAVIOR_THRESHOLD,
  WEAK_CAP,
} from "./behavior.js";

export { detectAutomation } from "./detect.js";
export {
  boundValues,
  canonicalize,
  generateInstrumentation,
  MAX_BOUND_DATA,
  serializeBound,
  verifyInstrumentationResult,
} from "./instrumentation.js";

import { mintHashwxChallenges, verifyHashwxSolution } from "./hashwx.js";

export {
  DEFAULT_HASHWX_CHALLENGE_COUNT,
  DEFAULT_HASHWX_DIFFICULTY,
  DEFAULT_HASHWX_NONCES_PER_HASH,
  hashwxHash,
  hashwxReady,
  hashwxSeed,
  hashwxTarget,
  setHashwxModule,
} from "./hashwx.js";

import { fnv1a, fnv1aResume, prngFromHash } from "./prng.js";
import {
  buildRswMinter as _buildRswMinter,
  deserializeRswKeypair,
  verifyRswSolution,
} from "./rsw.js";

export {
  buildRswMinter,
  deserializeRswKeypair,
  generateRswKeypair,
  serializeRswKeypair,
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

  const kp =
    typeof opts.keypair.N === "string"
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
  const len =
    typeof secret === "string"
      ? Buffer.byteLength(secret, "utf8")
      : secret.length;
  if (len < 16) {
    throw new Error(
      "[capjs-core] secret must be at least 16 bytes for security",
    );
  }
}

function behaviorPolicy(opt) {
  if (!opt) return null;
  const o = typeof opt === "object" ? opt : {};
  const th = Number(o.threshold);
  return {
    b: o.block === true ? 1 : 0,
    s: o.strict === true ? 1 : 0,
    r: o.requireInteraction === false ? 0 : 1,
    th: th >= 0.1 && th <= 1 ? th : DEFAULT_BEHAVIOR_THRESHOLD,
    ag: o.blockAgents === "all" ? 2 : o.blockAgents === "identified" ? 1 : 0,
    va: o.allowVerifiedAgents === true ? 1 : 0,
  };
}

async function requestAgentEvidence(evidence, opts) {
  const req = opts.request;
  if (!req?.headers) return null;
  evidence.push(...agentFromHeaders(req.headers));
  if (opts.verifyWebBotAuth !== true || !req.method || !req.url) return null;
  if (!evidence.some((e) => e.evidence.startsWith("signature_agent:")))
    return null;
  return verifyWebBotAuth(req, {
    authority:
      opts.webBotAuthAuthority ??
      (URL.canParse(req.url) ? new URL(req.url).host : null),
    fetch: opts.fetch,
    trustedOrigins: opts.trustedSignatureAgents,
    nonceCheck: opts.webBotAuthNonceCheck,
  });
}

const INSTR_ERROR_REASONS = {
  csp_blocked: "instr_csp_blocked",
  csp_script_blocked: "instr_csp_blocked",
  natives_tampered: "instr_natives_tampered",
  env_failed: "instr_env_failed",
  script_failed: "instr_script_failed",
};

const instrErrorReason = (code) =>
  Object.hasOwn(INSTR_ERROR_REASONS, code)
    ? INSTR_ERROR_REASONS[code]
    : "instr_failed";

async function evaluateBehavior(policy, trace, payload, opts, bound) {
  if (policy.ag > 0 && bound?.host === false) {
    return {
      fail: fail(
        bound.isolated
          ? "instr_isolated"
          : bound.legacy
            ? "instr_widget_outdated"
            : "instr_host_unreachable",
        { instr_error: true },
      ),
    };
  }
  const ctx = { strict: policy.s === 1, threshold: policy.th };
  let pre = analyzeBehavior(trace, ctx);
  if (pre.digest && typeof opts.behaviorReplayCheck === "function") {
    const ttlMs = Math.max(60_000, (payload.exp ?? Date.now()) - Date.now());
    let replayed = false;
    try {
      replayed = (await opts.behaviorReplayCheck(pre.digest, ttlMs)) === true;
    } catch {}
    if (replayed) pre = analyzeBehavior(trace, { ...ctx, replayed: true });
  }
  const evidence = (
    trace && !validateTrace(trace) ? agentFromTrace(trace) : []
  ).map((e) =>
    e.agent === "gemini-in-chrome" && bound?.browser === "brave"
      ? { ...e, agent: "brave-leo" }
      : e,
  );
  if (bound) {
    const seen = new Set(evidence.map((e) => e.evidence));
    evidence.push(
      ...agentFromCodes(bound.all).filter((e) => !seen.has(e.evidence)),
    );
  }
  const verification = await requestAgentEvidence(evidence, opts);
  const agent = summarizeAgent(evidence, verification);

  let verdict = pre.verdict;
  if (agent?.detected && verdict !== "automated") verdict = "agent";

  const behavior = {
    score: pre.score,
    verdict,
    flags: pre.flags,
    signals: pre.signals,
    ...(agent && { agent }),
  };
  const flags = pre.verdict === "missing" ? ["bh_missing"] : [...pre.flags];
  if (agent?.detected) flags.push(`agent:${agent.name}`);

  const blockAgent =
    agent?.detected &&
    !(policy.va === 1 && agent.verified) &&
    (policy.ag === 2 || (policy.ag === 1 && agent.confidence === "high"));
  if (blockAgent) {
    return { fail: fail("behavior_agent", { behavior }) };
  }
  if (pre.verdict === "missing") {
    if ((bound?.legacy || bound?.isolated) && policy.b !== 1) {
      return { behavior, flags };
    }
    return { fail: fail("behavior_missing", { behavior }) };
  }
  if (policy.b === 1) {
    if (pre.verdict === "automated") {
      return { fail: fail("behavior_automated", { behavior }) };
    }
    if (policy.r === 1 && pre.verdict === "no_interaction") {
      return { fail: fail("behavior_no_interaction", { behavior }) };
    }
  }
  return { behavior, flags };
}

function sealedInstrMeta(instr, expires) {
  if (!instr?.binding && !Array.isArray(instr?.expectedVals)) {
    throw new Error(
      "[capjs-core] instrumentationGenerator must return the binding from generateInstrumentation, or expectedVals",
    );
  }
  return {
    id: instr.id,
    ...(Number.isFinite(instr.iat) && { iat: instr.iat }),
    vars: instr.vars,
    ...(instr.binding
      ? { binding: instr.binding }
      : { expectedVals: instr.expectedVals }),
    blockAutomatedBrowsers: instr.blockAutomatedBrowsers === true,
    blockAutomatedInteractions: instr.blockAutomatedInteractions === true,
    detectAutomatedInteractions: instr.detectAutomatedInteractions === true,
    behavior: instr.behavior === true,
    behaviorEnforced: instr.behaviorEnforced === true,
    expires,
  };
}

function instrOptions(opts, ttlMs, bh) {
  const base =
    typeof opts.instrumentation === "object" && opts.instrumentation !== null
      ? opts.instrumentation
      : {};
  return {
    ...base,
    ttlMs,
    behavior: !!bh,
    behaviorEnforced: !!bh && (bh.b === 1 || bh.ag > 0),
  };
}

export async function generateChallenge(secret, opts = {}) {
  assertSecret(secret);

  const format =
    opts.format ??
    (["challengeCount", "challengeSize", "challengeDifficulty"].some(
      (k) => opts[k] !== undefined,
    )
      ? 1
      : 2);
  if (format === 2) {
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
  const bh = behaviorPolicy(opts.behavior);
  if (bh) payload.bh = bh;

  let instrumentation;
  if (opts.instrumentation || bh) {
    const generator = opts.instrumentationGenerator || generateInstrumentation;
    const instr = await generator(instrOptions(opts, ttlMs, bh));
    payload.ei = encryptGcm(sealedInstrMeta(instr, expires), secret);
    instrumentation = instr.instrumentation;
  }

  const token = jwtSign(payload, secret);
  const result = { challenge: { c, s, d }, token, expires };
  if (instrumentation) result.instrumentation = instrumentation;
  if (bh) result.behavior = true;
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

  let riskFlags = [];
  let bound = null;
  let trace = null;
  if (payload.ei) {
    const instrMeta = decryptGcm(payload.ei, secret);
    if (!instrMeta) return fail("instr_corrupted", { instr_error: true });
    if (instrMeta.expires && Date.now() > instrMeta.expires) {
      return fail("instr_expired", { instr_error: true });
    }

    if (body.instr_blocked === true) {
      return fail(
        instrMeta.blockAutomatedBrowsers
          ? "instr_automated_browser"
          : "instr_failed",
        { instr_error: true },
      );
    } else if (typeof body.instr_error === "string") {
      return fail(instrErrorReason(body.instr_error), { instr_error: true });
    } else if (body.instr_timeout === true) {
      return fail("instr_timeout", { instr_error: true });
    } else if (body.instr) {
      const r = verifyInstrumentationResult(instrMeta, body.instr);
      if (!r.valid) {
        return fail(r.reason || "instr_failed", {
          instr_error: true,
          ...(r.blockedBy && { blockedBy: r.blockedBy }),
        });
      }
      if (r.riskFlags?.length) riskFlags = [...riskFlags, ...r.riskFlags];
      if (r.agent) bound = r.agent;
      trace = r.trace ?? null;
    } else {
      return fail("instr_missing", { instr_error: true });
    }
  }

  let behavior;
  let agent = null;
  if (payload.bh && typeof payload.bh === "object") {
    const r = await evaluateBehavior(payload.bh, trace, payload, opts, bound);
    if (r.fail) return r.fail;
    behavior = r.behavior;
    if (r.flags.length) riskFlags = [...riskFlags, ...r.flags];
  } else {
    const evidence = bound ? agentFromCodes(bound.all) : [];
    const verification = await requestAgentEvidence(evidence, opts);
    agent = evidence.length ? summarizeAgent(evidence, verification) : null;
    if (agent?.detected) riskFlags = [...riskFlags, `agent:${agent.name}`];
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
      riskFlags,
      ...(behavior && { behavior }),
      ...(agent && { agent }),
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
    riskFlags,
    ...(behavior && { behavior }),
    ...(agent && { agent }),
  };
}

async function generateChallengeV2(secret, opts) {
  const bh = behaviorPolicy(opts.behavior);
  const requested =
    Array.isArray(opts.protocols) && opts.protocols.length
      ? opts.protocols
      : opts.keypair || opts.rsw
        ? ["rsw"]
        : ["hashwx"];
  const protocols =
    (bh || opts.instrumentation) && !requested.includes("instrumentation")
      ? [...requested, "instrumentation"]
      : requested;
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
    } else if (proto === "hashwx") {
      for (const minted of mintHashwxChallenges(opts)) {
        challenges.push({ protocol: "hashwx", payload: minted.payload });
        expected.push({ protocol: "hashwx", ...minted.expected });
      }
    } else if (proto === "instrumentation") {
      const generator =
        opts.instrumentationGenerator || generateInstrumentation;
      const instr = await generator(instrOptions(opts, ttlMs, bh));
      challenges.push({
        protocol: "instrumentation",
        payload: { blob: instr.instrumentation },
      });
      expected.push({
        protocol: "instrumentation",
        instrMeta: sealedInstrMeta(instr, exp),
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
  if (bh) tokenPayload.bh = bh;

  const token = jwtSign(tokenPayload, secret);
  const result = { token, format: 2, challenges, expires: exp };
  if (bh) result.behavior = true;
  return result;
}

async function validateChallengeV2(secret, body, payload, opts = {}) {
  if (opts.scope && payload.sk !== opts.scope) return fail("scope_mismatch");
  if (!payload.exp || payload.exp < Date.now()) return fail("expired");

  const decrypted = decryptGcm(payload.ev, secret, "cap:fmt2-v1");
  if (!decrypted || !Array.isArray(decrypted.expected))
    return fail("invalid_token");
  const expected = decrypted.expected;
  const solutions = body.solutions;
  let riskFlags = [];
  let bound = null;
  let trace = null;

  if (!Array.isArray(solutions) || solutions.length !== expected.length)
    return fail("invalid_solutions");

  const instrSteps = [];
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const s = solutions[i];
    if (!s || typeof s !== "object") return fail("invalid_solution");

    if (e.protocol === "sha256-pow") {
      const nonce = s.nonce;
      if (typeof nonce !== "number" && typeof nonce !== "string")
        return fail("invalid_solution");
      const hash = sha256Bytes(e.salt + nonce);
      if (!powMatchesPrefix(hash, parseHexPrefix(e.target)))
        return fail("invalid_solution");
    } else if (e.protocol === "rsw") {
      if (!verifyRswSolution(e.y, s.y)) return fail("invalid_solution");
    } else if (e.protocol === "hashwx") {
      if (!(await verifyHashwxSolution(e, s))) return fail("invalid_solution");
    } else if (e.protocol === "instrumentation") {
      instrSteps.push([e.instrMeta, s]);
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

  for (const [meta, s] of instrSteps) {
    if (!meta) return fail("instr_corrupted", { instr_error: true });
    if (meta.expires && Date.now() > meta.expires) {
      return fail("instr_expired", { instr_error: true });
    }
    if (s.blocked === true) {
      return fail(
        meta.blockAutomatedBrowsers
          ? "instr_automated_browser"
          : "instr_failed",
        { instr_error: true },
      );
    }
    if (typeof s.error === "string") {
      return fail(instrErrorReason(s.error), { instr_error: true });
    }
    if (s.timeout === true) {
      return fail("instr_timeout", { instr_error: true });
    }
    if (!s.instr) return fail("instr_missing", { instr_error: true });
    const r = verifyInstrumentationResult(meta, s.instr);
    if (!r.valid) {
      return fail(r.reason || "instr_failed", {
        instr_error: true,
        ...(r.blockedBy && { blockedBy: r.blockedBy }),
      });
    }
    if (r.riskFlags?.length) riskFlags = [...riskFlags, ...r.riskFlags];
    if (r.agent) bound = r.agent;
    trace = r.trace ?? null;
  }

  let behavior;
  let agent = null;
  if (payload.bh && typeof payload.bh === "object") {
    const r = await evaluateBehavior(payload.bh, trace, payload, opts, bound);
    if (r.fail) return r.fail;
    behavior = r.behavior;
    if (r.flags.length) riskFlags = [...riskFlags, ...r.flags];
  } else {
    const evidence = bound ? agentFromCodes(bound.all) : [];
    const verification = await requestAgentEvidence(evidence, opts);
    agent = evidence.length ? summarizeAgent(evidence, verification) : null;
    if (agent?.detected) riskFlags = [...riskFlags, `agent:${agent.name}`];
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
      riskFlags,
      ...(behavior && { behavior }),
      ...(agent && { agent }),
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
    riskFlags,
    ...(behavior && { behavior }),
    ...(agent && { agent }),
  };
}
