import { describe, expect, test } from "bun:test";
import { generateChallenge, validateChallenge } from "../src/index.js";
import { solveChallengeFromPublic, TEST_SECRET } from "./helpers.js";

describe("generateChallenge", () => {
  test("returns flat shape with challenge/token/expires", async () => {
    const r = await generateChallenge(TEST_SECRET, {
      challengeCount: 5,
      challengeSize: 16,
      challengeDifficulty: 2,
    });
    expect(r.challenge).toEqual({ c: 5, s: 16, d: 2 });
    expect(typeof r.token).toBe("string");
    expect(r.token.split(".")).toHaveLength(3);
    expect(typeof r.expires).toBe("number");
    expect(r.expires).toBeGreaterThan(Date.now());
    expect(r.instrumentation).toBeUndefined();
  });

  test("uses defaults when no opts passed", async () => {
    const r = await generateChallenge(TEST_SECRET);
    expect(r.challenge.c).toBe(50);
    expect(r.challenge.s).toBe(32);
    expect(r.challenge.d).toBe(4);
  });

  test("respects custom expiresMs", async () => {
    const before = Date.now();
    const r = await generateChallenge(TEST_SECRET, { expiresMs: 30_000 });
    const after = Date.now();
    expect(r.expires).toBeGreaterThanOrEqual(before + 30_000);
    expect(r.expires).toBeLessThanOrEqual(after + 30_000);
  });

  test("each call produces unique tokens", async () => {
    const a = await generateChallenge(TEST_SECRET);
    const b = await generateChallenge(TEST_SECRET);
    expect(a.token).not.toBe(b.token);
  });

  test("rejects missing/short secrets", async () => {
    await expect(generateChallenge()).rejects.toThrow(/secret is required/);
    await expect(generateChallenge("")).rejects.toThrow(/secret is required/);
    await expect(generateChallenge("short")).rejects.toThrow(/at least 16/);
    await expect(generateChallenge(123)).rejects.toThrow(/string or Buffer/);
  });

  test("accepts Buffer as secret", async () => {
    const buf = Buffer.from(TEST_SECRET);
    const r = await generateChallenge(buf, {
      challengeCount: 3,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    expect(r.token).toBeTruthy();
  });
});

describe("validateChallenge", () => {
  test("accepts a valid solution", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 4,
      challengeSize: 16,
      challengeDifficulty: 2,
    });
    const solutions = await solveChallengeFromPublic(pub);

    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
    });
    expect(r.success).toBe(true);
    expect(typeof r.token).toBe("string");
    expect(typeof r.tokenKey).toBe("string");
    expect(r.token.split(":")).toHaveLength(2);
    expect(r.tokenKey.split(":")).toHaveLength(2);
    expect(r.expires).toBeGreaterThan(Date.now());
  });

  test("rejects wrong secret", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 3,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(
      "another-secret-32-bytes-junk-padding-1234",
      { token: pub.token, solutions },
    );
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_token");
  });

  test("rejects wrong solutions (mostly)", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 3,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const wrong = [0, 0, 0];
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions: wrong,
    });
    if (!r.success) expect(r.reason).toBe("invalid_solution");
  });

  test("rejects mismatched solution count", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 5,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions: [1, 2, 3],
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_solutions");
  });

  test("rejects non-number solutions", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 3,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions: ["1", "2", "3"],
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_solutions");
  });

  test("rejects expired challenges", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      expiresMs: 1,
    });
    await new Promise((r) => setTimeout(r, 30));
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("expired");
  });

  test("validates scope", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      scope: "login",
    });
    const solutions = await solveChallengeFromPublic(pub);
    const wrongScope = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { scope: "signup" },
    );
    expect(wrongScope.success).toBe(false);
    expect(wrongScope.reason).toBe("scope_mismatch");

    const okScope = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { scope: "login" },
    );
    expect(okScope.success).toBe(true);
  });

  test("rejects body that is not an object", async () => {
    const r1 = await validateChallenge(TEST_SECRET, null);
    expect(r1.success).toBe(false);
    expect(r1.reason).toBe("invalid_body");

    const r2 = await validateChallenge(TEST_SECRET, "string");
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe("invalid_body");
  });

  test("rejects missing token", async () => {
    const r = await validateChallenge(TEST_SECRET, { solutions: [1, 2, 3] });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("missing_token");
  });

  test("rejects non-array solutions", async () => {
    const r = await validateChallenge(TEST_SECRET, {
      token: "x.y.z",
      solutions: "abc",
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("missing_solutions");
  });

  test("rejects malformed JWT", async () => {
    const r = await validateChallenge(TEST_SECRET, {
      token: "not.a.jwt.token",
      solutions: [1, 2, 3],
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_token");
  });

  test("rejects JWT with tampered payload", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const parts = pub.token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ c: 9999, s: 8, d: 1, exp: Date.now() + 60000 }),
    ).toString("base64url");
    const tampered = `${parts[0]}.${fakePayload}.${parts[2]}`;
    const r = await validateChallenge(TEST_SECRET, {
      token: tampered,
      solutions: [],
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_token");
  });
});

describe("consumeNonce (one-time use)", () => {
  test("calls consumeNonce with sigHex + ttl", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);

    const calls = [];
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      {
        consumeNonce: (sigHex, ttlMs) => {
          calls.push({ sigHex, ttlMs });
          return true;
        },
      },
    );
    expect(r.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(typeof calls[0].sigHex).toBe("string");
    expect(calls[0].sigHex).toMatch(/^[0-9a-f]+$/);
    expect(calls[0].ttlMs).toBeGreaterThan(0);
  });

  test("rejects on replay (returns false)", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);

    const seen = new Set();
    const consume = (sig) => {
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    };

    const r1 = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { consumeNonce: consume },
    );
    expect(r1.success).toBe(true);

    const r2 = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { consumeNonce: consume },
    );
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe("already_redeemed");
  });

  test("propagates store errors", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      {
        consumeNonce: () => {
          throw new Error("redis exploded");
        },
      },
    );
    expect(r.success).toBe(false);
    expect(r.reason).toBe("nonce_store_error");
    expect(r.error).toContain("redis exploded");
  });

  test("supports async consumeNonce", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { consumeNonce: async () => true },
    );
    expect(r.success).toBe(true);
  });
});

describe("signToken (custom redeem token)", () => {
  test("uses signToken when provided", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      scope: "myapp",
    });
    const solutions = await solveChallengeFromPublic(pub);

    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { signToken: ({ scope }) => `custom-${scope}-token` },
    );
    expect(r.success).toBe(true);
    expect(r.token).toBe("custom-myapp-token");
    expect(r.tokenKey).toBeUndefined();
  });

  test("supports async signToken", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
    });
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(
      TEST_SECRET,
      { token: pub.token, solutions },
      { signToken: async () => "async-token" },
    );
    expect(r.success).toBe(true);
    expect(r.token).toBe("async-token");
  });
});
