import { describe, expect, test } from "bun:test";
import { jwtVerify } from "../src/crypto.js";
import { generateChallenge, validateChallenge } from "../src/index.js";
import { solveChallengeFromPublic, TEST_SECRET } from "./helpers.js";

describe("edge cases", () => {
  test("opts.extra round-trips through the JWT payload", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      extra: { user_id: 42, custom: "value" },
    });
    const payload = jwtVerify(pub.token, TEST_SECRET);
    expect(payload.x).toEqual({ user_id: 42, custom: "value" });
  });

  test("extra is ignored if not an object", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      extra: "not-an-object",
    });
    const payload = jwtVerify(pub.token, TEST_SECRET);
    expect(payload.x).toBeUndefined();
  });

  test("very long scope is preserved", async () => {
    const longScope = "a".repeat(500);
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      scope: longScope,
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { scope: longScope },
    );
    expect(r.success).toBe(true);
  });

  test("non-string scope is coerced to string", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      scope: 12345,
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { scope: "12345" },
    );
    expect(r.success).toBe(true);
  });

  test("challenge survives across mid-validation clock skew", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
      expiresMs: 5000,
    });
    const solutions = await solveChallengeFromPublic(pub);
    await new Promise((r) => setTimeout(r, 2000));
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
    });
    expect(r.success).toBe(true);
  }, 30_000);

  test("very high challenge count works (stress)", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 100,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);
    expect(solutions).toHaveLength(100);
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
    });
    expect(r.success).toBe(true);
  }, 60_000);
});

describe("generateChallenge: instrumentation as boolean vs object", () => {
  test("instrumentation: true uses defaults", async () => {
    const r = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      instrumentation: true,
    });
    expect(typeof r.instrumentation).toBe("string");
    expect(r.instrumentation.length).toBeGreaterThan(0);
  }, 30_000);

  test("instrumentation: { obfuscationLevel: 1 } uses lighter obfuscation", async () => {
    const r = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      instrumentation: { obfuscationLevel: 1 },
    });
    expect(typeof r.instrumentation).toBe("string");
  });

  test("instrumentation: false → no instrumentation in response", async () => {
    const r = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      instrumentation: false,
    });
    expect(r.instrumentation).toBeUndefined();
  });

  test("custom instrumentationGenerator is called", async () => {
    let called = false;
    const r = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      instrumentation: { obfuscationLevel: 1 },
      instrumentationGenerator: async (opts) => {
        called = true;
        expect(opts.obfuscationLevel).toBe(1);
        return {
          id: "custom-id-32-chars-aaaaaaaaaaaaa",
          expires: Date.now() + 60_000,
          expectedVals: [1, 2, 3, 4],
          vars: ["a", "b", "c", "d"],
          blockAutomatedBrowsers: false,
          instrumentation: "Y3VzdG9t",
        };
      },
    });
    expect(called).toBe(true);
    expect(r.instrumentation).toBe("Y3VzdG9t");
  });
});
