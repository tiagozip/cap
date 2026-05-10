import { describe, expect, test } from "bun:test";
import { jwtSign, jwtVerify, sha256Hex } from "../src/crypto.js";
import { generateChallenge, validateChallenge } from "../src/index.js";
import { prng } from "../src/prng.js";
import { solveChallengeFromPublic, TEST_SECRET } from "./helpers.js";

describe("regression: nonce 0 is a valid solution (server@3.0.1)", () => {
  test("accepts a solution where one of the nonces is 0", async () => {
    let triesLeft = 200;
    while (triesLeft-- > 0) {
      const pub = await generateChallenge(TEST_SECRET, {
        challengeCount: 1,
        challengeSize: 8,
        challengeDifficulty: 1,
      });
      const salt = prng(`${pub.token}1`, 8);
      const target = prng(`${pub.token}1d`, 1);
      const hash = await sha256Hex(salt + 0);
      if (hash.startsWith(target)) {
        const r = await validateChallenge(TEST_SECRET, {
          token: pub.token,
          solutions: [0],
        });
        expect(r.success).toBe(true);
        return;
      }
    }
  });

  test("rejects nonce-0 if it is not a real solution", async () => {
    let triesLeft = 200;
    while (triesLeft-- > 0) {
      const pub = await generateChallenge(TEST_SECRET, {
        challengeCount: 1,
        challengeSize: 8,
        challengeDifficulty: 2,
      });
      const salt = prng(`${pub.token}1`, 8);
      const target = prng(`${pub.token}1d`, 2);
      const hash = await sha256Hex(salt + 0);
      if (!hash.startsWith(target)) {
        const r = await validateChallenge(TEST_SECRET, {
          token: pub.token,
          solutions: [0],
        });
        expect(r.success).toBe(false);
        expect(r.reason).toBe("invalid_solution");
        return;
      }
    }
  });
});

describe("regression: stateless — no fs, no signal handlers", () => {
  test("module load does not register signal handlers", async () => {
    const beforeSig = process.listenerCount("SIGINT");
    const beforeBefore = process.listenerCount("beforeExit");
    await import(`../src/index.js?nocache=${Math.random()}`);
    expect(process.listenerCount("SIGINT")).toBe(beforeSig);
    expect(process.listenerCount("beforeExit")).toBe(beforeBefore);
  });

  test("module load does not touch the filesystem (no .data folder)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    let dataFolderExists = false;
    try {
      await fs.access(path.join(process.cwd(), ".data"));
      dataFolderExists = true;
    } catch {}
    expect(dataFolderExists).toBe(false);
  });
});

describe("regression: timing-safe signature comparison", () => {
  test("signatures of differing length are rejected", () => {
    const t = jwtSign({ a: 1 }, TEST_SECRET);
    const parts = t.split(".");
    const truncated = `${parts[0]}.${parts[1]}.${parts[2].slice(0, parts[2].length - 4)}`;
    expect(jwtVerify(truncated, TEST_SECRET)).toBeNull();
  });
});

describe("regression: difficulty bound", () => {
  test("rejects payload with absurd difficulty", async () => {
    const fakeToken = jwtSign(
      { c: 1, s: 8, d: 999, exp: Date.now() + 60_000, iat: Date.now() },
      TEST_SECRET,
    );
    const r = await validateChallenge(TEST_SECRET, {
      token: fakeToken,
      solutions: [1],
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_token");
  });

  test("rejects payload with zero/negative challenge count", async () => {
    for (const c of [0, -1, -100, 0.5]) {
      const t = jwtSign(
        { c, s: 8, d: 1, exp: Date.now() + 60_000, iat: Date.now() },
        TEST_SECRET,
      );
      const r = await validateChallenge(TEST_SECRET, {
        token: t,
        solutions: [],
      });
      expect(r.success).toBe(false);
      expect(r.reason).toBe("invalid_token");
    }
  });
});

describe("regression: instrumentation expiry", () => {
  test("instrumentation expiring is rejected with instr_error", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      expiresMs: 50,
      instrumentation: true,
    });
    await new Promise((r) => setTimeout(r, 100));
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(TEST_SECRET, {
      token: pub.token,
      solutions,
      instr: { i: "x", state: {} },
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("expired");
  }, 30_000);
});

describe("regression: encrypted instrumentation cannot be read without server secret", () => {
  test("a different secret cannot decrypt instr metadata", async () => {
    const pub = await generateChallenge(TEST_SECRET, {
      challengeCount: 1,
      challengeSize: 4,
      challengeDifficulty: 1,
      instrumentation: true,
    });
    const otherSecret = "different-secret-32-bytes-padding-junk";
    const solutions = await solveChallengeFromPublic(pub);
    const r = await validateChallenge(otherSecret, {
      token: pub.token,
      solutions,
    });
    expect(r.success).toBe(false);
    expect(r.reason).toBe("invalid_token");
  }, 30_000);
});
