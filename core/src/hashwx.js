import crypto from "node:crypto";
import { HASHWX_WASM_BASE64 } from "./hashwx-wasm.js";

export const HASHWX_SEED_SIZE = 32;
export const HASHWX_CHALLENGE_SIZE = 32;

export const DEFAULT_HASHWX_NONCES_PER_HASH = 65536;
export const DEFAULT_HASHWX_DIFFICULTY = 1_000_000;
export const DEFAULT_HASHWX_CHALLENGE_COUNT = 4;

export const MAX_HASHWX_DIFFICULTY = 1_000_000_000;
export const MAX_HASHWX_NONCES_PER_HASH = 1_048_576;
export const MAX_HASHWX_CHALLENGE_COUNT = 64;

const U64_MAX = (1n << 64n) - 1n;
const HASHWX_INTERPRETED = 0;

function decodeBase64(b64) {
  if (typeof Buffer !== "undefined")
    return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let readyPromise = null;

async function init() {
  const mod = await WebAssembly.compile(decodeBase64(HASHWX_WASM_BASE64));
  const instance = new WebAssembly.Instance(mod, {});
  const exports = instance.exports;
  if (typeof exports._initialize === "function") exports._initialize();

  const ctx = exports.hashwx_alloc(HASHWX_INTERPRETED);
  if (ctx <= 0) throw new Error("[capjs-core] hashwx_alloc failed");

  return { exports, ctx, seedPtr: exports.hashwx_seed(ctx) };
}

export function hashwxReady() {
  if (!readyPromise) {
    readyPromise = init().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

export function hashwxTarget(difficulty) {
  const d = BigInt(difficulty);
  if (d <= 0n)
    throw new Error("[capjs-core] hashwx difficulty must be positive");
  return U64_MAX / d;
}

export function hashwxSeed(challenge, block) {
  const buf = new Uint8Array(HASHWX_CHALLENGE_SIZE + 8);
  buf.set(challenge, 0);
  let rest = BigInt(block);
  for (let i = 0; i < 8; i++) {
    buf[HASHWX_CHALLENGE_SIZE + i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return new Uint8Array(crypto.createHash("sha256").update(buf).digest());
}

export function hashwxHash(state, seed, nonce) {
  const { exports, ctx, seedPtr } = state;
  new Uint8Array(exports.memory.buffer, seedPtr, HASHWX_SEED_SIZE).set(seed);
  exports.hashwx_make(ctx, seedPtr);
  return BigInt.asUintN(64, exports.hashwx_exec(ctx, nonce));
}

function parseNonce(value) {
  if (typeof value === "bigint")
    return value >= 0n && value <= U64_MAX ? value : null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  if (typeof value !== "string" || !/^[0-9]{1,20}$/.test(value)) return null;
  const parsed = BigInt(value);
  return parsed <= U64_MAX ? parsed : null;
}

function hexToBytes(hex, expectedLength) {
  if (typeof hex !== "string" || hex.length !== expectedLength * 2) return null;
  if (!/^[0-9a-f]*$/i.test(hex)) return null;
  const out = new Uint8Array(expectedLength);
  for (let i = 0; i < expectedLength; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function mintHashwxChallenges(opts = {}) {
  const difficulty = opts.hashwxDifficulty ?? DEFAULT_HASHWX_DIFFICULTY;
  const noncesPerHash =
    opts.hashwxNoncesPerHash ?? DEFAULT_HASHWX_NONCES_PER_HASH;
  const count = opts.hashwxChallengeCount ?? DEFAULT_HASHWX_CHALLENGE_COUNT;

  if (
    !Number.isInteger(difficulty) ||
    difficulty < 1 ||
    difficulty > MAX_HASHWX_DIFFICULTY
  ) {
    throw new Error(
      `[capjs-core] hashwxDifficulty must be an integer in [1, ${MAX_HASHWX_DIFFICULTY}]`,
    );
  }
  if (
    !Number.isInteger(noncesPerHash) ||
    noncesPerHash < 1 ||
    noncesPerHash > MAX_HASHWX_NONCES_PER_HASH
  ) {
    throw new Error(
      `[capjs-core] hashwxNoncesPerHash must be an integer in [1, ${MAX_HASHWX_NONCES_PER_HASH}]`,
    );
  }
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > MAX_HASHWX_CHALLENGE_COUNT
  ) {
    throw new Error(
      `[capjs-core] hashwxChallengeCount must be an integer in [1, ${MAX_HASHWX_CHALLENGE_COUNT}]`,
    );
  }

  const each = Math.max(1, Math.round(difficulty / count));
  const out = [];
  for (let i = 0; i < count; i++) {
    const spec = {
      c: crypto.randomBytes(HASHWX_CHALLENGE_SIZE).toString("hex"),
      d: each,
      n: noncesPerHash,
    };
    out.push({ payload: { ...spec }, expected: { ...spec } });
  }
  return out;
}

export async function verifyHashwxSolution(expected, solution) {
  if (!expected || typeof expected !== "object") return false;
  if (!solution || typeof solution !== "object") return false;

  const challenge = hexToBytes(expected.c, HASHWX_CHALLENGE_SIZE);
  if (!challenge) return false;

  const noncesPerHash = expected.n;
  if (
    !Number.isInteger(noncesPerHash) ||
    noncesPerHash < 1 ||
    noncesPerHash > MAX_HASHWX_NONCES_PER_HASH
  ) {
    return false;
  }

  const nonce = parseNonce(solution.nonce);
  if (nonce === null) return false;

  let target;
  try {
    target = hashwxTarget(expected.d);
  } catch {
    return false;
  }

  const state = await hashwxReady();
  const block = nonce / BigInt(noncesPerHash);
  const seed = hashwxSeed(challenge, block);
  return hashwxHash(state, seed, nonce) <= target;
}
