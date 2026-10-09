import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { HASHWX_WASM_SHA256 } from "../src/hashwx-wasm.js";
import {
  generateChallenge,
  hashwxHash,
  hashwxReady,
  hashwxSeed,
  hashwxTarget,
  validateChallenge,
} from "../src/index.js";
import { TEST_SECRET } from "./helpers.js";

const wasmBytes = readFileSync(new URL("../src/hashwx.wasm", import.meta.url));

describe("hashwx module loading", () => {
  test("shipped hashwx.wasm matches the embedded bytes", () => {
    expect(createHash("sha256").update(wasmBytes).digest("hex")).toBe(
      HASHWX_WASM_SHA256,
    );
  });

  test("setHashwxModule uses the supplied module instead of compiling", async () => {
    const hashwx = await import("../src/hashwx.js?supplied");
    const mod = new WebAssembly.Module(wasmBytes);
    const compile = WebAssembly.compile;
    WebAssembly.compile = () => {
      throw new Error("Wasm code generation disallowed by embedder");
    };
    try {
      hashwx.setHashwxModule(mod);
      const state = await hashwx.hashwxReady();
      const seed = hashwx.hashwxSeed(new Uint8Array(32), 0);
      expect(typeof hashwx.hashwxHash(state, seed, 0n)).toBe("bigint");
    } finally {
      WebAssembly.compile = compile;
    }
    expect(() => hashwx.setHashwxModule(mod)).toThrow(
      /before HashWX initializes/,
    );
  });

  test("setHashwxModule rejects non-modules", async () => {
    const hashwx = await import("../src/hashwx.js?invalid");
    expect(() => hashwx.setHashwxModule(wasmBytes)).toThrow(TypeError);
  });

  test("supplied and embedded modules hash identically", async () => {
    const supplied = await import("../src/hashwx.js?compare");
    const embedded = await import("../src/hashwx.js?embedded");
    supplied.setHashwxModule(new WebAssembly.Module(wasmBytes));
    const a = await supplied.hashwxReady();
    const b = await embedded.hashwxReady();
    const seed = supplied.hashwxSeed(new Uint8Array(32).fill(7), 3);
    expect(supplied.hashwxHash(a, seed, 196611n)).toBe(
      embedded.hashwxHash(b, seed, 196611n),
    );
  });
});

async function solveHashwx(payload) {
  const state = await hashwxReady();
  const challenge = Uint8Array.from(Buffer.from(payload.c, "hex"));
  const target = hashwxTarget(payload.d);
  const per = BigInt(payload.n);
  for (let nonce = 0n; nonce < 1_000_000n; nonce++) {
    const seed = hashwxSeed(challenge, nonce / per);
    if (hashwxHash(state, seed, nonce) <= target)
      return { nonce: nonce.toString() };
  }
  throw new Error("hashwx solver gave up");
}

describe("hashwx verification", () => {
  test("generate -> solve -> validate round trip", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      format: 2,
      protocols: ["hashwx"],
      hashwxDifficulty: 64,
      hashwxNoncesPerHash: 16,
    });
    const solutions = [];
    for (const c of pub.challenges)
      solutions.push(await solveHashwx(c.payload));

    const ok = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
    });
    expect(ok.success).toBe(true);

    const tampered = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions: solutions.map(() => ({ nonce: "18446744073709551615" })),
    });
    expect(tampered.success).toBe(false);
  });
});
