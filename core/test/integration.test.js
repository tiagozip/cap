import { describe, expect, test } from "bun:test";
import { generateChallenge, validateChallenge } from "../src/index.js";
import {
  generateInstrumentation,
  verifyInstrumentationResult,
} from "../src/instrumentation.js";
import { solveChallengeFromPublic, TEST_SECRET } from "./helpers.js";

describe("end-to-end (PoW only)", () => {
  test("full happy path: generate -> solve -> validate", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 6,
      challengeSize: 16,
      challengeDifficulty: 2,
      scope: "test-scope",
    });

    const solutions = await solveChallengeFromPublic(pub);
    expect(solutions).toHaveLength(6);

    const result = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { scope: "test-scope" },
    );
    expect(result.success).toBe(true);
    expect(result.scope).toBe("test-scope");
    expect(typeof result.token).toBe("string");
    expect(typeof result.tokenKey).toBe("string");
  });
});

describe("end-to-end (PoW + instrumentation)", () => {
  test("missing instrumentation in body is rejected with instr_missing", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 3,
      challengeSize: 8,
      challengeDifficulty: 1,
      instrumentation: { obfuscationLevel: 1, blockAutomatedBrowsers: false },
    });
    expect(typeof pub.instrumentation).toBe("string");

    const solutions = await solveChallengeFromPublic(pub);
    const missing = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
    });
    expect(missing.success).toBe(false);
    expect(missing.reason).toBe("instr_missing");
    expect(missing.instr_error).toBe(true);
  }, 60_000);

  test("instr_blocked + blockAutomatedBrowsers=false succeeds", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
      instrumentation: { obfuscationLevel: 1, blockAutomatedBrowsers: false },
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
      instr_blocked: true,
    });
    expect(r.success).toBe(true);
  }, 30_000);

  test("instr_blocked + blockAutomatedBrowsers=true is rejected", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
      instrumentation: { obfuscationLevel: 1, blockAutomatedBrowsers: true },
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
      instr_blocked: true,
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("instr_automated_browser");
    expect(r.instr_error).toBe(true);
  }, 60_000);

  test("instr_timeout is rejected with instr_timeout reason", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
      instrumentation: { obfuscationLevel: 1 },
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
      instr_timeout: true,
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("instr_timeout");
    expect(r.instr_error).toBe(true);
  }, 30_000);
});

describe("end-to-end with custom storage callbacks", () => {
  test("simulates a redis-backed one-time-use store", async () => {
    const store = new Map();
    const consumeNonce = async (sigHex, ttlMs) => {
      if (store.has(sigHex)) return false;
      store.set(sigHex, Date.now() + ttlMs);
      return true;
    };

    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 3,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);

    const r1 = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { consumeNonce },
    );
    expect(r1.success).toBe(true);
    expect(store.size).toBe(1);

    const r2 = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { consumeNonce },
    );
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe("already_redeemed");
  });

  test("custom signToken receives scope/expires/iat", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
      scope: "scoped",
    });
    const solutions = await solveChallengeFromPublic(pub);
    let signedWith;
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      {
        signToken: (data) => {
          signedWith = data;
          return `r-${data.scope}-${data.expires}`;
        },
        tokenTtlMs: 60_000,
      },
    );
    expect(r.success).toBe(true);
    expect(r.token).toMatch(/^r-scoped-\d+$/);
    expect(signedWith.scope).toBe("scoped");
    expect(signedWith.expires).toBeGreaterThan(Date.now());
    expect(typeof signedWith.iat).toBe("number");
  });
});

describe("instrumentation result simulation", () => {
  test("a fully simulated instrumentation flow validates", async () => {
    const meta = await generateInstrumentation({ obfuscationLevel: 1 });
    const state = {};
    for (let i = 0; i < meta.vars.length; i++)
      state[meta.vars[i]] = meta.expectedVals[i];
    const result = verifyInstrumentationResult(meta, {
      i: meta.id,
      state,
      ts: Date.now(),
    });
    expect(result.valid).toBe(true);
  });
});
